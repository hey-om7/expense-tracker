const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const auth = require('../middleware/authMiddleware');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(subscriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const subscription = new Subscription({ ...req.body, userId: req.userId });
    const saved = await subscription.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { startDate, endDate, ...safeUpdates } = req.body;
    const updated = await Subscription.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      safeUpdates,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Subscription not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Subscription.findOneAndDelete({ _id: req.params.id, userId: req.userId });
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

    const activeSubs = await Subscription.find({ userId: req.userId, isActive: true });
    const processed = [];

    for (const sub of activeSubs) {
      const baseDateStr = sub.startDate;
      if (!baseDateStr) continue;

      const start = new Date(baseDateStr);
      start.setHours(0, 0, 0, 0);

      const endLimit = sub.endDate ? new Date(sub.endDate) : null;
      if (endLimit) endLimit.setHours(0, 0, 0, 0);

      const limitDate = endLimit && endLimit < today ? endLimit : today;

      let nextCycle = new Date(start);
      // If there's a lastExecutedDate, the next cycle is one period after it
      if (sub.lastExecutedDate) {
        const lastExec = new Date(sub.lastExecutedDate);
        lastExec.setHours(0, 0, 0, 0);
        nextCycle = new Date(lastExec);
        if (sub.period === 'weekly') {
          nextCycle.setDate(nextCycle.getDate() + 7);
        } else if (sub.period === 'yearly') {
          nextCycle.setFullYear(nextCycle.getFullYear() + 1);
        } else {
          nextCycle.setMonth(nextCycle.getMonth() + 1);
        }
      }

      let subProcessedCount = 0;
      let lastExecString = sub.lastExecutedDate;

      // Loop to generate all missing cycles up to the limit limitDate
      while (nextCycle <= limitDate) {
        // Create transaction at noon to avoid timezone midnight shift issues
        const txDate = new Date(nextCycle);
        txDate.setHours(12, 0, 0, 0);

        const tx = new Transaction({
          userId: req.userId,
          type: 'expense',
          categoryId: sub.categoryId || '',
          amount: sub.amount,
          title: `Subscription Payment - ${sub.name}`,
          date: txDate,
          notes: 'Automated cyclic payment',
        });
        await tx.save();

        lastExecString = nextCycle.toISOString().split('T')[0];
        subProcessedCount++;

        // Advance nextCycle correctly based on period
        if (sub.period === 'weekly') {
          nextCycle.setDate(nextCycle.getDate() + 7);
        } else if (sub.period === 'yearly') {
          nextCycle.setFullYear(nextCycle.getFullYear() + 1);
        } else {
          nextCycle.setMonth(nextCycle.getMonth() + 1);
        }
      }

      if (subProcessedCount > 0) {
        sub.lastExecutedDate = lastExecString;
        await sub.save();
        processed.push(sub.name);
      }
    }

    if (processed.length > 0) {
      const notification = new Notification({
        userId: req.userId,
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
