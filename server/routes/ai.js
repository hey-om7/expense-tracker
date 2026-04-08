const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { chatWithGemini } = require('../services/aiService');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const Subscription = require('../models/Subscription');
const CreditCard = require('../models/CreditCard');
const User = require('../models/User');

router.use(auth);

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ message: 'Message too long (max 2000 characters)' });
    }

    // Fetch user-specific data
    const [user, transactions, investments, subscriptions, creditCards] = await Promise.all([
      User.findById(req.userId).select('name email'),
      Transaction.find({ userId: req.userId }).sort({ date: -1 }).limit(50).lean(),
      Investment.find({ userId: req.userId }).lean(),
      Subscription.find({ userId: req.userId }).lean(),
      CreditCard.find({ userId: req.userId }).lean(),
    ]);

    const userData = {
      userName: user?.name || 'User',
      transactions,
      investments,
      subscriptions,
      creditCards,
    };

    const reply = await chatWithGemini(message.trim(), userData);
    res.json({ reply });
  } catch (err) {
    console.error('AI Chat Error:', err.message);
    if (err.message.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ message: err.message });
    }
    res.status(500).json({ message: 'Failed to get AI response. Please try again.' });
  }
});

module.exports = router;
