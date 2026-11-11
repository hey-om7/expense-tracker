/**
 * Review queue actions for bank emails Vestor couldn't read on its own.
 *
 *  analyze(userId, id)  – re-read the email from Gmail and ask AI what it is.
 *                         The answer is saved as a proposal; nothing is recorded yet.
 *  confirm(userId, id)  – record the email using the (possibly corrected) proposal and,
 *                         if asked, remember this email type as an EmailRule so the
 *                         same kind of email is read locally, without AI, from now on.
 *                         Other waiting emails of the same type are resolved right away.
 */
const FinancialEmail = require('../models/FinancialEmail');
const CardStatement = require('../models/CardStatement');
const CreditCard = require('../models/CreditCard');
const EmailRule = require('../models/EmailRule');
const GmailConnection = require('../models/GmailConnection');
const pipeline = require('./emailProcessing');
const { identifyInstitution } = require('./emailProcessing/institutions');
const { sanitizeFields, buildResult } = require('./emailProcessing/result');
const cardStatementSink = require('./emailProcessing/sinks/cardStatement');
const gmail = require('./gmailSync');
const { resolveModel } = require('./aiService');
const statementPasswords = require('./statementPasswords');
const { readStatementPdf, withPdfText } = require('./emailProcessing/pdfText');

const { OUTCOME, rules } = pipeline;
const MAX_SIMILAR = 25;

class ReviewError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const fetchEmail = async (client, doc) => {
  let msg;
  try {
    ({ data: msg } = await client.request({ url: `${gmail.GMAIL_API}/messages/${doc.gmailMessageId}`, params: { format: 'raw' } }));
  } catch (err) {
    if (err.response?.status === 404) throw new ReviewError(404, 'This email is no longer in your Gmail.');
    throw new ReviewError(502, 'Could not read this email from Gmail. Please try again.');
  }
  return pipeline.normalizeEmail(Buffer.from(msg.raw, 'base64url'), { messageId: doc.gmailMessageId, receivedAt: doc.receivedAt });
};

const gmailClient = async (userId) => {
  const conn = await GmailConnection.findOne({ userId, status: { $ne: 'revoked' } }).select('_id').lean();
  if (!conn) throw new ReviewError(400, 'Connect your Gmail first.');
  return gmail.clientForConnection(conn._id);
};

const findReview = async (userId, id) => {
  const doc = await FinancialEmail.findOne({ _id: id, userId, status: 'review' });
  if (!doc) throw new ReviewError(404, 'Email not found');
  return doc;
};

const analyze = async (userId, id, { password, rememberPassword = true } = {}) => {
  const doc = await findReview(userId, id);
  const prefs = await gmail.loadProcessingPrefs(userId);
  // Same model the user picked in Settings for the AI assistant.
  const aiSession = pipeline.createAiSession({ apiKey: gmail.groqKeyFrom(prefs), maxCalls: 1, model: resolveModel(prefs?.aiModel) });
  if (!aiSession) throw new ReviewError(400, 'Add a Groq API key in Settings to analyze emails with AI.');

  const { client } = await gmailClient(userId);
  const [userRules, shared] = await Promise.all([
    EmailRule.find({ userId }).select('senderDomain').lean(),
    pipeline.createSharedKnowledge(userId),
  ]);
  const email = pipeline.classifySender(await fetchEmail(client, doc), { rules: userRules, shared });
  // Same protection as automatic processing: forged or unrelated emails never reach AI.
  // New senders are allowed when their content looks like a bank email (discovery.js).
  if (!(email.knownSender || email.senderStatus === 'candidate') || !email.authenticated) {
    throw new ReviewError(422, "This email's sender couldn't be verified, so it won't be sent to AI.");
  }

  // Attached statement PDF: open it with the typed password, else the saved one for this bank.
  let target = email;
  let pdf = null;
  if (email.pdfs?.length) {
    const saved = (await statementPasswords.loadAll(userId)).get(doc.senderDomain);
    const read = await readStatementPdf(email, [password, saved].filter(Boolean));
    if (read.status === 'needs_password') {
      if (password) throw new ReviewError(422, "That password didn't open the PDF. Check it and try again.");
      return { needsPassword: true, filename: read.filename, savedPasswordFailed: !!saved };
    }
    if (read.status === 'ok' && read.text.length > 20) {
      target = withPdfText(email, read.text);
      pdf = { filename: read.filename, read: true };
      if (read.password && read.password === password && rememberPassword) {
        await statementPasswords.save(userId, doc.senderDomain, password);
        pdf.passwordSaved = true;
      } else if (read.password && read.password === saved) {
        await statementPasswords.touch(userId, doc.senderDomain);
      }
    } else {
      // Scanned image PDFs have no text layer; continue with the email body.
      pdf = { filename: read.filename, read: false };
    }
  }

  let proposal;
  try {
    proposal = await pipeline.analyzeWithAi(target, aiSession);
  } catch (err) {
    console.warn(`[email-review] AI analysis failed: ${err.message}`);
    throw new ReviewError(502, 'AI analysis failed. Please try again in a moment.');
  }
  proposal.anchors = rules.learnAnchors(target, proposal.fields);
  proposal.usesPdf = !!pdf?.read;
  proposal.analyzedAt = new Date();
  await FinancialEmail.updateOne({ _id: doc._id }, { $set: { proposal } });
  return { ...publicProposal(proposal), pdf };
};

const publicProposal = (p) => ({
  category: p.category,
  confidence: p.confidence,
  fields: p.fields,
  // Which values a remembered rule will be able to find again next time.
  learnable: Object.fromEntries(rules.ANCHOR_FIELDS.map(f => [f, !!p.anchors?.[f]])),
});

