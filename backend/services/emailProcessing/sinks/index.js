/**
 * Storage for standardized results, chosen by category.
 *  - review results always go to the review queue (FinancialEmail, status "review"),
 *    so uncertain emails never create records automatically
 *  - extracted results go to the category's sink, or FinancialEmail by default
 *  - ignored results are not stored
 * A sink exports save(result, ctx) -> { action, doc? }.
 */
const cardStatement = require('./cardStatement');
const financialEmail = require('./financialEmail');
const { OUTCOME } = require('../result');

const sinks = new Map([['credit_card_statement', cardStatement]]);

const registerSink = (categoryId, sink) => sinks.set(categoryId, sink);

const persist = async (result, ctx) => {
  if (result.outcome === OUTCOME.IGNORED) return { action: 'ignored' };
  if (result.outcome === OUTCOME.REVIEW) return financialEmail.save(result, ctx);
  return (sinks.get(result.category) || financialEmail).save(result, ctx);
};

module.exports = { persist, registerSink, applyLatestToCard: cardStatement.applyLatestToCard };
