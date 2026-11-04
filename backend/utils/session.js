// Session cookie helpers. The JWT lives in an httpOnly cookie so page scripts
// (and any XSS or malicious package) can't read it.
const { signToken } = require('./security');

const SESSION_COOKIE = 'vestor_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches maxAge in authMiddleware

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
});

const parseCookies = (req) => {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (!name || out[name] !== undefined) continue;
    try { out[name] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* skip malformed */ }
  }
  return out;
};

const readCookie = (req, name) => parseCookies(req)[name] ?? null;

const setSessionCookie = (res, user) => {
  res.cookie(SESSION_COOKIE, signToken(user), { ...cookieOptions(), maxAge: SESSION_MAX_AGE_MS });
};

const clearSessionCookie = (res) => res.clearCookie(SESSION_COOKIE, cookieOptions());

module.exports = { SESSION_COOKIE, readCookie, setSessionCookie, clearSessionCookie };
