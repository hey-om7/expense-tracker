const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 200 },
  message: { type: String, default: '', maxlength: 500 },
  isRead: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
