import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
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
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 0) ||
      (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  const value = address.toLowerCase();
  if (value.startsWith('::ffff:')) return isPrivateIp(value.slice(7));
  return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') ||
    value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb') || value.startsWith('ff');
}

async function safeExternalUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Extra URL must be public HTTPS');
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(record => isPrivateIp(record.address))) throw new Error('Extra URL resolves to a private address');
  return { url, record: records[0] };
}

async function fetchPublicText(input, { accept = 'text/html', maxBytes = 5_000_000, sameOrigin = null } = {}) {
  let target = input;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const { url, record } = await safeExternalUrl(target);
    if (sameOrigin && url.origin !== sameOrigin) throw new Error('Cross-origin redirect blocked');
    const response = await new Promise((resolve, reject) => {
      const request = https.get(url, {
        headers: { 'user-agent': 'WebsiteChatbot/1.0 (+site content indexer)', accept },
        servername: url.hostname,
        lookup: (_hostname, options, callback) => options?.all
          ? callback(null, [record])
          : callback(null, record.address, record.family)
      }, res => {
        const chunks = []; let total = 0;
        res.on('data', chunk => {
          total += chunk.length;
          if (total > maxBytes) { request.destroy(new Error('Response body too large')); return; }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8'), url: url.href }));
      });
      request.setTimeout(12_000, () => request.destroy(new Error('Request timeout')));
      request.on('error', reject);
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === 3 || !response.headers.location) throw new Error('Too many or invalid redirects');
      target = new URL(response.headers.location, url).href;
      continue;
    }
    return response;
  }
  throw new Error('Too many redirects');
}

async function fetchExtraPage(input) {
    const response = await fetchPublicText(input, { accept: 'text/html,text/plain' });
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
    const type = response.headers['content-type'] || '';
    const raw = response.text;
    const url = new URL(response.url);
    if (type.includes('text/html')) {
      const $ = cheerio.load(raw); $('script,style,noscript,svg,nav,footer,form,iframe').remove();
      return { url: url.href, title: $('title').first().text().trim() || url.hostname, text: ($('main,article,[role="main"]').first().text() || $('body').text()).replace(/\s+/g, ' ').trim() };
    }
    if (type.includes('text/plain')) return { url: url.href, title: url.hostname, text: raw.replace(/\s+/g, ' ').trim() };
    throw new Error('Unsupported content type');
}

export async function crawlWebsite() {
  const robotUrl = new URL('/robots.txt', config.websiteUrl);
  let robots = robotsParser(robotUrl.href, '');
  try {
    if (!config.crawlEnabled) throw new Error('Website crawling disabled');
    const response = await fetchPublicText(robotUrl.href, { accept: 'text/plain', maxBytes: 512_000, sameOrigin: config.websiteUrl.origin });
    if (response.status >= 200 && response.status < 300) robots = robotsParser(robotUrl.href, response.text);
  } catch {}

  const queue = config.crawlEnabled ? [{ url: config.websiteUrl.href, depth: 0 }] : [];
  const seen = new Set();
  const chunks = [];

  while (queue.length && seen.size < config.maxPages) {
    const item = queue.shift();
    const url = allowedUrl(item.url);
    if (!url || seen.has(url.href) || !robots.isAllowed(url.href, 'WebsiteChatbot')) continue;
    seen.add(url.href);
    try {
      const response = await fetchPublicText(url.href, { accept: 'text/html', sameOrigin: config.websiteUrl.origin });
      if (response.status < 200 || response.status >= 300 || !(response.headers['content-type'] || '').includes('text/html')) continue;
      const html = response.text;
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
  for (const file of (config.knowledgeFiles || [])) {
    splitText(file.text || '', 1200, 150, 1).forEach((part, i) => chunks.push({ id: `custom:file:${file.name}#${i}`, url: config.websiteUrl.href, title: `Tệp kiến thức: ${file.name}`, text: part }));
  }
  await saveIndex(chunks);
  return { pages: seen.size, chunks: chunks.length };
}
