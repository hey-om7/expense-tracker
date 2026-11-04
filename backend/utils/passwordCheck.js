// Checks a password against the Have I Been Pwned breach corpus using k-anonymity:
// only the first 5 hex chars of the SHA-1 hash leave the server.
// Fails open (returns false) if the API is unreachable, so sign-up never hard-depends on it.
const crypto = require('crypto');

const isBreachedPassword = async (password) => {
  const hash = crypto.createHash('sha1').update(String(password), 'utf8').digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'vestor-app' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split('\n').some((line) => {
      const [s, count] = line.trim().split(':');
      return s === suffix && Number(count) > 0; // padding entries have count 0
    });
  } catch (err) {
    console.warn('Breached-password check skipped:', err.message);
    return false;
  }
};

const BREACHED_MESSAGE = 'This password has appeared in a known data breach. Please choose a different one.';

module.exports = { isBreachedPassword, BREACHED_MESSAGE };
