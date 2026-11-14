const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  aiEnabled: { type: Boolean, default: true },
  // Groq model id, chosen from the models Groq reports as active for the user's key.
  aiModel: { type: String, default: 'llama-3.3-70b-versatile', maxlength: 100 },
  groqApiKey: { type: String, default: '' },
  emailAlertsEnabled: { type: Boolean, default: true },
  // Pop-up notifications shown by the browser (OS). Permission itself is per device.
  browserNotificationsEnabled: { type: Boolean, default: true },
  // Credit card bill reminder email: days before the due date, and an optional
  // second email on the due date itself while the bill is still unpaid.
  ccReminderDaysBefore: { type: Number, default: 1, min: 1, max: 10 },
  ccReminderOnDueDate: { type: Boolean, default: false },
  // Opt-in: when false (default), Gmail emails are processed only by local rules
  // and their content is never sent to an AI service.
  aiEmailProcessingEnabled: { type: Boolean, default: false },
  onboarding: {
    dashboardSeen: { type: Boolean, default: false },
    historySeen: { type: Boolean, default: false },
    investmentsSeen: { type: Boolean, default: false },
    cyclicSeen: { type: Boolean, default: false },
    aiSeen: { type: Boolean, default: false },
    settingsSeen: { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);