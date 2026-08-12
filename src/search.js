import fs from 'node:fs/promises';
import path from 'node:path';
import { firebaseIsEnabled, loadFirebaseChunks, saveFirebaseChunks } from './firebase-store.js';

const INDEX_FILE = path.resolve('data/index.json');
let chunks = [];

export function tokenize(text) {
  return [...new Set(text.toLocaleLowerCase('vi').normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu) || [])];
}

export async function loadIndex() {
  let localChunks = [];
  try { localChunks = JSON.parse(await fs.readFile(INDEX_FILE, 'utf8')).chunks || []; }
  catch (e) { if (e.code !== 'ENOENT') throw e; chunks = []; }
  if (firebaseIsEnabled()) {
    try {
      const remoteChunks = await loadFirebaseChunks();
      if (remoteChunks.length) chunks = remoteChunks;
      else if (localChunks.length) { await saveFirebaseChunks(localChunks); chunks = localChunks; }
      else chunks = [];
    } catch (error) {
      console.error(`Cannot load Firebase RAG index: ${error.message}`);
      chunks = localChunks;
    }
  } else chunks = localChunks;
  return chunks.length;
}

export async function saveIndex(nextChunks) {
  if (firebaseIsEnabled()) await saveFirebaseChunks(nextChunks);
  await fs.mkdir(path.dirname(INDEX_FILE), { recursive: true });
  const temp = `${INDEX_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify({ updatedAt: new Date().toISOString(), chunks: nextChunks }), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temp, INDEX_FILE);
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
