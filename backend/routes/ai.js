const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { chatWithGroq, parseSpokenTransaction, resolveModel } = require('../services/aiService');
const { normalizeSpokenAmounts } = require('../services/spokenAmount');
const { planAndSearch, MAX_PROMPT_RECORDS } = require('../services/aiQuery');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const Subscription = require('../models/Subscription');
const CreditCard = require('../models/CreditCard');
const User = require('../models/User');
const Category = require('../models/Category');
const UserPreferences = require('../models/UserPreferences');
const { revealSecret, contexts } = require('../utils/tokenCrypto');
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
    if (!prefs) prefs = { aiEnabled: true, groqApiKey: '' };
    const groqApiKey = revealSecret(prefs.groqApiKey, contexts.groqKey(req.userId));

    if (!prefs.aiEnabled) {
      return res.status(403).json({ message: 'AI Chatbot is disabled in settings.' });
    }

    const modelName = resolveModel(prefs.aiModel);

    if (!groqApiKey || groqApiKey.trim().length === 0) {
      return res.status(403).json({ message: 'Please add your Groq API key in Settings to use AI.' });
    }

    const question = message.trim();
    const [user, categories] = await Promise.all([
      User.findById(req.userId).select('name').lean(),
      Category.find({ userId: req.userId }).select('_id name type').lean(),
    ]);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Step 1: let the AI turn the question into a filter, then search the DB.
    const search = await planAndSearch({
      question, userId: req.userId, categories, today, apiKey: groqApiKey, model: modelName,
    });
    const scopes = search?.plan.scopes || ['transactions', 'investments', 'subscriptions', 'credit_cards'];
    const needs = (s) => scopes.includes(s);

    // Step 2: load only the other data the question needs.
    const [transactions, investments, subscriptions, creditCards] = await Promise.all([
      search?.transactions ? null : needs('transactions')
        ? Transaction.find({ userId: req.userId }).sort({ date: -1 }).limit(50)
          .select('-_id type amount title notes categoryId date').lean() : [],
      // Only the fields the prompt uses, so nothing internal can reach the AI.
      needs('investments') ? Investment.find({ userId: req.userId })
        .select('-_id name symbol currentPrice type holdings.type holdings.quantity holdings.price holdings.date').lean() : [],
      needs('subscriptions') ? Subscription.find({ userId: req.userId })
        .select('-_id name amount period isActive startDate expiryDate').lean() : [],
      needs('credit_cards') ? CreditCard.find({ userId: req.userId })
        .select('-_id name last4Digits billDueDate totalLimit').lean() : [],
    ]);

    const userData = {
      userName: user?.name || 'User',
      categories,
      transactions: transactions || [],
      investments,
      subscriptions,
      creditCards,
      search: search ? { ...search, promptLimit: MAX_PROMPT_RECORDS } : null,
    };

    let reply = await chatWithGroq(question, userData, { model: modelName, apiKey: groqApiKey });
    // Last line of defence: never return text that echoes the system prompt.
    if (/<\/?financial_data|SECURITY RULES|SCOPE \(these override|You are Vestor AI/i.test(reply)) {
      reply = 'I can only help with questions about your own financial data in Vestor.';
    }

    // Send the matched records so the chat can list them under the answer.
    let records;
    if (search?.transactions) {
      const catNames = new Map(categories.map(c => [String(c._id), c.name]));
      records = {
        count: search.count,
        totals: search.totals,
        filter: {
          dateFrom: search.plan.dateFrom,
          dateTo: search.plan.dateTo,
          keywords: search.plan.keywords,
          categories: search.plan.categoryIds.map(id => catNames.get(id)).filter(Boolean),
        },
        items: search.transactions.map(t => ({
          id: String(t._id),
          date: t.date,
          type: t.type,
          amount: t.amount,
          title: t.title,
          category: catNames.get(t.categoryId) || '',
        })),
      };
    }
    res.json({ reply, records });
    
  } catch (err) {
    console.error('AI Chat Error:', err.message);
    if (err.status === 401 || /api key|GROQ/i.test(err.message || '')) {
      return res.status(503).json({ message: 'The AI provider rejected the request. Check your API key in Settings.' });
    }
    if (err.status === 404 || /model_not_found|decommissioned/i.test(err.message || '')) {
      return res.status(503).json({ message: 'The selected AI model is no longer available. Pick another model in Settings.' });
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
    // Optional extra guesses from the browser's speech recognizer.
    const alternatives = (Array.isArray(req.body?.alternatives) ? req.body.alternatives : [])
      .filter(a => typeof a === 'string')
      .map(a => a.trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, 5);

    const prefs = (await UserPreferences.findOne({ userId: req.userId }).lean()) || { aiEnabled: true };
    if (prefs.aiEnabled === false) return res.status(403).json({ message: 'AI is disabled in Settings.' });
    const modelName = resolveModel(prefs.aiModel);
    const apiKey = revealSecret(prefs.groqApiKey, contexts.groqKey(req.userId));
    if (!apiKey || !apiKey.trim()) {
      return res.status(403).json({ message: 'Please add your Groq API key in Settings to use voice add.' });
    }

    const categories = await Category.find({ userId: req.userId }).select('_id name type').lean();
    const tz = 'Asia/Kolkata';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD

    const ai = await parseSpokenTransaction(normalizeSpokenAmounts(transcript), {
      categories,
      today,
      // Keep the raw wording as a fallback reading in case the join was wrong.
      alternatives: [...new Set([...alternatives.map(normalizeSpokenAmounts), transcript])],
      model: modelName,
      apiKey,
    });

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
    if (err.status === 401 || /api key|GROQ|401|403/i.test(err.message || '')) {
      return res.status(503).json({ message: 'The AI provider rejected the request. Check your API key in Settings.' });
    }
    res.status(500).json({ message: "Couldn't understand that. Please try again." });
  }
});

module.exports = router;