const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 200 },
  symbol: { type: String, required: true, maxlength: 50 },
  currentPrice: { type: Number, default: 0, min: 0 },
  type: { type: String, default: 'Stock', maxlength: 30 },
  comments: { type: String, default: '', maxlength: 500 },
}, { timestamps: true });

module.exports = mongoose.model('Investment', investmentSchema);
