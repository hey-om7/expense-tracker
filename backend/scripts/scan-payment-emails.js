/**
 * Demo / backfill: scan past PhonePe and Kotak payment emails for every
 * connected Gmail account and show what the parser detects.
 *
 *   node scripts/scan-payment-emails.js                 # dry run, last 60 days
 *   node scripts/scan-payment-emails.js --days 120      # wider window
 *   node scripts/scan-payment-emails.js --dump          # also print the email text (to tune patterns)
 *   node scripts/scan-payment-emails.js --apply         # store detections so they appear as suggestions
 *
 * Read-only on Gmail. With --apply it only inserts or updates FinancialEmail records
 * for these senders; it never deletes anything.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const GmailConnection = require('../models/GmailConnection');
const FinancialEmail = require('../models/FinancialEmail');
const { clientForConnection, GMAIL_API } = require('../services/gmailSync');
const pipeline = require('../services/emailProcessing');
const { normalizeEmail } = require('../services/emailProcessing/normalize');
const { PAYMENT_SUGGESTION_DOMAINS } = require('../services/emailProcessing/institutions');

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
};
const DAYS = Number(arg('--days', 60));
const APPLY = process.argv.includes('--apply');
const DUMP = process.argv.includes('--dump');
const LIMIT = Number(arg('--limit', 200));

const scanConnection = async (connId) => {
  const { conn, client } = await clientForConnection(connId);
  const after = Math.floor((Date.now() - DAYS * 864e5) / 1000);
  const q = `after:${after} from:(${PAYMENT_SUGGESTION_DOMAINS.join(' OR ')})`;
  const ids = [];
  let pageToken;
  do {
    const { data } = await client.request({ url: `${GMAIL_API}/messages`, params: { q, maxResults: 100, ...(pageToken ? { pageToken } : {}) } });
    (data.messages || []).forEach(m => ids.push(m.id));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < LIMIT);

  console.log(`\n📬 ${conn.gmailAddress}: ${ids.length} PhonePe/Kotak email(s) in the last ${DAYS} days`);
  const tally = {};
  for (const id of ids.slice(0, LIMIT)) {
    const { data: msg } = await client.request({ url: `${GMAIL_API}/messages/${id}`, params: { format: 'raw' } });
    const raw = Buffer.from(msg.raw, 'base64url');
    const receivedAt = new Date(Number(msg.internalDate));
    const result = await pipeline.processRawEmail(raw, { method: 'deterministic', messageId: id, receivedAt });
    const key = `${result.outcome}:${result.reason}`;
    tally[key] = (tally[key] || 0) + 1;
    const f = result.fields || {};
    const line = result.outcome === 'extracted'
      ? `✅ ${result.institution.name.padEnd(8)} ₹${String(f.amount).padEnd(9)} ${String(f.merchant || '—').slice(0, 30).padEnd(30)} ${f.transactionType || ''}/${f.paymentMethod || ''} ${(f.transactionDate || receivedAt).toISOString().slice(0, 10)}`
      : `·  ${result.institution.name.padEnd(8)} ${key}`;
    console.log(`  ${line}  | ${result.email.subject.slice(0, 70)}`);
    if (DUMP) {
      const email = await normalizeEmail(raw, { messageId: id, receivedAt });
      console.log(`     from ${email.fromAddr} auth=${email.authenticated}\n     ${email.text.slice(0, 900).replace(/\s+/g, ' ')}\n`);
    }
    if (APPLY && result.outcome !== 'ignored') {
      await FinancialEmail.deleteOne({ userId: conn.userId, gmailMessageId: id, suggestionState: { $in: [null, 'open'] } });
      await pipeline.sinks.persist(result, { userId: conn.userId, conn, cards: [] });
    }
  }
  console.log(`  outcomes: ${JSON.stringify(tally)}`);
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const conns = await GmailConnection.find({ status: { $in: ['active', 'error'] } }).select('_id').lean();
  if (!conns.length) console.log('No connected Gmail accounts.');
  for (const c of conns) {
    try { await scanConnection(c._id); } catch (e) { console.error(`  failed: ${e.message}`); }
  }
  if (!APPLY) console.log('\nDry run. Re-run with --apply to store these as expense suggestions.');
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
