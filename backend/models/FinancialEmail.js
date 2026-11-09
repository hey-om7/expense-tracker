const mongoose = require('mongoose');

/**
 * A financial email found in Gmail that is not stored as a CardStatement:
 *  recorded  – parsed into a known category that has no dedicated storage (e.g. transaction alerts)
 *  review    – could not be reliably classified or parsed; waiting for the user
 *  dismissed – the user looked at it and dismissed it
 * Only metadata and extracted fields are stored, never the email body.
 */
const financialEmailSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gmailMessageId: { type: String, required: true },
  status: { type: String, enum: ['recorded', 'review', 'dismissed'], required: true },
  category: { type: String, default: null },
  reason: { type: String, default: '' },
  processor: { type: String, default: 'deterministic' },
  confidence: { type: String, default: null },
  institutionName: { type: String, default: '' },
  senderDomain: { type: String, default: '' },
  subject: { type: String, default: '' },
  receivedAt: { type: Date, required: true },
  fields: {
    amount: { type: Number, default: null },
    currency: { type: String, default: 'INR' },
    dueDate: { type: Date, default: null },
    statementDate: { type: Date, default: null },
    transactionDate: { type: Date, default: null },
    last4: { type: String, default: null },
    merchant: { type: String, default: null },
    paymentMethod: { type: String, default: null },
    transactionType: { type: String, default: null },
  },
  // Expense suggestions (PhonePe/Kotak debits): null = open, 'used' = added as a transaction, 'dismissed' = hidden
  suggestionState: { type: String, enum: [null, 'used', 'dismissed'], default: null },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
  // Payment-parser version that produced `fields`. Open suggestions parsed by an older
  // version are re-read from Gmail on the next sync (see gmailSync.reparseStaleSuggestions).
  parserRevision: { type: Number, default: 0 },
  // Review items: the last "Analyze with AI" answer, waiting for the user to confirm.
  // { category, confidence, fields, anchors, analyzedAt }. Labels only, never the body.
  proposal: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

financialEmailSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true });
financialEmailSchema.index({ userId: 1, status: 1, receivedAt: -1 });

module.exports = mongoose.model('FinancialEmail', financialEmailSchema);
