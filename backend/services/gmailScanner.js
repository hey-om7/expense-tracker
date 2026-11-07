/**
 * gmailScanner.js
 * Credit card statement detection for Indian banks: bank-domain whitelist,
 * sender authentication, regex extraction, and an optional AI fallback
 * (statementAi.js) for emails the regexes can't fully read.
 * scanGmailForBills (legacy shared-inbox IMAP scan) is no longer used.
 *
 * Requires: imapflow, mailparser
 * Env vars: GMAIL_INBOX_USER, GMAIL_INBOX_PASS (Gmail App Password for the inbox account)
 */

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { convert: htmlToText } = require('html-to-text');

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
  /card\s*statement/i,                       // "Axis Bank Neo Card Statement"
  /statement\s*(for|of)\s*(your\s*)?.{0,40}card/i, // "Statement for your Axis Bank ... Card"
  /\bstatement\b.{0,40}\b(xx|\*\*|ending)\s*\d{2,4}/i, // "Statement ... XX93"
  /(payment|bill)\s*reminder/i,
  /\bdue\s*(on|by|date)\b/i,
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
  /amount\s+payable[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /total\s+payment\s+due[^\d]{0,80}?([0-9,]+(?:\.[0-9]{1,2})?)/i,
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
  // Masked numbers: "4594 XXXX XXXX 1293", "XXXX1293", "**93" -> digits AFTER the mask
  /[xX*]{2,}[\sxX*-]*(\d{2,4})\b/,

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
    // new Date("21 Nov 2026") is local midnight; read the local calendar day
    // and pin it to noon UTC, otherwise IST/UTC offsets shift it a day back.
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12));
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
// Only emails from these domains or their subdomains are parsed.
const OFFICIAL_BANK_DOMAINS = [
  // RBI-mandated domain: only regulated Indian banks can register *.bank.in,
  // and banks are moving email to it (e.g. axis.bank.in, hdfc.bank.in, icici.bank.in).
  'bank.in',

  // Private banks
  'icicibank.com', 'icicibank.co.in',
  'hdfcbank.net', 'hdfcbank.com',
  'axisbank.com', 'axisbank.co.in',
  'kotak.com', 'kotakbank.com',
  'idfcfirstbank.com',
  'indusind.com', 'indusind.net',
  'rblbank.com',
  'yesbank.in', 'yesbank.co.in',
  'federalbank.co.in',
  'aubank.in',
  'bandhanbank.com',
  'southindianbank.com',
  'kvb.co.in',
  'csb.co.in',
  'dcbbank.com',
  'equitasbank.com',
  'idbibank.co.in', 'idbi.co.in',

  // Public sector banks & their card companies
  'sbicard.com', 'sbi.co.in',
  'bobcard.co.in', 'bobfinancial.com', 'bankofbaroda.co.in', 'bankofbaroda.com',
  'pnb.co.in', 'pnbindia.in',
  'canarabank.com', 'canarabank.in',
  'unionbankofindia.co.in', 'unionbankofindia.com',
  'bankofindia.co.in',
  'indianbank.in', 'indianbank.co.in',
  'centralbank.co.in',

  // Foreign banks
  'aexp.com', 'americanexpress.com',
  'sc.com',
  'citi.com', 'citibank.com',
  'hsbc.co.in', 'hsbc.com',
  'dbs.com',

  // Fintech card issuers
  'getonecard.app',
  'uni.cards',
  'sliceit.com',
  'scapia.cards',
  'jupiter.money',

  // UPI apps (payment confirmations only; still DKIM/DMARC-checked like banks)
  'phonepe.com',
];

const isBankDomain = (domain) =>
  !!domain && OFFICIAL_BANK_DOMAINS.some(d => domain === d || domain.endsWith('.' + d));

// ─── Statement-candidate constraints ──────────────────────────────────────
// Body must look like a card statement (positive) and not like an alert/OTP/offer (negative).
const BODY_CARD_PATTERNS = [/credit\s*card/i, /\bcard\s*(no|number|ending|account)/i, /\bcard\b.*\b(xx|\*\*)\d{2,4}/i];
const BODY_STATEMENT_PATTERNS = [
  /total\s*(amount\s*)?(due|payable)/i, /minimum\s*(amount\s*)?(due|payable)/i,
  /payment\s*due\s*date/i, /due\s*date/i, /pay\s*(by|before)/i,
  /statement\s*(date|period|summary|for|of)/i, /outstanding/i, /amount\s*payable/i,
  /\bdues\b/i, /(billing|statement)\s*cycle|cycle\s*ending/i, /\b(card|account)\s*summary\b/i,
  /\bpayable\s*(by|before|on)\b/i,
];
const NEGATIVE_PATTERNS = [
  /\bOTP\b/i, /one[\s-]*time\s*password/i,
  /payment\s*(of\s*.{0,30})?(has\s*been\s*)?received/i, /thank\s*you\s*for\s*(your\s*)?payment/i,
  /transaction\s*alert/i, /\b(spent|debited)\b.{0,40}\bon\s*your\b/i,
  /pre[\s-]*approved/i, /\blimit\s*(enhancement|increase)\s*offer/i,
];

