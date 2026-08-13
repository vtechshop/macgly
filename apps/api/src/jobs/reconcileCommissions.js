const Order = require('../models/Order');
const Commission = require('../models/Commission');
const { createVendorCommissions, createAffiliateCommission } = require('../services/commissionService');

// Look back 48 hours to catch commissions that failed due to transient errors
// during the payment flow (network blip, MongoDB timeout, etc.).
const LOOKBACK_MS = 48 * 60 * 60 * 1000;

/**
 * Ensure every paid order has commission records.
 *
 * Commission creation is currently fire-and-forget in orderController — a
 * transient failure at payment time silently drops the commission record.
 * This job reconciles those gaps. It is safe to run frequently because
 * createVendorCommissions and createAffiliateCommission both have idempotency
 * guards (Commission.findOne check before insertMany).
 */
async function run() {
  const since = new Date(Date.now() - LOOKBACK_MS);

  const paidOrders = await Order.find({
    paymentStatus: 'paid',
    createdAt: { $gte: since },
  }).lean();

  let fixed = 0;
  let errors = 0;

  for (const order of paidOrders) {
    // Vendor commissions
    const hasVendorCommission = await Commission.exists({ order: order._id, type: 'vendor' });
    if (!hasVendorCommission) {
      // createVendorCommissions also checks internally — this outer check avoids
      // the loop over order.items when commissions already exist (common case).
      try {
        const created = await createVendorCommissions(order);
        if (created.length > 0) {
          fixed += created.length;
          console.log(`[ReconcileCommissions] Created ${created.length} vendor commission(s) for orderId=${order.orderId}`);
        }
      } catch (err) {
        console.error(`[ReconcileCommissions] vendor failed orderId=${order.orderId}:`, err.message);
        errors++;
      }
    }

    // Affiliate commission
    if (order.affiliateId) {
      const hasAffiliateCommission = await Commission.exists({ order: order._id, type: 'affiliate' });
      if (!hasAffiliateCommission) {
        try {
          await createAffiliateCommission(order, order.affiliateId);
          fixed++;
          console.log(`[ReconcileCommissions] Created affiliate commission for orderId=${order.orderId}`);
        } catch (err) {
          console.error(`[ReconcileCommissions] affiliate failed orderId=${order.orderId}:`, err.message);
          errors++;
        }
      }
    }
  }

  if (errors > 0) {
    console.error(`[ReconcileCommissions] Completed with ${errors} error(s) — check logs above`);
  }
}

module.exports = { run };
