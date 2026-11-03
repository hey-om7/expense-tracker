/**
 * Dismiss review-queue emails whose subject is promotional (stored before the
 * promotional filter existed). Only changes status review -> dismissed.
 *
 *   node scripts/dismiss-promotional-review.js           # dry run, lists matches
 *   node scripts/dismiss-promotional-review.js --apply   # dismiss them
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const FinancialEmail = require('../models/FinancialEmail');
const { isPromotionalSubject } = require('../services/emailProcessing/promotional');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const items = await FinancialEmail.find({ status: 'review' }).select('subject institutionName').lean();
  const promo = items.filter(i => isPromotionalSubject(i.subject));
  promo.forEach(i => console.log(`  [promo] ${i.institutionName} · ${i.subject}`));
  items.filter(i => !promo.includes(i)).forEach(i => console.log(`  [keep]  ${i.institutionName} · ${i.subject}`));
  console.log(`${promo.length} of ${items.length} review item(s) are promotional.`);
  if (process.argv.includes('--apply') && promo.length) {
    const r = await FinancialEmail.updateMany({ _id: { $in: promo.map(i => i._id) } }, { $set: { status: 'dismissed' } });
    console.log(`Dismissed ${r.modifiedCount}.`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
