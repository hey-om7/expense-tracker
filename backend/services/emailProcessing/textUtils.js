/** Small deterministic helpers shared by categories and processors. */
const { parseDate } = require('../gmailScanner');

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

const noonUtc = (y, m, d) => {
  const year = y < 100 ? 2000 + y : y;
  const date = new Date(Date.UTC(year, m, d, 12));
  return date.getUTCMonth() === m && date.getUTCDate() === d ? date : null;
};

/**
 * Parse Indian-style dates: 03/11/2026, 3-11-26, 03.11.2026, 03-Nov-26, 3 November 2026, Nov 3, 2026.
 * Always day-first for numeric dates. Returns a Date at noon UTC, or null.
 */
const parseFlexibleDate = (str) => {
  if (!str) return null;
  const s = String(str).trim();
  let m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) return noonUtc(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s,-]+([A-Za-z]{3,9})[\s,-]+'?(\d{2,4})/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) {
    return noonUtc(Number(m[3]), MONTHS[m[2].slice(0, 3).toLowerCase()], Number(m[1]));
  }
  m = s.match(/([A-Za-z]{3,9})[\s,-]+(\d{1,2})(?:st|nd|rd|th)?[\s,-]+'?(\d{2,4})/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()] !== undefined) {
    return noonUtc(Number(m[3]), MONTHS[m[1].slice(0, 3).toLowerCase()], Number(m[2]));
  }
  const fallback = parseDate(s);
  return fallback && !isNaN(fallback.getTime()) ? fallback : null;
};

const toAmount = (s) => {
  const n = parseFloat(String(s).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 && n < 1e8 ? n : null;
};

/** First pattern whose capture group 1 survives `transform` (non-null). */
const firstMatch = (patterns, text, transform = (v) => v) => {
  if (!text) return null;
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1] != null) {
      const v = transform(m[1]);
      if (v != null) return v;
    }
  }
  return null;
};

const CURRENCY_AMOUNT = /(?:INR|Rs\.?|₹)\s*[0-9]/i;

module.exports = { parseFlexibleDate, toAmount, firstMatch, CURRENCY_AMOUNT };
