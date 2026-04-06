const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ['income', 'expense'] },
  color: { type: String, default: '#E5BA73' },
  icon: { type: String, default: 'category' },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
