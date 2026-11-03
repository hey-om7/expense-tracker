const { CARD_DIGITS_PATTERNS } = require('../../gmailScanner');
const { patternsFor } = require('../institutions');
const { firstMatch, toAmount, parseFlexibleDate, CURRENCY_AMOUNT } = require('../textUtils');

const ID = 'transaction_alert';
const AMT = '([0-9][0-9,]*(?:\\.[0-9]{1,2})?)';
const CUR = '(?:INR|Rs\\.?|₹)';

const SIGNALS = [
  /\b(spent|debited|credited|charged|withdrawn)\b/i,
  /\btransaction\s*(alert|successful|of|on)\b/i,
  /\btxn\b/i,
  /payment\s*(of\s*.{0,30})?(has\s*been\s*)?received/i,
  /thank\s*you\s*for\s*(your\s*)?payment/i,
  /\brefund(ed)?\b/i,
];

const GENERIC = {
  amount: [
    new RegExp(`${CUR}\\s*${AMT}\\s*(?:has\\s+been\\s+|was\\s+|is\\s+)?(?:spent|debited|credited|charged|paid|received|refunded)`, 'i'),
    new RegExp(`(?:spent|debited|credited|charged|payment|refund)\\s*(?:of|for|with)?\\s*${CUR}\\s*${AMT}`, 'i'),
    new RegExp(`${CUR}\\s*${AMT}`, 'i'),
  ],
  merchant: [
    /\b(?:at|towards)\s+([A-Za-z0-9@][A-Za-z0-9 &@._'*/-]{1,60}?)(?=\s+(?:on|via|using|ref|for|with|from)\b|[.,;\n]|$)/i,
    /\bto\s+VPA\s+([A-Za-z0-9._-]+@[A-Za-z0-9.-]+)/i,
    /\bInfo:?\s*([A-Za-z0-9 &@._*/-]{2,60}?)(?=[.,;\n]|$)/i,
  ],
  transactionDate: [
    /\bon\s+(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i,
    /\bon\s+(\d{1,2}(?:st|nd|rd|th)?[- ][A-Za-z]{3,9}[- ,]+'?\d{2,4})/i,
    /\bon\s+([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/i,
    /\bdate[:\s]+(\d{1,2}[-/.][0-9A-Za-z]{1,9}[-/.]\d{2,4})/i,
  ],
};

const MERCHANT_STOPWORDS = /^(your|the|you|our|this|a|an|any|us)\b/i;

const detectPaymentMethod = (text) => {
  if (/\bUPI\b|\bVPA\b/i.test(text)) return 'upi';
  if (/credit\s*card/i.test(text)) return 'credit_card';
  if (/debit\s*card/i.test(text)) return 'debit_card';
  if (/net\s*banking|\bNEFT\b|\bIMPS\b|\bRTGS\b/i.test(text)) return 'net_banking';
  if (/\bwallet\b/i.test(text)) return 'wallet';
  if (/\bATM\b/.test(text)) return 'cash';
  return null;
};

const detectType = (text) => {
  if (/\brefund(ed)?\b/i.test(text)) return 'refund';
  if (/payment\s*(of\s*.{0,30})?(has\s*been\s*)?received|thank\s*you\s*for\s*(your\s*)?payment/i.test(text)) return 'payment';
  if (/\bcredited\b/i.test(text) && !/\bdebited\b/i.test(text)) return 'credit';
  return 'debit';
};

module.exports = {
  id: ID,
  label: 'Transaction alert',
  aiDescription: 'a single transaction notification: a card/UPI/bank debit or credit, a payment received, or a refund',

  detect: (email) => {
    const head = `${email.subject}\n${email.text.slice(0, 2000)}`;
    return SIGNALS.some(p => p.test(head)) && CURRENCY_AMOUNT.test(head);
  },

  extract: (email, template) => {
    const head = `${email.subject}\n${email.text.slice(0, 4000)}`;
    const merchant = firstMatch(patternsFor(template, ID, 'merchant', GENERIC.merchant), head,
      (v) => (MERCHANT_STOPWORDS.test(v.trim()) || /^\d+$/.test(v.trim()) ? null : v));
    return {
      amount: firstMatch(patternsFor(template, ID, 'amount', GENERIC.amount), head, toAmount),
      transactionDate: firstMatch(patternsFor(template, ID, 'transactionDate', GENERIC.transactionDate), head, parseFlexibleDate),
      merchant,
      last4: firstMatch(patternsFor(template, ID, 'last4', CARD_DIGITS_PATTERNS), head),
      paymentMethod: detectPaymentMethod(head),
      transactionType: detectType(head),
    };
  },

  isUsable: (f) => f.amount != null,
  isComplete: (f) => f.amount != null && f.transactionDate != null && f.merchant != null,
};
