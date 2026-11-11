const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/authMiddleware');
const validateId = require('../middleware/validateId');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Investment = require('../models/Investment');
const Subscription = require('../models/Subscription');
const FinancialEmail = require('../models/FinancialEmail');

// Linked records must belong to the same user. categoryId may also be a
// built-in key (e.g. "trade"), which isn't an ObjectId and needs no check.
const checkReferences = async (userId, fields) => {
  const isId = (v) => v && mongoose.Types.ObjectId.isValid(String(v));
  const checks = [];
  if (isId(fields.categoryId)) checks.push(Category.exists({ _id: fields.categoryId, userId }));
  if (fields.investmentId) {
    if (!isId(fields.investmentId)) return false;
    checks.push(Investment.exists({ _id: fields.investmentId, userId }));
  }
  if (fields.subscriptionId) {
    if (!isId(fields.subscriptionId)) return false;
    checks.push(Subscription.exists({ _id: fields.subscriptionId, userId }));
  }
  const results = await Promise.all(checks);
  return results.every(Boolean);
};

router.use(auth);

// Whitelist allowed fields
const pickFields = (body) => {
  const allowed = ['type', 'amount', 'title', 'notes', 'categoryId', 'date', 'investmentId', 'subscriptionId'];
  const clean = {};
  for (const key of allowed) {
    if (body[key] !== undefined) clean[key] = body[key];
  }
  // Validate amount
  if (clean.amount !== undefined) {
    clean.amount = Number(clean.amount);
    if (isNaN(clean.amount) || clean.amount <= 0 || clean.amount > 999999999) {
      return null;
    }
  }
  // Truncate strings
  if (clean.title) clean.title = String(clean.title).slice(0, 200);
  if (clean.notes) clean.notes = String(clean.notes).slice(0, 500);
  return clean;
};

router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.userId }).sort({ date: -1 }).limit(1000);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = pickFields(req.body);
    if (!fields) return res.status(400).json({ message: 'Invalid amount' });
    if (!(await checkReferences(req.userId, fields))) return res.status(400).json({ message: 'Invalid linked record' });
    const transaction = new Transaction({ ...fields, userId: req.userId });
    const saved = await transaction.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create transaction' });
  }
});

router.put('/:id', validateId, async (req, res) => {
  try {
    const fields = pickFields(req.body);
    if (!fields) return res.status(400).json({ message: 'Invalid amount' });
    const existing = await Transaction.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!existing) return res.status(404).json({ message: 'Transaction not found' });
    // Only check links that change, so editing an old transaction whose category
    // was later deleted still works.
    const changed = {};
    for (const k of ['categoryId', 'investmentId', 'subscriptionId']) {
      if (fields[k] !== undefined && String(fields[k] ?? '') !== String(existing[k] ?? '')) changed[k] = fields[k];
    }
    if (!(await checkReferences(req.userId, changed))) return res.status(400).json({ message: 'Invalid linked record' });
    const updated = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      fields,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Transaction not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update transaction' });
  }
});

router.delete('/:id', validateId, async (req, res) => {
  try {
    const deleted = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: 'Transaction not found' });
    // An expense added from a Gmail suggestion: offer that suggestion again.
    await FinancialEmail.updateMany(
      { userId: req.userId, transactionId: deleted._id, suggestionState: 'used' },
      { $set: { suggestionState: null, transactionId: null } },
    );
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete transaction' });
  }
});
module.exports = router;
