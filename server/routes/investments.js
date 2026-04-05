const express = require('express');
const router = express.Router();
const Investment = require('../models/Investment');

router.get('/', async (req, res) => {
  try {
    const investments = await Investment.find();
    res.json(investments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const investment = new Investment(req.body);
    const saved = await investment.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Investment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Investment not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Investment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Investment not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
