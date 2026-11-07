const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const UserPreferences = require('../models/UserPreferences');
const { maskKey, isMaskedKey } = require('../utils/security');
const { encryptSecret, revealSecret, contexts, isConfigured: isEncryptionConfigured } = require('../utils/tokenCrypto');
const { listGroqModels, isValidModelId, resolveModel } = require('../services/aiService');
const { userLimiter } = require('../utils/rateLimits');

// Never send stored API keys back in full; the browser only needs to know one exists.
const toPublic = (prefs) => ({
  aiEnabled: prefs.aiEnabled,
  aiModel: resolveModel(prefs.aiModel),
  emailAlertsEnabled: prefs.emailAlertsEnabled,
  aiEmailProcessingEnabled: prefs.aiEmailProcessingEnabled === true,
  groqApiKey: maskKey(revealSecret(prefs.groqApiKey, contexts.groqKey(prefs.userId))),
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
        userId: req.userId,
        aiEnabled: true,
        groqApiKey: '',
        emailAlertsEnabled: true,
        aiEmailProcessingEnabled: false,
      };
    }
    
    res.json(toPublic(prefs));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

// POST /api/settings/groq/models  { apiKey? }
// Tests a Groq key and returns its active chat models. Uses the key in the body
// when a new one is given, otherwise the saved key. Nothing is saved here.
router.post(
  '/groq/models',
  userLimiter('groq-models', { windowMs: 10 * 60 * 1000, limit: 30, message: 'Too many key checks. Please wait a few minutes.' }),
  async (req, res) => {
    try {
      let apiKey = cleanKey(req.body?.apiKey);
      if (!apiKey) {
        const prefs = await UserPreferences.findOne({ userId: req.userId }).select('groqApiKey').lean();
        apiKey = revealSecret(prefs?.groqApiKey, contexts.groqKey(req.userId));
      }
      if (!apiKey) return res.status(400).json({ message: 'Enter a Groq API key first.' });

      const models = await listGroqModels(apiKey);
      res.json({ ok: true, models });
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        return res.status(400).json({ message: 'Groq rejected this API key. Check that it is correct and active.' });
      }
      console.error('Groq models check failed:', err.message);
      res.status(502).json({ message: 'Could not reach Groq. Please try again.' });
    }
  }
);

// PUT /api/settings - Update user preferences
router.put('/', async (req, res) => {
  try {
    const { aiEnabled, aiModel, groqApiKey, emailAlertsEnabled, aiEmailProcessingEnabled } = req.body;

    if (aiModel !== undefined && !isValidModelId(aiModel)) {
      return res.status(400).json({ message: 'Invalid AI model.' });
    }

    const update = {};
    // Partial updates: only fields present in the body change.
    if (aiEnabled !== undefined) update.aiEnabled = Boolean(aiEnabled);
    if (aiModel !== undefined) update.aiModel = aiModel;
    if (emailAlertsEnabled !== undefined) update.emailAlertsEnabled = Boolean(emailAlertsEnabled);
    // Only an explicit boolean changes the email-AI opt-in; anything else leaves it as saved.
    if (typeof aiEmailProcessingEnabled === 'boolean') update.aiEmailProcessingEnabled = aiEmailProcessingEnabled;
    const groq = cleanKey(groqApiKey);
    // API keys are encrypted at rest; refuse to store them in plaintext.
    if (groq && !isEncryptionConfigured()) {
      return res.status(503).json({ message: 'Saving API keys is not configured on the server.' });
    }
    if (groq !== undefined) update.groqApiKey = encryptSecret(groq, contexts.groqKey(req.userId));

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
