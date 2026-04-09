const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  aiEnabled: { type: Boolean, default: true },
  aiModel: { type: String, default: 'gemini-1.5-flash', enum: ['gemini-1.5-flash', 'gemini-1.5-pro'] },
  geminiApiKey: { type: String, default: '' },
  emailAlertsEnabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);
