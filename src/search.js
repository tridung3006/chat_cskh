import fs from 'node:fs/promises';
import path from 'node:path';

const INDEX_FILE = path.resolve('data/index.json');
let chunks = [];

export function tokenize(text) {
  return [...new Set(text.toLocaleLowerCase('vi').normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu) || [])];
}

export async function loadIndex() {
  try { chunks = JSON.parse(await fs.readFile(INDEX_FILE, 'utf8')).chunks || []; }
  catch (e) { if (e.code !== 'ENOENT') throw e; chunks = []; }
  return chunks.length;
}

export async function saveIndex(nextChunks) {
  await fs.mkdir(path.dirname(INDEX_FILE), { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), chunks: nextChunks }), 'utf8');
  chunks = nextChunks;
}

export function search(query, limit = 6) {
  const terms = tokenize(query);
  if (!terms.length) return [];
  return chunks.map(chunk => {
    const haystack = `${chunk.title} ${chunk.text}`.toLocaleLowerCase('vi');
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0) + (chunk.title.toLocaleLowerCase('vi').includes(term) ? 2 : 0), 0);
    return { ...chunk, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function indexSize() { return chunks.length; }
