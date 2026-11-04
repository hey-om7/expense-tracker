// One-time migration: encrypts users' Gemini/Groq API keys that were stored in plaintext.
// Safe to re-run; already-encrypted values are skipped.
// Usage (from repo root): node backend/scripts/encrypt-api-keys.js
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const { encrypt, isEncrypted, isConfigured } = require('../utils/tokenCrypto');
const UserPreferences = require('../models/UserPreferences');

(async () => {
  if (!isConfigured()) {
    console.error('GMAIL_TOKEN_ENCRYPTION_KEY must be set (64 hex chars).');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  let updated = 0;
  const cursor = UserPreferences.find({
    $or: [{ geminiApiKey: { $nin: ['', null] } }, { groqApiKey: { $nin: ['', null] } }],
  }).select('geminiApiKey groqApiKey').lean().cursor();

  for await (const prefs of cursor) {
    const set = {};
    for (const field of ['geminiApiKey', 'groqApiKey']) {
      const v = prefs[field];
      if (v && !isEncrypted(v)) set[field] = encrypt(v);
    }
    if (Object.keys(set).length) {
      await UserPreferences.updateOne({ _id: prefs._id }, { $set: set });
      updated++;
    }
  }
  console.log(`Encrypted API keys for ${updated} user(s).`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
