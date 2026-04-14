const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  aiEnabled: { type: Boolean, default: true },
  aiModel: { 
    type: String, 
    default: 'gemini-2.5-flash', 
    enum: [
      'gemini-2.5-flash', 
      'gemini-2.5-pro', 
      'gemini-pro-latest', 
      'llama-3.1-8b-instant',      // UPDATED
      'llama-3.3-70b-versatile',   // UPDATED
      'mixtral-8x7b-32768'         // Still active
    ] 
  },
  geminiApiKey: { type: String, default: '' },
  groqApiKey: { type: String, default: '' }, // ADDED GROQ API KEY
  emailAlertsEnabled: { type: Boolean, default: true },
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