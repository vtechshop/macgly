const Order = require('../models/Order');
const Commission = require('../models/Commission');
const notificationService = require('../services/notificationService');

const VENDOR_HOLD_DAYS    = parseInt(process.env.PAYOUT_HOLD_DAYS)           || 7;
const AFFILIATE_HOLD_DAYS = parseInt(process.env.AFFILIATE_PAYOUT_HOLD_DAYS) || 30;
const AFFILIATE_MIN_PAYOUT = parseFloat(process.env.AFFILIATE_MIN_PAYOUT)    || 500; // ₹500 minimum

async function run() {
  const now = Date.now();
  const vendorCutoff    = new Date(now - VENDOR_HOLD_DAYS    * 24 * 60 * 60 * 1000);
  const affiliateCutoff = new Date(now - AFFILIATE_HOLD_DAYS * 24 * 60 * 60 * 1000);

  // Vendor commissions: released after VENDOR_HOLD_DAYS
  const vendorOrders = await Order.find({
    status: 'delivered',
    deliveredAt: { $exists: true, $ne: null, $lte: vendorCutoff },
  }).select('_id');

  // Affiliate commissions: released after AFFILIATE_HOLD_DAYS
  const affiliateOrders = await Order.find({
    status: 'delivered',
    deliveredAt: { $exists: true, $ne: null, $lte: affiliateCutoff },
  }).select('_id');

  let released = 0;

  // Release vendor commissions
  if (vendorOrders.length) {
    const vendorCommissions = await Commission.find({
      order: { $in: vendorOrders.map((o) => o._id) },
      type: 'vendor',
      status: 'pending',
    });
    for (const commission of vendorCommissions) {
      // Re-assert 'pending' in the filter: a cancellation between the find above
      // and this write would otherwise be silently undone.
      const moved = await Commission.findOneAndUpdate(
        { _id: commission._id, status: 'pending' },
        { status: 'approved', approvedAt: new Date() },
      );
      if (!moved) continue;
      await notificationService.notifyCommissionApproved(commission.user, commission.commissionAmount, 'vendor');
      released++;
    }
  }

  // Release affiliate commissions — only if affiliate's total pending >= minimum threshold
  if (affiliateOrders.length) {
    const affiliateCommissions = await Commission.find({
      order: { $in: affiliateOrders.map((o) => o._id) },
      type: 'affiliate',
      status: 'pending',
    });

    // Group by affiliate user to check threshold
    const byAffiliate = {};
    for (const c of affiliateCommissions) {
      const uid = c.user.toString();
      if (!byAffiliate[uid]) byAffiliate[uid] = [];
      byAffiliate[uid].push(c);
    }

    for (const [, commissions] of Object.entries(byAffiliate)) {
      const total = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
      if (total < AFFILIATE_MIN_PAYOUT) continue; // below ₹500 threshold — hold until next cycle

      for (const commission of commissions) {
        // Re-assert 'pending' in the filter: a cancellation between the find above
      // and this write would otherwise be silently undone.
      const moved = await Commission.findOneAndUpdate(
        { _id: commission._id, status: 'pending' },
        { status: 'approved', approvedAt: new Date() },
      );
      if (!moved) continue;
        await notificationService.notifyCommissionApproved(commission.user, commission.commissionAmount, 'affiliate');
        released++;
      }
    }
  }

  if (released > 0) console.log(`[AutoRelease] Released ${released} commissions`);
  return released;
}

module.exports = { run };
