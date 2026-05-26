const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const app = express();

// ─── Trust proxy (required behind load balancers / reverse proxies) ───
app.set('trust proxy', 1);

// ─── Security Headers ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com", "https://apis.google.com"],
      frameSrc: ["https://accounts.google.com"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      imgSrc: ["'self'", "data:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
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
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // Preflight cache 24h
}));

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

// ─── Rate limiting ───
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
  // keyGenerator: (req) => req.ip,
});
app.use('/api', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please wait 15 minutes.' },
  // keyGenerator: (req) => req.ip,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

const stocksLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many stock lookups. Please slow down.' },
});
app.use('/api/stocks', stocksLimiter);

// ─── Routes ───
app.use('/api/auth', require('./routes/auth'));
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

// ─── 404 handler ───
app.use((_req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// ─── Global error handler ───
app.use((err, _req, res, _next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Forbidden' });
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
