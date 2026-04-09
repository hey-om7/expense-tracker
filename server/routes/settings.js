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
        aiModel: 'gemini-1.5-flash',
        geminiApiKey: '',
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
    const { aiEnabled, aiModel, geminiApiKey, emailAlertsEnabled } = req.body;
    
    const allowedModels = ['gemini-1.5-flash', 'gemini-1.5-pro'];
    const modelToSave = allowedModels.includes(aiModel) ? aiModel : 'gemini-1.5-flash';

    const prefs = await UserPreferences.findOneAndUpdate(
      { userId: req.userId },
      { 
        $set: {
          aiEnabled: Boolean(aiEnabled),
          aiModel: modelToSave,
          geminiApiKey: geminiApiKey || '',
          emailAlertsEnabled: Boolean(emailAlertsEnabled)
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    
    res.json(prefs);
  } catch (err) {
    console.error('Failed to update settings:', err);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

module.exports = router;
