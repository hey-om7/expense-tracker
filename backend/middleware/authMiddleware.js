const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Simple in-memory cache to avoid hitting DB on every request
// Key: userId, Value: { valid: boolean, checkedAt: timestamp }
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.length > 2000) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      maxAge: '7d',
    });

    if (!decoded.userId || !mongoose.Types.ObjectId.isValid(decoded.userId)) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Check user existence with cache
    const cached = userCache.get(decoded.userId);
    if (cached && (Date.now() - cached.checkedAt) < CACHE_TTL) {
      if (!cached.valid) {
        return res.status(401).json({ message: 'Account no longer exists' });
      }
    } else {
      // Verify user still exists in DB
      const User = mongoose.model('User');
      const userExists = await User.exists({ _id: decoded.userId });
      userCache.set(decoded.userId, { valid: !!userExists, checkedAt: Date.now() });
      if (!userExists) {
        return res.status(401).json({ message: 'Account no longer exists' });
      }
    }

    // Evict old cache entries periodically
    if (userCache.size > 10000) {
      const now = Date.now();
      for (const [key, val] of userCache) {
        if (now - val.checkedAt > CACHE_TTL) userCache.delete(key);
      }
    }

    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired, please login again' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = auth;
