/**
 * Settings → AI training.
 *
 *  listTypes(userId)            – email types (bank + subject shape) that feed expense
 *                                 suggestions, with one sample email each.
 *  getSample(userId, id)        – that email's body, read live from Gmail (bodies are never
 *                                 stored), the values Vestor extracted and where they are.
 *  train(userId, id, marks)     – the user marked the right text for each value. Patterns
 *                                 are built from the text around the marks and saved as the
 *                                 user's EmailRule (and shared, see below), then re-applied to
 *                                 this user's recorded emails of the same type.
 *
 * Patterns are also written to SharedEmailPattern so other users' emails of the same
 * type are read the same way without AI. Values are always read from each user's own
 * email, so a shared pattern can't put one user's data into another user's account.
 */
const FinancialEmail = require('../models/FinancialEmail');
const EmailRule = require('../models/EmailRule');
const SharedEmailPattern = require('../models/SharedEmailPattern');
const GmailConnection = require('../models/GmailConnection');
const pipeline = require('./emailProcessing');
const gmail = require('./gmailSync');
const { identifyInstitution } = require('./emailProcessing/institutions');
const { PAYMENT_SUGGESTION_DOMAINS } = require('./emailProcessing/institutions');
const { OUTCOME } = require('./emailProcessing/result');
const { TRAINABLE_FIELDS, buildPattern, parseValue } = require('./emailProcessing/trainedPatterns');

const { rules } = pipeline;
const LIST_DAYS = 90;
const MAX_REAPPLY = 25;
const CATEGORY = 'transaction_alert';

class TrainingError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Same emails the expense suggestions are built from (routes/gmailScan.js /suggestions).
const trackedFilter = (userId) => ({
  userId,
  status: 'recorded',
  category: CATEGORY,
  receivedAt: { $gte: new Date(Date.now() - LIST_DAYS * 864e5) },
  $or: [
    { senderDomain: { $in: PAYMENT_SUGGESTION_DOMAINS } },
    { 'fields.paymentMethod': { $in: ['credit_card', 'debit_card'] } },
    { processor: { $in: ['ai', 'shared'] } },
  ],
});

const publicFields = (f = {}) => ({
  amount: f.amount ?? null,
  transactionDate: f.transactionDate ?? null,
  merchant: f.merchant ?? null,
  last4: f.last4 ?? null,
  paymentMethod: f.paymentMethod ?? null,
  transactionType: f.transactionType ?? null,
});

