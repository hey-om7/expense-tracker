/**
 * Per-user Gmail statement scanning (Google OAuth, gmail.readonly).
 *
 *  POST /api/gmail/connect                      → returns Google consent URL
 *  GET  /api/gmail/oauth/callback               → Google redirects here (no Bearer token)
 *  GET  /api/gmail/status                       → connection state
 *  POST /api/gmail/scan-bills                   → manual "scan now" (new emails only)
 *  POST /api/gmail/disconnect                   → revoke access + delete token
 *  GET  /api/gmail/statements?status=&cardId=   → saved statements
 *  POST /api/gmail/statements/:id/add-card      → track this untracked card from now on
 *  POST /api/gmail/statements/:id/ignore        → don't track this card, ignore its future statements
 *  GET  /api/gmail/emails?status=review|recorded → other financial emails (review queue, transaction alerts)
 *  POST /api/gmail/emails/:id/dismiss           → dismiss one review item
 *  POST /api/gmail/emails/dismiss-all           → dismiss every review item
 */
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const validateId = require('../middleware/validateId');
const GmailConnection = require('../models/GmailConnection');
const CardStatement = require('../models/CardStatement');
const CreditCard = require('../models/CreditCard');
const FinancialEmail = require('../models/FinancialEmail');
const gmail = require('../services/gmailSync');
const { isConfigured: isEncryptionConfigured } = require('../utils/tokenCrypto');

const NONCE_COOKIE = 'wallo_gmail_oauth';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const frontendUrl = (query) => `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}/cyclic?gmail=${query}`;

const readCookie = (req, name) => {
  const match = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

const startBackfill = (connectionId) => {
  setImmediate(() => {
    gmail.syncConnection(connectionId, { backfill: true }).catch(() => { /* logged in service */ });
  });
};

// ─── OAuth callback (browser redirect from Google; authenticated via signed state + cookie) ───
router.get('/oauth/callback', async (req, res) => {
  const clearCookie = () => res.clearCookie(NONCE_COOKIE, { path: '/api/gmail/oauth' });
  try {
    const { code, state, error } = req.query;
    if (error) { clearCookie(); return res.redirect(frontendUrl('denied')); }
    if (typeof code !== 'string' || typeof state !== 'string') throw new Error('Missing code/state');

    const payload = jwt.verify(state, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const nonce = readCookie(req, NONCE_COOKIE);
    // The nonce cookie ties the callback to the browser that started the flow,
    // so nobody can trick a victim into connecting their Gmail to another account.
    if (payload.p !== 'gmail_connect' || !nonce || sha256(nonce) !== payload.n ||
        !mongoose.Types.ObjectId.isValid(payload.uid)) {
      throw new Error('Invalid OAuth state');
    }
    clearCookie();

    const conn = await gmail.completeConnection(payload.uid, code);
    startBackfill(conn._id);
    return res.redirect(frontendUrl('connected'));
  } catch (err) {
    console.error('Gmail OAuth callback failed:', err.message);
    clearCookie();
    return res.redirect(frontendUrl('error'));
  }
});

router.use(auth);

const publicStatus = (conn) => (conn
  ? {
      connected: true,
      gmailAddress: conn.gmailAddress,
      status: conn.status,
      backfillStatus: conn.backfillStatus,
      lastScannedAt: conn.lastScannedAt,
      lastError: conn.lastError,
    }
  : { connected: false });

router.get('/status', async (req, res) => {
  try {
    const conn = await GmailConnection.findOne({ userId: req.userId }).lean();
    const [pendingCount, reviewCount] = await Promise.all([
      CardStatement.countDocuments({ userId: req.userId, status: 'pending' }),
      FinancialEmail.countDocuments({ userId: req.userId, status: 'review' }),
    ]);
    res.json({ ...publicStatus(conn), pendingCount, reviewCount, available: gmail.isOAuthConfigured() && isEncryptionConfigured() });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load Gmail status' });
  }
});

router.post('/connect', (req, res) => {
  if (!gmail.isOAuthConfigured() || !isEncryptionConfigured()) {
    return res.status(503).json({ message: 'Gmail connection is not configured on the server.' });
  }
  const nonce = crypto.randomBytes(32).toString('hex');
  const state = jwt.sign({ uid: req.userId, p: 'gmail_connect', n: sha256(nonce) }, process.env.JWT_SECRET, {
    algorithm: 'HS256', expiresIn: '10m',
  });
  res.cookie(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/gmail/oauth',
    maxAge: 10 * 60 * 1000,
  });
  res.json({ url: gmail.getAuthUrl(state) });
});

router.post('/scan-bills', async (req, res) => {
  try {
    const conn = await GmailConnection.findOne({ userId: req.userId }).lean();
    if (!conn) return res.status(400).json({ message: 'Connect your Gmail first.' });
    if (conn.backfillStatus === 'running') {
      return res.status(429).json({ message: 'Your first Gmail scan is still running. Please check back shortly.' });
    }
    // full=true re-reads the last 90 days (already-saved statements are skipped),
    // e.g. after parsing improvements picked up emails that were missed before.
    const full = req.body?.full === true;
    if (full || conn.backfillStatus !== 'done') {
      // Long-running: run in the background; the UI polls /status until done.
      await GmailConnection.updateOne({ _id: conn._id }, { $set: { backfillStatus: 'pending' } });
      startBackfill(conn._id);
      return res.status(202).json({ started: true });
    }
    const result = await gmail.syncConnection(conn._id);
    if (result.busy) return res.status(429).json({ message: 'A scan is already in progress.' });
    res.json({
      linked: result.linked.length,
      pending: result.pending.length,
      review: result.review,
      method: result.method,
      aiRequested: result.aiRequested,
      aiAvailable: result.aiAvailable,
    });
  } catch (err) {
    res.status(500).json({ message: 'Gmail scan failed. Please try again later.' });
  }
});

router.post('/disconnect', async (req, res) => {
  try {
    await gmail.disconnect(req.userId);
    res.json({ message: 'Gmail disconnected. Wallo can no longer read your email.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to disconnect Gmail' });
  }
});

router.get('/statements', async (req, res) => {
  try {
    const filter = { userId: req.userId };
    if (['linked', 'pending', 'dismissed'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.cardId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.cardId)) return res.status(400).json({ message: 'Invalid card ID' });
      filter.cardId = req.query.cardId;
    }
    const statements = await CardStatement.find(filter)
      .select('-gmailMessageId -userId -__v')
      .sort({ statementDate: -1 })
      .limit(200)
      .lean();
    res.json(statements);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load statements' });
  }
});

