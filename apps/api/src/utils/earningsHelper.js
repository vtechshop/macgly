const User = require('../models/User');

/**
 * Credit or reverse vendor + affiliate earnings when order status changes.
 * Pass the order BEFORE the status update, and the incoming new status.
 */
async function applyEarnings(order, newStatus) {
  const wasDelivered = order.status === 'delivered';
  const nowDelivered = newStatus === 'delivered';
  const nowReversed  = ['cancelled', 'returned'].includes(newStatus);

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
}

module.exports = { applyEarnings };
