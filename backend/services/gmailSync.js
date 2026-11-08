/**
 * gmailSync.js
 * Per-user Gmail statement sync using Google OAuth (gmail.readonly).
 *  - first connect: backfill the last 90 days
 *  - every 30 minutes, and when the user opens the app: fetch only emails newer than the last scan
 * Statements for tracked cards are linked and update the card's current bill,
 * which drives the existing "due tomorrow" reminder in cronJobs.processCreditCards.
 * Statements for untracked cards are stored as "pending" until the user decides.
 * Each email goes through services/emailProcessing: AI or deterministic,
 * chosen from the user's saved "aiEmailProcessingEnabled" preference.
 * Emails that can't be reliably parsed are queued for manual review (FinancialEmail).
 */
const { OAuth2Client } = require('google-auth-library');
const GmailConnection = require('../models/GmailConnection');
const CardStatement = require('../models/CardStatement');
const CreditCard = require('../models/CreditCard');
const Notification = require('../models/Notification');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');
const FinancialEmail = require('../models/FinancialEmail');
const { OFFICIAL_BANK_DOMAINS } = require('./gmailScanner');
const pipeline = require('./emailProcessing');
const { rootDomainFor, PAYMENT_SUGGESTION_DOMAINS } = require('./emailProcessing/institutions');
const { applyLatestToCard } = pipeline.sinks;
const { sendEmail } = require('./emailService');
const { encrypt, decrypt, needsUpgrade, revealSecret, contexts } = require('../utils/tokenCrypto');
const { escapeHtml } = require('../utils/security');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const BACKFILL_DAYS = 90;
const MAX_MESSAGES_PER_SYNC = 500;
const MAX_AI_CALLS_PER_SYNC = 60;
const PREF_RECHECK_EVERY = 25;

// Bump when the payment-alert parsing (institutions.js templates) improves. Open expense
// suggestions stored with a lower revision and missing details are re-read from Gmail.
const PAYMENT_PARSER_REVISION = 1;
const REPARSE_DAYS = 45; // same window as the suggestions list
const MAX_REPARSE_PER_SYNC = 200;

/**
 * Re-read open expense suggestions that an older parser stored without a merchant
 * (e.g. Kotak "Your transaction of Rs.258.00 on AMAZONIN using ... Card") and update
 * them in place. Bodies are never stored, so the email is fetched again from Gmail.
 */
const reparseStaleSuggestions = async (client, conn) => {
  const stale = await FinancialEmail.find({
    userId: conn.userId,
    status: 'recorded',
    category: 'transaction_alert',
    suggestionState: null,
    senderDomain: { $in: PAYMENT_SUGGESTION_DOMAINS },
    'fields.merchant': null,
    parserRevision: { $not: { $gte: PAYMENT_PARSER_REVISION } },
    receivedAt: { $gte: new Date(Date.now() - REPARSE_DAYS * 864e5) },
  }).select('_id gmailMessageId receivedAt').limit(MAX_REPARSE_PER_SYNC).lean();

  let updated = 0;
  for (const rec of stale) {
    const mark = { parserRevision: PAYMENT_PARSER_REVISION };
    try {
      const { data: msg } = await client.request({ url: `${GMAIL_API}/messages/${rec.gmailMessageId}`, params: { format: 'raw' } });
      const result = await pipeline.processRawEmail(Buffer.from(msg.raw, 'base64url'), {
        method: 'deterministic', messageId: rec.gmailMessageId, receivedAt: rec.receivedAt,
      });
      if (result.outcome === pipeline.OUTCOME.EXTRACTED && result.category === 'transaction_alert') {
        Object.assign(mark, { fields: result.fields, reason: result.reason, confidence: result.confidence });
        if (result.fields.merchant) updated += 1;
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.warn(`Re-parse failed for one message: ${err.message}`);
        continue; // transient error: try again next sync
      }
      // 404: email deleted from Gmail; keep the record as it is
    }
    await FinancialEmail.updateOne({ _id: rec._id }, { $set: mark });
  }
  if (stale.length) console.log(`📧 Re-parsed ${stale.length} payment email(s), ${updated} now have a merchant`);
  return updated;
};

// The user's saved preference decides the processing method on every job.
// Read from the database, never from the request.
const loadProcessingPrefs = (userId) =>
  UserPreferences.findOne({ userId }).select('userId aiEmailProcessingEnabled groqApiKey').lean();

