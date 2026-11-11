/**
 * Financial institution identification and institution-specific parsing templates.
 *
 * A template only adds patterns for a bank whose emails the generic patterns read
 * badly. Template patterns are tried first, then the generic ones, so a bank with
 * no template is still handled by the generic fallback parser.
 *
 * Template shape:
 *   { id, roots: [rootDomain...], patterns: { [categoryId]: { [field]: RegExp[] } } }
 * Each RegExp must capture the value in group 1.
 */
const { OFFICIAL_BANK_DOMAINS } = require('../gmailScanner');

const BANK_NAMES = {
  'icicibank.com': 'ICICI Bank', 'icici.bank.in': 'ICICI Bank',
  'hdfcbank.net': 'HDFC Bank', 'hdfcbank.com': 'HDFC Bank',
  'axisbank.com': 'Axis Bank', 'sbicard.com': 'SBI Card', 'kotak.com': 'Kotak',
  'idfcfirstbank.com': 'IDFC FIRST', 'aexp.com': 'American Express',
  'americanexpress.com': 'American Express', 'indusind.com': 'IndusInd',
  'rblbank.com': 'RBL Bank', 'sc.com': 'Standard Chartered', 'citi.com': 'Citi',
  'citibank.com': 'Citi', 'hsbc.co.in': 'HSBC', 'hsbc.com': 'HSBC',
  'yesbank.in': 'Yes Bank', 'getonecard.app': 'OneCard', 'uni.cards': 'Uni Card',
  'sliceit.com': 'Slice', 'federalbank.co.in': 'Federal Bank', 'aubank.in': 'AU Small Finance Bank',
  'bobcard.co.in': 'BOBCARD', 'bobfinancial.com': 'BOBCARD', 'scapia.cards': 'Scapia',
  'dbs.com': 'DBS Bank', 'sbi.co.in': 'SBI', 'pnb.co.in': 'PNB', 'canarabank.com': 'Canara Bank',
  'unionbankofindia.co.in': 'Union Bank of India', 'idbibank.co.in': 'IDBI Bank',
  'bandhanbank.com': 'Bandhan Bank', 'jupiter.money': 'Jupiter',
  'kotakbank.com': 'Kotak', 'phonepe.com': 'PhonePe',
};
// Labels used under the RBI ".bank.in" domain, e.g. axis.bank.in
const BANK_IN_NAMES = {
  axis: 'Axis Bank', hdfc: 'HDFC Bank', hdfcbank: 'HDFC Bank', icici: 'ICICI Bank', sbi: 'SBI',
  sbicard: 'SBI Card', kotak: 'Kotak', idfcfirst: 'IDFC FIRST', indusind: 'IndusInd', yes: 'Yes Bank',
  yesbank: 'Yes Bank', rbl: 'RBL Bank', federal: 'Federal Bank', federalbank: 'Federal Bank', au: 'AU Bank',
  bob: 'Bank of Baroda', pnb: 'PNB', canara: 'Canara Bank', union: 'Union Bank', idbi: 'IDBI Bank',
};

// Root bank domain, so "statements.hdfcbank.net" and "hdfcbank.net" are the same bank.
// Under *.bank.in each bank is its own root: "cc.axis.bank.in" -> "axis.bank.in".
const rootDomainFor = (domain = '') => {
  if (!domain) return '';
  if (domain.endsWith('.bank.in')) return domain.split('.').slice(-3).join('.');
  return OFFICIAL_BANK_DOMAINS.find(d => domain === d || domain.endsWith('.' + d)) || registrableDomain(domain);
};

// Senders outside the bank list: "alerts.newbank.co.in" -> "newbank.co.in", "mail.card.com" -> "card.com".
const SECOND_LEVEL = /^(?:co|com|net|org|gov|ac|edu|firm|gen|ind|nic|res|ltd|plc)$/;
function registrableDomain(domain) {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  const n = parts[parts.length - 1].length === 2 && SECOND_LEVEL.test(parts[parts.length - 2]) ? 3 : 2;
  return parts.slice(-n).join('.');
}

