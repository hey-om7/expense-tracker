const mongoose = require('mongoose');

/**
 * Password that opens a bank's statement PDFs, saved when the user asks Vestor
 * to remember it. Encrypted with AES-256-GCM, bound to the user and bank
 * (utils/tokenCrypto contexts.statementPdf), and never sent to the client.
 */
const statementPasswordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  senderDomain: { type: String, required: true },
  passwordEnc: { type: String, required: true, select: false },
  lastUsedAt: { type: Date, default: null },
}, { timestamps: true });

statementPasswordSchema.index({ userId: 1, senderDomain: 1 }, { unique: true });

module.exports = mongoose.model('StatementPassword', statementPasswordSchema);