// Statements in the same "pending card" group as this one (same bank + digits).
const sameCardFilter = (userId, st) => ({
  userId, status: 'pending', senderDomain: st.senderDomain, last4: st.last4 || null,
});

router.post('/statements/:id/add-card', validateId, async (req, res) => {
  try {
    const st = await CardStatement.findOne({ _id: req.params.id, userId: req.userId, status: 'pending' });
    if (!st) return res.status(404).json({ message: 'Statement not found' });

    const name = String(req.body.name || `${st.bankName} Credit Card`).trim().slice(0, 100);
    const last4Digits = String(req.body.last4Digits || st.last4 || '').replace(/\D/g, '').slice(-4);
    if (name.length < 2 || last4Digits.length < 2) {
      return res.status(400).json({ message: 'Card name and last digits are required' });
    }

    const card = await CreditCard.create({
      userId: req.userId,
      name,
      last4Digits,
      billDueDate: st.dueDate || new Date(),
      billAmount: st.amount,
      billGeneratedDate: st.statementDate,
    });
    await CardStatement.updateMany(sameCardFilter(req.userId, st), { $set: { status: 'linked', cardId: card._id } });
    await gmail.applyLatestToCard(card._id);

    res.status(201).json(await CreditCard.findById(card._id));
  } catch (err) {
    res.status(400).json({ message: 'Failed to add card' });
  }
});

router.post('/statements/:id/ignore', validateId, async (req, res) => {
  try {
    const st = await CardStatement.findOne({ _id: req.params.id, userId: req.userId, status: 'pending' });
    if (!st) return res.status(404).json({ message: 'Statement not found' });

    await CardStatement.updateMany(sameCardFilter(req.userId, st), { $set: { status: 'dismissed' } });
    await GmailConnection.updateOne(
      { userId: req.userId },
      { $addToSet: { ignoredCards: { domain: st.senderDomain, last4: st.last4 || null } } },
    );
    res.json({ message: 'Ignored. Future statements for this card will be skipped.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to ignore card' });
  }
});

router.get('/emails', async (req, res) => {
  try {
    const status = ['review', 'recorded', 'dismissed'].includes(req.query.status) ? req.query.status : 'review';
    const emails = await FinancialEmail.find({ userId: req.userId, status })
      .select('-gmailMessageId -userId -__v')
      .sort({ receivedAt: -1 })
      .limit(200)
      .lean();
    res.json(emails);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load emails' });
  }
});

router.post('/emails/dismiss-all', async (req, res) => {
  try {
    const r = await FinancialEmail.updateMany({ userId: req.userId, status: 'review' }, { $set: { status: 'dismissed' } });
    res.json({ dismissed: r.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to dismiss' });
  }
});

router.post('/emails/:id/dismiss', validateId, async (req, res) => {
  try {
    const r = await FinancialEmail.updateOne(
      { _id: req.params.id, userId: req.userId, status: 'review' }, { $set: { status: 'dismissed' } });
    if (!r.matchedCount) return res.status(404).json({ message: 'Email not found' });
    res.json({ message: 'Dismissed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to dismiss' });
  }
});

module.exports = router;
