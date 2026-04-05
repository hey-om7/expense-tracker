const mongoose = require('mongoose');

const creditCardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  last4Digits: { type: String, required: true },
  billDueDate: { type: Date, required: true },
  totalLimit: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('CreditCard', creditCardSchema);
