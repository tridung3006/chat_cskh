import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Worker } from 'node:worker_threads';
import { config } from './config.js';
import { askDeepSeek } from './deepseek.js';
import { crawlWebsite } from './crawler.js';
import { indexSize, loadIndex, search } from './search.js';
import { getPublicAdminSettings, loadSettings, saveSettings } from './settings.js';
import { firebaseStatus } from './firebase-store.js';

const app = express();
const reindexState = { status: 'idle', startedAt: null, finishedAt: null, result: null, error: null };
if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((req, res, next) => {
  const incoming = String(req.headers['x-request-id'] || '');
  req.requestId = /^[a-zA-Z0-9._-]{8,80}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});
app.use(express.json({ limit: '256kb' }));

const corsCheck = cors({ origin(origin, cb) {
  if (!origin || config.origins.includes(origin)) return cb(null, true);
  cb(new Error('Origin not allowed'));
}, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] });

app.use('/api', corsCheck);
const jsonRateLimit = options => rateLimit({ windowMs: 60_000, standardHeaders: true, legacyHeaders: false, handler: (_req, res) => res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }), ...options });
app.use('/api/chat', jsonRateLimit({ limit: config.chatRateLimit }));
app.use('/widget.js', cors({ origin: '*' }));
app.use(express.static('public', { maxAge: '1h', setHeaders(res, filePath) {
  if (filePath.endsWith('widget.js')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
} }));

function isAdmin(req) {
  const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(config.adminToken);
  return suppliedBytes.length === expectedBytes.length && crypto.timingSafeEqual(suppliedBytes, expectedBytes);
}

const adminAuthLimit = jsonRateLimit({ limit: config.adminRateLimit, skipSuccessfulRequests: true });
const adminOperationLimit = jsonRateLimit({ limit: 60 });
app.use('/api/admin', adminAuthLimit, adminOperationLimit, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (config.adminAllowedIps.length && !config.adminAllowedIps.includes(req.ip)) return res.status(403).json({ error: 'IP quản trị không được phép' });
  if (!isAdmin(req)) {
    console.warn(JSON.stringify({ event: 'admin_auth_failed', requestId: req.requestId, ip: req.ip, at: new Date().toISOString() }));
    return res.status(401).json({ error: 'Thông tin đăng nhập không hợp lệ' });
  }
  if (req.method !== 'GET') res.once('finish', () => console.info(JSON.stringify({ event: 'admin_action', requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, ip: req.ip, at: new Date().toISOString() })));
  next();
});

function parseDocumentInWorker(ext, buffer) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./file-parser-worker.js', import.meta.url), {
      workerData: { ext, data: buffer },
      resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 }
    });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('File parser timeout')); }, 10_000);
    worker.once('message', result => { clearTimeout(timer); worker.terminate(); result.error ? reject(new Error(result.error)) : resolve(result.text); });
    worker.once('error', error => { clearTimeout(timer); reject(error); });
  });
}

app.get('/api/health', (_req, res) => res.json({ ok: true, indexedChunks: indexSize(), persistentRag: config.firebaseEnabled ? 'firebase' : 'local' }));
const contactIconTypes = new Set(['launcher', 'zalo', 'messenger']);
const imageSignatures = { 'image/png': [0x89,0x50,0x4e,0x47], 'image/jpeg': [0xff,0xd8,0xff], 'image/gif': [0x47,0x49,0x46,0x38], 'image/webp': [0x52,0x49,0x46,0x46] };
function validImageUpload(body, mime) {
  const signature = imageSignatures[mime];
  const validWebp = mime !== 'image/webp' || body?.subarray(8, 12).toString('ascii') === 'WEBP';
  return Buffer.isBuffer(body) && body.length && signature && signature.every((byte, index) => body[index] === byte) && validWebp;
}

