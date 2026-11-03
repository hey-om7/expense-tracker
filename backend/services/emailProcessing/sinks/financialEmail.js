/** Default sink: stores review items and categories without dedicated storage as FinancialEmail. */
const FinancialEmail = require('../../../models/FinancialEmail');
const { OUTCOME } = require('../result');

const save = async (result, ctx) => {
  const status = result.outcome === OUTCOME.REVIEW ? 'review' : 'recorded';
  const doc = {
    userId: ctx.userId,
    gmailMessageId: result.email.messageId,
    status,
    category: result.category,
    reason: result.reason,
    processor: result.processor,
    confidence: result.confidence,
    institutionName: result.institution.name,
    senderDomain: result.institution.rootDomain,
    subject: result.email.subject,
    receivedAt: result.email.receivedAt,
    fields: result.fields,
  };
  try {
    await FinancialEmail.create(doc);
  } catch (err) {
    if (err.code === 11000) return { action: 'duplicate' };
    throw err;
  }
  return { action: status, doc };
};

module.exports = { save };