const parseDate = (v) => {
  if (v == null || v === '') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

// The user may correct the category and key values before saving.
const applyCorrections = (proposal, body) => {
  const allowed = rules.CONFIRMABLE();
  const category = allowed.includes(body.category) ? body.category : proposal.category;
  const fields = { ...proposal.fields };
  if (body.amount !== undefined) fields.amount = body.amount === null || body.amount === '' ? null : Number(body.amount);
  ['dueDate', 'statementDate'].forEach((f) => {
    if (body[f] === undefined) return;
    const d = parseDate(body[f]);
    if (d !== undefined) fields[f] = d;
  });
  if (body.last4 !== undefined) fields.last4 = body.last4;
  return { category, fields: sanitizeFields(fields) };
};

// Keep a learned label only if the user kept the value it was learned from.
const confirmedAnchors = (proposal, fields) => {
  const sameValue = (a, b) => (a instanceof Date || b instanceof Date
    ? a && b && new Date(a).toDateString() === new Date(b).toDateString()
    : a === b);
  return Object.fromEntries(rules.ANCHOR_FIELDS.map(f => [
    f, proposal.anchors?.[f] && sameValue(proposal.fields?.[f], fields[f]) ? proposal.anchors[f] : null,
  ]));
};

/**
 * Turn one review item into its final record.
 * credit card statements move to CardStatement; ignored emails are dismissed;
 * anything else becomes a "recorded" FinancialEmail.
 */
const resolveReviewDoc = async (doc, result, ctx) => {
  if (result.outcome === OUTCOME.REVIEW) return 'review';
  if (result.outcome === OUTCOME.IGNORED) {
    await FinancialEmail.updateOne({ _id: doc._id }, { $set: { status: 'dismissed', reason: result.reason, proposal: null } });
    return 'dismissed';
  }
  if (result.category === 'credit_card_statement') {
    const saved = await cardStatementSink.save(result, ctx);
    await FinancialEmail.deleteOne({ _id: doc._id });
    if (saved.action === 'linked') await cardStatementSink.applyLatestToCard(saved.card._id);
    return saved.action === 'duplicate' ? 'recorded' : saved.action;
  }
  await FinancialEmail.updateOne({ _id: doc._id }, {
    $set: {
      status: 'recorded', category: result.category, reason: result.reason, processor: result.processor,
      confidence: result.confidence, fields: result.fields, proposal: null,
    },
  });
  return 'recorded';
};

const sinkContext = async (userId) => ({
  userId,
  conn: await GmailConnection.findOne({ userId }).lean() || {},
  cards: await CreditCard.find({ userId }).lean(),
});

// Resolve other waiting emails of the same type with the new rule (local rules only, no AI).
const applyToSimilar = async (userId, rule, exceptId, client, ctx) => {
  const candidates = await FinancialEmail.find({
    userId, status: 'review', senderDomain: rule.senderDomain, _id: { $ne: exceptId },
  }).limit(200);
  const same = candidates.filter(d => rules.subjectKey(d.subject) === rule.subjectKey).slice(0, MAX_SIMILAR);
  let resolved = 0;
  const passwords = rule.usesPdf ? await statementPasswords.loadAll(userId) : new Map();
  for (const doc of same) {
    try {
      const email = pipeline.classifySender(await fetchEmail(client, doc), { rules: [rule] });
      if (!email.knownSender || !email.authenticated) continue;
      const institution = identifyInstitution(email.domain);
      const result = await rules.applyRule(email, institution, rule, 'deterministic', passwords);
      if ((await resolveReviewDoc(doc, result, ctx)) !== 'review') resolved += 1;
    } catch (err) {
      console.warn(`[email-review] could not apply rule to a similar email: ${err.message}`);
    }
  }
  if (resolved) await EmailRule.updateOne({ _id: rule._id }, { $inc: { timesApplied: resolved }, $set: { lastAppliedAt: new Date() } });
  return resolved;
};

const confirm = async (userId, id, body = {}) => {
  const doc = await findReview(userId, id);
  if (!doc.proposal) throw new ReviewError(400, 'Analyze this email first.');
  const { category, fields } = applyCorrections(doc.proposal, body);
  const ignore = category === rules.IGNORE_CATEGORY;

  const institution = identifyInstitution(doc.senderDomain);
  const email = { messageId: doc.gmailMessageId, subject: doc.subject, domain: doc.senderDomain, receivedAt: doc.receivedAt, date: doc.receivedAt };
  const result = buildResult({
    email, institution: { ...institution, name: doc.institutionName || institution.name }, processor: 'ai',
    outcome: ignore ? OUTCOME.IGNORED : OUTCOME.EXTRACTED,
    category: ignore ? null : category, reason: 'user_confirmed', fields, confidence: 'high',
  });

  const ctx = await sinkContext(userId);
  const action = await resolveReviewDoc(doc, result, ctx);

  let rule = null;
  let similarResolved = 0;
  if (body.remember !== false) {
    rule = await EmailRule.findOneAndUpdate(
      { userId, senderDomain: doc.senderDomain, subjectKey: rules.subjectKey(doc.subject) },
      {
        $set: {
          category, anchors: ignore ? {} : confirmedAnchors(doc.proposal, fields),
          usesPdf: !ignore && doc.proposal.usesPdf === true,
          institutionName: doc.institutionName, sampleSubject: doc.subject,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    try {
      const { client } = await gmailClient(userId);
      similarResolved = await applyToSimilar(userId, rule, doc._id, client, ctx);
    } catch (err) {
      console.warn(`[email-review] similar emails not updated: ${err.message}`);
    }
  }
  return { action, category, remembered: !!rule, similarResolved };
};

module.exports = { analyze, confirm, ReviewError };
