const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

router.get('/', async (req, res) => {
  try {
    const subscriptions = await Subscription.find().sort({ createdAt: -1 });
    res.json(subscriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const subscription = new Subscription(req.body);
    const saved = await subscription.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Subscription.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Subscription not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Subscription.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Subscription not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /run-check — executed on app load by the frontend
router.post('/run-check', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const activeSubs = await Subscription.find({ isActive: true });
    const processed = [];

    for (const sub of activeSubs) {
      const renewalDate = new Date(sub.renewalDate);
      renewalDate.setHours(0, 0, 0, 0);

      const isDue = today >= renewalDate;
      const notExecutedToday = sub.lastExecutedDate !== todayStr;

      if (isDue && notExecutedToday) {
        // Create automated expense transaction
        const tx = new Transaction({
          type: 'expense',
          categoryId: sub.categoryId || '',
          amount: sub.amount,
          title: `Subscription Payment - ${sub.name}`,
          date: new Date(),
          notes: 'Automated cyclic payment',
        });
        await tx.save();

        // Advance renewal date
        const nextRenewal = new Date(renewalDate);
        if (sub.period === 'yearly') {
          nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
        } else {
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        }

        sub.lastExecutedDate = todayStr;
        sub.renewalDate = nextRenewal;
        await sub.save();

        processed.push(sub.name);
      }
    }

    if (processed.length > 0) {
      const notification = new Notification({
        title: 'Cyclic Protocol Engaged',
        message: `Processed ${processed.length} automated subscription renewal(s): ${processed.join(', ')}`,
        isRead: false,
        date: new Date(),
      });
      await notification.save();
    }

    res.json({ processed: processed.length, names: processed });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
