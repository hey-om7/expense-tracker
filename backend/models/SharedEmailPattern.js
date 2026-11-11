const mongoose = require('mongoose');

/**
 * What AI concluded about one email type, shared by all users so the same type
 * is never sent to AI twice. An email type is (sender root domain, subject shape),
 * where the subject shape has amounts, dates and numbers removed
 * (emailProcessing/rules.subjectKey).
 *
 *  verdict 'financial'     – category + anchors (label text before each value) let
 *                            later emails of this type be read locally.
 *  verdict 'not_financial' – later emails of this type are skipped without AI.
 *
 * Only labels and the subject shape are stored, never email bodies or values.
 */
const sharedEmailPatternSchema = new mongoose.Schema({
  senderDomain: { type: String, required: true, maxlength: 253 },
  subjectKey: { type: String, required: true, maxlength: 300 },
  verdict: { type: String, enum: ['financial', 'not_financial'], required: true },
  category: { type: String, default: null },
  anchors: {
    amount: { type: String, default: null },
    dueDate: { type: String, default: null },
    statementDate: { type: String, default: null },
    transactionDate: { type: String, default: null },
    last4: { type: String, default: null },
  },
  institutionName: { type: String, default: '', maxlength: 120 },
  // Field patterns a user taught by marking values (see trainedPatterns.js).
  patterns: {
    amount: { type: String, default: null, maxlength: 400 },
    transactionDate: { type: String, default: null, maxlength: 400 },
    merchant: { type: String, default: null, maxlength: 400 },
    last4: { type: String, default: null, maxlength: 400 },
  },
  aiVerdicts: { type: Number, default: 1 },
  timesApplied: { type: Number, default: 0 },
  lastAppliedAt: { type: Date, default: null },
}, { timestamps: true });

sharedEmailPatternSchema.index({ senderDomain: 1, subjectKey: 1 }, { unique: true });

module.exports = mongoose.model('SharedEmailPattern', sharedEmailPatternSchema);
