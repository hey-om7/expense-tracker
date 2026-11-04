const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

// `npm start` / `npm run prod` pass --production so NODE_ENV is set cross-platform
if (process.argv.includes('--production')) process.env.NODE_ENV = 'production';
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.MONGODB_URI && !process.env.MONGO_URI) {
  console.error('❌ MONGO_URI must be set in production.');
  process.exit(1);
}

const app = express();

// ─── Refuse to start with a missing or guessable JWT secret ───
// A weak secret lets anyone forge a token for any userId.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET must be set and at least 32 characters. Generate one with: openssl rand -hex 48');
  process.exit(1);
}
app.disable('x-powered-by');

// ─── Trust proxy (required behind load balancers / reverse proxies) ───
// Number of proxy hops in front of the app (Render: 1). Wrong values break
// per-IP rate limiting: too low = every user shares one IP, too high = clients can spoof it.
// Accepts a hop count, "true"/"false", or a comma-separated list of trusted subnets.
const parseTrustProxy = (v) => {
  if (v === undefined || v === '') return 1;
  if (/^\d+$/.test(v)) return Number(v);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v.split(',').map(s => s.trim()).filter(Boolean);
};
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

if (isProd && !require('./utils/tokenCrypto').isConfigured()) {
  console.warn('⚠️  GMAIL_TOKEN_ENCRYPTION_KEY is not set — users cannot save AI API keys or connect Gmail.');
}

// ─── Security Headers ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com", "https://apis.google.com"],
      frameSrc: ["https://accounts.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://api.mfapi.in"],
      imgSrc: ["'self'", "data:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  // Google Sign-In's popup must postMessage the credential back to this window.
  // Helmet's default COOP ("same-origin") cuts that link, leaving the popup blank
  // on accounts.google.com/gsi/transform.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  },
}));

// ─── Compression ───
app.use(compression());

// ─── CORS — restrict to known origins ───
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
// Same-origin requests also send an Origin header (on POST/PUT/DELETE), so the
// app's own origin and FRONTEND_URL are always allowed.
const frontendOrigin = (() => {
  try { return process.env.FRONTEND_URL ? new URL(process.env.FRONTEND_URL).origin : null; } catch { return null; }
})();
const isAllowedOrigin = (req, origin) =>
  !origin ||
  origin === `${req.protocol}://${req.get('host')}` ||
  origin === frontendOrigin ||
  allowedOrigins.includes(origin);

app.use(cors((req, callback) => {
  if (!isAllowedOrigin(req, req.headers.origin)) return callback(new Error('Not allowed by CORS'));
  callback(null, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
    maxAge: 86400, // Preflight cache 24h
  });
}));

// ─── CSRF protection ───
// Sessions are cookies, so state-changing requests must carry a custom header.
// Browsers only let other sites send one after a CORS preflight, which the check above rejects.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
});

// ─── Body parsing with strict size limit ───
app.use(express.json({ limit: '256kb' }));

// ─── Fix for Express 5 req.query immutability ───
app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    value: req.query,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
});

// ─── NoSQL injection prevention ───
app.use(mongoSanitize({ replaceWith: '_' }));

// ─── Request timeout (30s) ───
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

// ─── Rate limiting (stored in MongoDB: survives restarts, shared across instances) ───
const { ipLimiter } = require('./utils/rateLimits');
app.use('/api', ipLimiter('general', {
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: 'Too many requests, please try again later.',
}));

const authLimiter = ipLimiter('auth', {
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many authentication attempts. Please wait 15 minutes.',
});
for (const p of ['login', 'register', 'google', 'forgot-password', 'reset-password', 'verify-email', 'resend-verification']) {
  app.use(`/api/auth/${p}`, authLimiter);
}

app.use('/api/stocks', ipLimiter('stocks', {
  windowMs: 60 * 1000,
  limit: 30,
  message: 'Too many stock lookups. Please slow down.',
}));

// ─── Routes ───
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/passwordReset'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/investments', require('./routes/investments'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/credit-cards', require('./routes/creditCards'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/gmail', require('./routes/gmailScan'));

// ─── Health check ───
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Serve the built frontend (single-service production deploy) ───
// Enabled when frontend/dist exists (after `npm run build`). In dev, Vite serves the UI.
const path = require('path');
const fs = require('fs');
const distDir = process.env.FRONTEND_DIST || path.resolve(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir, {
    index: false,
    dotfiles: 'ignore',
    setHeaders: (res, filePath) => {
      // Vite emits content-hashed files under /assets — safe to cache forever
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  // SPA fallback: any non-API GET returns index.html so React Router can handle it
  app.get(/^(?!\/api(\/|$)).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`📦 Serving frontend from ${distDir}`);
} else if (isProd) {
  console.warn(`⚠️  No frontend build at ${distDir}. Run \`npm run build\` (or \`npm run prod\`) to serve the UI.`);
}

// ─── 404 handler ───
app.use((_req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// ─── Global error handler ───
app.use((err, _req, res, _next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (err.type === 'entity.too.large' || err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid request body' });
  }
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'Internal server error' });
});

// ─── MongoDB Connection with production pool settings ───
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/vestor';
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGO_URI, {
  maxPoolSize: 50,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
})
  .then(() => {
    console.log('✅ MongoDB connected successfully');

    // Initialize cron jobs for scheduled reminders
    const { initCronJobs } = require('./services/cronJobs');
    initCronJobs();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Vestor API server running on port ${PORT}`);
    });

    // ─── Keep-alive and timeout settings for high traffic ───
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // ─── Graceful shutdown ───
    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await mongoose.connection.close();
        console.log('✅ Server and database connections closed.');
        process.exit(0);
      });
      // Force kill after 10s
      setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ─── Catch unhandled rejections ───
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
