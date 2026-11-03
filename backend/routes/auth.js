const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const { invalidateUserCache } = require('../middleware/authMiddleware');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const bcrypt = require('bcryptjs');
const { signToken, DUMMY_BCRYPT_HASH } = require('../utils/security');

const generateToken = (user) => signToken(user);

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate inputs
    if (!name || !email || !password ||
        typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'All fields are required' });
    }
    // Sanitize name — strip HTML tags
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

    // Check duplicate email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Create user
    const user = new User({ name: cleanName, email, password });
    await user.save();

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Same bcrypt cost and same message whether or not the account exists,
    // so response time/text cannot be used to discover registered emails.
    if (!user || !user.password) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
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
    console.error('Get me error:', err);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified } = payload;

    if (!email || email_verified !== true) {
      return res.status(400).json({ message: 'Google account must have a verified email' });
    }

    // Check if user exists by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (user) {
      // Link Google ID if user exists by email but hasn't linked Google yet
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
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();
        invalidateUserCache(user._id);
      }
    } else {
      // Create new user
      user = new User({
        name: String(name || email.split('@')[0]).replace(/<[^>]*>/g, '').trim().slice(0, 50) || 'User',
        email: email.toLowerCase(),
        googleId,
        authProvider: 'google',
      });
      await user.save();
    }

    const token = generateToken(user);

    res.json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Google auth error:', err.message);
    if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token')) {
      return res.status(401).json({ message: 'Google token is invalid or expired. Please try again.' });
    }
    res.status(500).json({ message: 'Server error during Google authentication' });
  }
});

module.exports = router;
