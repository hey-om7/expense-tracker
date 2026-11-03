/**
 * Migration Script: Assign userId to all existing documents
 *
 * Usage: node migrate-userId.js <userId>
 *
 * Run this ONCE after registering your first user to claim
 * all existing data under your account.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/vestor';

const collections = [
  'transactions',
  'categories',
  'investments',
  'subscriptions',
  'creditcards',
  'notifications',
];

async function migrate() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('❌ Usage: node migrate-userId.js <userId>');
    console.error('   Get your userId from the register response or MongoDB.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const objectId = new mongoose.Types.ObjectId(userId);

    for (const colName of collections) {
      const result = await mongoose.connection.db
        .collection(colName)
        .updateMany(
          { userId: { $exists: false } },
          { $set: { userId: objectId } }
        );
      console.log(`  📦 ${colName}: updated ${result.modifiedCount} documents`);
    }

    console.log('\n✅ Migration complete! All existing data now belongs to user:', userId);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
