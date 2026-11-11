/**
 * Discovery of financial emails from senders that are NOT in the built-in bank list
 * (gmailScanner.OFFICIAL_BANK_DOMAINS), e.g. a bank or card issuer we don't know yet.
 *
 * Three cheap local stages decide which emails are worth an AI call:
 *
 *   1. GMAIL_QUERY   – wide Gmail full-text search for transaction/card/statement words.
 *   2. prefilter()   – From + Subject + Gmail snippet only (metadata fetch, no body).
 *                      Lenient: one money/card/transaction signal is enough.
 *   3. scoreEmail()  – full body, weighted signals. Only "candidate" emails go further.
 *
 * Candidates must also pass Gmail's DMARC/DKIM check (see normalize.js) before any AI call.
 * The rules lean towards letting an email through: a false candidate costs one AI call
 * (once per email type, see shared.js), a missed one loses a real record.
 */
const { isPromotional } = require('./promotional');

// Personal mailboxes: anyone can send from these, and forwarded bank alerts must not
// teach the system that "gmail.com" is a bank.
const FREEMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.in', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'zoho.com', 'zohomail.in', 'rediffmail.com',
  'gmx.com', 'gmx.net', 'mail.com', 'yandex.com', 'tutanota.com', 'fastmail.com', 'hey.com',
];
const isFreemail = (domain = '') => FREEMAIL_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));

// ─── Stage 1: Gmail search ──────────────────────────────────────────────────
// Gmail ignores punctuation ("Rs." -> rs) and matches words in subject and body.
// The currency is checked locally, because Gmail can't search for "₹" reliably.
const GMAIL_TERMS = [
  'spent', 'debited', 'charged', 'deducted', 'withdrawn', 'txn', '"transaction alert"', '"transaction of"',
  '"transaction on"', '"transaction at"', '"transaction successful"', '"has been used"', '"used for"',
  '"used at"', '"card ending"', '"ending with"', '"credit card"', '"debit card"', '"avl lmt"', '"avl bal"',
  '"available limit"', '"available balance"', '"available credit"', '"total amount due"', '"minimum amount due"',
  '"payment due date"', '"card statement"', '"e-statement"', '"purchase of"', '"not done by you"',
  'upi', 'imps', 'neft', 'pos',
];
const buildGmailQuery = (afterSec) => [
  `after:${afterSec}`,
  `{${GMAIL_TERMS.join(' ')}}`,
  ...FREEMAIL_DOMAINS.slice(0, 12).map(d => `-from:@${d}`),
  '-in:sent', '-in:drafts', '-in:chats',
].join(' ');

// ─── Shared patterns ────────────────────────────────────────────────────────
// Amount with a currency, on either side: "Rs.1,234.50", "INR 500", "₹ 99", "1,250.00 INR".
const CURRENCY_AMOUNT = /(?:\b(?:INR|Rs|Rupees)\b\.?|₹)\s*:?\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?|\b[0-9][0-9,]*(?:\.[0-9]{1,2})?\s*(?:\bINR\b|\bRs\b|₹|\/-)/i;

const OTP = /\b(?:OTP|one[\s-]*time[\s-]*(?:password|passcode|pin)|verification\s+code|security\s+code|login\s+code|2fa)\b/i;

