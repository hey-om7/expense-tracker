const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/authMiddleware');
const validateId = require('../middleware/validateId');

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
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete transaction' });
  }
});
module.exports = router;
