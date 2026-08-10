import 'dotenv/config';

const required = ['DEEPSEEK_API_KEY', 'WEBSITE_URL', 'ALLOWED_ORIGINS', 'ADMIN_TOKEN'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}
if (process.env.ADMIN_TOKEN.length < 32) throw new Error('ADMIN_TOKEN must be at least 32 characters');

export const config = {
  port: Number(process.env.PORT || 3000),
  deepseekKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  websiteUrl: new URL(process.env.WEBSITE_URL),
  origins: process.env.ALLOWED_ORIGINS.split(',').map(x => x.trim()).filter(Boolean),
  adminToken: process.env.ADMIN_TOKEN,
  maxPages: Math.min(Number(process.env.MAX_PAGES || 200), 2000),
  maxDepth: Math.min(Number(process.env.MAX_CRAWL_DEPTH || 4), 10),
  refreshHours: Number(process.env.INDEX_REFRESH_HOURS || 24),
  trustProxy: process.env.TRUST_PROXY === 'true'
};
