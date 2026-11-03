const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate inputs
    if (!name || !email || !password) {
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
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ message: 'Password must be 6-128 characters' });
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
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Reject Google-only users from password login
    if (user.authProvider === 'google' && !user.password) {
      return res.status(401).json({ message: 'This account uses Google Sign-In. Please sign in with Google.' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Login error:', err);
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
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ message: 'Google account must have an email' });
    }

    // Check if user exists by googleId or email
    let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

    if (user) {
      // Link Google ID if user exists by email but hasn't linked Google yet
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
        await user.save();
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

    const token = generateToken(user._id);

    res.json({
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('Google auth error:', err);
    if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token')) {
      return res.status(401).json({ message: 'Google token is invalid or expired. Please try again.' });
    }
    res.status(500).json({ message: 'Server error during Google authentication' });
  }
});

module.exports = router;
