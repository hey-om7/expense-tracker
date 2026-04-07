const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  categoryId: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  period: { type: String, default: 'monthly', enum: ['weekly', 'monthly', 'yearly'] },
  lastExecutedDate: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
