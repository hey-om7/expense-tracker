const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const auth = require('../middleware/authMiddleware');
const validateId = require('../middleware/validateId');

router.use(auth);

const pickFields = (body, isCreate = false) => {
  const clean = {};
  if (body.name !== undefined) clean.name = String(body.name).slice(0, 100);
  if (body.amount !== undefined) {
    clean.amount = Number(body.amount);
    if (isNaN(clean.amount) || clean.amount <= 0 || clean.amount > 999999999) return null;
  }
  if (body.categoryId !== undefined) clean.categoryId = String(body.categoryId).slice(0, 50);
  if (body.period !== undefined) clean.period = body.period;
  if (body.isActive !== undefined) clean.isActive = Boolean(body.isActive);
  if (body.lastExecutedDate !== undefined) clean.lastExecutedDate = body.lastExecutedDate;
  // Only allow dates on create
  if (isCreate) {
    if (body.startDate !== undefined) clean.startDate = body.startDate;
    if (body.endDate !== undefined) clean.endDate = body.endDate;
  }
  return clean;
};

router.get('/', async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(subscriptions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch subscriptions' });
  }
});

router.post('/', async (req, res) => {
  try {
    const fields = pickFields(req.body, true);
    if (!fields) return res.status(400).json({ message: 'Invalid amount' });
    const subscription = new Subscription({ ...fields, userId: req.userId });
    const saved = await subscription.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create subscription' });
  }
});

router.put('/:id', validateId, async (req, res) => {
  try {
    const fields = pickFields(req.body, false);
    if (!fields) return res.status(400).json({ message: 'Invalid amount' });
    const updated = await Subscription.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      fields,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Subscription not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: 'Failed to update subscription' });
  }
});

router.delete('/:id', validateId, async (req, res) => {
  try {
    const deleted = await Subscription.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: 'Subscription not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete subscription' });
  }
});

// POST /run-check — cap at 50 cycles per sub to prevent abuse
router.post('/run-check', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeSubs = await Subscription.find({ userId: req.userId, isActive: true });
    const processed = [];

    for (const sub of activeSubs) {
      if (!sub.startDate) continue;

      const start = new Date(sub.startDate);
      start.setHours(0, 0, 0, 0);

      const endLimit = sub.endDate ? new Date(sub.endDate) : null;
      if (endLimit) endLimit.setHours(0, 0, 0, 0);
      const limitDate = endLimit && endLimit < today ? endLimit : today;

      let nextCycle = new Date(start);
      if (sub.lastExecutedDate) {
        const lastExec = new Date(sub.lastExecutedDate);
        lastExec.setHours(0, 0, 0, 0);
        nextCycle = new Date(lastExec);
        if (sub.period === 'weekly') nextCycle.setDate(nextCycle.getDate() + 7);
        else if (sub.period === 'yearly') nextCycle.setFullYear(nextCycle.getFullYear() + 1);
        else nextCycle.setMonth(nextCycle.getMonth() + 1);
      }

      let count = 0;
      let lastExecString = sub.lastExecutedDate;
      const MAX_CYCLES = 50;

      while (nextCycle <= limitDate && count < MAX_CYCLES) {
        const txDate = new Date(nextCycle);
        txDate.setHours(12, 0, 0, 0);

        const tx = new Transaction({
          userId: req.userId,
          type: 'expense',
          categoryId: String(sub.categoryId || '').slice(0, 50),
          amount: sub.amount,
          title: String(`Subscription Payment - ${sub.name}`).slice(0, 200),
          date: txDate,
          notes: 'Automated cyclic payment',
        });
        await tx.save();

        lastExecString = nextCycle.toISOString().split('T')[0];
        count++;

        if (sub.period === 'weekly') nextCycle.setDate(nextCycle.getDate() + 7);
        else if (sub.period === 'yearly') nextCycle.setFullYear(nextCycle.getFullYear() + 1);
        else nextCycle.setMonth(nextCycle.getMonth() + 1);
      }

      if (count > 0) {
        sub.lastExecutedDate = lastExecString;
        await sub.save();
        processed.push(sub.name);
      }
    }

    if (processed.length > 0) {
      const notification = new Notification({
        userId: req.userId,
        title: 'Cyclic Protocol Engaged',
        message: String(`Processed ${processed.length} subscription renewal(s): ${processed.join(', ')}`).slice(0, 500),
        isRead: false,
        date: new Date(),
      });
      await notification.save();
    }

    res.json({ processed: processed.length, names: processed });
  } catch (err) {
    res.status(500).json({ message: 'Failed to run subscription check' });
  }
});

module.exports = router;
