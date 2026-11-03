const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, maxlength: 50 },
  type: { type: String, required: true, enum: ['income', 'expense'] },
  color: { type: String, default: '#E5BA73', maxlength: 20 },
  icon: { type: String, default: 'category', maxlength: 50 },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
