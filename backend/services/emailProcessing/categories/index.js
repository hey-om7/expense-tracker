/**
 * Registry of financial email categories. Order matters: the deterministic
 * processor uses the first category whose detect() matches.
 *
 * Category interface:
 *   id, label, aiDescription
 *   detect(email) -> boolean
 *   extract(email, template) -> partial fields (see result.js)
 *   isUsable(fields) -> boolean   // safe to store without manual review
 *   isComplete(fields) -> boolean // all key fields present (high confidence)
 *
 * To add a category: create a module with this interface and register() it,
 * and optionally register a storage sink for it in sinks/index.js. Without a
 * sink, results are stored as generic FinancialEmail records.
 */
const categories = [
  require('./creditCardStatement'),
  require('./transactionAlert'),
  require('./accountStatement'),
];

const register = (category, { before } = {}) => {
  const i = before ? categories.findIndex(c => c.id === before) : -1;
  if (i >= 0) categories.splice(i, 0, category); else categories.push(category);
};

const list = () => categories;
const get = (id) => categories.find(c => c.id === id) || null;

module.exports = { register, list, get };
