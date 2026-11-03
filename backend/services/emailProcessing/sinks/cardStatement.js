/** Stores credit_card_statement results as CardStatement documents and links them to cards. */
const CardStatement = require('../../../models/CardStatement');
const CreditCard = require('../../../models/CreditCard');
const { rootDomainFor } = require('../institutions');

const matchCard = (cards, result) => {
  const { last4 } = result.fields;
  if (last4 && last4.length >= 2) {
    const byDigits = cards.filter(c => String(c.last4Digits).endsWith(last4));
    if (byDigits.length === 1) return byDigits[0];
    if (byDigits.length > 1) return null; // ambiguous — let the user decide
  }
  const haystack = `${result.email.subject} ${result.email.from} ${result.institution.name}`.toLowerCase();
  const byName = cards.filter(c =>
    c.name.toLowerCase().split(/\s+/).some(w => w.length > 3 && haystack.includes(w)));
  return byName.length === 1 ? byName[0] : null;
};

const isIgnored = (conn, domain, last4) =>
  (conn.ignoredCards || []).some(i =>
    i.domain === rootDomainFor(domain) && (!i.last4 || !last4 || i.last4 === last4));

// Apply the newest linked statement to its card (drives due-date reminders).
const applyLatestToCard = async (cardId) => {
  const latest = await CardStatement.findOne({ cardId, status: 'linked' }).sort({ statementDate: -1 }).lean();
  if (!latest) return;
  const update = { billGeneratedDate: latest.statementDate };
  if (latest.amount != null) update.billAmount = latest.amount;
  if (latest.dueDate) update.billDueDate = latest.dueDate;
  await CreditCard.updateOne({ _id: cardId }, { $set: update });
};

/**
 * @param {object} result standardized result
 * @param {{ userId, conn, cards }} ctx
 * @returns {Promise<{ action: 'linked'|'pending'|'dismissed'|'duplicate', doc?, card? }>}
 */
const save = async (result, ctx) => {
  const card = matchCard(ctx.cards, result);
  const status = card ? 'linked' : isIgnored(ctx.conn, result.institution.domain, result.fields.last4) ? 'dismissed' : 'pending';
  const doc = {
    userId: ctx.userId,
    cardId: card?._id || null,
    status,
    gmailMessageId: result.email.messageId,
    bankName: result.institution.name,
    senderDomain: result.institution.rootDomain,
    last4: result.fields.last4,
    amount: result.fields.amount,
    dueDate: result.fields.dueDate,
    statementDate: result.email.receivedAt,
    subject: result.email.subject,
    source: result.processor === 'ai' ? 'ai' : 'regex',
  };
  try {
    await CardStatement.create(doc);
  } catch (err) {
    if (err.code === 11000) return { action: 'duplicate' }; // stored by a concurrent run
    throw err;
  }
  return { action: status, doc, card };
};

module.exports = { save, applyLatestToCard, matchCard };
