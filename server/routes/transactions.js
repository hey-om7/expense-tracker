const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/authMiddleware');

// All routes require authentication
router.use(auth);

// GET all transactions (sorted newest first)
router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.userId }).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create transaction
router.post('/', async (req, res) => {
  try {
    const transaction = new Transaction({ ...req.body, userId: req.userId });
    const saved = await transaction.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT update transaction
router.put('/:id', async (req, res) => {
  try {
    const updated = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Transaction not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE transaction
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE all transactions for a given investmentId
router.delete('/investment/:investmentId', async (req, res) => {
  try {
    await Transaction.deleteMany({ investmentId: req.params.investmentId, userId: req.userId });
    res.json({ message: 'Deleted all trades for investment' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
