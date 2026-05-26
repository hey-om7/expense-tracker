const mongoose = require('mongoose');

/**
 * Tracks the last time Gmail was scanned for CC bills per user.
 * Used to ensure each daily scan only processes genuinely new emails.
 */
const gmailScanStateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  // The date of the most recent email we successfully processed.
  // Next scan will only fetch emails with date > lastEmailDate.
  lastEmailDate: {
    type: Date,
    default: null,
  },
  // When the scan itself last ran (for logging/debugging)
  lastScannedAt: {
    type: Date,
    default: null,
  },
  // How many bills were found in the last scan
  lastScanCount: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

module.exports = mongoose.model('GmailScanState', gmailScanStateSchema);
