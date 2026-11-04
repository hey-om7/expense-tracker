// Distributed lock for scheduled jobs. With more than one server instance,
// only the instance that wins the lock runs the job; the rest skip it.
const os = require('os');
const mongoose = require('mongoose');

const holder = `${os.hostname()}:${process.pid}`;

/**
 * Runs fn only if no other instance has run `name` within the last ttlMs.
 * The lock is not released early on purpose: it doubles as "already ran this period".
 */
const runExclusive = async (name, ttlMs, fn) => {
  const col = mongoose.connection.collection('joblocks');
  const now = new Date();
  try {
    await col.findOneAndUpdate(
      { _id: name, lockedUntil: { $lte: now } },
      { $set: { lockedUntil: new Date(now.getTime() + ttlMs), holder, startedAt: now } },
      { upsert: true },
    );
  } catch (err) {
    // Duplicate key: the lock document exists and is still held by someone.
    if (err.code === 11000) return { skipped: true };
    throw err;
  }
  await fn();
  return { skipped: false };
};

module.exports = { runExclusive };
