const yahooFinance = require('yahoo-finance2').default;
async function run() {
  try {
     console.log("Searching Apple...");
     const search = await yahooFinance.search("Apple");
     console.log(search.quotes && search.quotes.length > 0 ? search.quotes[0] : "No quotes");
     
     console.log("Quoting AAPL...");
     const quote = await yahooFinance.quote("AAPL");
     console.log(quote.regularMarketPrice);
  } catch (e) {
     console.error("Failed:", e.message);
  }
}
run();
