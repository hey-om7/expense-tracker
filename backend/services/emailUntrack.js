/**
 * "Don't track" for emails Vestor recorded that the user doesn't want
 * (promotions, newsletters, unrelated mail).
 *
 * Untracking an email:
 *   - saves an EmailRule for its type (sender root domain + subject shape) with
 *     category 'not_financial', so later emails of that type are skipped by the
 *     pipeline (rules.matchRule runs before any category detection);
 *   - hides that email and every already-saved email of the same type
 *     (status 'dismissed'), remembering each one's previous state.
 *
 * Undo puts the hidden emails back as they were and restores the rule: a rule
 * the user taught earlier gets its old category back, a rule created only for
 * untracking is deleted.
 */
const EmailRule = require('../models/EmailRule');
const FinancialEmail = require('../models/FinancialEmail');
const { rules } = require('./emailProcessing');

const IGNORE = rules.IGNORE_CATEGORY;
const MAX_SAME_TYPE = 500;

class UntrackError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const untrack = async (userId, emailId) => {
  const doc = await FinancialEmail.findOne({ _id: emailId, userId, status: { $in: ['recorded', 'review'] } })
    .select('senderDomain subject institutionName').lean();
  if (!doc) throw new UntrackError(404, 'Email not found');
  if (!doc.senderDomain) throw new UntrackError(400, 'This email has no sender to block.');

  const subjectKey = rules.subjectKey(doc.subject);
  const existing = await EmailRule.findOne({ userId, senderDomain: doc.senderDomain, subjectKey }).lean();
  let rule;
  if (existing) {
    rule = await EmailRule.findByIdAndUpdate(existing._id, {
      $set: {
        category: IGNORE,
        untrackedAt: new Date(),
        // Keep the first category seen, so repeated untracking can't lose a taught rule.
        previousCategory: existing.untrackedAt ? existing.previousCategory
          : existing.category !== IGNORE ? existing.category : null,
      },
    }, { returnDocument: 'after' }).lean();
  } else {
    rule = (await EmailRule.create({
      userId, senderDomain: doc.senderDomain, subjectKey, category: IGNORE,
      institutionName: doc.institutionName || '', sampleSubject: (doc.subject || '').slice(0, 300),
      untrackedAt: new Date(),
    })).toObject();
  }

  const candidates = await FinancialEmail.find({
    userId, senderDomain: doc.senderDomain, status: { $in: ['recorded', 'review'] },
  }).select('subject status suggestionState').sort({ receivedAt: -1 }).limit(MAX_SAME_TYPE * 4).lean();
  const same = candidates.filter(e => String(e._id) === String(emailId) || rules.subjectKey(e.subject) === subjectKey)
    .slice(0, MAX_SAME_TYPE);

  if (same.length) {
    await FinancialEmail.bulkWrite(same.map(e => ({
      updateOne: {
        filter: { _id: e._id, userId },
        update: {
          $set: {
            status: 'dismissed',
            untrack: { ruleId: rule._id, status: e.status, suggestionState: e.suggestionState ?? null },
          },
        },
      },
    })));
  }
  return { ruleId: String(rule._id), hidden: same.length };
};

/** Untracked email types, newest first, each with the emails it hid. */
const history = async (userId) => {
  const list = await EmailRule.find({ userId, untrackedAt: { $ne: null }, category: IGNORE })
    .select('institutionName senderDomain sampleSubject untrackedAt timesApplied lastAppliedAt')
    .sort({ untrackedAt: -1 }).limit(200).lean();
  if (!list.length) return [];
  const emails = await FinancialEmail.find({ userId, 'untrack.ruleId': { $in: list.map(r => r._id) } })
    .select('subject receivedAt fields.amount untrack.ruleId').sort({ receivedAt: -1 }).limit(2000).lean();
  const byRule = new Map();
  emails.forEach((e) => {
    const k = String(e.untrack.ruleId);
    if (!byRule.has(k)) byRule.set(k, []);
    byRule.get(k).push({ _id: e._id, subject: e.subject, receivedAt: e.receivedAt, amount: e.fields?.amount ?? null });
  });
  return list.map(r => ({ ...r, emails: byRule.get(String(r._id)) || [] }));
};

const undo = async (userId, ruleId) => {
  const rule = await EmailRule.findOne({ _id: ruleId, userId, untrackedAt: { $ne: null } }).lean();
  if (!rule) throw new UntrackError(404, 'Not found');

  const hidden = await FinancialEmail.find({ userId, 'untrack.ruleId': rule._id })
    .select('untrack').lean();
  if (hidden.length) {
    await FinancialEmail.bulkWrite(hidden.map(e => ({
      updateOne: {
        filter: { _id: e._id, userId },
        update: {
          $set: {
            status: ['recorded', 'review'].includes(e.untrack.status) ? e.untrack.status : 'recorded',
            suggestionState: ['used', 'dismissed'].includes(e.untrack.suggestionState) ? e.untrack.suggestionState : null,
          },
          $unset: { untrack: '' },
        },
      },
    })));
  }

  if (rule.previousCategory) {
    await EmailRule.updateOne({ _id: rule._id }, {
      $set: { category: rule.previousCategory, untrackedAt: null, previousCategory: null },
    });
  } else {
    await EmailRule.deleteOne({ _id: rule._id });
  }
  return { restored: hidden.length };
};

module.exports = { untrack, history, undo, UntrackError };
