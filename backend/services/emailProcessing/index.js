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
  const email = await normalizeEmail(raw, { messageId: ctx.messageId, receivedAt: ctx.receivedAt });
  const processor = processors.get(ctx.method) || deterministic;
  // Defense in depth: a processor that calls external services only gets the AI
  // session when the method was explicitly chosen; any other method gets none.
  const safeCtx = processor.usesExternalServices ? ctx : { ...ctx, aiSession: null };
  return processor.process(email, safeCtx);
};

module.exports = {
  processRawEmail,
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