app.get('/api/widget-config', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const contactIconUrls = Object.fromEntries([...contactIconTypes].map(type => [type, config.contactIcons?.[type]?.version ? `/api/contact-icon/${type}?v=${config.contactIcons[type].version}` : '']));
  res.json({ title: config.botTitle || 'Trợ lý tư vấn', color: config.botColor || '#111827', welcomeMessage: config.welcomeMessage || 'Xin chào! Tôi có thể giúp gì cho bạn?', commands: config.commands || [], zaloUrl: config.zaloUrl || '', messengerUrl: config.messengerUrl || '', contactVisibility: config.contactVisibility || { zalo: true, messenger: true, assistant: true }, contactIconUrls, iconUrl: config.iconVersion ? `/api/bot-icon?v=${config.iconVersion}` : '' });
});
app.get('/api/bot-icon', async (_req, res) => {
  if (!config.iconVersion) return res.status(404).end();
  try { res.set({ 'Content-Type': config.iconMime || 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' }); res.send(await fs.readFile(path.resolve('data/bot-icon.bin'))); }
  catch { res.status(404).end(); }
});
app.get('/api/contact-icon/:type', async (req, res) => {
  const type = String(req.params.type || '');
  const metadata = config.contactIcons?.[type];
  if (!contactIconTypes.has(type) || !metadata?.version) return res.status(404).end();
  try { res.set({ 'Content-Type': metadata.mime || 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' }); res.send(await fs.readFile(path.resolve(`data/contact-icon-${type}.bin`))); }
  catch { res.status(404).end(); }
});
app.get('/api/admin/settings', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sai mã quản trị' });
  res.json(getPublicAdminSettings());
});
app.get('/api/admin/firebase-status', async (_req, res) => {
  try { res.json(await firebaseStatus()); }
  catch (error) { res.status(503).json({ enabled: config.firebaseEnabled, connected: false, error: 'Không thể kết nối Firebase' }); }
});
app.post('/api/admin/settings', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sai mã quản trị' });
  try {
    const body = req.body || {};
    const websiteUrl = new URL(body.websiteUrl);
    if (websiteUrl.protocol !== 'https:' || websiteUrl.username || websiteUrl.password || websiteUrl.port) throw new Error('Invalid website URL');
    const origins = [...new Set([websiteUrl.origin, ...String(body.origins || '').split(',').map(x => x.trim()).filter(Boolean).map(x => new URL(x).origin)])];
    if (!origins.length || origins.length > 20) throw new Error('Invalid origins');
    if (body.deepseekKey && (!String(body.deepseekKey).startsWith('sk-') || String(body.deepseekKey).length > 200)) throw new Error('Invalid API key');
    if (!/^#[0-9a-f]{6}$/i.test(body.botColor)) throw new Error('Invalid color');
    const extraUrls = String(body.extraUrls || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (extraUrls.length > 20 || extraUrls.some(value => { try { return new URL(value).protocol !== 'https:'; } catch { return true; } })) throw new Error('Invalid extra URLs');
    const commands = String(body.commands || '').split(/\r?\n/).map(line => { const separator = line.indexOf('|'); if (separator < 1) return null; const label = line.slice(0, separator).trim(); const url = line.slice(separator + 1).trim(); try { const parsed = new URL(url); return parsed.protocol === 'https:' && label ? { label: label.slice(0, 60), url: parsed.href } : null; } catch { return null; } }).filter(Boolean);
    if (commands.length > 10) throw new Error('Too many commands');
    const contactUrl = value => { if (!value) return ''; const parsed = new URL(String(value)); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid contact URL'); return parsed.href; };
    await saveSettings({ deepseekKey: String(body.deepseekKey || ''), model: String(body.model || 'deepseek-chat').slice(0, 80), websiteUrl: websiteUrl.href, crawlEnabled: body.crawlEnabled !== false, origins, botTitle: String(body.botTitle || 'Trợ lý tư vấn').slice(0, 80), botColor: body.botColor, extraUrls, customText: String(body.customText || '').slice(0, 100_000), botInstructions: String(body.botInstructions || '').slice(0, 10_000), welcomeMessage: String(body.welcomeMessage || '').slice(0, 500), commands, zaloUrl: contactUrl(body.zaloUrl), messengerUrl: contactUrl(body.messengerUrl), contactVisibility: { zalo: body.showZalo !== false, messenger: body.showMessenger !== false, assistant: body.showAssistant !== false } });
    res.json({ ok: true, settings: getPublicAdminSettings() });
  } catch { res.status(400).json({ error: 'Cấu hình không hợp lệ' }); }
});
app.post('/api/admin/icon', express.raw({ type: 'application/octet-stream', limit: '2mb' }), async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const mime = String(req.headers['x-file-type'] || '');
  if (!validImageUpload(req.body, mime)) return res.status(400).json({ error: 'Chỉ chấp nhận PNG, JPEG, WebP hoặc GIF hợp lệ, tối đa 2 MB.' });
  await fs.mkdir(path.resolve('data'), { recursive: true });
  await fs.writeFile(path.resolve('data/bot-icon.bin'), req.body, { mode: 0o600 });
  const iconVersion = Date.now(); await saveSettings({ iconVersion, iconMime: mime });
  res.json({ ok: true, iconUrl: `/api/bot-icon?v=${iconVersion}` });
});
app.post('/api/admin/contact-icon/:type', express.raw({ type: 'application/octet-stream', limit: '2mb' }), async (req, res) => {
  const type = String(req.params.type || '');
  const mime = String(req.headers['x-file-type'] || '');
  if (!contactIconTypes.has(type)) return res.status(404).json({ error: 'Loại icon không hợp lệ.' });
  if (!validImageUpload(req.body, mime)) return res.status(400).json({ error: 'Chỉ chấp nhận PNG, JPEG, WebP hoặc GIF hợp lệ, tối đa 2 MB.' });
  await fs.mkdir(path.resolve('data'), { recursive: true });
  await fs.writeFile(path.resolve(`data/contact-icon-${type}.bin`), req.body, { mode: 0o600 });
  const version = Date.now();
  await saveSettings({ contactIcons: { ...(config.contactIcons || {}), [type]: { version, mime } } });
  res.json({ ok: true, iconUrl: `/api/contact-icon/${type}?v=${version}` });
});
app.post('/api/admin/knowledge-file', express.raw({ type: 'application/octet-stream', limit: '5mb' }), async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const name = path.basename(decodeURIComponent(String(req.headers['x-file-name'] || ''))).slice(0, 120);
    const ext = path.extname(name).toLowerCase();
    if (!name || !Buffer.isBuffer(req.body) || !req.body.length || !['.txt','.md','.csv','.json','.pdf','.docx'].includes(ext)) throw new Error('Unsupported file');
    let text;
    if (ext === '.pdf' || ext === '.docx') text = await parseDocumentInWorker(ext, req.body);
    else text = req.body.toString('utf8');
    text = text.replace(/\0/g, '').trim().slice(0, 200_000);
    if (!text) throw new Error('Empty file');
    const files = [...(config.knowledgeFiles || []).filter(file => file.name !== name), { name, text }];
    if (files.length > 10 || files.reduce((sum, file) => sum + file.text.length, 0) > 500_000) throw new Error('Knowledge file limit exceeded');
    await saveSettings({ knowledgeFiles: files });
    res.json({ ok: true, file: { name, characters: text.length } });
  } catch { res.status(400).json({ error: 'Tệp không hợp lệ hoặc vượt giới hạn. Hỗ trợ TXT, MD, CSV, JSON, PDF, DOCX; tối đa 5 MB.' }); }
});
app.delete('/api/admin/knowledge-file', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  const name = String(req.body?.name || '');
  await saveSettings({ knowledgeFiles: (config.knowledgeFiles || []).filter(file => file.name !== name) });
  res.json({ ok: true });
});
app.post('/api/chat', async (req, res) => {
  try {
    const question = typeof req.body.question === 'string' ? req.body.question.trim() : '';
    const history = Array.isArray(req.body.history) ? req.body.history.filter(x => ['user', 'assistant'].includes(x?.role) && typeof x.content === 'string').slice(-6).map(x => ({ role: x.role, content: x.content.slice(0, 1500) })) : [];
    if (question.length < 2 || question.length > 1000) return res.status(400).json({ error: 'Câu hỏi phải từ 2 đến 1000 ký tự.' });
    const results = search(question);
    const answer = await askDeepSeek(question, results, history);
    res.json({ answer, sources: [...new Map(results.map(x => [x.url, { title: x.title, url: x.url }])).values()].slice(0, 4) });
  } catch (error) {
    console.error(error.message);
    res.status(502).json({ error: 'Dịch vụ AI đang bận. Vui lòng thử lại sau.' });
  }
});

app.post('/api/admin/reindex', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (reindexState.status === 'running') return res.status(409).json({ error: 'Đang có một tác vụ lập chỉ mục chạy', state: reindexState });
  Object.assign(reindexState, { status: 'running', startedAt: new Date().toISOString(), finishedAt: null, result: null, error: null });
  res.status(202).json({ ok: true, state: reindexState });
  crawlWebsite().then(result => {
    Object.assign(reindexState, { status: 'completed', finishedAt: new Date().toISOString(), result });
  }).catch(error => {
    console.error(error);
    Object.assign(reindexState, { status: 'failed', finishedAt: new Date().toISOString(), error: 'Lập chỉ mục thất bại. Kiểm tra log server.' });
  });
});
app.get('/api/admin/reindex-status', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });
  res.set('Cache-Control', 'no-store');
  res.json(reindexState);
});
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint không tồn tại.', requestId: req.requestId }));
app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'File hoặc dữ liệu upload vượt giới hạn cho phép.' });
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) return res.status(400).json({ error: 'JSON không hợp lệ.' });
  const status = error?.message === 'Origin not allowed' ? 403 : 500;
  const requestId = req.requestId || crypto.randomUUID();
  console.error(JSON.stringify({ event: 'request_error', requestId, status, message: error?.message || 'Unknown error' }));
  if (res.headersSent) return next(error);
  res.status(status).json({ error: status === 403 ? 'Origin không được phép.' : 'Đã xảy ra lỗi máy chủ.', requestId });
});

await loadSettings();
await loadIndex();
app.listen(config.port, () => console.log(`Chatbot listening on :${config.port}; ${indexSize()} chunks loaded`));
if (!indexSize()) crawlWebsite().then(x => console.log('Initial index:', x)).catch(console.error);
setInterval(() => crawlWebsite().catch(console.error), config.refreshHours * 3_600_000).unref();
