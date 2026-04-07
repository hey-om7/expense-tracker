const express = require('express');
const router = express.Router();
const Investment = require('../models/Investment');
const auth = require('../middleware/authMiddleware');
const validateId = require('../middleware/validateId');

router.use(auth);

const pickFields = (body) => {
  const clean = {};
  if (body.name !== undefined) clean.name = String(body.name).slice(0, 200);
  if (body.symbol !== undefined) clean.symbol = String(body.symbol).slice(0, 50);
  if (body.type !== undefined) clean.type = String(body.type).slice(0, 30);
  if (body.comments !== undefined) clean.comments = String(body.comments).slice(0, 500);
  if (body.currentPrice !== undefined) {
    clean.currentPrice = Number(body.currentPrice);
    if (isNaN(clean.currentPrice) || clean.currentPrice < 0) clean.currentPrice = 0;
  }
  return clean;
};

router.get('/', async (req, res) => {
  try {
    const investments = await Investment.find({ userId: req.userId });
    res.json(investments);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch investments' });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = pickFields(req.body);
    const investment = new Investment({ ...fields, userId: req.userId });
    const saved = await investment.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create investment' });
  }
});

router.put('/:id', validateId, async (req, res) => {
  try {
    const fields = pickFields(req.body);
    const updated = await Investment.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      fields,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Investment not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update investment' });
  }
});

router.delete('/:id', validateId, async (req, res) => {
  try {
    const deleted = await Investment.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: 'Investment not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete investment' });
  }
});

module.exports = router;
