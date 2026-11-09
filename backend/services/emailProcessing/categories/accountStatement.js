/**
 * Bank account (savings/current) statement or e-statement notice, e.g. HDFC
 * "Combined Email Statement for October-2026". These usually carry a password
 * protected PDF and few values in the body, so the email is stored as a record
 * to check later. Never detected by keyword rules alone: it is assigned by AI or
 * by a rule the user confirmed (see rules.js).
 */
const ID = 'account_statement';

module.exports = {
  id: ID,
  label: 'Bank account statement',
  aiDescription: 'a bank account (savings/current/combined) statement or e-statement notice, often with a PDF attached',
  detect: () => false,
  extract: (email) => ({ statementDate: email.receivedAt }),
  isUsable: () => true,
  isComplete: (f) => f.amount != null,
};
