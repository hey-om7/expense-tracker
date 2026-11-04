const crypto = require('crypto');

// AES-256-GCM for secrets at rest (Gmail refresh tokens, users' AI API keys).
// GMAIL_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes): openssl rand -hex 32
const getKey = () => {
  const hex = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY must be 64 hex characters');
  }
  return Buffer.from(hex, 'hex');
};

const encrypt = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
};

const decrypt = (payload) => {
  const [v, iv, tag, data] = String(payload).split(':');
  if (v !== 'v1') throw new Error('Unknown ciphertext version');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};

const isConfigured = () => {
  try { getKey(); return true; } catch { return false; }
};

const isEncrypted = (value) => typeof value === 'string' && value.startsWith('v1:');

// For user API keys: stored values may be legacy plaintext (before encryption was
// added) or ciphertext. Returns the usable key, or '' if it can't be decrypted.
const revealSecret = (stored) => {
  if (!stored) return '';
  if (!isEncrypted(stored)) return String(stored);
  try {
    return decrypt(stored);
  } catch (err) {
    console.error('Failed to decrypt stored secret:', err.message);
    return '';
  }
};

const encryptSecret = (plain) => (plain ? encrypt(plain) : '');

module.exports = { encrypt, decrypt, isConfigured, isEncrypted, revealSecret, encryptSecret };
