const Commission = require('../models/Commission');
const User = require('../models/User');
const Referral = require('../models/Referral');

const DEFAULT_VENDOR_RATE = 10;    // 10% platform fee, vendor keeps 90%
const DEFAULT_AFFILIATE_RATE = 5;  // 5% of sale goes to affiliate

async function createVendorCommissions(order) {
  const commissions = [];
  for (const item of order.items) {
    if (!item.vendorId) continue;
    const vendor = await User.findById(item.vendorId).select('vendorProfile.commissionRate');
    const rate = vendor?.vendorProfile?.commissionRate ?? DEFAULT_VENDOR_RATE;
    const saleAmount = item.price * item.quantity;
    const platformFee = (saleAmount * rate) / 100;
    const vendorEarning = saleAmount - platformFee;
    commissions.push({
      type: 'vendor',
      order: order._id,
      user: item.vendorId,
      product: item.product,
      saleAmount,
      commissionRate: rate,
      commissionAmount: vendorEarning,
      platformFee,
    });
    // Update vendorEarning on the order item
    item.vendorEarning = vendorEarning;
    item.platformFee = platformFee;
  }
  if (commissions.length) await Commission.insertMany(commissions);
  return commissions;
}

async function createAffiliateCommission(order, affiliateUserId) {
  if (!affiliateUserId) return null;
  const affiliate = await User.findById(affiliateUserId).select('affiliateProfile.commissionRate');
  const rate = affiliate?.affiliateProfile?.commissionRate ?? DEFAULT_AFFILIATE_RATE;
  const commissionAmount = (order.totalAmount * rate) / 100;
  const commission = await Commission.create({
    type: 'affiliate',
    order: order._id,
    user: affiliateUserId,
    saleAmount: order.totalAmount,
    commissionRate: rate,
    commissionAmount,
  });
  // Create referral record
  await Referral.create({
    referrer: affiliateUserId,
    referee: order.user,
    order: order._id,
    commissionAmount,
  });
  return commission;
}

async function getPendingByUser(userId) {
  return Commission.find({ user: userId, status: 'pending' }).populate('order', 'orderId');
}

module.exports = { createVendorCommissions, createAffiliateCommission, getPendingByUser, DEFAULT_VENDOR_RATE, DEFAULT_AFFILIATE_RATE };
