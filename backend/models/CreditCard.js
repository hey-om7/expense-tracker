const mongoose = require('mongoose');

const creditCardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 100 },
  last4Digits: { type: String, required: true, maxlength: 4 },
  billDueDate: { type: Date, required: true },
  billAmount: { type: Number, default: null },          // populated by Gmail scan
  billGeneratedDate: { type: Date, default: null },     // date the bill email was received
  totalLimit: { type: Number, default: 0, min: 0 },
  notes: { type: String, default: '', maxlength: 500 },
  lastReminderSentDate: { type: Date, default: null },
  // The bill is paid while paidDueDate matches billDueDate. A new statement
  // moves billDueDate forward, so the card becomes unpaid again on its own.
  paidDueDate: { type: Date, default: null },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('CreditCard', creditCardSchema);
