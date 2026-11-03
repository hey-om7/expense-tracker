/**
 * gmailSync.js
 * Per-user Gmail statement sync using Google OAuth (gmail.readonly).
 *  - first connect: backfill the last 90 days
 *  - daily (06:00 IST): fetch only emails newer than the last scan
 * Statements for tracked cards are linked and update the card's current bill,
 * which drives the existing "due tomorrow" reminder in cronJobs.processCreditCards.
 * Statements for untracked cards are stored as "pending" until the user decides.
 */
const { OAuth2Client } = require('google-auth-library');
const GmailConnection = require('../models/GmailConnection');
const CardStatement = require('../models/CardStatement');
const CreditCard = require('../models/CreditCard');
const Notification = require('../models/Notification');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');
const { parseBillFromRaw, OFFICIAL_BANK_DOMAINS } = require('./gmailScanner');
const { sendEmail } = require('./emailService');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const { escapeHtml } = require('../utils/security');

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const BACKFILL_DAYS = 90;
const MAX_MESSAGES_PER_SYNC = 500;

const BANK_NAMES = {
  'icicibank.com': 'ICICI Bank', 'icici.bank.in': 'ICICI Bank',
  'hdfcbank.net': 'HDFC Bank', 'hdfcbank.com': 'HDFC Bank',
  'axisbank.com': 'Axis Bank', 'sbicard.com': 'SBI Card', 'kotak.com': 'Kotak',
  'idfcfirstbank.com': 'IDFC FIRST', 'aexp.com': 'American Express',
  'americanexpress.com': 'American Express', 'indusind.com': 'IndusInd',
  'rblbank.com': 'RBL Bank', 'sc.com': 'Standard Chartered', 'citi.com': 'Citi',
  'citibank.com': 'Citi', 'hsbc.co.in': 'HSBC', 'hsbc.com': 'HSBC',
  'yesbank.in': 'Yes Bank', 'getonecard.app': 'OneCard', 'uni.cards': 'Uni Card',
  'sliceit.com': 'Slice',
};
const bankNameFor = (domain = '') => {
  const key = Object.keys(BANK_NAMES).find(d => domain === d || domain.endsWith('.' + d));
  return key ? BANK_NAMES[key] : domain;
};
// Root bank domain, so "statements.hdfcbank.net" and "hdfcbank.net" are the same bank.
const rootDomainFor = (domain = '') =>
  OFFICIAL_BANK_DOMAINS.find(d => domain === d || domain.endsWith('.' + d)) || domain;

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

  return GmailConnection.findOneAndUpdate(
    { userId },
    {
      $set: {
        gmailAddress: String(profile.emailAddress || '').toLowerCase(),
        refreshTokenEnc: encrypt(tokens.refresh_token),
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
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: decrypt(conn.refreshTokenEnc) });
  return { conn, client };
};

