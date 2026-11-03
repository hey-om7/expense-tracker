const mongoose = require('mongoose');

/**
 * One credit card statement found in a user's Gmail.
 *  linked    – attached to a tracked CreditCard
 *  pending   – card not tracked yet; waiting for the user to add or ignore it
 *  dismissed – user chose not to track this card
 */
const cardStatementSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditCard', default: null, index: true },
  status: { type: String, enum: ['linked', 'pending', 'dismissed'], required: true },
  gmailMessageId: { type: String, required: true },
  bankName: { type: String, default: '' },
  senderDomain: { type: String, default: '' },
  last4: { type: String, default: null },
  amount: { type: Number, default: null },
  dueDate: { type: Date, default: null },
  statementDate: { type: Date, required: true },
  subject: { type: String, default: '' },
  source: { type: String, enum: ['regex', 'ai'], default: 'regex' },
}, { timestamps: true });

// The same email is never stored twice for a user.
cardStatementSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true });
cardStatementSchema.index({ userId: 1, status: 1, statementDate: -1 });

module.exports = mongoose.model('CardStatement', cardStatementSchema);