const listTypes = async (userId) => {
  const docs = await FinancialEmail.find(trackedFilter(userId))
    .select('institutionName senderDomain subject receivedAt fields processor reason suggestionState')
    .sort({ receivedAt: -1 }).limit(1000).lean();
  const userRules = await EmailRule.find({ userId, category: CATEGORY })
    .select('senderDomain subjectKey trainedAt').lean();
  const ruleFor = new Map(userRules.map(r => [`${r.senderDomain}|${r.subjectKey}`, r]));

  const groups = new Map();
  for (const d of docs) {
    const key = `${d.senderDomain}|${rules.subjectKey(d.subject)}`;
    let g = groups.get(key);
    if (!g) {
      const rule = ruleFor.get(key);
      g = {
        key,
        institutionName: d.institutionName || d.senderDomain,
        senderDomain: d.senderDomain,
        // The newest email of the type is the sample.
        sample: { id: String(d._id), subject: d.subject, receivedAt: d.receivedAt, fields: publicFields(d.fields), processor: d.processor },
        count: 0,
        missingMerchant: 0,
        trainedAt: rule?.trainedAt || null,
      };
      groups.set(key, g);
    }
    g.count += 1;
    if (!d.fields?.merchant) g.missingMerchant += 1;
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
};

const findTracked = async (userId, id) => {
  const doc = await FinancialEmail.findOne({ ...trackedFilter(userId), _id: id });
  if (!doc) throw new TrainingError(404, 'Email not found');
  return doc;
};

const clientFor = async (userId) => {
  const conn = await GmailConnection.findOne({ userId, status: { $ne: 'revoked' } }).select('_id').lean();
  if (!conn) throw new TrainingError(400, 'Connect your Gmail first.');
  return (await gmail.clientForConnection(conn._id)).client;
};

const fetchEmail = async (client, doc) => {
  let msg;
  try {
    ({ data: msg } = await client.request({ url: `${gmail.GMAIL_API}/messages/${encodeURIComponent(doc.gmailMessageId)}`, params: { format: 'raw' } }));
  } catch (err) {
    if (err.response?.status === 404) throw new TrainingError(404, 'This email is no longer in your Gmail.');
    throw new TrainingError(502, 'Could not read this email from Gmail. Please try again.');
  }
  return pipeline.normalizeEmail(Buffer.from(msg.raw, 'base64url'), { messageId: doc.gmailMessageId, receivedAt: doc.receivedAt });
};

// Where each extracted value is written in the text, for highlighting.
const spanOf = (field, value, text) => {
  if (value == null) return null;
  if (field === 'merchant') {
    const i = text.toLowerCase().indexOf(String(value).toLowerCase());
    return i >= 0 ? { start: i, end: i + String(value).length } : null;
  }
  const tokens = {
    amount: /[0-9][0-9,]*(?:\.[0-9]{1,2})?/g,
    last4: /[xX*]*\d{2,4}\b/g,
    transactionDate: /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?[\s,-]+[A-Za-z]{3,9}[\s,-]+'?\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}/g,
  }[field];
  for (const m of text.matchAll(tokens)) {
    const v = parseValue(field, m[0]);
    const same = field === 'transactionDate'
      ? v && new Date(value).toDateString() === v.toDateString()
      : String(v) === String(value);
    if (same) return { start: m.index, end: m.index + m[0].length };
  }
  return null;
};

const getSample = async (userId, id) => {
  const doc = await findTracked(userId, id);
  const email = await fetchEmail(await clientFor(userId), doc);
  const fields = publicFields(doc.fields);
  const spans = Object.fromEntries(TRAINABLE_FIELDS.map(f => [f, spanOf(f, fields[f], email.text)]));
  return {
    id: String(doc._id),
    subject: email.subject,
    from: `${email.fromName} <${email.fromAddr}>`,
    receivedAt: doc.receivedAt,
    institutionName: doc.institutionName || doc.senderDomain,
    text: email.text,
    fields,
    spans,
    fieldNames: TRAINABLE_FIELDS,
  };
};

const validMark = (m, length) => m && Number.isInteger(m.start) && Number.isInteger(m.end)
  && m.start >= 0 && m.end > m.start && m.end <= length && m.end - m.start <= 120;

/**
 * @param {{ [field]: { start: number, end: number } | null }} marks  offsets in sample.text;
 *        null clears a field's pattern, a missing field is left as it is.
 */
const train = async (userId, id, marks = {}) => {
  const doc = await findTracked(userId, id);
  const client = await clientFor(userId);
  const email = pipeline.classifySender(await fetchEmail(client, doc), { rules: [{ senderDomain: doc.senderDomain }] });
  if (!email.authenticated) throw new TrainingError(422, "This email's sender couldn't be verified, so it can't be used for training.");

  const patterns = {};
  const values = {};
  const spans = TRAINABLE_FIELDS.filter(f => marks[f] && validMark(marks[f], email.text.length)).map(f => marks[f]);
  for (const f of TRAINABLE_FIELDS) {
    if (!(f in marks)) continue;
    if (marks[f] === null) { patterns[f] = null; continue; }
    if (!validMark(marks[f], email.text.length)) throw new TrainingError(400, `Mark the ${f} again; the selection is not valid.`);
    const built = buildPattern(email.text, f, marks[f].start, marks[f].end, spans.filter(s => s !== marks[f]));
    if (built.error) throw new TrainingError(422, `Couldn't learn the ${f}: ${built.error}.`);
    patterns[f] = built.source;
    values[f] = built.value;
  }
  if (!Object.keys(patterns).length) throw new TrainingError(400, 'Mark at least one value.');

  const senderDomain = doc.senderDomain;
  const subjectKey = rules.subjectKey(doc.subject);
  const set = Object.fromEntries(Object.entries(patterns).map(([f, s]) => [`patterns.${f}`, s]));
  const rule = await EmailRule.findOneAndUpdate(
    { userId, senderDomain, subjectKey },
    {
      $set: { ...set, trainedAt: new Date(), sampleSubject: doc.subject, institutionName: doc.institutionName },
      $setOnInsert: { category: CATEGORY },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();
  await SharedEmailPattern.updateOne(
    { senderDomain, subjectKey },
    { $set: { ...set, verdict: 'financial', category: CATEGORY }, $setOnInsert: { aiVerdicts: 0 } },
    { upsert: true },
  ).catch(err => console.warn(`[training] shared pattern not saved: ${err.message}`));

  // Re-read this type's recorded emails with the new rule (local only, no AI).
  const same = (await FinancialEmail.find({ ...trackedFilter(userId), senderDomain }).sort({ receivedAt: -1 }).limit(200))
    .filter(d => rules.subjectKey(d.subject) === subjectKey).slice(0, MAX_REAPPLY);
  let updated = 0;
  let sampleFields = null;
  for (const d of same) {
    try {
      const e = String(d._id) === String(doc._id) ? email : await fetchEmail(client, d);
      const result = rules.resultFromRule(e, identifyInstitution(e.domain), rule, 'deterministic');
      if (result.outcome !== OUTCOME.EXTRACTED) continue;
      await FinancialEmail.updateOne({ _id: d._id }, { $set: { fields: result.fields, reason: 'user_trained', confidence: result.confidence } });
      updated += 1;
      if (String(d._id) === String(doc._id)) sampleFields = publicFields(result.fields);
    } catch (err) {
      console.warn(`[training] could not re-read one email: ${err.message}`);
    }
  }
  const fields = sampleFields || publicFields(doc.fields);
  return {
    learned: Object.keys(patterns).filter(f => patterns[f]),
    values,
    fields,
    spans: Object.fromEntries(TRAINABLE_FIELDS.map(f => [f, spanOf(f, fields[f], email.text)])),
    updated,
  };
};

/** Forget the trained patterns for this email's type. */
const reset = async (userId, id) => {
  const doc = await findTracked(userId, id);
  const r = await EmailRule.updateOne(
    { userId, senderDomain: doc.senderDomain, subjectKey: rules.subjectKey(doc.subject) },
    { $set: { patterns: {}, trainedAt: null } },
  );
  return { reset: r.modifiedCount > 0 };
};

module.exports = { listTypes, getSample, train, reset, TrainingError };