const SIGNALS = {
  // Money moved. Covers "spent", "debited from", "charged", "has been used for", "txn of", "purchase at".
  movement: { weight: 2, re: [
    /\b(?:spent|debited|charged|deducted|withdrawn|withdrawal|swiped)\b/i,
    /\b(?:has|have)\s+been\s+(?:used|debited|charged|processed)\b/i,
    /\bwas\s+(?:used|debited|charged|spent)\b/i,
    /\bused\s+(?:for|at|on|to\s+pay)\b/i,
    /\b(?:transaction|txn|trxn|trans)\.?\s*(?:alert|of|for|at|on|amount|amt|successful|done|made|details|id|ref)\b/i,
    /\b(?:purchase|payment|spend)\s+(?:of|at|for|on)\b/i,
    /\bmade\s+a\s+(?:purchase|payment|transaction)\b/i,
    /\b(?:credited|received|refund(?:ed)?|reversed|reversal)\b/i,
  ] },
  // Masked card or account number: "XX1234", "**** 1234", "ending 1234", "a/c no. XX12".
  maskedNumber: { weight: 2, re: [
    /[xX*•]{2,}[\sxX*•-]*\d{2,4}\b/,
    /\bending\s*(?:in|with|no\.?)?\s*[:#-]?\s*[xX*]*\d{2,4}\b/i,
    /\b(?:card|a\/c|acct|account)\s*(?:no\.?|number|#)?\s*[:#-]?\s*[xX*]+\d{2,4}\b/i,
    /\blast\s+(?:4|four)\s+digits?\b/i,
  ] },
  // A credit card statement or bill.
  statement: { weight: 2, re: [
    /\b(?:total|minimum)\s+(?:amount\s+)?(?:due|payable)\b/i,
    /\bpayment\s+due\s+(?:date|on|by)\b/i,
    /\b(?:card|account)\s+statement\b|\bstatement\s+(?:date|period|for|of|summary|is\s+ready)\b|\be-?statement\b/i,
    /\b(?:billing|statement)\s+cycle\b/i,
  ] },
  instrument: { weight: 1, re: [
    /\b(?:credit|debit|prepaid|forex)\s*card\b/i,
    /\b(?:a\/c|acct|savings\s+account|current\s+account|bank\s+account)\b/i,
    /\b(?:UPI|VPA|IMPS|NEFT|RTGS|POS|ECOM|e-?com|ATM|net\s*banking|NACH|e-?mandate|auto[\s-]*debit|si\s+mandate)\b/i,
  ] },
  balance: { weight: 1, re: [
    /\b(?:available|avail|avl|aval)\.?\s*(?:credit\s+)?(?:limit|lmt|bal|balance)\b/i,
    /\b(?:outstanding|credit\s+limit|closing\s+balance|current\s+balance)\b/i,
  ] },
  // Fraud footer that real alerts carry: "If not done by you, call...".
  fraudFooter: { weight: 1, re: [
    /\bnot\s+(?:done|made|initiated|authori[sz]ed|performed)\s+by\s+you\b/i,
    /\b(?:if\s+)?(?:this|it)\s+(?:wasn'?t|was\s+not|is\s+not)\s+(?:done\s+by\s+)?you\b/i,
    /\b(?:didn'?t|did\s+not)\s+(?:make|do|authori[sz]e)\s+this\b/i,
    /\b(?:block|hotlist|freeze)\s+(?:your\s+)?card\b|\breport\s+(?:it|fraud|this)\b|\bdispute\b/i,
  ] },
  merchant: { weight: 1, re: [
    /\b(?:at|towards|to|merchant[:\s]+|info[:\s]+)\s*[A-Z0-9][A-Za-z0-9&*._@'/ -]{2,40}?\s+(?:on|dated|at)\b/,
  ] },
  dateTime: { weight: 1, re: [
    /\b\d{1,2}[-/.](?:\d{1,2}|[A-Za-z]{3})[-/.]\d{2,4}\b/,
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm|hrs|IST)?\b/i,
  ] },
  senderHint: { weight: 1, re: [] }, // checked on the From line, see below
};

const SENDER_HINT = /\b(?:bank|banking|card|cards|credit|finance|financial|fin|capital|money|pay|wallet|alerts?|statements?|transactions?|txn)\b|bank|card|credit|finserv|fincorp|capital/i;

// Merchant receipts, shipping and booking mails mention cards and amounts too.
// They lose points but can still pass when bank signals are strong.
const MERCHANT_RECEIPT = [
  /\border\s*(?:id|no\.?|number|#|confirmed|placed|shipped|delivered|summary|details)\b/i,
  /\byour\s+(?:order|booking|trip|ride|delivery|subscription)\b/i,
  /\b(?:booking|pnr|itinerary|e-?ticket)\b/i,
  /\b(?:invoice|receipt)\s+(?:for|no\.?|number|#)\b/i,
];

const MIN_SCORE = 4;

const headOf = (email, chars = 6000) => `${email.subject || ''}\n${(email.text || '').slice(0, chars)}`;

/**
 * Full-body scoring. Returns { candidate, score, hits }.
 * Requires an amount with a currency (or a statement) and enough independent signals.
 */
const scoreEmail = (email) => {
  const head = headOf(email);
  const hits = [];
  if (OTP.test(email.subject || '')) return { candidate: false, score: 0, hits: ['otp'] };
  const hasAmount = CURRENCY_AMOUNT.test(head);
  let score = 0;
  for (const [name, s] of Object.entries(SIGNALS)) {
    if (s.re.some(r => r.test(head))) { score += s.weight; hits.push(name); }
  }
  if (SENDER_HINT.test(`${email.fromName || ''} ${email.fromAddr || ''}`)) { score += 1; hits.push('senderHint'); }
  const receipt = MERCHANT_RECEIPT.filter(r => r.test(head)).length;
  if (receipt) { score -= Math.min(receipt, 2) * 2; hits.push(`receipt-${receipt}`); }
  if (isPromotional(email)) { score -= 3; hits.push('promo'); }

  const record = hits.includes('movement') || hits.includes('statement');
  const candidate = hasAmount && record && score >= MIN_SCORE;
  return { candidate, score, hits: hasAmount ? hits : [...hits, 'no-amount'] };
};

/**
 * Metadata-only check (From, Subject and the ~200 character Gmail snippet), used to
 * decide whether to download the full email. Very lenient on purpose.
 */
const prefilter = ({ from = '', subject = '', snippet = '' }) => {
  if (OTP.test(subject)) return false;
  const text = `${subject}\n${snippet}`;
  const any = (s) => SIGNALS[s].re.some(r => r.test(text));
  return CURRENCY_AMOUNT.test(text) || any('movement') || any('maskedNumber') || any('statement')
    || (any('instrument') && SENDER_HINT.test(from));
};

module.exports = { buildGmailQuery, prefilter, scoreEmail, isFreemail, FREEMAIL_DOMAINS, MIN_SCORE };
