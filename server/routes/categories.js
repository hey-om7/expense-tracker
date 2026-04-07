const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const auth = require('../middleware/authMiddleware');
const validateId = require('../middleware/validateId');

router.use(auth);

const pickFields = (body) => {
  const clean = {};
  if (body.name !== undefined) clean.name = String(body.name).slice(0, 50);
  if (body.type !== undefined) clean.type = body.type;
  if (body.color !== undefined) clean.color = String(body.color).slice(0, 20);
  if (body.icon !== undefined) clean.icon = String(body.icon).slice(0, 50);
  return clean;
};

router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ userId: req.userId });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = pickFields(req.body);
    const category = new Category({ ...fields, userId: req.userId });
    const saved = await category.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create category' });
  }
});

router.put('/:id', validateId, async (req, res) => {
  try {
    const fields = pickFields(req.body);
    const updated = await Category.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      fields,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Category not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update category' });
  }
});

router.delete('/:id', validateId, async (req, res) => {
  try {
    const deleted = await Category.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

module.exports = router;
