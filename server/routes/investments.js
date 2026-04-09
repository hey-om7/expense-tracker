const express = require('express');
const router = express.Router();
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
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
    const investments = await Investment.find({ userId: req.userId }).lean();
    
    // Compute derived metrics for response
    const computedInvestments = investments.map(inv => {
      let totalQuantity = 0;
      let totalCostBase = 0;
      let realizedProfit = 0;

      const holdings = inv.holdings || [];
      const sortedHoldings = [...holdings].sort((a, b) => new Date(a.date) - new Date(b.date));

      sortedHoldings.forEach(holding => {
        if (holding.type === 'BUY') {
          const tempCost = totalQuantity * (totalQuantity > 0 ? totalCostBase / totalQuantity : 0);
          const purchaseCost = holding.quantity * holding.price;
          totalQuantity += holding.quantity;
          totalCostBase = totalQuantity > 0 ? tempCost + purchaseCost : 0;
        } else if (holding.type === 'SELL') {
          const currentAvgCost = totalQuantity > 0 ? totalCostBase / totalQuantity : 0;
          realizedProfit += (holding.price - currentAvgCost) * holding.quantity;
          totalQuantity -= holding.quantity;
          totalCostBase = totalQuantity * currentAvgCost;
        }
      });

      const avgBuyPrice = totalQuantity > 0 ? totalCostBase / totalQuantity : 0;

      return {
        ...inv,
        id: inv._id,
        totalQuantity,
        avgBuyPrice,
        realizedProfit
      };
    });

    res.json(computedInvestments);
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
    // Don't delete transactions, just the investment (per new schema rules, tx are independent)
    const deleted = await Investment.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: 'Investment not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete investment' });
  }
});

// ─── Trade Holding APIs ───

router.post('/:id/trade', validateId, async (req, res) => {
  try {
    const { type, quantity, price, date } = req.body;
    
    if (!['BUY', 'SELL'].includes(type) || !quantity || quantity <= 0 || price < 0) {
      return res.status(400).json({ message: 'Invalid trade parameters' });
    }

    const investment = await Investment.findOne({ _id: req.params.id, userId: req.userId });
    if (!investment) return res.status(404).json({ message: 'Investment not found' });

    const tradeDate = date ? new Date(date) : new Date();

    // 1. Create the parallel transaction for history
    const tx = new Transaction({
      userId: req.userId,
      type: type === 'BUY' ? 'buy_investment' : 'sell_investment',
      amount: quantity * price,
      title: `${type === 'BUY' ? 'Bought' : 'Sold'} ${quantity} units of ${investment.name}`,
      categoryId: 'trade',
      date: tradeDate,
      investmentId: investment._id.toString()
    });
    const savedTx = await tx.save();

    // 2. Add holding to investment
    investment.holdings.push({
      quantity,
      price,
      date: tradeDate,
      type,
      transactionId: savedTx._id
    });
    
    await investment.save();
    res.status(201).json(investment); // Return updated investment (client will refetch or compute)
  } catch (err) {
    console.error('Trade execution failed:', err);
    res.status(500).json({ message: 'Failed to execute trade' });
  }
});

router.delete('/:id/holdings/:holdingId', validateId, async (req, res) => {
  try {
    const investment = await Investment.findOne({ _id: req.params.id, userId: req.userId });
    if (!investment) return res.status(404).json({ message: 'Investment not found' });

    const holding = investment.holdings.id(req.params.holdingId);
    if (!holding) return res.status(404).json({ message: 'Holding not found' });

    // Remove parallel transaction if it exists
    if (holding.transactionId) {
      await Transaction.findByIdAndDelete(holding.transactionId);
    }

    // Remove the holding
    investment.holdings.pull(req.params.holdingId);
    await investment.save();

    res.json({ message: 'Holding deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete holding' });
  }
});

module.exports = router;
