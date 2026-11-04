const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const UserPreferences = require('../models/UserPreferences');
const { maskKey, isMaskedKey } = require('../utils/security');
const { encryptSecret, revealSecret, isConfigured: isEncryptionConfigured } = require('../utils/tokenCrypto');

// Never send stored API keys back in full; the browser only needs to know one exists.
const toPublic = (prefs) => ({
  aiEnabled: prefs.aiEnabled,
  aiModel: prefs.aiModel,
  emailAlertsEnabled: prefs.emailAlertsEnabled,
  aiEmailProcessingEnabled: prefs.aiEmailProcessingEnabled === true,
  geminiApiKey: maskKey(revealSecret(prefs.geminiApiKey)),
  groqApiKey: maskKey(revealSecret(prefs.groqApiKey)),
});

// undefined = leave unchanged (masked value echoed back), otherwise a cleaned string.
const cleanKey = (key) => {
  if (key === undefined || key === null || isMaskedKey(key)) return undefined;
  if (typeof key !== 'string') return undefined;
  return key.trim().slice(0, 200);
};

router.use(auth);

// GET /api/settings - Fetch user preferences
router.get('/', async (req, res) => {
  try {
    let prefs = await UserPreferences.findOne({ userId: req.userId }).lean();
    
    // If none exist, return default values
    if (!prefs) {
      prefs = {
        aiEnabled: true,
        aiModel: 'gemini-2.5-flash',
        geminiApiKey: '',
        groqApiKey: '', // Added default
        emailAlertsEnabled: true,
        aiEmailProcessingEnabled: false,
      };
    }
    
    res.json(toPublic(prefs));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update user preferences
router.put('/', async (req, res) => {
  try {
    // Destructure the new groqApiKey
    const { aiEnabled, aiModel, geminiApiKey, groqApiKey, emailAlertsEnabled, aiEmailProcessingEnabled } = req.body;
    
    // Updated to include Groq models
    const allowedModels = [
      'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-pro-latest', 
      'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'
    ];
    const modelToSave = allowedModels.includes(aiModel) ? aiModel : 'gemini-2.5-flash';

    const update = {};
    // Partial updates: only fields present in the body change.
    if (aiEnabled !== undefined) update.aiEnabled = Boolean(aiEnabled);
    if (aiModel !== undefined) update.aiModel = modelToSave;
    if (emailAlertsEnabled !== undefined) update.emailAlertsEnabled = Boolean(emailAlertsEnabled);
    // Only an explicit boolean changes the email-AI opt-in; anything else leaves it as saved.
    if (typeof aiEmailProcessingEnabled === 'boolean') update.aiEmailProcessingEnabled = aiEmailProcessingEnabled;
    const gem = cleanKey(geminiApiKey);
    const groq = cleanKey(groqApiKey);
    // API keys are encrypted at rest; refuse to store them in plaintext.
    if ((gem || groq) && !isEncryptionConfigured()) {
      return res.status(503).json({ message: 'Saving API keys is not configured on the server.' });
    }
    if (gem !== undefined) update.geminiApiKey = encryptSecret(gem);
    if (groq !== undefined) update.groqApiKey = encryptSecret(groq);

    const prefs = await UserPreferences.findOneAndUpdate(
      { userId: req.userId },
      { $set: update },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );
    
    res.json(toPublic(prefs));
  } catch (err) {
    console.error('Failed to update settings:', err.message);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

module.exports = router;