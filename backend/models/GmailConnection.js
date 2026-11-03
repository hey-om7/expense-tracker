const mongoose = require('mongoose');

/**
 * A user's permission for Wallo to read their Gmail (read-only) for card statements.
 * The refresh token is AES-256-GCM encrypted and never leaves the server.
 */
const gmailConnectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  gmailAddress: { type: String, default: '' },
  refreshTokenEnc: { type: String, required: true, select: false },
  status: { type: String, enum: ['active', 'revoked', 'error'], default: 'active' },
  // Only emails received after this moment are fetched on the next scan.
  lastEmailDate: { type: Date, default: null },
  lastScannedAt: { type: Date, default: null },
  backfillStatus: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'pending' },
  lastError: { type: String, default: '' },
  // Cards the user chose NOT to track; their statements are ignored in future.
  ignoredCards: [{
    _id: false,
    domain: { type: String, required: true },
    last4: { type: String, default: null },
  }],
}, { timestamps: true });

module.exports = mongoose.model('GmailConnection', gmailConnectionSchema);
