const jwt = require('jsonwebtoken');

// Escape untrusted text before interpolating it into HTML (emails).
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// API keys are never sent back to the browser in full.
const MASK_PREFIX = '••••••••';
const maskKey = (key) => (key ? `${MASK_PREFIX}${String(key).slice(-4)}` : '');
const isMaskedKey = (key) => typeof key === 'string' && key.startsWith(MASK_PREFIX);

// Signs a session token bound to the user's current tokenVersion,
// so bumping tokenVersion (e.g. on password reset) revokes all old sessions.
const signToken = (user) =>
  jwt.sign({ userId: user._id.toString(), tv: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Precomputed bcrypt hash (cost 12) used to equalise login timing for unknown emails.
const DUMMY_BCRYPT_HASH = '$2b$12$ZOW7sgijjmvGwS.URUFdHOErK0xTMeGlc/RawPF34xXSD6Tdx5VHW';

// Gmail bill scanning reads ONE shared inbox (GMAIL_INBOX_USER). Only the
// owner(s) of that inbox may receive data from it.
const gmailScanAllowedEmails = () =>
  (process.env.GMAIL_SCAN_ALLOWED_EMAILS || process.env.GMAIL_INBOX_USER || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const canUseGmailScan = (email) =>
  !!email && gmailScanAllowedEmails().includes(String(email).toLowerCase());

module.exports = {
  escapeHtml,
  maskKey,
  isMaskedKey,
  signToken,
  DUMMY_BCRYPT_HASH,
  gmailScanAllowedEmails,
  canUseGmailScan,
};
