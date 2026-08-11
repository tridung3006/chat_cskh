import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from './config.js';
import { saveIndex } from './search.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function allowedUrl(input) {
  const url = new URL(input, config.websiteUrl);
  url.hash = '';
  if (url.origin !== config.websiteUrl.origin) return null;
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|mp4|mp3|css|js)$/i.test(url.pathname)) return null;
  return url;
}

function splitText(text, size = 1200, overlap = 150, minLength = 80) {
  const out = [];
  for (let i = 0; i < text.length; i += size - overlap) out.push(text.slice(i, i + size).trim());
  return out.filter(x => x.length >= minLength);
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const value = address.toLowerCase();
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:');
}

async function safeExternalUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Extra URL must be public HTTPS');
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(record => isPrivateIp(record.address))) throw new Error('Extra URL resolves to a private address');
  return url;
}

async function fetchExtraPage(input) {
  let url = await safeExternalUrl(input);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, { headers: { 'user-agent': 'WebsiteChatbot/1.0 (+explicit admin URL)', accept: 'text/html,text/plain' }, redirect: 'manual', signal: AbortSignal.timeout(12000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === 3) throw new Error('Too many redirects');
      url = await safeExternalUrl(new URL(response.headers.get('location'), url).href);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    const raw = await response.text();
    if (raw.length > 5_000_000) throw new Error('Page too large');
    if (type.includes('text/html')) {
      const $ = cheerio.load(raw); $('script,style,noscript,svg,nav,footer,form,iframe').remove();
      return { url: url.href, title: $('title').first().text().trim() || url.hostname, text: ($('main,article,[role="main"]').first().text() || $('body').text()).replace(/\s+/g, ' ').trim() };
    }
    if (type.includes('text/plain')) return { url: url.href, title: url.hostname, text: raw.replace(/\s+/g, ' ').trim() };
    throw new Error('Unsupported content type');
  }
}

export async function crawlWebsite() {
  const robotUrl = new URL('/robots.txt', config.websiteUrl);
  let robots = robotsParser(robotUrl.href, '');
  try {
    const response = await fetch(robotUrl, { signal: AbortSignal.timeout(8000) });
    if (response.ok) robots = robotsParser(robotUrl.href, await response.text());
  } catch {}

  const queue = [{ url: config.websiteUrl.href, depth: 0 }];
  const seen = new Set();
  const chunks = [];

  while (queue.length && seen.size < config.maxPages) {
    const item = queue.shift();
    const url = allowedUrl(item.url);
    if (!url || seen.has(url.href) || !robots.isAllowed(url.href, 'WebsiteChatbot')) continue;
    seen.add(url.href);
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'WebsiteChatbot/1.0 (+site content indexer)', accept: 'text/html' },
        redirect: 'follow', signal: AbortSignal.timeout(12000)
      });
      if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) continue;
      const html = await response.text();
      if (html.length > 5_000_000) continue;
      const $ = cheerio.load(html);
      $('script,style,noscript,svg,nav,footer,form,iframe').remove();
      const title = $('title').first().text().trim() || $('h1').first().text().trim() || url.pathname;
      const text = ($('main,article,[role="main"]').first().text() || $('body').text()).replace(/\s+/g, ' ').trim();
      splitText(text).forEach((part, i) => chunks.push({ id: `${url.href}#${i}`, url: url.href, title, text: part }));
      if (item.depth < config.maxDepth) {
        $('a[href]').each((_, a) => {
          const next = allowedUrl($(a).attr('href'));
          if (next && !seen.has(next.href)) queue.push({ url: next.href, depth: item.depth + 1 });
        });
      }
      await sleep(100);
    } catch (error) { console.warn(`Skip ${url.href}: ${error.message}`); }
  }
  for (const input of (config.extraUrls || []).slice(0, 20)) {
    try {
      const page = await fetchExtraPage(input);
      splitText(page.text).forEach((part, i) => chunks.push({ id: `extra:${page.url}#${i}`, url: page.url, title: page.title, text: part }));
    } catch (error) { console.warn(`Skip extra URL ${input}: ${error.message}`); }
  }
  splitText(config.customText || '', 1200, 150, 1).forEach((part, i) => chunks.push({ id: `custom:text#${i}`, url: config.websiteUrl.href, title: 'Kiến thức do quản trị viên cung cấp', text: part }));
  await saveIndex(chunks);
  return { pages: seen.size, chunks: chunks.length };
}
