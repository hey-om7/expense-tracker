/**
 * gmailScanner.js
 * Connects to Gmail via IMAP, finds credit card bill emails from the last 45 days,
 * extracts bill amount + due date, and returns structured results.
 *
 * Requires: imapflow, mailparser
 * Env vars: GMAIL_INBOX_USER, GMAIL_INBOX_PASS (Gmail App Password for the inbox account)
 */

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

// ─── Patterns to identify CC bill emails ───────────────────────────────────
// Subject keywords that strongly indicate a credit card statement/bill email
const BILL_SUBJECT_PATTERNS = [
  /credit\s*card\s*(statement|bill|due|payment)/i,
  /statement\s*(generated|available|ready)/i,
  /bill\s*(generated|due|payment|amount)/i,
  /payment\s*due/i,
  /minimum\s*(amount|payment)\s*due/i,
  /total\s*amount\s*due/i,
  /outstanding\s*(amount|balance|dues)/i,
  /e-?statement/i,
  /monthly\s*statement/i,
];

// Known Indian bank sender domains / keywords
const BANK_SENDER_PATTERNS = [
  /hdfc/i, /icici/i, /sbi/i, /axis/i, /kotak/i, /indusind/i,
  /amex/i, /american\s*express/i, /citibank/i, /citi/i,
  /yes\s*bank/i, /rbl/i, /idfc/i, /standard\s*chartered/i,
  /hsbc/i, /barclays/i, /bnp/i, /deutsche/i,
  /card.*statement/i, /statement.*card/i,
];

// ─── Amount extraction patterns ───────────────────────────────────────────
// Ordered from most specific to least specific
// ─── Amount extraction patterns ───────────────────────────────────────────
// We use [^\d\n]*? to seamlessly skip over things like ":", "INR", "Rs.", "₹", or spaces 
// until it hits the very first digit.
const AMOUNT_PATTERNS = [
  // 1. AXIS BANK SPECIFIC: Their emails flatten the table into "(DD-MM-YYYY)1633 Dr100 Dr"
  // This jumps over the "(DD-MM-YYYY)" text directly to the first number (Total Amount)
  /\(DD-MM-YYYY\)[^\d]{0,15}?([0-9,]+(?:\.[0-9]{1,2})?)/i,

  // 2. TOTAL AMOUNT DUE (Prioritized first so it ignores the "Minimum" amount)
  // The [^\d]{0,80}? trick jumps across up to 80 characters of newlines, "INR", "₹", or spaces
  // ICICI Example: "Total Amount Due\n₹8,885.00"
  /total\s+(?:amount\s+)?due[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,

  // 3. STATEMENT / OUTSTANDING BALANCE
  /statement\s+balance[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /current\s+balance[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /outstanding\s+(?:balance|amount|dues?)[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,

  // 4. AMOUNT DUE
  /amount\s+due[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /bill\s+amount[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,

  // 5. MINIMUM AMOUNT DUE (Only triggers if the Total Amount regex fails)
  /minimum\s+(?:amount\s+)?due[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,

  // 6. GENERIC FALLBACK: Finds the first rupee value in the email if all labels fail
  /(?:₹|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
];

// ─── Due date extraction patterns ─────────────────────────────────────────
const DUE_DATE_PATTERNS = [
  // Format 1: DD MMM YYYY (e.g., 15 Jan 2025, 15-01-2025)
  /(?:payment\s+)?due\s*(?:date|on|by)?[\s\S]{0,60}?(\d{1,2}[\s\-\/]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/,]+\d{2,4})/i,
  
  // Format 2: MMM DD, YYYY (e.g., April 30, 2026) -> Solves ICICI Bank
  /(?:payment\s+)?due\s*(?:date|on|by)?[\s\S]{0,60}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/,]+\d{1,2}(?:st|nd|rd|th)?[\s\-\/,]+\d{2,4})/i,

  // Format 3: DD/MM/YYYY (e.g., 15/01/2025) -> Solves Axis Bank
  /(?:payment\s+)?due\s*(?:date|on|by)?[\s\S]{0,60}?(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,

  // Fallbacks for "Pay by" instead of "Due Date"
  /pay\s*(?:by|before)[\s\S]{0,30}?(\d{1,2}[\s\-\/]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/,]+\d{2,4})/i,
  /pay\s*(?:by|before)[\s\S]{0,30}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/,]+\d{1,2}(?:st|nd|rd|th)?[\s\-\/,]+\d{2,4})/i,
  
  // Fallback for "Last date of payment: 15/01/2025"
  /last\s+(?:date\s+(?:of|for)\s+)?payment[\s\S]{0,30}?(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,
];

// ─── Card number / last 4 digits extraction ───────────────────────────────
const CARD_DIGITS_PATTERNS = [
  // "ending XX93", "ending 1234", "ending in 93" (Matches 2 to 4 digits to catch Axis Bank's XX93)
  /ending[^\d\n]*(\d{2,4})/i,
  
  // "Card No: 1234", "Account Number 1234" (Strictly 4 digits)
  /(?:card|account)\s+(?:no\.?|number)[^\d\n]*(\d{4})/i,
  
  // "XXXX1234", "**93", "XX93"
  /[xX*]{2,}\s*(\d{2,4})/,
  
  // "Last 4 digits: 1234", "last digits 1234"
  /last\s+(?:4\s+)?digits?[^\d\n]*(\d{4})/i,
];

// ─── Parse a date string into a JS Date ───────────────────────────────────
const parseDate = (str) => {
  if (!str) return null;
  // Normalize separators
  const cleaned = str.trim().replace(/\s+/g, ' ');
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }

  return null;
};

// ─── Extract amount from text ─────────────────────────────────────────────
const extractAmount = (text) => {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[1].replace(/,/g, '');
      const amount = parseFloat(raw);
      if (!isNaN(amount) && amount > 0 && amount < 10000000) {
        return amount;
      }
    }
  }
  return null;
};

// ─── Extract due date from text ───────────────────────────────────────────
const extractDueDate = (text) => {
  for (const pattern of DUE_DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const d = parseDate(match[1]);
      if (d && !isNaN(d.getTime())) return d;
    }
  }
  return null;
};

