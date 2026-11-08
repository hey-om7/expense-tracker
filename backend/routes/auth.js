const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const { invalidateUserCache } = require('../middleware/authMiddleware');
const { DUMMY_BCRYPT_HASH } = require('../utils/security');
const { setSessionCookie, clearSessionCookie, readCookie, SESSION_COOKIE } = require('../utils/session');
const jwt = require('jsonwebtoken');
const { isBreachedPassword, BREACHED_MESSAGE } = require('../utils/passwordCheck');
const { appUrl, sendActionEmail } = require('../utils/authEmails');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Brute-force protection per account (the per-IP limiter in server.js can be
// bypassed with many IPs).
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const VERIFY_RESEND_COOLDOWN_MS = 5 * 60 * 1000;

const { TERMS_VERSION, PRIVACY_VERSION } = require('../legal');
const TERMS_REQUIRED = 'Please agree to the Terms of Service and acknowledge the Privacy Policy to create an account.';
const consentRecord = () => ({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, acceptedAt: new Date() });

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// Same response whether or not the email is already registered, so sign-up
// can't be used to discover who has an account.
const REGISTER_RESPONSE = {
  message: 'Check your inbox for a link to verify your email and finish creating your account.',
};
const RESEND_RESPONSE = {
  message: 'If that account needs verification, a new link has been sent.',
};

const startSession = (res, user) => {
  setSessionCookie(res, user);
  return res.json({ user: user.toJSON() });
};

// Creates a fresh verification token on `user` and emails it. Caller saves the user.
const issueVerification = async (user) => {
  const raw = crypto.randomBytes(32).toString('hex');
  user.emailVerifyToken = hashToken(raw);
  user.emailVerifyExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  user.emailVerifySentAt = new Date();
  await user.save({ validateBeforeSave: false });
  const sent = await sendActionEmail(user.email, 'Verify your Vestor email', {
    name: user.name,
    label: 'Verify your email',
    intro: 'Confirm this is your email address to finish setting up your Vestor account. This link expires in 24 hours.',
    buttonText: 'Verify Email',
    link: appUrl(`/verify-email/${raw}`),
    footer: "If you didn't create a Vestor account, you can ignore this email.",
  });
  if (!sent) console.error('❌ Verification email could not be sent. Check the EMAIL_* settings.');
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, termsAccepted } = req.body;

    if (!name || !email || !password ||
        typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (termsAccepted !== true) {
      return res.status(400).json({ message: TERMS_REQUIRED, code: 'TERMS_REQUIRED' });
    }
    const cleanName = String(name).replace(/<[^>]*>/g, '').trim();
    if (cleanName.length < 2 || cleanName.length > 50) {
      return res.status(400).json({ message: 'Name must be 2-50 characters' });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (String(email).length > 254) {
      return res.status(400).json({ message: 'Email address is too long' });
    }
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ message: 'Password must be 8-72 characters' });
    }
    if (await isBreachedPassword(password)) {
      return res.status(400).json({ message: BREACHED_MESSAGE });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail }).select('+emailVerifySentAt');
    if (existing) {
      // Re-send the link if the owner never verified; otherwise do nothing.
      // Either way the response is identical to a new sign-up.
      const canResend = existing.emailVerified === false &&
        (!existing.emailVerifySentAt || Date.now() - existing.emailVerifySentAt.getTime() > VERIFY_RESEND_COOLDOWN_MS);
      if (canResend) await issueVerification(existing);
      return res.status(202).json(REGISTER_RESPONSE);
    }

    const user = new User({ name: cleanName, email: normalizedEmail, password, emailVerified: false, legalConsent: consentRecord() });
    await user.save();
    await issueVerification(user);

    return res.status(202).json(REGISTER_RESPONSE);
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/verify-email/:token
router.post('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!/^[a-f0-9]{64}$/.test(String(token))) {
      return res.status(400).json({ message: 'Invalid verification link' });
    }
    const user = await User.findOne({
      emailVerifyToken: hashToken(token),
      emailVerifyExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ message: 'Verification link is invalid or has expired. Sign in to request a new one.' });
    }
    user.emailVerified = true;
    user.emailVerifyToken = null;
    user.emailVerifyExpires = null;
    await user.save({ validateBeforeSave: false });
    return startSession(res, user);
  } catch (err) {
    console.error('Verify email error:', err.message);
    res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || email.length > 254) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+emailVerifySentAt');
    const canResend = user && user.emailVerified === false &&
      (!user.emailVerifySentAt || Date.now() - user.emailVerifySentAt.getTime() > VERIFY_RESEND_COOLDOWN_MS);
    if (canResend) await issueVerification(user);
    return res.json(RESEND_RESPONSE);
  } catch (err) {
    console.error('Resend verification error:', err.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+failedLoginCount +lockUntil');

    // Same bcrypt cost and same message whether or not the account exists,
    // so response time/text cannot be used to discover registered emails.
    if (!user || !user.password) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(429).json({
        message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Atomic increment so parallel guesses can't skip the lock
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { failedLoginCount: 1 } },
        { returnDocument: 'after', projection: { failedLoginCount: 1 } },
      );
      if (updated && updated.failedLoginCount >= MAX_FAILED_LOGINS) {
        await User.updateOne({ _id: user._id }, { $set: { lockUntil: new Date(Date.now() + LOCK_MS), failedLoginCount: 0 } });
      }
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.failedLoginCount || user.lockUntil) {
      await User.updateOne({ _id: user._id }, { $set: { failedLoginCount: 0, lockUntil: null } });
    }

    // Only revealed after the correct password, so it doesn't leak which emails exist.
    if (user.emailVerified === false) {
      return res.status(403).json({ message: 'Please verify your email first. Check your inbox for the link.', code: 'EMAIL_NOT_VERIFIED' });
    }

    return startSession(res, user);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/logout
// Revokes every session for this account (all devices), not just this browser,
// so a token stolen earlier stops working too.
router.post('/logout', async (req, res) => {
  try {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      // Only revoke if this token is still current (avoids bumping on replayed old tokens)
      const result = await User.updateOne(
        { _id: decoded.userId, tokenVersion: decoded.tv || 0 },
        { $inc: { tokenVersion: 1 } },
      );
      if (result.modifiedCount) invalidateUserCache(decoded.userId);
    }
  } catch (err) {
    // Expired or invalid token: nothing to revoke
  }
  clearSessionCookie(res);
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me (protected)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.toJSON());
  } catch (err) {
    console.error('Get me error:', err.message);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { credential, termsAccepted } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified } = payload;

    if (!email || email_verified !== true) {
      return res.status(400).json({ message: 'Google account must have a verified email' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (user) {
      if (user.googleId && user.googleId !== googleId) {
        return res.status(401).json({ message: 'This email is linked to a different Google account.' });
      }
      if (!user.googleId) {
        // Google just proved ownership of this email. Anyone could have
        // registered it earlier with a password ("pre-account hijacking"),
        // so drop that password and revoke every existing session.
        user.googleId = googleId;
        user.authProvider = 'google';
        user.password = undefined;
        user.emailVerified = true;
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();
        invalidateUserCache(user._id);
      }
    } else {
      // Signing in with Google for the first time creates an account, which needs consent.
      if (termsAccepted !== true) {
        return res.status(400).json({ message: TERMS_REQUIRED, code: 'TERMS_REQUIRED' });
      }
      user = new User({
        name: String(name || email.split('@')[0]).replace(/<[^>]*>/g, '').trim().slice(0, 50) || 'User',
        email: email.toLowerCase(),
        googleId,
        authProvider: 'google',
        emailVerified: true,
        legalConsent: consentRecord(),
      });
      await user.save();
    }

    return startSession(res, user);
  } catch (err) {
    console.error('Google auth error:', err.message);
    if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token')) {
      return res.status(401).json({ message: 'Google token is invalid or expired. Please try again.' });
    }
    res.status(500).json({ message: 'Server error during Google authentication' });
  }
});

module.exports = router;
