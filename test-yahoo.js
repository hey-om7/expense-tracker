const yahooFinance = require('./server/node_modules/yahoo-finance2').default;
yahooFinance.suppressNotices(['yahooSurvey']);
async function run() {
  try {
     console.log("Searching Apple...");
     const search = await yahooFinance.search("Apple");
     console.log(search.quotes[0]);
  } catch (e) {
     console.error("Search failed:", e.message);
  }
}
run();
