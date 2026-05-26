const express = require('express');
const router = express.Router();
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/authMiddleware');
const validateId = require('../middleware/validateId');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

router.use(auth);

// ─── Helper: compute derived fields from holdings (reused by GET and PUT) ───
const computeDerived = (inv) => {
  let totalQuantity = 0;
  let totalCostBase = 0;
  let realizedProfit = 0;

  const sortedHoldings = [...(inv.holdings || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

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

  return {
    totalQuantity,
    avgBuyPrice: totalQuantity > 0 ? totalCostBase / totalQuantity : 0,
    realizedProfit,
  };
};

// ─── Helper: silently fetch sector/industry from Yahoo Finance ───
const fetchSectorInfo = async (symbol) => {
  try {
    const summary = await yahooFinance.quoteSummary(symbol, { modules: ['assetProfile'] });
    const profile = summary?.assetProfile;
    return {
      sector: profile?.sector || null,
      industry: profile?.industry || null,
    };
  } catch {
    return { sector: null, industry: null };
  }
};

const isEtfSymbol = (symbol, name) =>
  /BEES|ETF|NIFTY|SENSEX|INDEX/i.test(symbol || '') ||
  /BEES|ETF|NIFTY|SENSEX|INDEX/i.test(name || '');

const pickFields = (body) => {
  const clean = {};
  if (body.name !== undefined) clean.name = String(body.name).slice(0, 200);
  if (body.symbol !== undefined) clean.symbol = String(body.symbol).slice(0, 50);
  if (body.type !== undefined) clean.type = String(body.type).slice(0, 30);
  if (body.comments !== undefined) clean.comments = String(body.comments).slice(0, 500);
  if (body.sector !== undefined) clean.sector = body.sector ? String(body.sector).slice(0, 100) : null;
  if (body.industry !== undefined) clean.industry = body.industry ? String(body.industry).slice(0, 100) : null;
  if (body.currentPrice !== undefined) {
    clean.currentPrice = Number(body.currentPrice);
    if (isNaN(clean.currentPrice) || clean.currentPrice < 0) clean.currentPrice = 0;
  }
  return clean;
};

// ─── GET / — fetch all investments with computed fields ───
router.get('/', async (req, res) => {
  try {
    const investments = await Investment.find({ userId: req.userId }).lean();

    const computedInvestments = investments.map(inv => ({
      ...inv,
      id: inv._id,
      ...computeDerived(inv),
    }));

    res.json(computedInvestments);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch investments' });
  }
});

// ─── POST / — create new investment, auto-fetch sector for stocks ───
router.post('/', async (req, res) => {
  try {
    const fields = pickFields(req.body);

    if (fields.type === 'Stock' && fields.symbol && !fields.sector) {
      if (isEtfSymbol(fields.symbol, fields.name)) {
        fields.sector = 'ETF / Index';
        fields.industry = null;
      } else {
        const info = await fetchSectorInfo(fields.symbol);
        fields.sector = info.sector || 'Other';
        fields.industry = info.industry || null;
      }
    }

    const investment = new Investment({ ...fields, userId: req.userId });
    const saved = await investment.save();
    const derived = computeDerived(saved.toObject());
    res.status(201).json({ ...saved.toObject(), id: saved._id, ...derived });
  } catch (err) {
    res.status(400).json({ message: 'Failed to create investment' });
  }
});

// ─── PUT /:id — update investment, return with computed fields so state stays intact ───
router.put('/:id', validateId, async (req, res) => {
  try {
    const fields = pickFields(req.body);
    const updated = await Investment.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      fields,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Investment not found' });

    // Return with computed derived fields — same shape as GET /
    const derived = computeDerived(updated.toObject());
    res.json({ ...updated.toObject(), id: updated._id, ...derived });
  } catch (err) {
    res.status(400).json({ message: 'Failed to update investment' });
  }
});

// ─── DELETE /:id ───
router.delete('/:id', validateId, async (req, res) => {
  try {
    const deleted = await Investment.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!deleted) return res.status(404).json({ message: 'Investment not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete investment' });
  }
});

// ─── POST /refresh-sectors — backfill sector for stocks missing it ───
router.post('/refresh-sectors', async (req, res) => {
  try {
    const stocks = await Investment.find({
      userId: req.userId,
      type: 'Stock',
      $or: [{ sector: null }, { sector: { $exists: false } }],
    }).lean();

    if (stocks.length === 0) {
      return res.json({ updated: 0, message: 'All stocks already have sector data.' });
    }

    let updated = 0;
    for (const stock of stocks) {
      if (isEtfSymbol(stock.symbol, stock.name)) {
        await Investment.updateOne({ _id: stock._id }, { $set: { sector: 'ETF / Index', industry: null } });
      } else {
        const { sector, industry } = await fetchSectorInfo(stock.symbol);
        await Investment.updateOne(
          { _id: stock._id },
          { $set: { sector: sector || 'Other', industry: industry || null } }
        );
      }
      updated++;
    }

    res.json({ updated, total: stocks.length });
  } catch (err) {
    console.error('Sector refresh failed:', err);
    res.status(500).json({ message: 'Failed to refresh sectors' });
  }
});

// ─── POST /:id/trade ───
router.post('/:id/trade', validateId, async (req, res) => {
  try {
    const { type, quantity, price, date } = req.body;

    if (!['BUY', 'SELL'].includes(type) || !quantity || quantity <= 0 || price < 0) {
      return res.status(400).json({ message: 'Invalid trade parameters' });
    }

    const investment = await Investment.findOne({ _id: req.params.id, userId: req.userId });
    if (!investment) return res.status(404).json({ message: 'Investment not found' });

    const tradeDate = date ? new Date(date) : new Date();

    const tx = new Transaction({
      userId: req.userId,
      type: type === 'BUY' ? 'buy_investment' : 'sell_investment',
      amount: quantity * price,
      title: `${type === 'BUY' ? 'Bought' : 'Sold'} ${quantity} units of ${investment.name}`,
      categoryId: 'trade',
      date: tradeDate,
      investmentId: investment._id.toString(),
    });
    const savedTx = await tx.save();

    investment.holdings.push({ quantity, price, date: tradeDate, type, transactionId: savedTx._id });
    await investment.save();

    res.status(201).json(investment);
  } catch (err) {
    console.error('Trade execution failed:', err);
    res.status(500).json({ message: 'Failed to execute trade' });
  }
});

// ─── DELETE /:id/holdings/:holdingId ───
router.delete('/:id/holdings/:holdingId', validateId, async (req, res) => {
  try {
    const investment = await Investment.findOne({ _id: req.params.id, userId: req.userId });
    if (!investment) return res.status(404).json({ message: 'Investment not found' });

    const holding = investment.holdings.id(req.params.holdingId);
    if (!holding) return res.status(404).json({ message: 'Holding not found' });

    if (holding.transactionId) {
      await Transaction.findByIdAndDelete(holding.transactionId);
    }

    investment.holdings.pull(req.params.holdingId);
    await investment.save();

    res.json({ message: 'Holding deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete holding' });
  }
});

module.exports = router;