// ─── Extract last 4 digits from text ─────────────────────────────────────
const extractLast4 = (text) => {
  for (const pattern of CARD_DIGITS_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// ─── Check if a subject/sender looks like a CC bill ──────────────────────
const isBillEmail = (subject = '', from = '') => {
  const subjectMatch = BILL_SUBJECT_PATTERNS.some(p => p.test(subject));
  const senderMatch = BANK_SENDER_PATTERNS.some(p => p.test(from));
  return subjectMatch || senderMatch;
};

// ─── Main scanner function ────────────────────────────────────────────────
/**
 * Scans Gmail inbox for CC bill emails.
 *
 * @param {Date|null} since - Only fetch emails received after this date.
 *                            If null, defaults to 45 days ago (for manual/first scans).
 * @returns {Promise<Array<{subject, from, date, amount, dueDate, last4, rawSnippet}>>}
 */
const scanGmailForBills = async (since = null) => {
  const user = process.env.GMAIL_INBOX_USER;
  const pass = process.env.GMAIL_INBOX_PASS;

  if (!user || !pass) {
    throw new Error('Gmail inbox credentials not configured (GMAIL_INBOX_USER / GMAIL_INBOX_PASS)');
  }

  // Default: look back 45 days on first scan, otherwise use the provided cutoff
  const sinceDate = since instanceof Date ? since : (() => {
    const d = new Date();
    d.setDate(d.getDate() - 45);
    return d;
  })();

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const results = [];

  try {
    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ since: sinceDate });
      if (!uids || uids.length === 0) {
        return results;
      }

      // Cap at 200 most recent to avoid memory issues on large inboxes
      const BATCH_SIZE = 50;
      const recentUids = uids.slice(-Math.min(uids.length, 200));

      for (let i = 0; i < recentUids.length; i += BATCH_SIZE) {
        const batch = recentUids.slice(i, i + BATCH_SIZE);

        for await (const msg of client.fetch(batch, { envelope: true, source: true })) {
          try {
            const subject = msg.envelope?.subject || '';
            const from = msg.envelope?.from?.[0]?.address || '';
            const fromName = msg.envelope?.from?.[0]?.name || '';
            const emailDate = msg.envelope?.date || new Date();

            // Strict date guard — IMAP SINCE is date-only (no time), so re-check here
            if (emailDate <= sinceDate) continue;

            // Quick filter before full parse
            if (!isBillEmail(subject, `${from} ${fromName}`)) continue;

            // Full parse for body text
            const parsed = await simpleParser(msg.source);
            const bodyText = parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '';

            const amount = extractAmount(bodyText) || extractAmount(subject);
            const dueDate = extractDueDate(bodyText) || extractDueDate(subject);
            const last4 = extractLast4(bodyText) || extractLast4(subject);

            // Only include if we got at least an amount or a due date
            if (!amount && !dueDate) continue;

            results.push({
              subject,
              from: `${fromName} <${from}>`,
              date: emailDate,
              amount,
              dueDate,
              last4,
              rawSnippet: bodyText.slice(0, 500).replace(/\s+/g, ' ').trim(),
            });
          } catch {
            // Skip malformed messages silently
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  // Deduplicate: if same card (last4) has multiple emails, keep the most recent
  const deduped = new Map();
  for (const r of results) {
    const key = r.last4 || r.subject;
    const existing = deduped.get(key);
    if (!existing || new Date(r.date) > new Date(existing.date)) {
      deduped.set(key, r);
    }
  }

  return Array.from(deduped.values());
};

module.exports = { scanGmailForBills };
