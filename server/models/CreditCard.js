const mongoose = require('mongoose');

const creditCardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 100 },
  last4Digits: { type: String, required: true, maxlength: 4 },
  billDueDate: { type: Date, required: true },
  totalLimit: { type: Number, default: 0, min: 0 },
  notes: { type: String, default: '', maxlength: 500 },
  lastReminderSentDate: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('CreditCard', creditCardSchema);
