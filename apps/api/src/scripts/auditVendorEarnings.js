/**
 * Read-only reconciliation for vendorProfile.totalEarnings (audit COMM-PAYOUT-EARN-01).
 *
 * Until this was fixed, lifetime earnings were credited twice: once on delivery
 * by applyEarnings, and again when an admin recorded a payout. This reports the
 * gap between the stored figure and what the order ledger says it should be.
 *
 * It writes NOTHING. Correcting a vendor is a finance decision — the command to
 * do it is printed alongside each discrepancy.
 *
 * Usage:  node apps/api/src/scripts/auditVendorEarnings.js [--all]
 *         --all  also list vendors that reconcile cleanly
 */
require('../config/env');
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');

const SHOW_ALL = process.argv.includes('--all');
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const inr = (n) => `Rs.${n.toFixed(2).padStart(12)}`;

/**
 * What totalEarnings should be: the vendor's share of every delivered order,
 * which is exactly what applyEarnings credits and reverses.
 */
async function expectedEarnings(vendorId) {
  const [agg] = await Order.aggregate([
    { $match: { 'items.vendorId': vendorId, status: 'delivered' } },
    { $unwind: '$items' },
    { $match: { 'items.vendorId': vendorId } },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$items.vendorEarning', 0] } } } },
  ]);
  return round2(agg?.total || 0);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shop');

  const vendors = await User.find({ role: 'vendor' })
    .select('name email vendorProfile.businessName vendorProfile.totalEarnings')
    .lean();

  console.log(`Checking ${vendors.length} vendor(s)\n`);
  console.log('  stored         expected       difference   vendor');
  console.log('  ' + '-'.repeat(72));

  let overstated = 0;
  let understated = 0;
  let totalGap = 0;

  for (const v of vendors) {
    const stored = round2(v.vendorProfile?.totalEarnings || 0);
    const expected = await expectedEarnings(v._id);
    const diff = round2(stored - expected);

    if (diff === 0 && !SHOW_ALL) continue;
    if (diff > 0) { overstated++; totalGap += diff; }
    if (diff < 0) understated++;

    const flag = diff > 0 ? 'OVERSTATED' : diff < 0 ? 'understated' : 'ok';
    const label = v.vendorProfile?.businessName || v.name || v.email;
    console.log(`  ${inr(stored)} ${inr(expected)} ${inr(diff)}   ${label}  [${flag}]`);
    if (diff !== 0) {
      console.log(`      db.users.updateOne({_id:ObjectId("${v._id}")},{$set:{"vendorProfile.totalEarnings":${expected}}})`);
    }
  }

  console.log('\n  ' + '-'.repeat(72));
  console.log(`  overstated:  ${overstated} vendor(s), Rs.${totalGap.toFixed(2)} total`);
  console.log(`  understated: ${understated} vendor(s)`);
  if (!overstated && !understated) console.log('  Everything reconciles.');
  console.log('\n  Nothing was modified. Apply the printed commands only after a finance review.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('auditVendorEarnings failed:', err);
  process.exit(1);
});
