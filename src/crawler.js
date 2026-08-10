import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
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

function splitText(text, size = 1200, overlap = 150) {
  const out = [];
  for (let i = 0; i < text.length; i += size - overlap) out.push(text.slice(i, i + size).trim());
  return out.filter(x => x.length >= 80);
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
  await saveIndex(chunks);
  return { pages: seen.size, chunks: chunks.length };
}
