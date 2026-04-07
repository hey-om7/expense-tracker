const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/authMiddleware');
const validateId = require('../middleware/validateId');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId }).sort({ date: -1 }).limit(100);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

router.post('/', async (req, res) => {
  try {
    const clean = {
      title: String(req.body.title || '').slice(0, 200),
      message: String(req.body.message || '').slice(0, 500),
      isRead: false,
      date: new Date(),
      userId: req.userId,
    };
    const notification = new Notification(clean);
    const saved = await notification.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create notification' });
  }
});

router.put('/:id/read', validateId, async (req, res) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { isRead: true },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Notification not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update notification' });
  }
});

router.put('/mark-all-read', async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.userId }, { isRead: true });
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark notifications' });
  }
});

router.delete('/', async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.userId });
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to clear notifications' });
  }
});

module.exports = router;
