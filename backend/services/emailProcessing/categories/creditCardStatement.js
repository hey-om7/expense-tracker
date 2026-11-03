const { AMOUNT_PATTERNS, DUE_DATE_PATTERNS, CARD_DIGITS_PATTERNS, isStatementCandidate } = require('../../gmailScanner');
const { patternsFor } = require('../institutions');
const { firstMatch, toAmount, parseFlexibleDate } = require('../textUtils');

const ID = 'credit_card_statement';

module.exports = {
  id: ID,
  label: 'Credit card statement',
  // Used in the AI prompt so the model knows what this category means.
  aiDescription: 'a credit card statement or bill notice that states an amount due and/or a payment due date',

  detect: (email) => isStatementCandidate(email.subject, email.text),

  extract: (email, template) => {
    const amountP = patternsFor(template, ID, 'amount', AMOUNT_PATTERNS);
    const dueP = patternsFor(template, ID, 'dueDate', DUE_DATE_PATTERNS);
    const digitsP = patternsFor(template, ID, 'last4', CARD_DIGITS_PATTERNS);
    return {
      amount: firstMatch(amountP, email.text, toAmount) ?? firstMatch(amountP, email.subject, toAmount),
      dueDate: firstMatch(dueP, email.text, parseFlexibleDate) ?? firstMatch(dueP, email.subject, parseFlexibleDate),
      last4: firstMatch(digitsP, email.text) ?? firstMatch(digitsP, email.subject),
      statementDate: email.receivedAt,
      paymentMethod: 'credit_card',
    };
  },

  // Enough to store without a human looking at it.
  isUsable: (f) => f.amount != null || f.dueDate != null,
  isComplete: (f) => f.amount != null && f.dueDate != null,
};
