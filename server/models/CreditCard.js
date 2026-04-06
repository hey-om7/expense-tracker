const mongoose = require('mongoose');

const creditCardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  last4Digits: { type: String, required: true },
  billDueDate: { type: Date, required: true },
  totalLimit: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('CreditCard', creditCardSchema);
