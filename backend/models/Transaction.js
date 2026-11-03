const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, enum: ['income', 'expense', 'buy_investment', 'sell_investment'] },
  amount: { type: Number, required: true, min: 0.01, max: 999999999 },
  title: { type: String, default: '', maxlength: 200 },
  notes: { type: String, default: '', maxlength: 500 },
  categoryId: { type: String, default: '', maxlength: 50 },
  date: { type: Date, default: Date.now },
  investmentId: { type: String, default: null },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
}, { timestamps: true });

// Compound indexes for production query performance
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, investmentId: 1 });
transactionSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