// Groq key for AI processing: server key first, else the user's own key from Settings.
const groqKeyFrom = (prefs) => process.env.GROQ_API_KEY ||
  (prefs ? revealSecret(prefs.groqApiKey, contexts.groqKey(prefs.userId)).trim() : '') || null;

const isOAuthConfigured = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GMAIL_OAUTH_REDIRECT_URI);

const newOAuthClient = () => new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GMAIL_OAUTH_REDIRECT_URI,
);

const getAuthUrl = (state) => newOAuthClient().generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',            // always returns a refresh token
  include_granted_scopes: false,
  scope: [GMAIL_SCOPE],
  state,
});

// Exchange the OAuth code, verify the read-only scope was granted, and save the connection.
const completeConnection = async (userId, code) => {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error('Google did not return a refresh token');
  if (!String(tokens.scope || '').split(' ').includes(GMAIL_SCOPE)) {
    throw new Error('Gmail read permission was not granted');
  }
  client.setCredentials(tokens);
  const { data: profile } = await client.request({ url: `${GMAIL_API}/profile` });

  // Reconnecting issues a new refresh token; the old one stays valid at Google
  // until revoked, so revoke it instead of just overwriting it.
  const previous = await GmailConnection.findOne({ userId }).select('+refreshTokenEnc userId').lean();
  if (previous?.refreshTokenEnc) {
    const old = readRefreshToken(previous);
    if (old && old !== tokens.refresh_token) await revokeOnce(old);
  }

  return GmailConnection.findOneAndUpdate(
    { userId },
    {
      $set: {
        gmailAddress: String(profile.emailAddress || '').toLowerCase(),
        refreshTokenEnc: encrypt(tokens.refresh_token, contexts.gmailRefresh(userId)),
        status: 'active',
        lastEmailDate: null,
        backfillStatus: 'pending',
        lastError: '',
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
};

const clientForConnection = async (connectionId) => {
  const conn = await GmailConnection.findById(connectionId).select('+refreshTokenEnc');
  if (!conn) throw new Error('Gmail connection not found');
  let refreshToken;
  try {
    refreshToken = decrypt(conn.refreshTokenEnc, contexts.gmailRefresh(conn.userId));
    if (needsUpgrade(conn.refreshTokenEnc)) {
      // Re-encrypt legacy tokens bound to their owner (see utils/tokenCrypto).
      await GmailConnection.updateOne({ _id: conn._id, refreshTokenEnc: conn.refreshTokenEnc }, {
        $set: { refreshTokenEnc: encrypt(refreshToken, contexts.gmailRefresh(conn.userId)) },
      });
    }
  } catch (err) {
    // Token was encrypted with a different GMAIL_TOKEN_ENCRYPTION_KEY. It can never be
    // read again, so ask the user to reconnect instead of failing silently on every sync.
    await GmailConnection.updateOne({ _id: conn._id }, {
      $set: { status: 'revoked', lastError: 'Gmail needs to be reconnected. Please reconnect from the Bills tab.' },
    });
    throw new Error(`Stored Gmail token can't be decrypted (encryption key changed?): ${err.message}`);
  }
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return { conn, client };
};

const readRefreshToken = (conn) => {
  try { return decrypt(conn.refreshTokenEnc, contexts.gmailRefresh(conn.userId)); } catch { return null; }
};

// Google answers 400 invalid_token when the token is already revoked or expired.
const isDeadTokenError = (err) =>
  err.response?.status === 400 || /invalid_token|invalid_grant/i.test(err.message || '');

// One attempt to revoke at Google. Never stores the token for a retry: the caller
// deletes it either way, so we don't hold secrets the user asked us to remove.
// Returns false only when Google couldn't be reached (access may still be live).
const revokeOnce = async (refreshToken) => {
  try {
    await newOAuthClient().revokeToken(refreshToken);
    return true;
  } catch (err) {
    if (isDeadTokenError(err)) return true;
    console.warn('Gmail token revoke failed; token deleted locally, user told to revoke manually:', err.message);
    return false;
  }
};

// Revoke Google access and delete the stored token. Saved statements are kept.
// Returns false when Google couldn't be reached; the token is deleted anyway.
const disconnect = async (userId) => {
  const conn = await GmailConnection.findOne({ userId }).select('+refreshTokenEnc userId');
  if (!conn) return true;
  const token = readRefreshToken(conn);
  // An unreadable token can't be revoked here, so the user is told to do it manually.
  const revoked = token ? await revokeOnce(token) : false;
  await GmailConnection.deleteOne({ _id: conn._id });
  return revoked;
};

const listMessageIds = async (client, since) => {
  const afterSec = Math.floor(since.getTime() / 1000);
  const fromClause = OFFICIAL_BANK_DOMAINS.join(' OR ');
  const q = `after:${afterSec} from:(${fromClause})`;
  const ids = [];
  let pageToken;
  do {
    const { data } = await client.request({
      url: `${GMAIL_API}/messages`,
      params: { q, maxResults: 100, ...(pageToken ? { pageToken } : {}) },
    });
    (data.messages || []).forEach(m => ids.push(m.id));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < MAX_MESSAGES_PER_SYNC);
  return ids.slice(0, MAX_MESSAGES_PER_SYNC);
};

const syncLocks = new Set();

/**
 * Fetch and store new statements for one connection.
 * @returns {{ linked: Array, pending: Array }}
 */
const syncConnection = async (connectionId, { backfill = false } = {}) => {
  const key = String(connectionId);
  if (syncLocks.has(key)) return { linked: [], pending: [], busy: true };
  syncLocks.add(key);

  let conn;
  try {
    const ctx = await clientForConnection(connectionId);
    conn = ctx.conn;
    const { client } = ctx;
    if (conn.status === 'revoked') return { linked: [], pending: [] };

    const backfillStart = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);
    const since = backfill || !conn.lastEmailDate ? backfillStart : conn.lastEmailDate;
    if (backfill) await GmailConnection.updateOne({ _id: conn._id }, { $set: { backfillStatus: 'running' } });

    const ids = await listMessageIds(client, since);
    // Duplicate detection: a Gmail message is processed once per user, whichever store it ended up in.
    const [knownStatements, knownOther] = await Promise.all([
      CardStatement.find({ userId: conn.userId, gmailMessageId: { $in: ids } }, { gmailMessageId: 1 }).lean(),
      FinancialEmail.find({ userId: conn.userId, gmailMessageId: { $in: ids } }, { gmailMessageId: 1 }).lean(),
    ]);
    const known = new Set([...knownStatements, ...knownOther].map(s => s.gmailMessageId));

    const cards = await CreditCard.find({ userId: conn.userId }).lean();

    // Resolve the processing method from the saved preference. It is re-read
    // during long jobs so turning AI off takes effect without waiting for the next job.
    let method = 'deterministic';
    let aiSession = null;
    const refreshMethod = async () => {
      const prefs = await loadProcessingPrefs(conn.userId);
      const next = pipeline.methodForPreferences(prefs);
      if (next !== 'ai') { aiSession = null; method = next; return; }
      if (method !== 'ai' || !aiSession) {
        aiSession = pipeline.createAiSession({ apiKey: groqKeyFrom(prefs), maxCalls: MAX_AI_CALLS_PER_SYNC });
      }
      method = 'ai';
    };
    await refreshMethod();
    const aiRequested = method === 'ai';
    const aiAvailable = !!aiSession;

    const counts = {};
    const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };
    const linked = [];
    const pending = [];
    const touchedCards = new Set();
    let newest = conn.lastEmailDate || since;
    let fetchFailed = false;
    let processed = 0;

    for (const id of ids) {
      if (known.has(id)) continue;
      if (processed > 0 && processed % PREF_RECHECK_EVERY === 0) await refreshMethod();
      processed += 1;

      let msg;
      try {
        ({ data: msg } = await client.request({ url: `${GMAIL_API}/messages/${id}`, params: { format: 'raw' } }));
      } catch (err) {
        console.warn(`Gmail fetch failed for one message: ${err.message}`);
        fetchFailed = true; // don't move the cursor past it; it is retried next run
        continue;
      }
      const received = new Date(Number(msg.internalDate));
      if (received > newest) newest = received;

      const sinkCtx = { userId: conn.userId, conn, cards };
      let result;
      try {
        let raw = Buffer.from(msg.raw, 'base64url');
        msg = null; // drop the raw message as early as possible
        result = await pipeline.processRawEmail(raw, { method, messageId: id, receivedAt: received, aiSession });
        raw = null;
      } catch (err) {
        // Unreadable email from a bank sender: keep a review entry rather than dropping it.
        console.warn(`Email processing failed for one message: ${err.message}`);
        result = {
          outcome: pipeline.OUTCOME.REVIEW, category: null, reason: 'parse_error', processor: method, confidence: null,
          institution: { domain: '', rootDomain: '', name: '', templateId: null },
          email: { messageId: id, subject: '', from: '', sentAt: received, receivedAt: received },
          fields: {},
        };
      }
      bump(`${result.outcome}:${result.reason}`);

      const saved = await pipeline.sinks.persist(result, sinkCtx);
      if (saved.action === 'linked') {
        linked.push({ ...saved.doc, cardName: saved.card.name });
        touchedCards.add(String(saved.card._id));
      } else if (saved.action === 'pending') {
        pending.push(saved.doc);
      }
    }

    for (const cardId of touchedCards) await applyLatestToCard(cardId);
    try {
      await reparseStaleSuggestions(client, conn);
    } catch (err) {
      console.warn(`Payment re-parse skipped: ${err.message}`);
    }
    console.log(`📧 Gmail sync ${key}: ${ids.length} bank email(s), ${linked.length} linked, ${pending.length} pending, ` +
      `method ${method}${aiRequested ? `, AI calls ${aiSession?.calls || 0}${aiAvailable ? '' : ' (no Groq key)'}` : ''}, ` +
      `outcomes ${JSON.stringify(counts)}`);

    await GmailConnection.updateOne({ _id: conn._id }, {
      $set: {
        ...(fetchFailed ? {} : { lastEmailDate: newest }),
        lastScannedAt: new Date(),
        lastError: '',
        status: 'active',
        ...(backfill ? { backfillStatus: 'done' } : {}),
      },
    });

    const reviewCount = Object.entries(counts)
      .filter(([k]) => k.startsWith('review:')).reduce((n, [, v]) => n + v, 0);

    await notifyUser(conn.userId, linked, pending, backfill);
    if (reviewCount > 0) {
      await Notification.create({
        userId: conn.userId, title: '🔎 Bank emails need review',
        message: `${reviewCount} bank email(s) couldn't be read reliably, so nothing was recorded from them. Open the Bills tab to review.`,
        isRead: false, date: new Date(),
      });
    }
    return { linked, pending, review: reviewCount, outcomes: counts, method, aiRequested, aiAvailable };
  } catch (err) {
    const revoked = /invalid_grant/i.test(err.message || '') || err.response?.status === 401;
    console.error(`Gmail sync failed for connection ${key}:`, err.message);
    if (conn) {
      await GmailConnection.updateOne({ _id: conn._id }, {
        $set: {
          status: revoked ? 'revoked' : 'error',
          lastError: revoked ? 'Gmail access was revoked. Please reconnect.' : 'Last scan failed. It will retry automatically in a few minutes.',
          ...(backfill ? { backfillStatus: 'failed' } : {}),
        },
      });
      if (revoked) {
        await Notification.create({
          userId: conn.userId, title: '📭 Gmail disconnected',
          message: 'Wallo can no longer read your Gmail. Reconnect it from the Bills tab to keep tracking statements.',
          isRead: false, date: new Date(),
        });
      }
    }
    throw err;
  } finally {
    syncLocks.delete(key);
  }
};

const fmtINR = (n) => (n != null
  ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
  : 'N/A');
const fmtDate = (d) => (d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
  : 'N/A');

const notifyUser = async (userId, linked, pending, backfill) => {
  if (linked.length === 0 && pending.length === 0) return;

  // Group pending statements by card so the user sees each card once.
  const pendingCards = new Map();
  pending.forEach(p => pendingCards.set(`${p.senderDomain}|${p.last4 || ''}`, p));

  // Newest linked statement per card for the summary
  const latestByCard = new Map();
  linked.forEach(l => {
    const prev = latestByCard.get(String(l.cardId));
    if (!prev || l.statementDate > prev.statementDate) latestByCard.set(String(l.cardId), l);
  });

  if (latestByCard.size > 0) {
    await Notification.create({
      userId, title: '💳 Credit card statements found',
      message: `Updated from Gmail: ${[...latestByCard.values()].map(l => l.cardName).join(', ')}`.slice(0, 500),
      isRead: false, date: new Date(),
    });
  }
  if (pendingCards.size > 0) {
    await Notification.create({
      userId, title: '🆕 Untracked cards found in Gmail',
      message: `Found statements for ${pendingCards.size} card(s) you don't track yet. Open the Bills tab to add or ignore them.`,
      isRead: false, date: new Date(),
    });
  }

  const [user, prefs] = await Promise.all([
    User.findById(userId).select('email name').lean(),
    UserPreferences.findOne({ userId }).lean(),
  ]);
  if (!user?.email || prefs?.emailAlertsEnabled === false) return;

  const rows = [...latestByCard.values()].map(l => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #2a1f15;color:#E5BA73;font-weight:bold;">${escapeHtml(l.cardName)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #2a1f15;text-align:right;color:#f1dfd3;">${escapeHtml(fmtINR(l.amount))}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #2a1f15;text-align:right;color:#f1dfd3;">${escapeHtml(fmtDate(l.dueDate))}</td>
    </tr>`).join('');
  const pendingList = [...pendingCards.values()].map(p =>
    `<li style="margin:4px 0;">${escapeHtml(p.bankName)}${p.last4 ? ` ····${escapeHtml(p.last4)}` : ''}</li>`).join('');
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:28px 20px;background:#1A120B;color:#F1DFD3;border-radius:16px;">
    <h1 style="color:#E5BA73;font-size:22px;margin:0 0 4px;text-align:center;">Wallo</h1>
    <p style="text-align:center;opacity:.6;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 20px;">${backfill ? 'Gmail connected' : 'New statements'}</p>
    <p>Hi ${escapeHtml(user.name || 'there')},</p>
    ${rows ? `<p>We found new statements for your tracked cards:</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="color:#9a8f80;font-size:10px;text-transform:uppercase;"><th style="text-align:left;padding:6px 12px;">Card</th><th style="text-align:right;padding:6px 12px;">Amount</th><th style="text-align:right;padding:6px 12px;">Due</th></tr>
      ${rows}
    </table>
    <p style="font-size:12px;opacity:.7;">We'll email you one day before each due date.</p>` : ''}
    ${pendingList ? `<p>We also found statements for cards you don't track yet:</p><ul style="font-size:13px;">${pendingList}</ul>
    <p>Open the Bills tab in Wallo to add them for future tracking, or ignore them.</p>` : ''}
    ${base ? `<p style="text-align:center;margin-top:20px;"><a href="${escapeHtml(base)}/cyclic" style="background:#E5BA73;color:#1A120B;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:10px;">Open Wallo</a></p>` : ''}
  </div>`;

  await sendEmail(user.email, backfill ? '💳 Gmail connected — statements found' : '💳 New credit card statements', html);
};

/**
 * Quick incremental sync for one user (on app load / opening Add Expense).
 * Skips when there is no usable connection, the first backfill isn't done, or the
 * account was scanned within minAgeMs, so repeated page loads cost nothing.
 * @returns {{ synced: boolean, newSuggestions?: number }}
 */
const syncNewForUser = async (userId, { minAgeMs = 60 * 1000 } = {}) => {
  const conn = await GmailConnection.findOne({ userId, status: { $in: ['active', 'error'] } })
    .select('_id backfillStatus lastScannedAt').lean();
  if (!conn || conn.backfillStatus !== 'done') return { synced: false };
  if (conn.lastScannedAt && Date.now() - new Date(conn.lastScannedAt).getTime() < minAgeMs) return { synced: false };
  const result = await syncConnection(conn._id);
  if (result.busy) return { synced: false };
  return { synced: true };
};

// Scheduled job: sync every active connection, one at a time.
const syncAllConnections = async () => {
  const conns = await GmailConnection.find({ status: { $in: ['active', 'error'] } }).select('_id').lean();
  console.log(`📧 Gmail statement sync: ${conns.length} connected account(s)`);
  for (const c of conns) {
    try { await syncConnection(c._id); } catch { /* logged inside */ }
  }
};

module.exports = {
  GMAIL_SCOPE,
  isOAuthConfigured,
  getAuthUrl,
  completeConnection,
  disconnect,
  syncConnection,
  syncAllConnections,
  syncNewForUser,
  applyLatestToCard,
  clientForConnection,
  GMAIL_API,
  rootDomainFor,
};
