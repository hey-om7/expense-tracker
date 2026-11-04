// express-rate-limit store backed by MongoDB, so limits survive restarts and
// are shared across instances. Each key is one document with a hit count and
// an expiry; a TTL index removes expired documents.
const mongoose = require('mongoose');

const COLLECTION = 'ratelimits';
let indexReady = null;

const collection = () => {
  const col = mongoose.connection.collection(COLLECTION);
  if (!indexReady) {
    indexReady = col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((err) => {
      indexReady = null;
      console.error('Rate-limit TTL index failed:', err.message);
    });
  }
  return col;
};

class MongoRateStore {
  constructor(prefix) {
    this.prefix = `${prefix}:`;
    this.localKeys = false; // shared across processes
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const now = new Date();
    const resetAt = new Date(now.getTime() + this.windowMs);
    // Single atomic update: restart the window if it has expired, otherwise count the hit.
    const doc = await collection().findOneAndUpdate(
      { _id: this.prefix + key },
      [{
        $set: {
          hits: { $cond: [{ $gt: ['$expiresAt', now] }, { $add: ['$hits', 1] }, 1] },
          expiresAt: { $cond: [{ $gt: ['$expiresAt', now] }, '$expiresAt', resetAt] },
        },
      }],
      { upsert: true, returnDocument: 'after' },
    );
    return { totalHits: doc.hits, resetTime: doc.expiresAt };
  }

  async decrement(key) {
    await collection().updateOne({ _id: this.prefix + key, hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    await collection().deleteOne({ _id: this.prefix + key });
  }
}

module.exports = { MongoRateStore };
