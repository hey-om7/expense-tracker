const mongoose = require('mongoose');

/**
 * A sender domain outside the built-in bank list that the discovery scan found
 * (services/emailProcessing/discovery.js) and AI judged. Shared by all users.
 *
 *  financialHits    – AI found a real financial record from this domain
 *  nonFinancialHits – AI said a candidate email from this domain was not financial
 *  userIds          – distinct users whose mail confirmed it as financial (capped)
 *
 * A domain is trusted for a user once their own mail confirmed it, and for
 * everyone once MIN_USERS_FOR_GLOBAL distinct users confirmed it. This stops one
 * mailbox (or one attacker sending an authenticated email) from making a domain
 * trusted for all users.
 */
const learnedSenderSchema = new mongoose.Schema({
  domain: { type: String, required: true, unique: true, maxlength: 253 },
  institutionName: { type: String, default: '', maxlength: 120 },
  financialHits: { type: Number, default: 0 },
  nonFinancialHits: { type: Number, default: 0 },
  userIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  lastSeenAt: { type: Date, default: null },
}, { timestamps: true });

learnedSenderSchema.index({ userIds: 1 });

module.exports = mongoose.model('LearnedSender', learnedSenderSchema);
