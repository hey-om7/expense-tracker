// Fixes amounts that speech recognition splits apart.
// Indians say prices in pairs: "two fifty" = 250, "twelve ninety nine" = 1299.
// Chrome's recognizer often writes these as "two ₹50", "2 50" or "₹2 50", which the
// model then reads as 50 (or 2 × 50). We join them back into one number.

const SMALL = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
  // Hindi / Hinglish
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

const TENS_WORDS = Object.keys(TENS).join('|');
const UNITS_WORDS = 'one|two|three|four|five|six|seven|eight|nine';

// Lead part: a digit 1–19 or a word one–nineteen (not "do"/"das" etc. as bare English words are rare,
// but "do" is a common English verb, so Hindi words are only accepted right before a currency mark).
const lead = `(\\d{1,2}|${Object.keys(SMALL).filter(w => !['do', 'das', 'che', 'ek', 'teen', 'char', 'saat', 'nau'].includes(w)).join('|')})`;
// Before a currency mark we also accept digits and Hindi number words, except ones that are
// common English words ("do", "das" = "does" in some dialects, "che").
const leadHindi = `(\\d{1,2}|${Object.keys(SMALL).filter(w => !['do', 'das', 'che'].includes(w)).join('|')})`;
const currency = `(?:₹|rs\\.?|inr|rupees?)`;
// Second part: two digits 10–99, or a tens word optionally followed by a units word.
const tail = `(\\d{2}|(?:${TENS_WORDS})(?:[\\s-](?:${UNITS_WORDS}))?|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)`;

const wordToNum = (w) => {
  const s = String(w).toLowerCase();
  if (/^\d+$/.test(s)) return Number(s);
  if (SMALL[s] != null) return SMALL[s];
  const [t, u] = s.split(/[\s-]/);
  return (TENS[t] || 0) + (u ? SMALL[u] || 0 : 0);
};

const join = (a, b) => {
  const hi = wordToNum(a);
  const lo = wordToNum(b);
  if (!(hi >= 1 && hi <= 19) || !(lo >= 10 && lo <= 99)) return null;
  return String(hi * 100 + lo);
};

// "two ₹50" / "2 ₹50" / "paanch ₹50" → "₹250" (not "2 ₹50 each", which means 2 × 50)
const reLeadCurrencyTail = new RegExp(`\\b${leadHindi}\\s+${currency}\\s*${tail}\\b(?!\\s*(?:k|lakh|lakhs|crore|thousand|hundred|each|per|x|times|items?|pieces?|pcs)\\b)`, 'gi');
// "₹2 50" / "rs 2 50" → "₹250"
const reCurrencyLeadTail = new RegExp(`${currency}\\s*(\\d{1,2})\\s+(\\d{2})\\b(?!\\s*(?:k|lakh|lakhs|crore|thousand|hundred)\\b)`, 'gi');
// "two fifty rupees" / "2 50 rupees" / "two fifty on lunch" (after spent/paid) → "₹250"
const reLeadTailCurrency = new RegExp(`\\b${lead}\\s+${tail}\\s*${currency}`, 'gi');
const reVerbLeadTail = new RegExp(`\\b(spent|spend|paid|pay|gave|got|received|cost|costs|for|of|around|about|approx(?:imately)?|worth)\\s+(?:(?:around|about|like|roughly)\\s+)?${lead}\\s+${tail}\\b(?!\\s*(?:k|lakh|lakhs|crore|thousand|hundred|rupees?|rs|₹)\\b)`, 'gi');

const normalizeSpokenAmounts = (text) => {
  if (!text) return text;
  let out = String(text);
  out = out.replace(reLeadCurrencyTail, (m, a, b) => { const n = join(a, b); return n ? `₹${n}` : m; });
  out = out.replace(reCurrencyLeadTail, (m, a, b) => { const n = join(a, b); return n ? `₹${n}` : m; });
  out = out.replace(reLeadTailCurrency, (m, a, b) => { const n = join(a, b); return n ? `₹${n}` : m; });
  out = out.replace(reVerbLeadTail, (m, verb, a, b) => {
    const n = join(a, b);
    if (!n) return m;
    const filler = m.slice(verb.length).match(/^\s+((?:around|about|like|roughly)\s+)?/i)?.[1] || '';
    return `${verb} ${filler}₹${n}`;
  });
  return out.replace(/\s+/g, ' ').trim();
};

module.exports = { normalizeSpokenAmounts };
