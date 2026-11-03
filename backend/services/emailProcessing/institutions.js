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
  return OFFICIAL_BANK_DOMAINS.find(d => domain === d || domain.endsWith('.' + d)) || domain;
};

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
];

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

module.exports = { rootDomainFor, bankNameFor, identifyInstitution, patternsFor, registerTemplate, TEMPLATES };
