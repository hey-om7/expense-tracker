const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 100 },
  amount: { type: Number, required: true, min: 0.01, max: 999999999 },
  startDate: { type: Date, required: function() { return this.period !== 'one_time'; } },
  endDate: { type: Date, default: null },
  expiryDate: { type: Date, default: null },
  categoryId: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  period: { type: String, default: 'monthly', enum: ['weekly', 'monthly', 'yearly', 'one_time'] },
  lastExecutedDate: { type: String, default: null },
  lastReminderSentDate: { type: Date, default: null },
}, { timestamps: true });

subscriptionSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
