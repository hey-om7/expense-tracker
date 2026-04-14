const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const UserPreferences = require('../models/UserPreferences');

router.use(auth);

const DEFAULT_ONBOARDING = {
  dashboardSeen: false,
  historySeen: false,
  investmentsSeen: false,
  cyclicSeen: false,
  aiSeen: false,
  settingsSeen: false,
};

// GET /api/onboarding - Fetch onboarding state
router.get('/', async (req, res) => {
  try {
    const prefs = await UserPreferences.findOne({ userId: req.userId }).lean();
    res.json(prefs?.onboarding || DEFAULT_ONBOARDING);
  } catch (err) {
    console.error('Failed to fetch onboarding:', err);
    res.status(500).json({ message: 'Failed to fetch onboarding state' });
  }
});

// PUT /api/onboarding - Update specific onboarding flags
router.put('/', async (req, res) => {
  try {
    const allowedKeys = ['dashboardSeen', 'historySeen', 'investmentsSeen', 'cyclicSeen', 'aiSeen', 'settingsSeen'];
    const updates = {};
    
    for (const key of allowedKeys) {
      if (typeof req.body[key] === 'boolean') {
        updates[`onboarding.${key}`] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid onboarding flags provided' });
    }

    const prefs = await UserPreferences.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    res.json(prefs.onboarding || DEFAULT_ONBOARDING);
  } catch (err) {
    console.error('Failed to update onboarding:', err);
    res.status(500).json({ message: 'Failed to update onboarding state' });
  }
});

// POST /api/onboarding/reset - Reset all onboarding flags
router.post('/reset', async (req, res) => {
  try {
    const prefs = await UserPreferences.findOneAndUpdate(
      { userId: req.userId },
      { $set: { onboarding: { ...DEFAULT_ONBOARDING } } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    res.json(prefs.onboarding || DEFAULT_ONBOARDING);
  } catch (err) {
    console.error('Failed to reset onboarding:', err);
    res.status(500).json({ message: 'Failed to reset onboarding state' });
  }
});

module.exports = router;
