const mongoose = require('mongoose');

/**
 * A type of bank email the user taught Vestor (after an AI analysis they confirmed).
 * Emails from the same bank whose subject has the same shape (dates and numbers
 * removed, see emailProcessing/rules.subjectKey) are handled by this rule with
 * local extraction only, never AI.
 *
 * anchors: the label text found just before each value in the analyzed email,
 * e.g. { amount: 'total amount due', dueDate: 'payment due date' }.
 * Only short labels are stored, never the email body.
 */
const emailRuleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  senderDomain: { type: String, required: true },
  subjectKey: { type: String, required: true, maxlength: 300 },
  category: { type: String, required: true },
  anchors: {
    amount: { type: String, default: null },
    dueDate: { type: String, default: null },
    statementDate: { type: String, default: null },
    transactionDate: { type: String, default: null },
    last4: { type: String, default: null },
  },
  institutionName: { type: String, default: '' },
  sampleSubject: { type: String, default: '', maxlength: 300 },
  // Learned from the attached statement PDF: read the PDF (with the saved password) next time.
  usesPdf: { type: Boolean, default: false },
  timesApplied: { type: Number, default: 0 },
  lastAppliedAt: { type: Date, default: null },
}, { timestamps: true });

emailRuleSchema.index({ userId: 1, senderDomain: 1, subjectKey: 1 }, { unique: true });

module.exports = mongoose.model('EmailRule', emailRuleSchema);
