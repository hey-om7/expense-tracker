/**
 * Patterns the user teaches by marking a value in an email body (Settings → AI training).
 *
 * For a marked value, the text around it becomes a regular expression:
 *   "...card ending 4321 at NETFLIX on 10-11-2026..."  (user marked "NETFLIX" as merchant)
 *   -> /card\s*ending\s*\d+\s*at\s*([^\n]{1,80}?)\s*on\b/i
 * Digits become \d+ and month names [a-z]+, so the pattern fits the next email of the
 * same type where amounts, dates and card digits differ.
 *
 * Patterns are built only from escaped email text plus \s*, \d+, [a-z]+ and one bounded
 * capture group, so they can't backtrack badly. Only the pattern is stored, never the body.
 */
const { toAmount, parseFlexibleDate } = require('./textUtils');

const TRAINABLE_FIELDS = ['amount', 'transactionDate', 'merchant', 'last4'];
const MAX_SOURCE = 400;

const DATE_VALUE = "(\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:st|nd|rd|th)?[\\s,-]+[A-Za-z]{3,9}[\\s,-]+'?\\d{2,4}|[A-Za-z]{3,9}\\s+\\d{1,2},?\\s+\\d{2,4})";
const VALUE = {
  amount: '([0-9][0-9,]*(?:\\.[0-9]{1,2})?)',
  last4: '[xX*•\\s-]*(\\d{2,4})',
  transactionDate: DATE_VALUE,
  merchant: '([^\\n]{1,80}?)',
};

const MONTH = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi;

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Escaped text with variable parts generalized. */
const generalize = (s) => {
  // Placeholders survive escaping; they are swapped for regex parts at the end.
  const marked = s.replace(MONTH, '\u0001').replace(/\d+/g, '\u0002');
  return escape(marked)
    .replace(/\s+/g, '\\s*')
    .replace(/\u0001/g, '[a-z]+')
    .replace(/\u0002/g, '\\d+')
    .replace(/\u0003/g, '[^\\n]{1,80}?');
};

const letters = (s) => (s.match(/[a-z]/gi) || []).length;
const OTHER = '\u0003'; // stands for another marked value (e.g. a merchant name) inside the context

// Context before the value: the last 4 words on the same line. Other marked values inside
// it become a wildcard, so "at NETFLIX on <date>" works for every merchant. If that has
// fewer than 3 letters, the end of the previous line is added.
const prefixFor = (text, start, others = []) => {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const withOthers = (from, to) => {
    let s = '';
    let i = from;
    others.filter(o => o.start >= from && o.end <= to).sort((a, b) => a.start - b.start).forEach((o) => {
      s += `${text.slice(i, o.start)}${OTHER}`;
      i = o.end;
    });
    return s + text.slice(i, to);
  };
  const lastWords = (s, n) => s.split(/\s+/).filter(Boolean).slice(-n).join(' ');
  let pre = lastWords(withOthers(lineStart, start), 4);
  if (letters(pre.replace(OTHER, '')) < 3 && lineStart > 0) {
    const prevStart = text.lastIndexOf('\n', lineStart - 2) + 1;
    pre = `${lastWords(withOthers(prevStart, lineStart - 1), 3)} ${pre}`.trim();
  }
  return pre;
};

// Context after the value (used to end free-text values like merchant names).
const suffixFor = (text, end) => {
  const lineEnd = text.indexOf('\n', end);
  const after = text.slice(end, Math.min(lineEnd < 0 ? text.length : lineEnd, end + 20));
  const m = after.match(/^(\s*)([^\s\w]?\s*\w+)/);
  return m ? { space: m[1].length > 0, word: m[2] } : null;
};

/** Parse the marked text into a field value, or null if it isn't one. */
const parseValue = (field, raw) => {
  const s = String(raw || '').trim();
  if (field === 'amount') {
    const m = s.match(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/);
    return m ? toAmount(m[0]) : null;
  }
  if (field === 'last4') {
    const d = s.replace(/\D/g, '');
    return d.length >= 2 ? d.slice(-4) : null;
  }
  if (field === 'transactionDate') return parseFlexibleDate(s);
  if (field === 'merchant') {
    const v = s.replace(/\s+/g, ' ').replace(/[.,;:]+$/, '');
    return v.length >= 2 && v.length <= 80 ? v : null;
  }
  return null;
};

const readMatch = (field, m) => (m ? parseValue(field, m[1]) : null);

const compile = (source) => {
  try { return new RegExp(source, 'i'); } catch { return null; }
};

/**
 * Build a pattern for one marked value.
 * @returns {{ source: string, value: any } | { error: string }}
 */
const buildPattern = (text, field, start, end, others = []) => {
  if (!TRAINABLE_FIELDS.includes(field)) return { error: 'unknown field' };
  const value = parseValue(field, text.slice(start, end));
  if (value == null) return { error: `the marked text isn't a valid ${field}` };
  const pre = prefixFor(text, start, others.filter(o => o.end <= start));
  if (letters(pre.replace(OTHER, '')) < 2) return { error: `there is no label in front of the ${field}, so it can't be found again` };
  let source = `${/^\w/.test(pre) ? '\\b' : ''}${generalize(pre)}\\s*${VALUE[field]}`;
  if (field === 'merchant') {
    const suf = suffixFor(text, end);
    source += suf
      ? `${suf.space ? '\\s+' : '\\s*'}${generalize(suf.word.trim())}${/\w$/.test(suf.word) ? '\\b' : ''}`
      : '\\s*(?=[.,;\\n]|$)';
  }
  if (source.length > MAX_SOURCE) return { error: `the text around the ${field} is too long` };
  const re = compile(source);
  if (!re) return { error: `couldn't build a pattern for the ${field}` };
  // The pattern must find the same value in the email it was learned from.
  const found = readMatch(field, text.match(re));
  const same = field === 'transactionDate'
    ? found && found.toDateString() === value.toDateString()
    : found === value;
  if (!same) return { error: `the ${field} appears earlier in the email with different text; mark the first one` };
  return { source, value };
};

/** Read values with stored patterns. */
const extractWithPatterns = (email, patterns = {}) => {
  const text = email.text || '';
  const out = {};
  TRAINABLE_FIELDS.forEach((f) => {
    const source = patterns?.[f];
    if (!source || source.length > MAX_SOURCE) return;
    const re = compile(source);
    const v = re ? readMatch(f, text.match(re)) : null;
    if (v != null) out[f] = v;
  });
  return out;
};

module.exports = { TRAINABLE_FIELDS, buildPattern, extractWithPatterns, parseValue };
