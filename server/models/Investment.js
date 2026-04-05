const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  currentPrice: { type: Number, default: 0 },
  type: { type: String, default: 'Stock' },
  comments: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Investment', investmentSchema);
