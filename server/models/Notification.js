const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
