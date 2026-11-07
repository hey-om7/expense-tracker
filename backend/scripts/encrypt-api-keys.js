// Migration: encrypts users' Groq API keys stored in plaintext, and re-encrypts
// legacy v1 secrets (Groq keys and Gmail refresh tokens) in the owner-bound v2
// format (see utils/tokenCrypto). Safe to re-run; v2 values are skipped.
// Usage (from repo root): node backend/scripts/encrypt-api-keys.js
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const { encrypt, decryptLegacyForMigration, isEncrypted, needsUpgrade, isConfigured, contexts } = require('../utils/tokenCrypto');
const UserPreferences = require('../models/UserPreferences');
const GmailConnection = require('../models/GmailConnection');

(async () => {
  if (!isConfigured()) {
    console.error('GMAIL_TOKEN_ENCRYPTION_KEY must be set (64 hex chars).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  let keys = 0;
  const prefsCursor = UserPreferences.find({ groqApiKey: { $nin: ['', null] } })
    .select('userId groqApiKey').lean().cursor();
  for await (const prefs of prefsCursor) {
    const v = prefs.groqApiKey;
    if (isEncrypted(v) && !needsUpgrade(v)) continue;
    try {
      const plain = isEncrypted(v) ? decryptLegacyForMigration(v) : v;
      await UserPreferences.updateOne({ _id: prefs._id }, { $set: { groqApiKey: encrypt(plain, contexts.groqKey(prefs.userId)) } });
      keys++;
    } catch (err) {
      console.error(`Skipped API key for user ${prefs.userId}: ${err.message}`);
    }
  }

  let tokens = 0;
  const connCursor = GmailConnection.find({ refreshTokenEnc: /^v1:/ }).select('+refreshTokenEnc userId').lean().cursor();
  for await (const conn of connCursor) {
    try {
      const plain = decryptLegacyForMigration(conn.refreshTokenEnc);
      await GmailConnection.updateOne({ _id: conn._id }, { $set: { refreshTokenEnc: encrypt(plain, contexts.gmailRefresh(conn.userId)) } });
      tokens++;
    } catch (err) {
      console.error(`Skipped Gmail token for user ${conn.userId}: ${err.message}`);
    }
  }

  console.log(`Upgraded ${keys} API key(s) and ${tokens} Gmail token(s).`);

  // Confirm nothing unbound is left before the fallback is switched off.
  const [leftKeys, leftTokens] = await Promise.all([
    UserPreferences.countDocuments({ groqApiKey: { $nin: ['', null], $not: /^v2:/ } }),
    GmailConnection.countDocuments({ refreshTokenEnc: { $not: /^v2:/ } }),
  ]);
  if (leftKeys || leftTokens) {
    console.log(`⚠️  Still not upgraded: ${leftKeys} API key(s), ${leftTokens} Gmail token(s). Fix the errors above and re-run.`);
  } else {
    console.log('✅ All secrets are v2. You can now set ALLOW_LEGACY_SECRETS=false.');
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
