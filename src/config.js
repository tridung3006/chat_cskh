import 'dotenv/config';

const required = ['DEEPSEEK_API_KEY', 'WEBSITE_URL', 'ALLOWED_ORIGINS', 'ADMIN_TOKEN'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}
if (process.env.ADMIN_TOKEN.length < 32) throw new Error('ADMIN_TOKEN must be at least 32 characters');
if (process.env.SETTINGS_ENCRYPTION_KEY && process.env.SETTINGS_ENCRYPTION_KEY.length < 32) throw new Error('SETTINGS_ENCRYPTION_KEY must be at least 32 characters');
const configuredWebsiteUrl = new URL(process.env.WEBSITE_URL);
if (configuredWebsiteUrl.protocol !== 'https:' || configuredWebsiteUrl.username || configuredWebsiteUrl.password || configuredWebsiteUrl.port) throw new Error('WEBSITE_URL must be a public HTTPS URL without credentials or a custom port');
const firebaseEnabled = process.env.FIREBASE_ENABLED === 'true';
if (firebaseEnabled && !process.env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID is required when FIREBASE_ENABLED=true');
if (firebaseEnabled && !/^[a-zA-Z0-9_-]{1,80}$/.test(process.env.FIREBASE_BOT_ID || 'default')) throw new Error('FIREBASE_BOT_ID is invalid');

export const config = {
  port: Number(process.env.PORT || 3000),
  deepseekKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  websiteUrl: configuredWebsiteUrl,
  origins: process.env.ALLOWED_ORIGINS.split(',').map(x => x.trim()).filter(Boolean),
  adminToken: process.env.ADMIN_TOKEN,
  settingsEncryptionKey: process.env.SETTINGS_ENCRYPTION_KEY || process.env.ADMIN_TOKEN,
  maxPages: Math.min(Number(process.env.MAX_PAGES || 200), 2000),
  maxDepth: Math.min(Number(process.env.MAX_CRAWL_DEPTH || 4), 10),
  refreshHours: Number(process.env.INDEX_REFRESH_HOURS || 24),
  trustProxy: process.env.TRUST_PROXY === 'true',
  chatRateLimit: Math.max(1, Math.min(Number(process.env.CHAT_RATE_LIMIT || 15), 100)),
  adminRateLimit: Math.max(1, Math.min(Number(process.env.ADMIN_RATE_LIMIT || 10), 60)),
  adminAllowedIps: String(process.env.ADMIN_ALLOWED_IPS || '').split(',').map(value => value.trim()).filter(Boolean),
  firebaseEnabled,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseBotId: process.env.FIREBASE_BOT_ID || 'default',
  firebaseServiceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || ''
};

if (!process.env.SETTINGS_ENCRYPTION_KEY) console.warn('SECURITY WARNING: SETTINGS_ENCRYPTION_KEY is missing; using legacy ADMIN_TOKEN-derived encryption key.');
