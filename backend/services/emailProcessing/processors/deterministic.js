/**
 * Non-AI processor. Uses only local rules: sender identification, Gmail
 * authentication headers, subject matching, keyword detection, regular
 * expressions and institution templates (generic patterns as fallback).
 * Nothing leaves the server.
 */
const categories = require('../categories');
const { identifyInstitution } = require('../institutions');
const { OUTCOME, buildResult, sanitizeFields } = require('../result');
const { CURRENCY_AMOUNT } = require('../textUtils');
const { isPromotional } = require('../promotional');
const rules = require('../rules');

const NAME = 'deterministic';

// Subjects that are clearly not financial records. Only the subject is checked,
// so a statement that mentions an offer in its body is still processed.
const NOISE_SUBJECT = [
  /\bOTP\b/i, /one[\s-]*time\s*password/i, /verification\s*code/i,
  /pre[\s-]*approved/i, /\blimit\s*(enhancement|increase)\s*offer/i,
  /\bexclusive\s+offer\b/i, /\bnewsletter\b/i, /\bwebinar\b/i,
];

const FINANCIAL_SUBJECT = /\b(statement|bill|due|payment|transaction|txn|debit(ed)?|credit(ed)?|balance|emi|loan|refund|invoice)\b/i;

/** Checks that run before any processor. Returns a result to stop, or null to continue. */
const gate = (email, institution, processor) => {
  const base = { email, institution, processor };
  if (!email.knownSender && email.senderStatus !== 'candidate') return buildResult({ ...base, outcome: OUTCOME.IGNORED, reason: 'unknown_sender' });
  // Possibly spoofed: never turned into data automatically, but kept for the user to see.
  // A new sender that can't be verified is just ignored (anyone can forge an unknown domain).
  if (!email.authenticated) {
    if (email.senderStatus === 'candidate') return buildResult({ ...base, outcome: OUTCOME.IGNORED, reason: 'unauthenticated_new_sender' });
    return buildResult({ ...base, outcome: OUTCOME.REVIEW, reason: 'unauthenticated_sender' });
  }
  if (NOISE_SUBJECT.some(p => p.test(email.subject))) {
    return buildResult({ ...base, outcome: OUTCOME.IGNORED, reason: 'non_financial' });
  }
  // Marketing (loan offers, campaigns). Runs before any AI call, so promos are never sent to AI.
  if (isPromotional(email)) {
    return buildResult({ ...base, outcome: OUTCOME.IGNORED, reason: 'promotional' });
  }
  return null;
};

/**
 * Apply what AI already concluded for this email type (any user, see shared.js).
 * Returns a result, or null when nothing usable is known.
 * Financial patterns are applied only to trusted senders; a new sender's records are
 * still verified by AI (or the user) until the sender is confirmed.
 */
const fromSharedPattern = async (email, institution, ctx, processor, local) => {
  if (!ctx.shared) return null;
  const pattern = await ctx.shared.findPattern(email);
  if (!pattern) return null;
  if (pattern.verdict === 'not_financial') {
    if (local) return null; // local rules see a record here; don't drop it on an old verdict
    ctx.shared.countHit(pattern._id);
    return buildResult({ email, institution, processor, outcome: OUTCOME.IGNORED, reason: 'shared_pattern' });
  }
  if (!email.knownSender || !categories.get(pattern.category)) return null;
  const { ruleId, ...result } = rules.resultFromRule(email, institution, pattern, processor);
  if (result.outcome !== OUTCOME.EXTRACTED) return null;
  ctx.shared.countHit(pattern._id);
  return { ...result, reason: 'shared_pattern' };
};

const withLearnedName = (institution, email, ctx) => {
  if (email.senderStatus === 'known') return institution;
  const name = ctx.shared?.nameFor(email.domain);
  return name ? { ...institution, name } : institution;
};

/** Run category detection + extraction locally. Exported so the AI processor can reuse it. */
const classifyLocally = (email, institution) => {
  for (const category of categories.list()) {
    if (!category.detect(email)) continue;
    return { category, fields: sanitizeFields(category.extract(email, institution.template)) };
  }
  return null;
};

const processEmail = async (email, ctx = {}) => {
  const institution = withLearnedName(identifyInstitution(email.domain), email, ctx);
  const stop = gate(email, institution, NAME);
  if (stop) return stop;

  // An email type the user taught Vestor: read it with the learned rule.
  const rule = rules.matchRule(email, ctx.rules);
  if (rule) return rules.applyRule(email, institution, rule, NAME, ctx.pdfPasswords);

  const base = { email, institution, processor: NAME };
  const local = classifyLocally(email, institution);

  const known = await fromSharedPattern(email, institution, ctx, NAME, local);
  if (known) return known;

  // New sender without AI: never recorded automatically; the user can check it in review.
  if (email.senderStatus === 'candidate') {
    return buildResult({ ...base, outcome: OUTCOME.REVIEW, category: local?.category.id || null, reason: 'new_sender', fields: local?.fields, confidence: 'low' });
  }

  if (local) {
    const { category, fields } = local;
    if (!category.isUsable(fields)) {
      return buildResult({ ...base, outcome: OUTCOME.REVIEW, category: category.id, reason: 'fields_missing', fields, confidence: 'low' });
    }
    return buildResult({
      ...base, outcome: OUTCOME.EXTRACTED, category: category.id, reason: institution.template ? 'template' : 'generic',
      fields, confidence: category.isComplete(fields) ? 'high' : 'medium',
    });
  }

  // From a bank, mentions money or financial terms, but matches no known category: a human should look.
  if (CURRENCY_AMOUNT.test(`${email.subject}\n${email.text.slice(0, 4000)}`) || FINANCIAL_SUBJECT.test(email.subject)) {
    return buildResult({ ...base, outcome: OUTCOME.REVIEW, reason: 'unclassified_financial', confidence: 'low' });
  }
  return buildResult({ ...base, outcome: OUTCOME.IGNORED, reason: 'no_financial_content' });
};

module.exports = { name: NAME, usesExternalServices: false, process: processEmail, gate, classifyLocally, fromSharedPattern, withLearnedName };
