import crypto from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { config } from './config.js';

let database;

function credentials() {
  if (!config.firebaseServiceAccountBase64) return undefined;
  let parsed;
  try { parsed = JSON.parse(Buffer.from(config.firebaseServiceAccountBase64, 'base64').toString('utf8')); }
  catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is invalid'); }
  if (!parsed.client_email || !parsed.private_key) throw new Error('Firebase service account is incomplete');
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function db() {
  if (!config.firebaseEnabled) return null;
  database ||= new Firestore({ projectId: config.firebaseProjectId, credentials: credentials(), ignoreUndefinedProperties: true });
  return database;
}

const botRef = () => db().collection('ragBots').doc(config.firebaseBotId);
const chunkId = chunk => crypto.createHash('sha256').update(chunk.id).digest('hex');

export function firebaseIsEnabled() { return config.firebaseEnabled; }

export async function loadFirebaseChunks() {
  if (!db()) return null;
  const meta = await botRef().get();
  const generation = meta.data()?.activeGeneration;
  if (!generation) return [];
  const snapshot = await botRef().collection('chunks').where('generation', '==', generation).get();
  return snapshot.docs.map(doc => {
    const { generation: _generation, ...chunk } = doc.data();
    return chunk;
  });
}

export async function saveFirebaseChunks(chunks) {
  if (!db()) return false;
  const generation = crypto.randomUUID();
  const collection = botRef().collection('chunks');
  for (let offset = 0; offset < chunks.length; offset += 450) {
    const batch = db().batch();
    for (const chunk of chunks.slice(offset, offset + 450)) batch.set(collection.doc(`${generation}_${chunkId(chunk)}`), { ...chunk, generation });
    await batch.commit();
  }
  await botRef().set({ activeGeneration: generation, chunkCount: chunks.length, indexedAt: new Date() }, { merge: true });

  try {
    const stale = await collection.where('generation', '!=', generation).get();
    for (let offset = 0; offset < stale.docs.length; offset += 450) {
      const batch = db().batch();
      for (const doc of stale.docs.slice(offset, offset + 450)) batch.delete(doc.ref);
      await batch.commit();
    }
  } catch (error) { console.warn(`Firebase stale generation cleanup failed: ${error.message}`); }
  return true;
}

export async function loadFirebaseKnowledgeFiles() {
  if (!db()) return null;
  const snapshot = await botRef().collection('knowledgeFiles').get();
  return snapshot.docs.map(doc => ({ name: doc.data().name, text: doc.data().text }));
}

export async function saveFirebaseKnowledgeFiles(files) {
  if (!db()) return false;
  const collection = botRef().collection('knowledgeFiles');
  const existing = await collection.get();
  const wanted = new Set(files.map(file => crypto.createHash('sha256').update(file.name).digest('hex')));
  const operations = [
    ...files.map(file => ({ type: 'set', ref: collection.doc(crypto.createHash('sha256').update(file.name).digest('hex')), data: { name: file.name, text: file.text, updatedAt: new Date() } })),
    ...existing.docs.filter(doc => !wanted.has(doc.id)).map(doc => ({ type: 'delete', ref: doc.ref }))
  ];
  for (let offset = 0; offset < operations.length; offset += 450) {
    const batch = db().batch();
    for (const operation of operations.slice(offset, offset + 450)) operation.type === 'set' ? batch.set(operation.ref, operation.data) : batch.delete(operation.ref);
    await batch.commit();
  }
  return true;
}

export async function firebaseStatus() {
  if (!db()) return { enabled: false };
  const meta = await botRef().get();
  return { enabled: true, connected: true, projectId: config.firebaseProjectId, botId: config.firebaseBotId, chunkCount: meta.data()?.chunkCount || 0 };
}
