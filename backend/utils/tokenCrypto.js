const crypto = require('crypto');

// AES-256-GCM for secrets at rest (Gmail refresh tokens, users' AI API keys).
// GMAIL_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes): openssl rand -hex 32
//
// Format v2 binds each ciphertext to a context string (purpose + owner, e.g.
// "gmail-refresh:<userId>") as GCM additional data. Copying one user's encrypted
// Gmail token into another user's record, or into a different field such as the
// AI key, makes decryption fail instead of handing the token to the wrong account.
//
// Legacy data (v1 ciphertext without a context, and plaintext API keys saved before
// encryption existed) is accepted only while ALLOW_LEGACY_SECRETS is not "false".
// After running scripts/encrypt-api-keys.js, set ALLOW_LEGACY_SECRETS=false so
// unbound values are rejected for good.
const getKey = () => {
  const hex = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY must be 64 hex characters');
  }
  return Buffer.from(hex, 'hex');
};

// Read on every call so tests and scripts can change it at runtime.
const legacyAllowed = () => String(process.env.ALLOW_LEGACY_SECRETS ?? 'true').trim().toLowerCase() !== 'false';

// Every new ciphertext is v2. A context is mandatory so nothing new is ever unbound.
const encrypt = (plain, context) => {
  if (!context) throw new Error('Encryption context is required');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  cipher.setAAD(Buffer.from(String(context), 'utf8'));
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v2', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
};

const rawDecrypt = (payload, context, { allowV1 }) => {
  const [v, iv, tag, data] = String(payload).split(':');
  if (v === 'v1') {
    if (!allowV1) throw new Error('Legacy v1 ciphertext is disabled (ALLOW_LEGACY_SECRETS=false)');
  } else if (v !== 'v2') {
    throw new Error('Unknown ciphertext version');
  } else if (!context) {
    throw new Error('Ciphertext requires a context');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  if (v === 'v2') decipher.setAAD(Buffer.from(String(context), 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};

const decrypt = (payload, context) => rawDecrypt(payload, context, { allowV1: legacyAllowed() });

// Only for the migration script: reads v1 even after the fallback is switched off,
// so records missed by an earlier run can still be upgraded.
const decryptLegacyForMigration = (payload) => rawDecrypt(payload, null, { allowV1: true });

// True when the value should be re-encrypted in the context-bound format.
const needsUpgrade = (payload) => typeof payload === 'string' && payload.startsWith('v1:');

const isConfigured = () => {
  try { getKey(); return true; } catch { return false; }
};

const isEncrypted = (value) => typeof value === 'string' && /^v[12]:/.test(value);

// Context strings, one per purpose, so a ciphertext only opens where it belongs.
const contexts = {
  gmailRefresh: (userId) => `gmail-refresh:${userId}`,
  groqKey: (userId) => `groq-key:${userId}`,
};

// For user API keys. Returns the usable key, or '' if it can't be decrypted.
// Plaintext keys (saved before encryption existed) count as legacy data.
const revealSecret = (stored, context) => {
  if (!stored) return '';
  if (!isEncrypted(stored)) {
    if (legacyAllowed()) return String(stored);
    console.error('Rejected unencrypted stored secret (ALLOW_LEGACY_SECRETS=false)');
    return '';
  }
  try {
    return decrypt(stored, context);
  } catch (err) {
    console.error('Failed to decrypt stored secret:', err.message);
    return '';
  }
};

const encryptSecret = (plain, context) => (plain ? encrypt(plain, context) : '');

module.exports = {
  encrypt, decrypt, decryptLegacyForMigration, needsUpgrade, legacyAllowed,
  isConfigured, isEncrypted, revealSecret, encryptSecret, contexts,
};
