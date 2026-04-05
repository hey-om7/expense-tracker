const express = require('express');
const router = express.Router();
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

// GET /api/stocks/search?q=keyword
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ message: 'Missing search query' });

    const results = await yahooFinance.search(q);
    
    // Filter to equities and prefer returning the core fields
    const filtered = results.quotes
      .filter(entry => entry.quoteType === 'EQUITY' || entry.quoteType === 'ETF')
      .map(entry => ({
        symbol: entry.symbol,
        name: entry.shortname || entry.longname || entry.symbol,
        exchange: entry.exchange
      }));

    res.json(filtered);
  } catch (err) {
    console.error('Yahoo Finance Search Error:', err);
    res.status(500).json({ message: 'Failed to search stocks from provider' });
  }
});

// GET /api/stocks/quote/:symbol
router.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!symbol) return res.status(400).json({ message: 'Missing symbol parameter' });

    const quote = await yahooFinance.quote(symbol);
    if (!quote || typeof quote.regularMarketPrice === 'undefined') {
      return res.status(404).json({ message: 'Stock data not available or delisted' });
    }

    res.json({
      symbol: quote.symbol,
      price: quote.regularMarketPrice,
      currency: quote.currency,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Yahoo Finance Quote Error:', err);
    res.status(500).json({ message: 'Failed to fetch live stock quote' });
  }
});

module.exports = router;
