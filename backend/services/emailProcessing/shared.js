/**
 * Knowledge shared between all users, so AI is spent once per email type, not once per email.
 *
 *   LearnedSender       – sender domains outside the built-in bank list that AI confirmed.
 *   SharedEmailPattern  – AI verdict per (sender root domain, subject shape), with the
 *                         labels needed to read later emails of that type locally.
 *
 * createSharedKnowledge(userId) loads what one sync job needs and caches lookups for the job.
 * Processors receive it as ctx.shared; without it (e.g. re-parse jobs) they behave as before.
 */
const LearnedSender = require('../../models/LearnedSender');
const SharedEmailPattern = require('../../models/SharedEmailPattern');
const { subjectKey, learnAnchors } = require('./rules');
const { rootDomainFor } = require('./institutions');
const { isFreemail } = require('./discovery');

// Distinct users whose mail must confirm a new sender before it is trusted for everyone.
const MIN_USERS_FOR_GLOBAL = 2;
// Not-financial verdicts (with no financial one) after which a new sender is no longer sent to AI.
const REJECT_AFTER = 3;
const MAX_USER_IDS = 50;

const cleanName = (s) => (typeof s === 'string' ? s.replace(/[^\p{L}\p{N} &.'-]/gu, '').trim().slice(0, 120) : '');

const createSharedKnowledge = async (userId) => {
  const uid = String(userId);
  const senders = await LearnedSender.find({
    $or: [{ financialHits: { $gt: 0 } }, { nonFinancialHits: { $gte: REJECT_AFTER } }],
  }).select('domain institutionName financialHits nonFinancialHits userIds').lean();

  const trusted = new Map(); // root domain -> institution name
  const rejected = new Set();
  for (const s of senders) {
    const mine = (s.userIds || []).some(id => String(id) === uid);
    if (s.financialHits > 0 && (mine || (s.userIds || []).length >= MIN_USERS_FOR_GLOBAL)) trusted.set(s.domain, s.institutionName);
    else if (s.financialHits === 0 && s.nonFinancialHits >= REJECT_AFTER) rejected.add(s.domain);
  }

  const patterns = new Map();
  const hits = new Map();

  return {
    trustedDomains: () => [...trusted.keys()],
    /** 'learned' | 'rejected' | null for a sender outside the built-in list. */
    senderStatus(domain) {
      const root = rootDomainFor(domain);
      if (!root || isFreemail(root)) return null;
      if (trusted.has(root)) return 'learned';
      if (rejected.has(root)) return 'rejected';
      return null;
    },
    nameFor: (domain) => trusted.get(rootDomainFor(domain)) || '',

    async findPattern(email) {
      const key = `${rootDomainFor(email.domain)}|${subjectKey(email.subject)}`;
      if (!patterns.has(key)) {
        const [senderDomain, sk] = key.split('|');
        patterns.set(key, sk ? await SharedEmailPattern.findOne({ senderDomain, subjectKey: sk }).lean() : null);
      }
      return patterns.get(key);
    },
    countHit(patternId) { hits.set(String(patternId), (hits.get(String(patternId)) || 0) + 1); },

    /**
     * Store what AI concluded for this email.
     * @param {object} email      normalized email
     * @param {{ financial: boolean, category?: string, fields?: object, institutionName?: string }} verdict
     */
    async learn(email, { financial, category = null, fields = null, institutionName = '' }) {
      const root = rootDomainFor(email.domain);
      const sk = subjectKey(email.subject);
      if (!root || !sk || isFreemail(root)) return;
      const name = cleanName(institutionName);
      const anchors = financial && fields ? learnAnchors(email, fields) : {};
      try {
        await SharedEmailPattern.updateOne(
          { senderDomain: root, subjectKey: sk },
          {
            $set: { verdict: financial ? 'financial' : 'not_financial', category: financial ? category : null, anchors, ...(name ? { institutionName: name } : {}) },
            $inc: { aiVerdicts: 1 },
          },
          { upsert: true },
        );
      } catch (err) {
        if (err.code !== 11000) console.warn(`[shared] pattern save failed: ${err.message}`);
      }
      patterns.delete(`${root}|${sk}`);

      // Only senders outside the built-in list are tracked as learned senders.
      if (email.senderStatus === 'known') return;
      const update = financial
        ? { $inc: { financialHits: 1 }, $addToSet: { userIds: userId }, $set: { lastSeenAt: new Date(), ...(name ? { institutionName: name } : {}) } }
        : { $inc: { nonFinancialHits: 1 }, $set: { lastSeenAt: new Date() } };
      try {
        await LearnedSender.updateOne(
          financial ? { domain: root, [`userIds.${MAX_USER_IDS}`]: { $exists: false } } : { domain: root },
          update, { upsert: true },
        );
      } catch (err) {
        // 11000: the domain exists but already holds MAX_USER_IDS users; count the hit only.
        if (err.code === 11000 && financial) await LearnedSender.updateOne({ domain: root }, { $inc: { financialHits: 1 } });
        else console.warn(`[shared] sender save failed: ${err.message}`);
      }
      if (financial) { trusted.set(root, name || trusted.get(root) || ''); rejected.delete(root); }
    },

    async flush() {
      for (const [id, n] of hits) {
        await SharedEmailPattern.updateOne({ _id: id }, { $inc: { timesApplied: n }, $set: { lastAppliedAt: new Date() } });
      }
      hits.clear();
    },
  };
};

module.exports = { createSharedKnowledge, MIN_USERS_FOR_GLOBAL, REJECT_AFTER };
