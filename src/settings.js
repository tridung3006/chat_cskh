import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const file = path.resolve('data/settings.enc');
const key = crypto.scryptSync(config.adminToken, 'deepseek-chatbot-settings-v1', 32);

export async function loadSettings() {
  try {
    const packed = JSON.parse(await fs.readFile(file, 'utf8'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(packed.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(packed.tag, 'base64'));
    const plain = Buffer.concat([decipher.update(Buffer.from(packed.data, 'base64')), decipher.final()]);
    applySettings(JSON.parse(plain.toString('utf8')));
  } catch (error) { if (error.code !== 'ENOENT') console.error('Cannot load encrypted settings:', error.message); }
}

function applySettings(value) {
  if (value.deepseekKey) config.deepseekKey = value.deepseekKey;
  if (value.model) config.model = value.model;
  if (value.websiteUrl) config.websiteUrl = new URL(value.websiteUrl);
  if (Array.isArray(value.origins)) config.origins = value.origins;
  config.botTitle = value.botTitle || 'Trợ lý tư vấn';
  config.botColor = /^#[0-9a-f]{6}$/i.test(value.botColor || '') ? value.botColor : '#111827';
}

export async function saveSettings(value) {
  const current = getPrivateSettings();
  const next = {
    deepseekKey: value.deepseekKey || current.deepseekKey,
    model: value.model || current.model,
    websiteUrl: value.websiteUrl || current.websiteUrl,
    origins: value.origins || current.origins,
    botTitle: value.botTitle || current.botTitle,
    botColor: value.botColor || current.botColor
  };
  applySettings(next);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(next), 'utf8'), cipher.final()]);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') }), { mode: 0o600 });
}

export function getPrivateSettings() {
  return { deepseekKey: config.deepseekKey, model: config.model, websiteUrl: config.websiteUrl.href, origins: config.origins, botTitle: config.botTitle || 'Trợ lý tư vấn', botColor: config.botColor || '#111827' };
}

export function getPublicAdminSettings() {
  const s = getPrivateSettings();
  return { ...s, deepseekKey: '', hasApiKey: Boolean(s.deepseekKey), apiKeyHint: s.deepseekKey ? `${s.deepseekKey.slice(0, 3)}••••${s.deepseekKey.slice(-4)}` : '' };
}
