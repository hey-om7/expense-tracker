/**
 * Per-user Gmail statement scanning (Google OAuth, gmail.readonly).
 *
 *  POST /api/gmail/connect                      → returns Google consent URL
 *  GET  /api/gmail/oauth/callback               → Google redirects here (no Bearer token)
 *  GET  /api/gmail/status                       → connection state
 *  POST /api/gmail/scan-bills                   → manual "scan now" (new emails only)
 *  POST /api/gmail/sync-new                     → quick background check for new emails (app load, Add Expense)
 *  POST /api/gmail/disconnect                   → revoke access + delete token
 *  GET  /api/gmail/statements?status=&cardId=   → saved statements
 *  POST /api/gmail/statements/:id/add-card      → track this untracked card from now on
 *  POST /api/gmail/statements/:id/ignore        → don't track this card, ignore its future statements
 *  GET  /api/gmail/emails?status=review|recorded → other financial emails (review queue, transaction alerts)
 *  POST /api/gmail/emails/:id/dismiss           → dismiss one review item
 *  POST /api/gmail/emails/dismiss-all           → dismiss every review item
 *  POST /api/gmail/emails/:id/analyze           → ask AI what a review email is (proposal only);
 *                                                 reads an attached PDF, asks for its password if needed
 *  POST /api/gmail/emails/:id/confirm           → save it and remember the email type (no AI next time)
 *  GET  /api/gmail/rules                        → remembered email types
 *  DELETE /api/gmail/rules/:id                  → forget one
 *  GET  /api/gmail/pdf-passwords                → banks with a saved statement PDF password
 *  DELETE /api/gmail/pdf-passwords/:id          → remove one
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
const EmailRule = require('../models/EmailRule');
const gmail = require('../services/gmailSync');
const emailReview = require('../services/emailReview');
const statementPasswords = require('../services/statementPasswords');
const { isConfigured: isEncryptionConfigured } = require('../utils/tokenCrypto');

const NONCE_COOKIE = 'vestor_gmail_oauth';
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

// Per-account caps: scans call Gmail (and possibly a paid AI API) many times.
const { userLimiter } = require('../utils/rateLimits');
const scanLimiter = userLimiter('gmail-scan', { windowMs: 60 * 60 * 1000, limit: 10, message: 'Too many Gmail scans. Please try again later.' });
const quickSyncLimiter = userLimiter('gmail-quick-sync', { windowMs: 10 * 60 * 1000, limit: 30, message: 'Checking for new emails too often. Please wait a moment.' });
const connectLimiter = userLimiter('gmail-connect', { windowMs: 60 * 60 * 1000, limit: 10, message: 'Too many Gmail connection attempts. Please try again later.' });

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

router.post('/connect', connectLimiter, (req, res) => {
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

router.post('/scan-bills', scanLimiter, async (req, res) => {
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

// Quick check for new emails. Waits up to 15 s so the caller can refresh suggestions;
// a slower sync keeps running in the background and the 30-minute job picks up the rest.
router.post('/sync-new', quickSyncLimiter, async (req, res) => {
  const sync = gmail.syncNewForUser(req.userId).catch(() => ({ synced: false }));
  const timeout = new Promise(resolve => setTimeout(() => resolve({ synced: false, running: true }), 15000));
  res.json(await Promise.race([sync, timeout]));
});

router.post('/disconnect', async (req, res) => {
  try {
    const revoked = await gmail.disconnect(req.userId);
    res.json({
      message: revoked
        ? 'Gmail disconnected. Vestor can no longer read your email.'
        : "Gmail disconnected here, but Google couldn't be reached to cancel access. To make sure access is removed, remove Vestor at myaccount.google.com/permissions.",
    });
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
    const filter = { userId: req.userId, status };
    // e.g. exclude=transaction_alert to list saved statements without the many payment alerts
    if (typeof req.query.exclude === 'string' && req.query.exclude) {
      filter.category = { $nin: req.query.exclude.split(',').slice(0, 5) };
    }
    const emails = await FinancialEmail.find(filter)
      .select('-gmailMessageId -userId -__v -proposal')
      .sort({ receivedAt: -1 })
      .limit(200)
      .lean();
    res.json(emails);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load emails' });
  }
});

// ─── Teach Vestor an email type: analyze once with AI, confirm, then read locally ───
const analyzeLimiter = userLimiter('gmail-analyze', { windowMs: 60 * 60 * 1000, limit: 30, message: 'Too many AI analyses. Please try again later.' });
const sendReviewError = (res, err, fallback) => {
  if (err instanceof emailReview.ReviewError) return res.status(err.status).json({ message: err.message });
  console.error(`${fallback}:`, err.message);
  return res.status(500).json({ message: fallback });
};

router.post('/emails/:id/analyze', validateId, analyzeLimiter, async (req, res) => {
  try {
    const { password, rememberPassword } = req.body || {};
    res.json(await emailReview.analyze(req.userId, req.params.id, {
      password: typeof password === 'string' && password.length ? password.slice(0, 100) : undefined,
      rememberPassword: rememberPassword !== false,
    }));
  } catch (err) {
    sendReviewError(res, err, 'Failed to analyze email');
  }
});

// Saved statement-PDF passwords: only the bank is shown, never the password.
router.get('/pdf-passwords', async (req, res) => {
  try {
    res.json(await statementPasswords.list(req.userId));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load saved passwords' });
  }
});

router.delete('/pdf-passwords/:id', validateId, async (req, res) => {
  try {
    const r = await statementPasswords.remove(req.userId, req.params.id);
    if (!r.deletedCount) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Password removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove password' });
  }
});

router.post('/emails/:id/confirm', validateId, async (req, res) => {
  try {
    const body = req.body || {};
    res.json(await emailReview.confirm(req.userId, req.params.id, {
      category: typeof body.category === 'string' ? body.category : undefined,
      amount: body.amount,
      dueDate: body.dueDate,
      statementDate: body.statementDate,
      last4: body.last4 != null ? String(body.last4).replace(/\D/g, '').slice(-4) : undefined,
      remember: body.remember !== false,
    }));
  } catch (err) {
    sendReviewError(res, err, 'Failed to save email');
  }
});

router.get('/rules', async (req, res) => {
  try {
    const list = await EmailRule.find({ userId: req.userId })
      .select('institutionName senderDomain sampleSubject category timesApplied lastAppliedAt createdAt')
      .sort({ createdAt: -1 }).limit(100).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load remembered email types' });
  }
});

router.delete('/rules/:id', validateId, async (req, res) => {
  try {
    const r = await EmailRule.deleteOne({ _id: req.params.id, userId: req.userId });
    if (!r.deletedCount) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Forgotten. These emails will go through the normal checks again.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to forget email type' });
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

// ─── Expense suggestions: recent PhonePe/Kotak debits not yet added as transactions ───
const { PAYMENT_SUGGESTION_DOMAINS } = require('../services/emailProcessing/institutions');
const { isPromotionalSubject } = require('../services/emailProcessing/promotional');
const SUGGESTION_DAYS = 45;
// A PhonePe payment from a Kotak account sends two emails for one payment; treat
// same amount within this window as one, keeping the record with the better merchant.
const SAME_PAYMENT_MS = 15 * 60 * 1000;

// Prefer the receive time (has hours); use the parsed date only when it is clearly a different day.
const whenOf = (e) => {
  const t = e.fields?.transactionDate;
  return t && Math.abs(new Date(t) - e.receivedAt) > 36 * 3600e3 ? t : e.receivedAt;
};

const cleanMerchant = (m) => {
  if (!m) return null;
  const s = String(m).trim().replace(/\s+/g, ' ');
  // HDFC: "VPA ****KYAQ@icici (M S CLASSIC HOSPITALITY)" -> use the registered name in brackets
  const named = s.match(/@\S*\s*\(([^)]{2,80})\)\s*$/);
  if (named) return cleanMerchant(named[1]);
  // "swiggy.upi@axisbank" -> "Swiggy"; keep person names as-is
  if (/@/.test(s)) {
    const handle = s.split('@')[0].split(/[._-]/).find(p => /[a-z]{3,}/i.test(p) && !/^(upi|pay|paytm|ybl|ok\w+)$/i.test(p));
    return handle ? handle.charAt(0).toUpperCase() + handle.slice(1).toLowerCase() : s;
  }
  return s.length > 3 && s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s;
};

router.get('/suggestions', async (req, res) => {
  try {
    const since = new Date(Date.now() - SUGGESTION_DAYS * 864e5);
    // Payment apps and UPI alert senders, plus card spends from any bank (including
    // banks found by the discovery scan). Same-payment twins are merged below.
    const rows = await FinancialEmail.find({
      userId: req.userId,
      status: 'recorded',
      category: 'transaction_alert',
      suggestionState: null,
      $or: [
        { senderDomain: { $in: PAYMENT_SUGGESTION_DOMAINS } },
        { 'fields.paymentMethod': { $in: ['credit_card', 'debit_card'] } },
        { processor: { $in: ['ai', 'shared'] } },
      ],
      'fields.amount': { $gt: 0 },
      'fields.transactionType': { $in: ['debit', null] },
      receivedAt: { $gte: since },
    }).select('institutionName senderDomain subject receivedAt fields confidence').sort({ receivedAt: -1 }).limit(100).lean();

    const out = [];
    for (const r of rows) {
      if (isPromotionalSubject(r.subject)) continue; // e.g. HDFC "Rs.2,000 voucher" mails stored before the promo rule existed
      if (/\b(declined|failed|unsuccessful|reversed)\b/i.test(r.subject || '')) continue; // money never left the account
      const twin = out.find(o => o.amount === r.fields.amount && Math.abs(o.receivedAt - r.receivedAt) < SAME_PAYMENT_MS);
      if (twin) {
        twin.ids.push(String(r._id));
        if (!twin.merchant && r.fields.merchant) twin.merchant = cleanMerchant(r.fields.merchant);
        if (!twin.sources.includes(r.institutionName)) twin.sources.push(r.institutionName);
        continue;
      }
      out.push({
        id: String(r._id),
        ids: [String(r._id)],
        amount: r.fields.amount,
        merchant: cleanMerchant(r.fields.merchant),
        paymentMethod: r.fields.paymentMethod,
        last4: r.fields.last4 && !String(r.fields.merchant || '').includes(`${r.fields.last4}@`) ? r.fields.last4 : null,
        date: whenOf(r),
        receivedAt: r.receivedAt,
        sources: [r.institutionName],
        confidence: r.confidence,
      });
    }
    res.json(out.slice(0, 30).map(({ receivedAt, ...s }) => s));
  } catch (err) {
    res.status(500).json({ message: 'Failed to load suggestions' });
  }
});

// Mark suggestion(s) as used (after the expense was saved) or dismissed.
router.post('/suggestions/resolve', async (req, res) => {
  try {
    const ids = [].concat(req.body?.ids || []).filter(id => mongoose.Types.ObjectId.isValid(id)).slice(0, 10);
    const state = req.body?.state === 'dismissed' ? 'dismissed' : 'used';
    if (!ids.length) return res.status(400).json({ message: 'No suggestion given' });
    const set = { suggestionState: state };
    if (state === 'used' && mongoose.Types.ObjectId.isValid(req.body?.transactionId)) set.transactionId = req.body.transactionId;
    const r = await FinancialEmail.updateMany({ _id: { $in: ids }, userId: req.userId, suggestionState: null }, { $set: set });
    res.json({ updated: r.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update suggestion' });
  }
});

// ─── Settings → AI training: check and correct how expense emails are read ───
const emailTraining = require('../services/emailTraining');
const trainLimiter = userLimiter('gmail-train', { windowMs: 60 * 60 * 1000, limit: 120, message: 'Too many training requests. Please try again later.' });
const sendTrainingError = (res, err, fallback) => {
  if (err instanceof emailTraining.TrainingError) return res.status(err.status).json({ message: err.message });
  console.error(`${fallback}:`, err.message);
  return res.status(500).json({ message: fallback });
};

router.get('/training/types', async (req, res) => {
  try {
    res.json(await emailTraining.listTypes(req.userId));
  } catch (err) {
    sendTrainingError(res, err, 'Failed to load tracked emails');
  }
});

router.get('/training/emails/:id', validateId, trainLimiter, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store'); // contains the email body
    res.json(await emailTraining.getSample(req.userId, req.params.id));
  } catch (err) {
    sendTrainingError(res, err, 'Failed to load email');
  }
});

router.post('/training/emails/:id', validateId, trainLimiter, async (req, res) => {
  try {
    const raw = req.body?.marks && typeof req.body.marks === 'object' ? req.body.marks : {};
    const marks = {};
    ['amount', 'transactionDate', 'merchant', 'last4'].forEach((f) => {
      if (!(f in raw)) return;
      const m = raw[f];
      marks[f] = m === null ? null : { start: Number(m?.start), end: Number(m?.end) };
    });
    res.json(await emailTraining.train(req.userId, req.params.id, marks));
  } catch (err) {
    sendTrainingError(res, err, 'Failed to save training');
  }
});

router.delete('/training/emails/:id', validateId, async (req, res) => {
  try {
    res.json(await emailTraining.reset(req.userId, req.params.id));
  } catch (err) {
    sendTrainingError(res, err, 'Failed to reset training');
  }
});

module.exports = router;
