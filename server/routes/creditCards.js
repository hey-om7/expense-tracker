const express = require('express');
const router = express.Router();
const CreditCard = require('../models/CreditCard');
const auth = require('../middleware/authMiddleware');
const validateId = require('../middleware/validateId');

router.use(auth);

const pickFields = (body) => {
  const clean = {};
  if (body.name !== undefined) clean.name = String(body.name).slice(0, 100);
  if (body.last4Digits !== undefined) clean.last4Digits = String(body.last4Digits).replace(/\D/g, '').slice(0, 4);
  if (body.billDueDate !== undefined) clean.billDueDate = body.billDueDate;
  if (body.totalLimit !== undefined) {
    clean.totalLimit = Number(body.totalLimit);
    if (isNaN(clean.totalLimit) || clean.totalLimit < 0) clean.totalLimit = 0;
  }
  if (body.notes !== undefined) clean.notes = String(body.notes).slice(0, 500);
  return clean;
};

router.get('/', async (req, res) => {
  try {
    const cards = await CreditCard.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(cards);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch credit cards' });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = pickFields(req.body);
    const card = new CreditCard({ ...fields, userId: req.userId });
    const saved = await card.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create credit card' });
  }
});

router.put('/:id', validateId, async (req, res) => {
  try {
    const fields = pickFields(req.body);
    const updated = await CreditCard.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      fields,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Credit card not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update credit card' });
  }
});

router.delete('/:id', validateId, async (req, res) => {
  try {
    const deleted = await CreditCard.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: 'Credit card not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete credit card' });
  }
});

module.exports = router;
