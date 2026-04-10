const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const UserPreferences = require('../models/UserPreferences');

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
      };
    }
    
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update user preferences
router.put('/', async (req, res) => {
  try {
    // Destructure the new groqApiKey
    const { aiEnabled, aiModel, geminiApiKey, groqApiKey, emailAlertsEnabled } = req.body;
    
    // Updated to include Groq models
    const allowedModels = [
      'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-pro-latest', 
      'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'
    ];
    const modelToSave = allowedModels.includes(aiModel) ? aiModel : 'gemini-2.5-flash';

    const prefs = await UserPreferences.findOneAndUpdate(
      { userId: req.userId },
      { 
        $set: {
          aiEnabled: Boolean(aiEnabled),
          aiModel: modelToSave,
          geminiApiKey: geminiApiKey || '',
          groqApiKey: groqApiKey || '', // Save the Groq Key
          emailAlertsEnabled: Boolean(emailAlertsEnabled)
        }
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );
    
    res.json(prefs);
  } catch (err) {
    console.error('Failed to update settings:', err);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

module.exports = router;