const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { invalidateUserCache } = require('../middleware/authMiddleware');
const { appUrl, sendActionEmail } = require('../utils/authEmails');
const { isBreachedPassword, BREACHED_MESSAGE } = require('../utils/passwordCheck');

// Minimum gap between reset emails for one account (stops inbox flooding).
const RESET_COOLDOWN_MS = 5 * 60 * 1000;

const router = express.Router();

// Token lifetime: 1 hour
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// POST /api/auth/forgot-password
// Always returns a generic success to avoid email enumeration.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || email.length > 254) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const genericResponse = {
      message: 'If an account exists for that email, a reset link has been sent.',
    };

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+resetPasswordRequestedAt');

    // Only local accounts with a password can reset. Google-only accounts are skipped.
    if (!user || !user.password) {
      return res.json(genericResponse);
    }

    if (user.resetPasswordRequestedAt && Date.now() - user.resetPasswordRequestedAt.getTime() < RESET_COOLDOWN_MS) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = hashToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    user.resetPasswordRequestedAt = new Date();
    await user.save({ validateBeforeSave: false });

    const sent = await sendActionEmail(user.email, 'Reset your Vestor password', {
      name: user.name,
      label: 'Password Reset',
      intro: 'We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.',
      buttonText: 'Reset Password',
      link: appUrl(`/reset-password/${rawToken}`),
      footer: "If you didn't request this, you can safely ignore this email and your password will stay the same.",
    });
    if (!sent) {
      // Roll back the token so a failed send doesn't leave a dangling reset token.
      user.resetPasswordToken = null;
      user.resetPasswordExpires = null;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ message: 'Failed to send reset email. Please try again later.' });
    }

    return res.json(genericResponse);
  } catch (err) {
    console.error('forgot-password error:', err.message);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body || {};

    if (!token || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({ message: 'Invalid or missing reset token' });
    }
    if (!password || typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ message: 'Password must be 8-72 characters' });
    }
    if (await isBreachedPassword(password)) {
      return res.status(400).json({ message: BREACHED_MESSAGE });
    }

    const hashed = hashToken(token);
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpires +password');

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired. Please request a new one.' });
    }

    // Setting the plain value triggers the pre('save') hook which bcrypt-hashes it.
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    // Clicking the emailed link proves inbox ownership; also lift any login lock.
    user.emailVerified = true;
    user.failedLoginCount = 0;
    user.lockUntil = null;
    // Log out every device that had a session before the reset.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    invalidateUserCache(user._id);

    return res.json({ message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    console.error('reset-password error:', err.message);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
