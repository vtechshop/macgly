const User = require('../models/User');
const { voidCommissionsForOrder } = require('../services/commissionService');

const REVERSING_STATUSES = ['cancelled', 'returned'];

/**
 * Credit or reverse vendor + affiliate money when an order status changes.
 * Pass the order BEFORE the status update, and the incoming new status.
 *
 * Two distinct things happen on a reversal, with different triggers:
 *
 *   - `totalEarnings` is only reversed if the order had reached 'delivered',
 *     because that is the only point at which it was credited.
 *   - the Commission ledger is voided whenever the order becomes cancelled or
 *     returned, regardless of how far it got. Rows are created at payment, long
 *     before delivery, so a cancellation at any stage leaves payable rows behind
 *     if they are not voided here.
 *
 * Doing the voiding here rather than at each call site is deliberate: every
 * cancellation path in the app already routes through this function, so no route
 * can forget it.
 */
async function applyEarnings(order, newStatus) {
  const wasDelivered = order.status === 'delivered';
  const nowDelivered = newStatus === 'delivered';
  const nowReversed  = REVERSING_STATUSES.includes(newStatus);

  // Affiliate earnings
  if (order.affiliateId && order.affiliateCommission > 0) {
    if (!wasDelivered && nowDelivered) {
      await User.findByIdAndUpdate(order.affiliateId, {
        $inc: { 'affiliateProfile.totalEarnings': order.affiliateCommission },
      });
    } else if (wasDelivered && nowReversed) {
      await User.findByIdAndUpdate(order.affiliateId, {
        $inc: { 'affiliateProfile.totalEarnings': -order.affiliateCommission },
      });
    }
  }

  // Vendor earnings
  const vendorItems = (order.items || []).filter((i) => i.vendorId && i.vendorEarning > 0);
  if (vendorItems.length) {
    if (!wasDelivered && nowDelivered) {
      await Promise.all(vendorItems.map((item) =>
        User.findByIdAndUpdate(item.vendorId, {
          $inc: { 'vendorProfile.totalEarnings': item.vendorEarning },
        })
      ));
    } else if (wasDelivered && nowReversed) {
      await Promise.all(vendorItems.map((item) =>
        User.findByIdAndUpdate(item.vendorId, {
          $inc: { 'vendorProfile.totalEarnings': -item.vendorEarning },
        })
      ));
    }
  }

  // Commission ledger — void on any reversal, whatever the previous status.
  // Never touches rows already marked 'paid'.
  if (nowReversed) {
    await voidCommissionsForOrder(order._id, `Order ${newStatus}`);
  }
}

module.exports = { applyEarnings };
