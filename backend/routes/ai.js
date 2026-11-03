const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
// ADDED: We will need a new function in your aiService to handle Groq requests
const { chatWithGemini, chatWithGroq } = require('../services/aiService'); 
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const Subscription = require('../models/Subscription');
const CreditCard = require('../models/CreditCard');
const User = require('../models/User');
const Category = require('../models/Category');
const UserPreferences = require('../models/UserPreferences');

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

    // Check settings
    let prefs = await UserPreferences.findOne({ userId: req.userId }).lean();
    if (!prefs) {
      prefs = { 
        aiEnabled: true, 
        aiModel: 'gemini-2.5-flash', 
        geminiApiKey: '', 
        groqApiKey: '' // ADDED: Default fallback for Groq
      };
    }

    if (!prefs.aiEnabled) {
      return res.status(403).json({ message: 'AI Chatbot is disabled in settings.' });
    }

    const modelName = prefs.aiModel || 'gemini-2.5-flash';
    
    // ADDED: Logic to determine if the selected model belongs to Groq
    // Groq primarily hosts Llama, Mixtral, and Gemma models
    const isGroqModel = modelName.includes('llama') || modelName.includes('mixtral');

    // Strict: user must have the corresponding API key
    if (isGroqModel) {
      if (!prefs.groqApiKey || prefs.groqApiKey.trim().length === 0) {
        return res.status(403).json({ message: 'Please add your Groq API key in Settings to use Groq models.' });
      }
    } else {
      if (!prefs.geminiApiKey || prefs.geminiApiKey.trim().length === 0) {
        return res.status(403).json({ message: 'Please add your Gemini API key in Settings to use Gemini models.' });
      }
    }

    // Fetch user-specific data including categories
    const [user, categories, transactions, investments, subscriptions, creditCards] = await Promise.all([
      User.findById(req.userId).select('name email'),
      Category.find({ userId: req.userId }).lean(),
      Transaction.find({ userId: req.userId }).sort({ date: -1 }).limit(50).lean(),
      Investment.find({ userId: req.userId }).lean(),
      Subscription.find({ userId: req.userId }).lean(),
      CreditCard.find({ userId: req.userId }).lean(),
    ]);

    const userData = {
      userName: user?.name || 'User',
      categories,
      transactions,
      investments,
      subscriptions,
      creditCards,
    };

    // Pass the correct API key down to the service based on the model
    const options = {
      model: modelName,
      apiKey: isGroqModel ? prefs.groqApiKey : prefs.geminiApiKey,
    };

    // Route the request to the correct AI service
    let reply;
    if (isGroqModel) {
      reply = await chatWithGroq(message.trim(), userData, options);
    } else {
      reply = await chatWithGemini(message.trim(), userData, options);
    }
    
    res.json({ reply });
    
  } catch (err) {
    console.error('AI Chat Error:', err.message);
    if (err.message.includes('API key') || err.message.includes('GEMINI') || err.message.includes('GROQ')) {
      return res.status(503).json({ message: err.message });
    }
    res.status(500).json({ message: 'Failed to get AI response. Please try again.' });
  }
});

module.exports = router;