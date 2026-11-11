/**
 * User-taught email rules (models/EmailRule). After the user confirms an AI
 * analysis of a review email, Vestor remembers that email type:
 *   - which bank sent it (root domain)
 *   - the shape of its subject (subjectKey: months, numbers and amounts removed)
 *   - its category
 *   - "anchors": the label printed just before each value, learned from the email
 * Later emails of the same type are classified and read with these rules only,
 * so AI is not needed again. Rules only apply after the normal gate, so emails
 * from unknown or unverified senders never match.
 */
const categories = require('./categories');
const { OUTCOME, buildResult, sanitizeFields } = require('./result');
const { parseFlexibleDate, toAmount } = require('./textUtils');
const { rootDomainFor } = require('./institutions');
const { readStatementPdf, withPdfText } = require('./pdfText');
const { extractWithPatterns } = require('./trainedPatterns');

const ANCHOR_FIELDS = ['amount', 'dueDate', 'statementDate', 'transactionDate', 'last4'];
const IGNORE_CATEGORY = 'not_financial';
const GENERIC_CATEGORY = 'other_financial';

const MONTH_WORD = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/g;

/** "HDFC Bank Combined Email Statement for October-2026" -> "hdfc bank combined email statement for {m} #" */
const subjectKey = (subject) => String(subject || '').slice(0, 300).toLowerCase()
  .replace(/(?:inr|rs\.?|₹)\s*[\d,]+(?:\.\d+)?/g, ' {amt} ')
  .replace(MONTH_WORD, ' {m} ')
  .replace(/\d+/g, ' # ')
  .replace(/[^\p{L}\p{N}{}#]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const sameDay = (a, b) => a && b && a.getUTCFullYear() === b.getUTCFullYear()
  && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();

const DATE_TOKENS = [
  /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g,
  /\b\d{1,2}(?:st|nd|rd|th)?[\s,-]+[a-z]{3,9}[\s,-]+'?\d{2,4}\b/gi,
  /\b[a-z]{3,9}[\s,-]+\d{1,2}(?:st|nd|rd|th)?[\s,-]+'?\d{2,4}\b/gi,
];

// Index of the first place in the text where this field's value is written.
const locateValue = (field, value, text) => {
  if (value == null) return -1;
  if (field === 'amount') {
    for (const m of text.matchAll(/\d[\d,]*(?:\.\d{1,2})?/g)) {
      if (toAmount(m[0]) === value) return m.index;
    }
    return -1;
  }
  if (field === 'last4') {
    const m = text.match(new RegExp(`(?<!\\d)${value}(?!\\d)`));
    return m ? m.index : -1;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return -1;
  let best = -1;
  for (const re of DATE_TOKENS) {
    for (const m of text.matchAll(re)) {
      if (sameDay(parseFlexibleDate(m[0]), date) && (best < 0 || m.index < best)) best = m.index;
    }
  }
  return best;
};

// Text just before a value on the same line, cleaned into a stable label.
const labelBefore = (text, index) => {
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  let label = text.slice(Math.max(lineStart, index - 80), index).toLowerCase();
  // Labels must not contain data that changes per email (dates, numbers, months).
  const parts = label.split(/\d+|\{m\}/);
  label = parts[parts.length - 1].replace(MONTH_WORD, '|').split('|').pop();
  label = label.replace(/(?:\b(?:inr|rs|is|of|was|on|by|for|amount of)\b|[^a-z])+$/i, '').trim();
  label = label.split(/\s+/).slice(-5).join(' ');
  return (label.match(/[a-z]/g) || []).length >= 4 ? label : null;
};

/** Learn anchors from an email and the values confirmed for it. */
const learnAnchors = (email, fields) => {
  const text = email.text || '';
  const anchors = {};
  ANCHOR_FIELDS.forEach((f) => {
    const i = locateValue(f, fields[f], text);
    anchors[f] = i > 0 ? labelBefore(text, i) : null;
  });
  return anchors;
};

const AMOUNT_AFTER = /(?:inr|rs\.?|₹)\s*:?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i;
const NUMBER_AFTER = /([0-9][0-9,]*(?:\.\d{1,2})?)/;

const readAfter = (field, slice) => {
  if (field === 'amount') {
    const m = slice.match(AMOUNT_AFTER) || slice.match(NUMBER_AFTER);
    return m ? toAmount(m[1]) : null;
  }
  if (field === 'last4') {
    const m = slice.match(/(\d{4})(?!\d)/);
    return m ? m[1] : null;
  }
  return parseFlexibleDate(slice.slice(0, 60));
};

/** Read values that follow each learned label. */
const extractWithAnchors = (email, anchors = {}) => {
  const lower = (email.text || '').toLowerCase();
  const out = {};
  ANCHOR_FIELDS.forEach((f) => {
    const label = anchors?.[f];
    if (!label) return;
    let from = lower.indexOf(label);
    while (from >= 0 && out[f] == null) {
      const v = readAfter(f, lower.slice(from + label.length, from + label.length + 120));
      if (v != null) out[f] = v;
      from = lower.indexOf(label, from + 1);
    }
  });
  return out;
};

const matchRule = (email, rules) => {
  if (!rules?.length) return null;
  const root = rootDomainFor(email.domain);
  const key = subjectKey(email.subject);
  return rules.find(r => r.senderDomain === root && r.subjectKey === key) || null;
};

/** Standardized result for an email that matches a user rule. No AI involved. */
const resultFromRule = (email, institution, rule, processor) => {
  const base = { email, institution, processor };
  if (rule.category === IGNORE_CATEGORY) {
    return { ...buildResult({ ...base, outcome: OUTCOME.IGNORED, reason: 'user_rule' }), ruleId: String(rule._id) };
  }
  const category = categories.get(rule.category);
  const local = category ? sanitizeFields(category.extract(email, institution.template)) : sanitizeFields({});
  const learned = { ...extractWithAnchors(email, rule.anchors), ...extractWithPatterns(email, rule.patterns) };
  const fields = { ...local };
  Object.entries(learned).forEach(([k, v]) => { if (v != null) fields[k] = v; });
  if (rule.category === 'credit_card_statement') {
    fields.statementDate = fields.statementDate || email.receivedAt;
    fields.paymentMethod = 'credit_card';
  }
  const usable = category ? category.isUsable(fields) : true;
  const complete = category ? category.isComplete(fields) : false;
  const result = buildResult({
    ...base,
    outcome: usable ? OUTCOME.EXTRACTED : OUTCOME.REVIEW,
    category: category ? category.id : GENERIC_CATEGORY,
    reason: usable ? 'user_rule' : 'user_rule_fields_missing',
    fields,
    confidence: complete ? 'high' : usable ? 'medium' : 'low',
  });
  return { ...result, ruleId: String(rule._id) };
};

/** Categories a user can confirm for a review email. */
const CONFIRMABLE = () => [...categories.list().map(c => c.id), GENERIC_CATEGORY, IGNORE_CATEGORY];

/**
 * Apply a rule, reading the attached statement PDF first when the rule was learned
 * from one. passwords: Map(rootDomain -> saved PDF password).
 * If the PDF can't be opened (no saved password, or it changed), the email goes to
 * review so the user can enter the password once.
 */
const applyRule = async (email, institution, rule, processor, passwords) => {
  if (rule.usesPdf && rule.category !== IGNORE_CATEGORY && email.pdfs?.length) {
    const saved = passwords?.get(rootDomainFor(email.domain));
    const pdf = await readStatementPdf(email, saved ? [saved] : []);
    if (pdf.status === 'ok') return resultFromRule(withPdfText(email, pdf.text), institution, rule, processor);
    if (pdf.status === 'needs_password') {
      const result = buildResult({
        email, institution, processor, outcome: OUTCOME.REVIEW,
        category: categories.get(rule.category) ? rule.category : GENERIC_CATEGORY,
        reason: 'pdf_password_needed', confidence: 'low',
      });
      return { ...result, ruleId: String(rule._id) };
    }
    // Unreadable PDF: fall back to the email body.
  }
  return resultFromRule(email, institution, rule, processor);
};

module.exports = {
  subjectKey, learnAnchors, extractWithAnchors, matchRule, resultFromRule, applyRule,
  CONFIRMABLE, IGNORE_CATEGORY, GENERIC_CATEGORY, ANCHOR_FIELDS,
};
