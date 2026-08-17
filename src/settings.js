import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { firebaseIsEnabled, loadFirebaseKnowledgeFiles, saveFirebaseKnowledgeFiles } from './firebase-store.js';

const file = path.resolve('data/settings.enc');
const legacyKey = crypto.scryptSync(config.adminToken, 'deepseek-chatbot-settings-v1', 32);
const hasSeparateEncryptionKey = config.settingsEncryptionKey !== config.adminToken;
const key = hasSeparateEncryptionKey
  ? crypto.scryptSync(config.settingsEncryptionKey, 'deepseek-chatbot-settings-v2', 32)
  : legacyKey;

function decrypt(packed, encryptionKey) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(packed.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(packed.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(packed.data, 'base64')), decipher.final()]).toString('utf8'));
}

export async function loadSettings() {
  try {
    const packed = JSON.parse(await fs.readFile(file, 'utf8'));
    try { applySettings(decrypt(packed, key)); }
    catch (error) {
      if (!hasSeparateEncryptionKey) throw error;
      const legacy = decrypt(packed, legacyKey);
      applySettings(legacy);
      await saveSettings(legacy);
      console.info('Encrypted settings migrated to SETTINGS_ENCRYPTION_KEY.');
    }
  } catch (error) { if (error.code !== 'ENOENT') console.error('Cannot load encrypted settings:', error.message); }
  if (firebaseIsEnabled()) {
    try {
      const remoteFiles = await loadFirebaseKnowledgeFiles();
      if (remoteFiles.length) config.knowledgeFiles = remoteFiles;
      else if ((config.knowledgeFiles || []).length) await saveFirebaseKnowledgeFiles(config.knowledgeFiles);
    } catch (error) { console.error(`Cannot load Firebase knowledge files: ${error.message}`); }
  }
}

function applySettings(value) {
  if (value.deepseekKey) config.deepseekKey = value.deepseekKey;
  if (value.model) config.model = value.model;
  if (value.websiteUrl) config.websiteUrl = new URL(value.websiteUrl);
  config.crawlEnabled = value.crawlEnabled !== false;
  if (Array.isArray(value.origins)) config.origins = value.origins;
  config.botTitle = value.botTitle || 'Trợ lý tư vấn';
  config.botColor = /^#[0-9a-f]{6}$/i.test(value.botColor || '') ? value.botColor : '#111827';
  config.extraUrls = Array.isArray(value.extraUrls) ? value.extraUrls : [];
  config.customText = value.customText || '';
  config.botInstructions = value.botInstructions || '';
  config.welcomeMessage = value.welcomeMessage || 'Xin chào! Tôi có thể giúp gì cho bạn?';
  config.commands = Array.isArray(value.commands) ? value.commands : [];
  config.zaloUrl = value.zaloUrl || '';
  config.messengerUrl = value.messengerUrl || '';
  config.contactVisibility = {
    zalo: value.contactVisibility?.zalo !== false,
    messenger: value.contactVisibility?.messenger !== false,
    assistant: value.contactVisibility?.assistant !== false
  };
  config.knowledgeFiles = Array.isArray(value.knowledgeFiles) ? value.knowledgeFiles : [];
  config.iconVersion = value.iconVersion || 0;
  config.iconMime = value.iconMime || '';
  config.contactIcons = value.contactIcons && typeof value.contactIcons === 'object' ? value.contactIcons : {};
}

export async function saveSettings(value) {
  const current = getPrivateSettings();
  const next = {
    deepseekKey: value.deepseekKey || current.deepseekKey,
    model: value.model || current.model,
    websiteUrl: value.websiteUrl || current.websiteUrl,
    crawlEnabled: value.crawlEnabled ?? current.crawlEnabled,
    origins: value.origins || current.origins,
    botTitle: value.botTitle || current.botTitle,
    botColor: value.botColor || current.botColor,
    extraUrls: value.extraUrls ?? current.extraUrls,
    customText: value.customText ?? current.customText,
    botInstructions: value.botInstructions ?? current.botInstructions,
    welcomeMessage: value.welcomeMessage ?? current.welcomeMessage,
    commands: value.commands ?? current.commands,
    zaloUrl: value.zaloUrl ?? current.zaloUrl,
    messengerUrl: value.messengerUrl ?? current.messengerUrl,
    contactVisibility: value.contactVisibility ?? current.contactVisibility,
    knowledgeFiles: value.knowledgeFiles ?? current.knowledgeFiles,
    iconVersion: value.iconVersion ?? current.iconVersion,
    iconMime: value.iconMime ?? current.iconMime,
    contactIcons: value.contactIcons ?? current.contactIcons
  };
  if (firebaseIsEnabled() && Object.hasOwn(value, 'knowledgeFiles')) await saveFirebaseKnowledgeFiles(next.knowledgeFiles);
  applySettings(next);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(next), 'utf8'), cipher.final()]);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') }), { mode: 0o600 });
  await fs.rename(temp, file);
}

export function getPrivateSettings() {
  return { deepseekKey: config.deepseekKey, model: config.model, websiteUrl: config.websiteUrl.href, crawlEnabled: config.crawlEnabled !== false, origins: config.origins, botTitle: config.botTitle || 'Trợ lý tư vấn', botColor: config.botColor || '#111827', extraUrls: config.extraUrls || [], customText: config.customText || '', botInstructions: config.botInstructions || '', welcomeMessage: config.welcomeMessage || 'Xin chào! Tôi có thể giúp gì cho bạn?', commands: config.commands || [], zaloUrl: config.zaloUrl || '', messengerUrl: config.messengerUrl || '', contactVisibility: config.contactVisibility || { zalo: true, messenger: true, assistant: true }, knowledgeFiles: config.knowledgeFiles || [], iconVersion: config.iconVersion || 0, iconMime: config.iconMime || '', contactIcons: config.contactIcons || {} };
}

export function getPublicAdminSettings() {
  const s = getPrivateSettings();
  return { ...s, deepseekKey: '', knowledgeFiles: s.knowledgeFiles.map(file => ({ name: file.name, characters: file.text.length })), hasApiKey: Boolean(s.deepseekKey), apiKeyHint: s.deepseekKey ? `${s.deepseekKey.slice(0, 3)}••••${s.deepseekKey.slice(-4)}` : '', hasIcon: Boolean(s.iconVersion), contactIconStatus: Object.fromEntries(Object.entries(s.contactIcons).map(([type, value]) => [type, Boolean(value?.version)])) };
}
