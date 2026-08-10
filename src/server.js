import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { askDeepSeek } from './deepseek.js';
import { crawlWebsite } from './crawler.js';
import { indexSize, loadIndex, search } from './search.js';
import { getPublicAdminSettings, loadSettings, saveSettings } from './settings.js';

const app = express();
const reindexState = { status: 'idle', startedAt: null, finishedAt: null, result: null, error: null };
if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json({ limit: '20kb' }));

const corsCheck = cors({ origin(origin, cb) {
  if (!origin || config.origins.includes(origin)) return cb(null, true);
  cb(new Error('Origin not allowed'));
}, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] });

app.use('/api', corsCheck);
app.use('/api/chat', rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: true, legacyHeaders: false }));
app.use('/widget.js', cors({ origin: '*' }));
app.use(express.static('public', { maxAge: '1h', setHeaders(res, filePath) {
  if (filePath.endsWith('widget.js')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
} }));

function isAdmin(req) {
  const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return supplied.length === config.adminToken.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(config.adminToken));
}

app.get('/api/health', (_req, res) => res.json({ ok: true, indexedChunks: indexSize() }));
app.get('/api/widget-config', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ title: config.botTitle || 'Trợ lý tư vấn', color: config.botColor || '#111827' });
});
app.get('/api/admin/settings', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sai mã quản trị' });
  res.json(getPublicAdminSettings());
});
app.post('/api/admin/settings', async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Sai mã quản trị' });
  try {
    const body = req.body || {};
    const websiteUrl = new URL(body.websiteUrl);
    if (!['https:', 'http:'].includes(websiteUrl.protocol)) throw new Error('Invalid website URL');
    const origins = [...new Set([websiteUrl.origin, ...String(body.origins || '').split(',').map(x => x.trim()).filter(Boolean).map(x => new URL(x).origin)])];
    if (!origins.length || origins.length > 20) throw new Error('Invalid origins');
    if (body.deepseekKey && (!String(body.deepseekKey).startsWith('sk-') || String(body.deepseekKey).length > 200)) throw new Error('Invalid API key');
    if (!/^#[0-9a-f]{6}$/i.test(body.botColor)) throw new Error('Invalid color');
    await saveSettings({ deepseekKey: String(body.deepseekKey || ''), model: String(body.model || 'deepseek-chat').slice(0, 80), websiteUrl: websiteUrl.href, origins, botTitle: String(body.botTitle || 'Trợ lý tư vấn').slice(0, 80), botColor: body.botColor });
    res.json({ ok: true, settings: getPublicAdminSettings() });
  } catch { res.status(400).json({ error: 'Cấu hình không hợp lệ' }); }
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

await loadSettings();
await loadIndex();
app.listen(config.port, () => console.log(`Chatbot listening on :${config.port}; ${indexSize()} chunks loaded`));
if (!indexSize()) crawlWebsite().then(x => console.log('Initial index:', x)).catch(console.error);
setInterval(() => crawlWebsite().catch(console.error), config.refreshHours * 3_600_000).unref();
