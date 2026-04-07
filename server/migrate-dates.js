const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wallo';

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const subscriptions = db.collection('subscriptions');

    const cursor = subscriptions.find({
      startDate: { $exists: false },
      renewalDate: { $exists: true }
    });

    let count = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      await subscriptions.updateOne(
        { _id: doc._id },
        { 
          $set: { startDate: doc.renewalDate },
          $unset: { renewalDate: "" }
        }
      );
      count++;
    }

    console.log(`Migrated ${count} subscriptions by copying renewalDate to startDate.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
