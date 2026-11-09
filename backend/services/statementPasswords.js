/** Saved statement-PDF passwords, one per user and bank (root sender domain). */
const StatementPassword = require('../models/StatementPassword');
const { encrypt, decrypt, contexts } = require('../utils/tokenCrypto');

/** @returns {Promise<Map<string, string>>} senderDomain -> password, for one user */
const loadAll = async (userId) => {
  const rows = await StatementPassword.find({ userId }).select('+passwordEnc senderDomain').lean();
  const map = new Map();
  rows.forEach((r) => {
    try {
      map.set(r.senderDomain, decrypt(r.passwordEnc, contexts.statementPdf(userId, r.senderDomain)));
    } catch (err) {
      console.warn(`Saved statement password for ${r.senderDomain} can't be decrypted: ${err.message}`);
    }
  });
  return map;
};

const save = (userId, senderDomain, password) => StatementPassword.updateOne(
  { userId, senderDomain },
  { $set: { passwordEnc: encrypt(password, contexts.statementPdf(userId, senderDomain)), lastUsedAt: new Date() } },
  { upsert: true },
);

const touch = (userId, senderDomain) =>
  StatementPassword.updateOne({ userId, senderDomain }, { $set: { lastUsedAt: new Date() } });

const list = (userId) => StatementPassword.find({ userId }).select('senderDomain lastUsedAt createdAt').lean();

const remove = (userId, id) => StatementPassword.deleteOne({ _id: id, userId });

module.exports = { loadAll, save, touch, list, remove };