const isStatementCandidate = (subject, body) => {
  const head = `${subject}\n${body.slice(0, 4000)}`;
  if (NEGATIVE_PATTERNS.some(p => p.test(subject))) return false;
  const subjectHit = BILL_SUBJECT_PATTERNS.some(p => p.test(subject));
  const cardHit = BODY_CARD_PATTERNS.some(p => p.test(head));
  const statementHits = BODY_STATEMENT_PATTERNS.filter(p => p.test(head)).length;
  return subjectHit || (cardHit && statementHits >= 2);
};

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
  const isVerifiedBank = isBankDomain(domain);

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

/**
 * Parse one raw RFC822 email. Returns structured bill data, or null if it is
 * not a credit card statement from a whitelisted bank domain.
 */
// Readable text from both MIME parts. Many banks send a stub text part
// ("view in browser") with the real figures only in the HTML table.
const emailBodyText = (parsed) => {
  const fromHtml = parsed.html
    ? htmlToText(parsed.html.replace(/<\/(td|th)>/gi, ' </$1>'), {
        wordwrap: false,
        selectors: [
          { selector: 'img', format: 'skip' },
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'tr', format: 'block' },
          { selector: 'table', format: 'block' },
        ],
      })
    : '';
  // mailparser auto-generates .text from HTML, so using both would duplicate
  // the content and let patterns match across the two copies.
  return (fromHtml || parsed.text || '').replace(/\u00a0/g, ' ');
};

/**
 * Parse one raw RFC822 email.
 * @param {Buffer} raw
 * @param {{ aiExtract?: (input) => Promise<null|{amount,dueDate,last4}> }} [opts]
 * @returns {Promise<{ bill: object|null, reason: string }>}
 *   reason: regex | ai | not_bank | unauthenticated | not_statement | no_fields | ai_rejected | ai_error
 */
const parseBillFromRaw = async (raw, { aiExtract } = {}) => {
  const parsed = await simpleParser(raw);
  const subject = parsed.subject || '';
  const fromAddr = parsed.from?.value?.[0]?.address || '';
  const fromName = parsed.from?.value?.[0]?.name || '';
  const domain = extractDomain(fromAddr);
  if (!isBankDomain(domain)) return { bill: null, reason: 'not_bank' };

  // Anti-spoofing: Gmail stamps every message with Authentication-Results.
  // Require DMARC or DKIM to pass so a forged "From: x@hdfcbank.com" email
  // can't plant fake bills or due dates.
  const authResults = [].concat(parsed.headers.get('authentication-results') || []).join(' ').toLowerCase();
  if (!/\b(dmarc|dkim)=pass\b/.test(authResults)) return { bill: null, reason: 'unauthenticated' };

  const bodyText = emailBodyText(parsed);
  if (!isStatementCandidate(subject, bodyText)) return { bill: null, reason: 'not_statement' };

  const date = parsed.date || new Date();
  let amount = extractAmount(bodyText) || extractAmount(subject);
  let dueDate = extractDueDate(bodyText) || extractDueDate(subject);
  let last4 = extractLast4(bodyText) || extractLast4(subject);
  let source = 'regex';

  // AI fallback when the regexes couldn't get both amount and due date.
  if ((!amount || !dueDate) && aiExtract) {
    try {
      const ai = await aiExtract({ subject, body: bodyText, emailDate: date });
      if (ai === undefined) {
        // AI budget exhausted for this scan; fall through with regex results.
      } else if (!ai) {
        // The model judged it not a statement (or nothing verifiable). Keep a
        // complete regex result only if it had both fields; otherwise drop it.
        if (!amount && !dueDate) return { bill: null, reason: 'ai_rejected' };
      } else {
        amount = amount || ai.amount;
        dueDate = dueDate || ai.dueDate;
        last4 = last4 || ai.last4;
        source = 'ai';
      }
    } catch (err) {
      console.warn(`[gmail] AI extraction failed (${domain}): ${err.message}`);
      if (!amount && !dueDate) return { bill: null, reason: 'ai_error' };
    }
  }
  if (!amount && !dueDate) return { bill: null, reason: 'no_fields' };

  return {
    reason: source,
    bill: {
      subject: subject.slice(0, 300),
      from: `${fromName} <${fromAddr}>`.slice(0, 300),
      domain,
      date,
      amount,
      dueDate,
      last4,
      source,
    },
  };
};

module.exports = {
  scanGmailForBills,
  parseBillFromRaw,
  isBankDomain,
  OFFICIAL_BANK_DOMAINS,
  // Shared with the deterministic email-processing pipeline (services/emailProcessing)
  BILL_SUBJECT_PATTERNS,
  AMOUNT_PATTERNS,
  DUE_DATE_PATTERNS,
  CARD_DIGITS_PATTERNS,
  NEGATIVE_PATTERNS,
  parseDate,
  isStatementCandidate,
  emailBodyText,
  extractDomain,
};
