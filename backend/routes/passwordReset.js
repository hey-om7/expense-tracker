const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { invalidateUserCache } = require('../middleware/authMiddleware');
const { escapeHtml } = require('../utils/security');

// Minimum gap between reset emails for one account (stops inbox flooding).
const RESET_COOLDOWN_MS = 5 * 60 * 1000;

const router = express.Router();

// Token lifetime: 1 hour
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const buildResetEmail = (name, link) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #1A120B; color: #F1DFD3; border-radius: 16px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #E5BA73; font-size: 24px; margin: 0;">Vestor</h1>
      <p style="color: #F1DFD3; opacity: 0.6; font-size: 12px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 2px;">Password Reset</p>
    </div>
    <div style="background: #241a12; border-radius: 12px; padding: 20px; border: 1px solid rgba(229,186,115,0.1);">
      <p style="margin: 0 0 12px; font-size: 16px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; opacity: 0.9;">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
      <p style="text-align: center; margin: 0;">
        <a href="${link}" style="display: inline-block; background: #E5BA73; color: #1A120B; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 10px; font-size: 14px;">Reset Password</a>
      </p>
      <p style="margin: 16px 0 0; font-size: 12px; line-height: 1.6; opacity: 0.6;">If you didn't request this, you can safely ignore this email and your password will stay the same.</p>
    </div>
    <p style="text-align: center; font-size: 11px; color: #F1DFD3; opacity: 0.4; margin-top: 24px;">Sent by Vestor · Your Personal Finance Tracker</p>
  </div>
`;

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

    const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const link = `${base}/reset-password/${rawToken}`;

    try {
      await sendEmail(user.email, 'Reset your Vestor password', buildResetEmail(user.name, link));
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr.message);
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
