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
  // 1. AXIS BANK SPECIFIC: Jumps over up to 80 non-digit characters (spaces, newlines)
  // to get from "(DD-MM-YYYY)" straight to the first number ("1633")
  /\(DD-MM-YYYY\)[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,

  // 2. TOTAL AMOUNT DUE 
  /total\s+(?:amount\s+)?due[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,

  // 3. STATEMENT / OUTSTANDING BALANCE
  /statement\s+balance[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /current\s+balance[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /outstanding\s+(?:balance|amount|dues?)[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,

  // 4. AMOUNT DUE
  /amount\s+due[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /bill\s+amount[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,

  // 5. MINIMUM AMOUNT DUE 
  /minimum\s+(?:amount\s+)?due[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,

  // 6. GENERIC FALLBACK
  /(?:₹|Rs\.?)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
];

// ─── Due date extraction patterns ─────────────────────────────────────────
const DUE_DATE_PATTERNS = [
  // 1. AXIS BANK SPECIFIC: Jumps over the spaces, "1633 Dr", and "100 Dr" to hit "02/06/2026"
  /\(DD-MM-YYYY\)[\s\S]{0,150}?(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,

  // 2. Standard patterns with extended 150 character jump limits
  /(?:payment\s+)?due\s*(?:date|on|by)?[\s\S]{0,150}?(\d{1,2}[\s\-\/]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/,]+\d{2,4})/i,
  
  /(?:payment\s+)?due\s*(?:date|on|by)?[\s\S]{0,150}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/,]+\d{1,2}(?:st|nd|rd|th)?[\s\-\/,]+\d{2,4})/i,

  /(?:payment\s+)?due\s*(?:date|on|by)?[\s\S]{0,150}?(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,

  // 3. Fallbacks for "Pay by" instead of "Due Date"
  /pay\s*(?:by|before)[\s\S]{0,80}?(\d{1,2}[\s\-\/]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/,]+\d{2,4})/i,
  /pay\s*(?:by|before)[\s\S]{0,80}?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\/,]+\d{1,2}(?:st|nd|rd|th)?[\s\-\/,]+\d{2,4})/i,
  
  // 4. Fallback for "Last date"
  /last\s+(?:date\s+(?:of|for)\s+)?payment[\s\S]{0,80}?(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,
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
// ─── Parse a date string into a JS Date ───────────────────────────────────
const parseDate = (str) => {
  if (!str) return null;
  
  // Strip out any hidden characters, zero-width spaces, or weird table formatting
  const cleaned = str.replace(/[^\w\s\-\/\,]/g, '').trim();

  // 1. MUST TRY DD/MM/YYYY FIRST (The Indian Format)
  // We removed the strict ^ and $ so it extracts the date even if garbage is attached.
  const dmyMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    
    // CRITICAL FIX: Set time to Noon (T12:00:00Z) UTC.
    // This prevents the date from shifting backwards a day when JSON is sent to the frontend.
    return new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`);
  }

  // 2. Fallback for text dates like "15 Jan 2025" or "April 30, 2026"
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    // Also force fallback dates to Noon UTC to prevent timezone shifts
    d.setUTCHours(12, 0, 0, 0);
    return d;
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
// ─── Verified Bank Domains (STRICT WHITELIST) ─────────────────────────────
// The system will ONLY parse emails originating directly from these domains or their subdomains.
const OFFICIAL_BANK_DOMAINS = [
  // ICICI Bank
  'icicibank.com',
  'icici.bank.in',        // Used for transactional/statement emails
  
  // HDFC Bank
  'hdfcbank.net',         // Heavily used by HDFC for statements
  'hdfcbank.com',
  
  // Axis Bank
  'axisbank.com',
  
  // SBI Card
  'sbicard.com',
  
  // Kotak Mahindra Bank
  'kotak.com',
  
  // IDFC FIRST Bank
  'idfcfirstbank.com',
  
  // American Express
  'aexp.com',
  'americanexpress.com',
  
  // IndusInd Bank
  'indusind.com',
  
  // RBL Bank
  'rblbank.com',
  
  // Standard Chartered
  'sc.com',
  
  // Citibank (Legacy/Transitioning, but good to keep)
  'citi.com',
  'citibank.com',
  
  // HSBC
  'hsbc.co.in',
  'hsbc.com',
  
  // Yes Bank
  'yesbank.in',
  
  // Modern/Fintech Cards
  'getonecard.app',       // OneCard
  'uni.cards',            // Uni Cards
  'sliceit.com'           // Slice
];

// Helper: Extracts just the domain from an email string (e.g., "ICICI <statements@icicibank.com>" -> "icicibank.com")
const extractDomain = (fromStr) => {
  if (!fromStr) return null;
  const match = fromStr.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match ? match[1].toLowerCase() : null;
};

// ─── Check if a subject/sender looks like a CC bill ──────────────────────
const isBillEmail = (subject = '', from = '') => {
  const domain = extractDomain(from);
  
  // 1. DOMAIN VERIFICATION (The Security Gate)
  if (!domain) return false;

  // Check if the extracted domain matches exactly, or is a valid subdomain 
  // (e.g., 'statements.axisbank.com' will pass because it ends with '.axisbank.com')
  const isVerifiedBank = OFFICIAL_BANK_DOMAINS.some(bankDomain => 
    domain === bankDomain || domain.endsWith('.' + bankDomain)
  );

  if (!isVerifiedBank) {
    return false; // Instantly rejects Wallo summaries, random users, and spam.
  }

  // 2. CONTEXT VERIFICATION (The Intent Gate)
  // Even if it's from the bank, it must be a bill, not a marketing email.
  const isStatementSubject = BILL_SUBJECT_PATTERNS.some(p => p.test(subject));
  
  return isStatementSubject;
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

            // ─── DIAGNOSTIC LOGGING ───────────────────────────────────────
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📧 BILL EMAIL FOUND`);
            console.log(`   Subject  : ${subject}`);
            console.log(`   From     : ${from}`);
            console.log(`   Date     : ${emailDate}`);
            console.log(`   Last4    : ${last4 ?? 'NOT FOUND'}`);
            console.log(`   Amount   : ${amount ?? 'NOT FOUND'}`);
            console.log(`   DueDate  : ${dueDate ?? 'NOT FOUND'}`);
            console.log(`   DueDate type: ${dueDate === null ? 'null' : typeof dueDate} | isDate: ${dueDate instanceof Date} | valid: ${dueDate instanceof Date ? !isNaN(dueDate) : 'N/A'}`);
            console.log(`   Body snippet (first 800 chars):`);
            console.log(`   ${bodyText.slice(0, 800).replace(/\n/g, ' ↵ ')}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            // ─────────────────────────────────────────────────────────────

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
