const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, enum: ['income', 'expense', 'buy_investment', 'sell_investment'] },
  amount: { type: Number, required: true },
  title: { type: String, default: '' },
  notes: { type: String, default: '' },
  categoryId: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  // Investment-specific fields
  investmentId: { type: String, default: null },
  shares: { type: Number, default: null },
  price: { type: Number, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
