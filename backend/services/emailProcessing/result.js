/**
 * The standardized result every processing method returns. Storage, duplicate
 * detection and notifications only ever see this shape, so they behave the same
 * whichever processor produced it.
 *
 * {
 *   outcome:    'extracted' | 'review' | 'ignored',
 *   category:   registered category id (e.g. 'credit_card_statement') | null,
 *   reason:     short machine-readable reason,
 *   processor:  'deterministic' | 'ai' | ...,
 *   confidence: 'high' | 'medium' | 'low' | null,
 *   institution:{ domain, rootDomain, name, templateId },
 *   email:      { messageId, subject, from, sentAt, receivedAt },   // metadata only, never the body
 *   fields:     { amount, currency, dueDate, statementDate, transactionDate,
 *                 last4, merchant, paymentMethod, transactionType }
 * }
 */
const OUTCOME = Object.freeze({ EXTRACTED: 'extracted', REVIEW: 'review', IGNORED: 'ignored' });
const CONFIDENCE = ['high', 'medium', 'low'];
const PAYMENT_METHODS = ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet', 'cash', 'other'];
const TRANSACTION_TYPES = ['debit', 'credit', 'payment', 'refund'];

const FIELD_NAMES = ['amount', 'currency', 'dueDate', 'statementDate', 'transactionDate',
  'last4', 'merchant', 'paymentMethod', 'transactionType'];

const validDate = (d) => (d instanceof Date && !isNaN(d.getTime()) ? d : null);

/** Validate and normalize extracted fields. Invalid values become null. */
const sanitizeFields = (f = {}) => {
  const amount = Number(f.amount);
  const digits = f.last4 == null ? '' : String(f.last4).replace(/\D/g, '').slice(-4);
  const merchant = typeof f.merchant === 'string'
    ? f.merchant.replace(/\s+/g, ' ').replace(/[.,;:\s]+$/, '').trim().slice(0, 100)
    : '';
  return {
    amount: f.amount != null && Number.isFinite(amount) && amount > 0 && amount < 1e8 ? Math.round(amount * 100) / 100 : null,
    currency: typeof f.currency === 'string' && /^[A-Z]{3}$/.test(f.currency) ? f.currency : 'INR',
    dueDate: validDate(f.dueDate),
    statementDate: validDate(f.statementDate),
    transactionDate: validDate(f.transactionDate),
    last4: digits.length >= 2 ? digits : null,
    merchant: merchant.length >= 2 ? merchant : null,
    paymentMethod: PAYMENT_METHODS.includes(f.paymentMethod) ? f.paymentMethod : null,
    transactionType: TRANSACTION_TYPES.includes(f.transactionType) ? f.transactionType : null,
  };
};

const buildResult = ({ email, institution, processor, outcome, category = null, reason, fields, confidence = null }) => ({
  outcome,
  category,
  reason,
  processor,
  confidence: CONFIDENCE.includes(confidence) ? confidence : null,
  institution: {
    domain: email.domain || '',
    rootDomain: institution?.rootDomain || '',
    name: institution?.name || '',
    templateId: institution?.template?.id || null,
  },
  email: {
    messageId: email.messageId,
    subject: (email.subject || '').slice(0, 300),
    from: `${email.fromName || ''} <${email.fromAddr || ''}>`.slice(0, 300),
    sentAt: email.date,
    receivedAt: email.receivedAt,
  },
  fields: sanitizeFields(fields),
});

module.exports = { OUTCOME, PAYMENT_METHODS, TRANSACTION_TYPES, FIELD_NAMES, sanitizeFields, buildResult };
