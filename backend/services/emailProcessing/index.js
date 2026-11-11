/**
 * Email processing pipeline.
 *
 *   raw email ─▶ normalizeEmail ─▶ processor (chosen per user) ─▶ standardized result ─▶ sink (storage)
 *
 * Processors are interchangeable: each takes a normalized email and returns the
 * standardized result from result.js. Storage, deduplication and notifications
 * only see that result, so they work the same for every processor.
 *
 * To add a processing method: write a module exporting
 *   { name, usesExternalServices, process(email, ctx) }
 * and registerProcessor() it. To add a category, see categories/index.js.
 */
const { normalizeEmail } = require('./normalize');
const deterministic = require('./processors/deterministic');
const ai = require('./processors/ai');
const categories = require('./categories');
const sinks = require('./sinks');
const { OUTCOME } = require('./result');
const rules = require('./rules');
const discovery = require('./discovery');
const shared = require('./shared');
const { rootDomainFor } = require('./institutions');

const processors = new Map([[deterministic.name, deterministic], [ai.name, ai]]);

const registerProcessor = (processor) => processors.set(processor.name, processor);

/**
 * Pick the processor from the user's saved preference (never from client input).
 * @param {{ aiEmailProcessingEnabled?: boolean }|null} prefs
 */
const methodForPreferences = (prefs) => (prefs?.aiEmailProcessingEnabled === true ? ai.name : deterministic.name);

/**
 * @param {Buffer} raw
 * @param {{ method: string, messageId: string, receivedAt: Date, aiSession?: object }} ctx
 */
const processRawEmail = async (raw, ctx) => {
  const email = classifySender(await normalizeEmail(raw, { messageId: ctx.messageId, receivedAt: ctx.receivedAt }), ctx);
  const processor = processors.get(ctx.method) || deterministic;
  // Defense in depth: a processor that calls external services only gets the AI
  // session when the method was explicitly chosen; any other method gets none.
  const safeCtx = processor.usesExternalServices ? ctx : { ...ctx, aiSession: null };
  return processor.process(email, safeCtx);
};

/**
 * Add email.senderStatus:
 *   'known'     – built-in bank list
 *   'learned'   – confirmed earlier (shared LearnedSender, or a rule this user confirmed)
 *   'candidate' – unknown sender whose content scored as a likely bank email (discovery.js)
 *   'unknown'   – anything else; ignored
 * knownSender is true for 'known' and 'learned'.
 * @param {{ shared?: object, rules?: Array }} ctx
 */
const classifySender = (email, ctx = {}) => {
  let status = 'unknown';
  if (email.knownSender) status = 'known';
  else if (email.domain && !discovery.isFreemail(email.domain)) {
    const root = rootDomainFor(email.domain);
    const shared = ctx.shared?.senderStatus(email.domain);
    if (shared === 'learned' || (ctx.rules || []).some(r => r.senderDomain === root)) status = 'learned';
    else if (shared !== 'rejected' && discovery.scoreEmail(email).candidate) status = 'candidate';
  }
  return Object.freeze({ ...email, senderStatus: status, knownSender: status === 'known' || status === 'learned' });
};

module.exports = {
  processRawEmail,
  classifySender,
  discovery,
  createSharedKnowledge: shared.createSharedKnowledge,
  methodForPreferences,
  registerProcessor,
  createAiSession: ai.createAiSession,
  analyzeWithAi: ai.analyze,
  normalizeEmail,
  rules,
  categories,
  sinks,
  OUTCOME,
};
