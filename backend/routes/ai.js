const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
// ADDED: We will need a new function in your aiService to handle Groq requests
const { chatWithGemini, chatWithGroq, parseSpokenTransaction } = require('../services/aiService'); 
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const Subscription = require('../models/Subscription');
const CreditCard = require('../models/CreditCard');
const User = require('../models/User');
const Category = require('../models/Category');
const UserPreferences = require('../models/UserPreferences');
const { revealSecret } = require('../utils/tokenCrypto');
const { userLimiter } = require('../utils/rateLimits');

router.use(auth);
// Per-account cap: each chat call sends the user's data to a paid AI API.
router.use(userLimiter('ai-chat', { windowMs: 10 * 60 * 1000, limit: 20, message: 'Too many AI requests. Please wait a few minutes.' }));

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
    prefs.geminiApiKey = revealSecret(prefs.geminiApiKey);
    prefs.groqApiKey = revealSecret(prefs.groqApiKey);

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
    if (/api key|GEMINI|GROQ/i.test(err.message || '')) {
      return res.status(503).json({ message: 'The AI provider rejected the request. Check your API key in Settings.' });
    }
    res.status(500).json({ message: 'Failed to get AI response. Please try again.' });
  }
});

// POST /api/ai/parse-transaction  { transcript }
// Voice quick-add: returns prefill values for the Add Transaction form. Nothing is saved here.
router.post('/parse-transaction', async (req, res) => {
  try {
    const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript.trim() : '';
    if (!transcript) return res.status(400).json({ message: 'Say something like "Spent 250 on lunch"' });
    if (transcript.length > 500) return res.status(400).json({ message: 'That was too long. Try one expense at a time.' });

    const prefs = (await UserPreferences.findOne({ userId: req.userId }).lean()) || { aiEnabled: true, aiModel: 'gemini-2.5-flash' };
    if (prefs.aiEnabled === false) return res.status(403).json({ message: 'AI is disabled in Settings.' });
    const modelName = prefs.aiModel || 'gemini-2.5-flash';
    const isGroq = modelName.includes('llama') || modelName.includes('mixtral');
    const apiKey = revealSecret(isGroq ? prefs.groqApiKey : prefs.geminiApiKey);
    if (!apiKey || !apiKey.trim()) {
      return res.status(403).json({ message: `Please add your ${isGroq ? 'Groq' : 'Gemini'} API key in Settings to use voice add.` });
    }

    const categories = await Category.find({ userId: req.userId }).select('_id name type').lean();
    const tz = 'Asia/Kolkata';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD

    const ai = await parseSpokenTransaction(transcript, { categories, today, isGroq, model: modelName, apiKey });

    // Never trust the model's output: coerce every field.
    const type = ai?.type === 'income' ? 'income' : 'expense';
    const amount = Number(ai?.amount);
    const cat = categories.find(c => String(c._id) === String(ai?.categoryId) && c.type === type);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(ai?.date || '') && !Number.isNaN(Date.parse(ai.date)) ? ai.date : today;
    const str = (v, max) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

    res.json({
      transcript,
      type,
      amount: Number.isFinite(amount) && amount > 0 && amount <= 999999999 ? Math.round(amount * 100) / 100 : null,
      categoryId: cat ? String(cat._id) : '',
      title: str(ai?.title, 200),
      notes: str(ai?.notes, 500),
      date,
    });
  } catch (err) {
    console.error('AI parse-transaction error:', err.message);
    if (/api key|GEMINI|GROQ|401|403/i.test(err.message || '')) {
      return res.status(503).json({ message: 'The AI provider rejected the request. Check your API key in Settings.' });
    }
    res.status(500).json({ message: "Couldn't understand that. Please try again." });
  }
});

module.exports = router;