// Revoke Google access and delete the stored token. Saved statements are kept.
const disconnect = async (userId) => {
  const conn = await GmailConnection.findOne({ userId }).select('+refreshTokenEnc');
  if (!conn) return;
  try {
    await newOAuthClient().revokeToken(decrypt(conn.refreshTokenEnc));
  } catch (err) {
    console.warn('Gmail token revoke failed (deleting anyway):', err.message);
  }
  await GmailConnection.deleteOne({ _id: conn._id });
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

const matchCard = (cards, bill) => {
  if (bill.last4 && bill.last4.length >= 2) {
    const byDigits = cards.filter(c => String(c.last4Digits).endsWith(bill.last4));
    if (byDigits.length === 1) return byDigits[0];
    if (byDigits.length > 1) return null; // ambiguous — let the user decide
  }
  const haystack = `${bill.subject} ${bill.from} ${bankNameFor(bill.domain)}`.toLowerCase();
  const byName = cards.filter(c =>
    c.name.toLowerCase().split(/\s+/).some(w => w.length > 3 && haystack.includes(w)));
  return byName.length === 1 ? byName[0] : null;
};

const isIgnored = (conn, domain, last4) =>
  (conn.ignoredCards || []).some(i =>
    i.domain === rootDomainFor(domain) && (!i.last4 || !last4 || i.last4 === last4));

// Apply the newest linked statement to its card (drives due-date reminders).
const applyLatestToCard = async (cardId) => {
  const latest = await CardStatement.findOne({ cardId, status: 'linked' }).sort({ statementDate: -1 }).lean();
  if (!latest) return;
  const update = { billGeneratedDate: latest.statementDate };
  if (latest.amount != null) update.billAmount = latest.amount;
  if (latest.dueDate) update.billDueDate = latest.dueDate;
  await CreditCard.updateOne({ _id: cardId }, { $set: update });
};

const syncLocks = new Set();

/**
 * Fetch and store new statements for one connection.
 * @returns {{ linked: Array, pending: Array }}
 */
const syncConnection = async (connectionId, { backfill = false } = {}) => {
  const key = String(connectionId);
  if (syncLocks.has(key)) return { linked: [], pending: [], skipped: true };
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
    const known = new Set((await CardStatement.find(
      { userId: conn.userId, gmailMessageId: { $in: ids } }, { gmailMessageId: 1 },
    ).lean()).map(s => s.gmailMessageId));

    const cards = await CreditCard.find({ userId: conn.userId }).lean();
    const linked = [];
    const pending = [];
    const touchedCards = new Set();
    let newest = conn.lastEmailDate || since;

    for (const id of ids) {
      if (known.has(id)) continue;
      let msg;
      try {
        ({ data: msg } = await client.request({ url: `${GMAIL_API}/messages/${id}`, params: { format: 'raw' } }));
      } catch (err) {
        console.warn(`Gmail fetch failed for one message: ${err.message}`);
        continue;
      }
      const received = new Date(Number(msg.internalDate));
      if (received > newest) newest = received;

      let bill;
      try {
        bill = await parseBillFromRaw(Buffer.from(msg.raw, 'base64url'));
      } catch {
        continue;
      }
      if (!bill) continue;

      const card = matchCard(cards, bill);
      const status = card ? 'linked' : isIgnored(conn, bill.domain, bill.last4) ? 'dismissed' : 'pending';
      const doc = {
        userId: conn.userId,
        cardId: card?._id || null,
        status,
        gmailMessageId: id,
        bankName: bankNameFor(bill.domain),
        senderDomain: rootDomainFor(bill.domain),
        last4: bill.last4,
        amount: bill.amount,
        dueDate: bill.dueDate instanceof Date && !isNaN(bill.dueDate) ? bill.dueDate : null,
        statementDate: received,
        subject: bill.subject,
      };
      try {
        await CardStatement.create(doc);
      } catch (err) {
        if (err.code === 11000) continue; // stored by a concurrent run
        throw err;
      }
      if (status === 'linked') { linked.push({ ...doc, cardName: card.name }); touchedCards.add(String(card._id)); }
      if (status === 'pending') pending.push(doc);
    }

    for (const cardId of touchedCards) await applyLatestToCard(cardId);

    await GmailConnection.updateOne({ _id: conn._id }, {
      $set: {
        lastEmailDate: newest,
        lastScannedAt: new Date(),
        lastError: '',
        status: 'active',
        ...(backfill ? { backfillStatus: 'done' } : {}),
      },
    });

    await notifyUser(conn.userId, linked, pending, backfill);
    return { linked, pending };
  } catch (err) {
    const revoked = /invalid_grant/i.test(err.message || '') || err.response?.status === 401;
    console.error(`Gmail sync failed for connection ${key}:`, err.message);
    if (conn) {
      await GmailConnection.updateOne({ _id: conn._id }, {
        $set: {
          status: revoked ? 'revoked' : 'error',
          lastError: revoked ? 'Gmail access was revoked. Please reconnect.' : 'Last scan failed. It will retry tomorrow.',
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

// Daily job: sync every active connection, one at a time.
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
  applyLatestToCard,
  rootDomainFor,
};
