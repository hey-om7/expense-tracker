/**
 * One-time Migration Script: Move shares/price from transactions → investment holdings
 * 
 * Usage:
 *   node server/scripts/migrate-holdings.js --dry-run    (preview only)
 *   node server/scripts/migrate-holdings.js              (execute migration)
 * 
 * Safety:
 *   - NEVER deletes transactions
 *   - Only copies data to investment.holdings
 *   - Then $unset shares/price from transactions
 *   - Fully idempotent (skips investments that already have holdings)
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/vestor';
  
  console.log(`\n🔄 Vestor Holdings Migration ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`   Connecting to: ${MONGO_URI.replace(/\/\/.*@/, '//***@')}\n`);

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const investments = await Investment.find({});
  console.log(`📊 Found ${investments.length} investment(s) to process\n`);

  let totalHoldingsMigrated = 0;
  let investmentsUpdated = 0;
  let investmentsSkipped = 0;

  for (const inv of investments) {
    // Skip if already has holdings (idempotent)
    if (inv.holdings && inv.holdings.length > 0) {
      console.log(`⏭  SKIP "${inv.name}" (${inv._id}) — already has ${inv.holdings.length} holdings`);
      investmentsSkipped++;
      continue;
    }

    // Find related transactions
    const trades = await Transaction.find({
      investmentId: inv._id.toString(),
      type: { $in: ['buy_investment', 'sell_investment'] },
    }).sort({ date: 1 }).lean();

    if (trades.length === 0) {
      console.log(`   "${inv.name}" (${inv._id}) — no trades found, skipping`);
      investmentsSkipped++;
      continue;
    }

    console.log(`\n📈 "${inv.name}" (${inv._id}) — ${trades.length} trade(s) found:`);

    const holdings = [];
    for (const trade of trades) {
      const quantity = parseFloat(trade.shares || 0);
      const price = parseFloat(trade.price || 0);
      
      if (quantity <= 0) {
        console.log(`   ⚠ Skipping trade ${trade._id} — invalid quantity: ${trade.shares}`);
        continue;
      }

      const holdingType = trade.type === 'buy_investment' ? 'BUY' : 'SELL';
      const holding = {
        quantity,
        price,
        date: trade.date || trade.createdAt,
        type: holdingType,
        transactionId: trade._id,
      };

      holdings.push(holding);
      console.log(`   ${holdingType === 'BUY' ? '🟢' : '🔴'} ${holdingType}: ${quantity} units @ ₹${price} on ${new Date(holding.date).toLocaleDateString('en-IN')} (tx: ${trade._id})`);
    }

    if (holdings.length > 0) {
      if (!DRY_RUN) {
        inv.holdings = holdings;
        await inv.save();
        console.log(`   ✅ Saved ${holdings.length} holdings to "${inv.name}"`);
      } else {
        console.log(`   🔍 Would save ${holdings.length} holdings to "${inv.name}"`);
      }
      totalHoldingsMigrated += holdings.length;
      investmentsUpdated++;
    }
  }

  // Phase 2: Strip shares/price from all transactions
  console.log(`\n${'─'.repeat(50)}`);
  
  // Count how many transactions have shares/price set
  const txWithShares = await Transaction.collection.countDocuments({ shares: { $ne: null } });
  const txWithPrice = await Transaction.collection.countDocuments({ price: { $ne: null } });
  
  console.log(`\n📋 Cleanup: ${txWithShares} transactions with 'shares', ${txWithPrice} with 'price'`);

  if (!DRY_RUN) {
    const result = await Transaction.collection.updateMany(
      {},
      { $unset: { shares: '', price: '' } }
    );
    console.log(`✅ Stripped shares/price from ${result.modifiedCount} transaction(s)`);
  } else {
    console.log(`🔍 Would strip shares/price from transactions`);
  }

  // Summary
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 Migration Summary ${DRY_RUN ? '(DRY RUN)' : '(COMPLETED)'}`);
  console.log(`   Investments updated: ${investmentsUpdated}`);
  console.log(`   Investments skipped: ${investmentsSkipped}`);
  console.log(`   Holdings migrated:   ${totalHoldingsMigrated}`);
  console.log(`${'═'.repeat(50)}\n`);

  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