const bankNameFor = (domain = '') => {
  const root = rootDomainFor(domain);
  if (root.endsWith('.bank.in')) {
    const label = root.split('.')[0];
    return BANK_IN_NAMES[label] || `${label.toUpperCase()} Bank`;
  }
  return BANK_NAMES[root] || root;
};

const AMT = '([0-9][0-9,]*(?:\\.[0-9]{1,2})?)';
const NUM_DATE = '(\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|\\d{1,2}[- ][A-Za-z]{3,9}[- ,]+\\d{2,4})';

const TEMPLATES = [
  {
    id: 'axis',
    roots: ['axisbank.com', 'axisbank.co.in', 'axis.bank.in'],
    patterns: {
      // Axis statement emails put a "(DD-MM-YYYY)" header above the amount and due date.
      credit_card_statement: {
        amount: [new RegExp(`\\(DD-MM-YYYY\\)[^\\d]{0,80}?${AMT}`, 'i')],
        dueDate: [/\(DD-MM-YYYY\)[\s\S]{0,150}?(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i],
      },
      transaction_alert: {
        amount: [new RegExp(`(?:INR|Rs\\.?|₹)\\s*${AMT}\\s+(?:was\\s+)?spent`, 'i')],
        merchant: [/\bat\s+(.+?)\s+on\s+\d/i],
      },
    },
  },
  {
    id: 'hdfc',
    roots: ['hdfcbank.net', 'hdfcbank.com', 'hdfc.bank.in', 'hdfcbank.bank.in'],
    patterns: {
      transaction_alert: {
        amount: [new RegExp(`Rs\\.?\\s*${AMT}\\s+(?:has\\s+been|is)\\s+debited`, 'i')],
        merchant: [/\btowards\s+(.+?)\s+on\s+\d/i, /\bto\s+VPA\s+(\S+)/i],
        transactionDate: [new RegExp(`\\bon\\s+${NUM_DATE}`, 'i')],
      },
    },
  },
  {
    id: 'icici',
    roots: ['icicibank.com', 'icicibank.co.in', 'icici.bank.in'],
    patterns: {
      transaction_alert: {
        amount: [new RegExp(`INR\\s*${AMT}\\s+spent`, 'i')],
        merchant: [/\bon\s+\S+\s+at\s+(.+?)\.\s/i, /\bat\s+(.+?)\.\s+Avl/i],
      },
    },
  },
  {
    id: 'sbicard',
    roots: ['sbicard.com', 'sbicard.bank.in'],
    patterns: {
      transaction_alert: {
        amount: [new RegExp(`Rs\\.?\\s*${AMT}\\s+spent\\s+on\\s+your\\s+SBI\\s+Credit\\s+Card`, 'i')],
        merchant: [/\bat\s+(.+?)\s+on\s+\d/i],
      },
    },
  },
  {
    id: 'kotak',
    roots: ['kotak.com', 'kotakbank.com', 'kotak.bank.in'],
    patterns: {
      // "Rs.250.00 is debited from your Kotak Bank Account XX1234 towards UPI/SWIGGY/... on 05-11-2026"
      // "Your account xx1234 is debited for INR 500.00 on 04-Nov-2026"
      // "Sent Rs.120.00 from Kotak Bank AC X1234 to shop@okaxis on 05-11-26"
      // "Your transaction of Rs.258.00 on AMAZONIN using Kotak Bank Debit Card XX9678 on 31/10/2026 10:34:44 ..."
      transaction_alert: {
        amount: [
          new RegExp(`(?:INR|Rs\\.?|₹)\\s*${AMT}\\s+(?:is|has\\s+been|was)\\s+debited`, 'i'),
          new RegExp(`debited\\s+(?:for|with|by)\\s+(?:INR|Rs\\.?|₹)\\s*${AMT}`, 'i'),
          new RegExp(`\\bSent\\s+(?:INR|Rs\\.?|₹)\\s*${AMT}`, 'i'),
          new RegExp(`\\btransaction\\s+of\\s+(?:INR|Rs\\.?|₹)\\s*${AMT}`, 'i'),
        ],
        merchant: [
          /\btransaction\s+of\s+(?:INR|Rs\.?|₹)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?\s+(?:on|at)\s+(.+?)\s+using\b/i,
          /\bto\s+VPA\s+([A-Za-z0-9._-]+@[A-Za-z0-9.-]+)/i,
          /\btowards\s+UPI\/(?:[^/\n]*\/)?([A-Za-z][^/\n]{1,50}?)\s*(?:\/|\s+on\s+\d|\n|$)/i,
          /\bto\s+([A-Za-z0-9._-]+@[A-Za-z][A-Za-z0-9.-]*)/i,
          /\b(?:towards|at)\s+(.+?)\s+on\s+\d/i,
        ],
        transactionDate: [new RegExp(`\\bon\\s+${NUM_DATE}`, 'i')],
      },
    },
  },
  {
    id: 'phonepe',
    roots: ['phonepe.com'],
    patterns: {
      // Subject "Paid ₹150 to Swiggy" / "Sent ₹500 to Ravi"; body "Paid to\nSWIGGY\n₹150\nTxn. ID ..."
      // or "Your payment of ₹ 200 to NAME was successful".
      transaction_alert: {
        amount: [
          new RegExp(`\\b(?:Paid|Sent)\\s+(?:INR|Rs\\.?|₹)\\s*${AMT}`, 'i'),
          new RegExp(`payment\\s+of\\s+(?:INR|Rs\\.?|₹)\\s*${AMT}`, 'i'),
          new RegExp(`\\b(?:Paid|Sent)\\s+to\\b[\\s\\S]{0,120}?(?:INR|Rs\\.?|₹)\\s*${AMT}`, 'i'),
        ],
        merchant: [
          /\b(?:Paid|Sent)\s+(?:INR|Rs\.?|₹)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?\s+to\s+(.+?)(?=\s+(?:on|via|using|successfully|from)\b|[.,;\n]|$)/i,
          /\bpayment\s+of\s+(?:INR|Rs\.?|₹)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?\s+to\s+(.+?)\s+(?:was|is|has)\b/i,
          /\b(?:Paid|Sent)\s+to\s*\n\s*([^\n₹]{2,60}?)\s*(?:\n|₹)/i,
          /\b(?:Paid|Sent)\s+to\s+([^\n₹]{2,60}?)\s*(?:\n|₹)/i,
        ],
        transactionDate: [
          new RegExp(`\\bon\\s+${NUM_DATE}`, 'i'),
          /(\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4})/,
          /([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/,
        ],
      },
    },
  },
];

// Senders whose debit alerts are offered as suggestions when adding an expense.
// hdfcbank.bank.in: alerts@ sends one "You have done a UPI txn" email per UPI debit.
const PAYMENT_SUGGESTION_DOMAINS = ['phonepe.com', 'kotak.com', 'kotakbank.com', 'kotak.bank.in', 'hdfcbank.bank.in'];

const templateByRoot = new Map();
TEMPLATES.forEach(t => t.roots.forEach(r => templateByRoot.set(r, t)));

/** Add or replace a template at runtime (e.g. from a plugin). */
const registerTemplate = (template) => {
  TEMPLATES.push(template);
  template.roots.forEach(r => templateByRoot.set(r, template));
};

/**
 * @returns {{ rootDomain: string, name: string, template: object|null }}
 */
const identifyInstitution = (domain = '') => {
  const rootDomain = rootDomainFor(domain);
  return { rootDomain, name: bankNameFor(domain), template: templateByRoot.get(rootDomain) || null };
};

/** Template patterns for one field, followed by the generic patterns. */
const patternsFor = (template, categoryId, field, generic = []) =>
  [...(template?.patterns?.[categoryId]?.[field] || []), ...generic];

module.exports = { rootDomainFor, bankNameFor, identifyInstitution, patternsFor, registerTemplate, TEMPLATES, PAYMENT_SUGGESTION_DOMAINS };
