const rateLimit = require('express-rate-limit');
const { MongoRateStore } = require('./mongoRateStore');

const base = (prefix, { windowMs, limit, message }) => ({
  windowMs,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message },
  store: new MongoRateStore(prefix),
});

// Keyed by client IP (requires a correct `trust proxy` setting).
const ipLimiter = (prefix, opts) => rateLimit(base(prefix, opts));

// Keyed by account. Must be mounted after the auth middleware.
const userLimiter = (prefix, opts) => rateLimit({
  ...base(prefix, opts),
  keyGenerator: (req) => String(req.userId),
});

module.exports = { ipLimiter, userLimiter };
