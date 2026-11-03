const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  quantity: { type: Number, required: true, min: 0.0001 },
  price: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  type: { type: String, required: true, enum: ['BUY', 'SELL'] },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
}, { _id: true });

const investmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 200 },
  symbol: { type: String, required: true, maxlength: 50 },
  currentPrice: { type: Number, default: 0, min: 0 },
  type: { type: String, default: 'Stock', maxlength: 30 },
  comments: { type: String, default: '', maxlength: 500 },
  holdings: [holdingSchema],
}, { timestamps: true });

module.exports = mongoose.model('Investment', investmentSchema);
