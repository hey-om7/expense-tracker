const express = require('express');
const router = express.Router();
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const auth = require('../middleware/authMiddleware');

// Require authentication for stock lookups
router.use(auth);

// GET /api/stocks/search?q=keyword
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (!q) return res.status(400).json({ message: 'Missing search query' });

    const results = await yahooFinance.search(q);
    
    const filtered = results.quotes
      .filter(entry => entry.quoteType === 'EQUITY' || entry.quoteType === 'ETF')
      .slice(0, 20)
      .map(entry => ({
        symbol: entry.symbol,
        name: entry.shortname || entry.longname || entry.symbol,
        exchange: entry.exchange
      }));

    res.json(filtered);
  } catch (err) {
    console.error('Yahoo Finance Search Error:', err.message);
    res.status(500).json({ message: 'Failed to search stocks' });
  }
});

// GET /api/stocks/quote/:symbol
router.get('/quote/:symbol', async (req, res) => {
  try {
    const symbol = String(req.params.symbol || '').trim().slice(0, 30);
    if (!symbol || !/^[A-Za-z0-9._\-^=]+$/.test(symbol)) {
      return res.status(400).json({ message: 'Invalid symbol format' });
    }

    const quote = await yahooFinance.quote(symbol);
    if (!quote || typeof quote.regularMarketPrice === 'undefined') {
      return res.status(404).json({ message: 'Stock data not available' });
    }

    res.json({
      symbol: quote.symbol,
      price: quote.regularMarketPrice,
      currency: quote.currency,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Yahoo Finance Quote Error:', err.message);
    res.status(500).json({ message: 'Failed to fetch stock quote' });
  }
});

module.exports = router;
