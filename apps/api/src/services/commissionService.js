const Commission = require('../models/Commission');
const Order      = require('../models/Order');
const User       = require('../models/User');
const Referral   = require('../models/Referral');

const DEFAULT_VENDOR_RATE    = 10;  // platform keeps 10%, vendor gets 90%
const DEFAULT_AFFILIATE_RATE = 5;   // 5% of sale goes to affiliate

async function createVendorCommissions(order) {
  // Idempotency guard — don't double-create
  const existing = await Commission.findOne({ order: order._id, type: 'vendor' });
  if (existing) return [];

  const commissions = [];
  for (const item of order.items) {
    if (!item.vendorId) continue;
    const vendor = await User.findById(item.vendorId).select('vendorProfile.commissionRate');
    const rate         = vendor?.vendorProfile?.commissionRate ?? DEFAULT_VENDOR_RATE;
    const saleAmount   = item.price * item.quantity;
    const platformFee  = parseFloat(((saleAmount * rate) / 100).toFixed(2));
    const vendorEarning = parseFloat((saleAmount - platformFee).toFixed(2));
    commissions.push({
      type:             'vendor',
      order:            order._id,
      user:             item.vendorId,
      product:          item.product,
      saleAmount,
      commissionRate:   rate,
      commissionAmount: vendorEarning,
      platformFee,
    });
  }
  if (commissions.length) await Commission.insertMany(commissions);
  return commissions;
}

async function createAffiliateCommission(order, affiliateUserId) {
  if (!affiliateUserId) return null;
  // Idempotency guard
  const existing = await Commission.findOne({ order: order._id, type: 'affiliate' });
  if (existing) return existing;
  const affiliate      = await User.findById(affiliateUserId).select('affiliateProfile.commissionRate');
  const rate           = affiliate?.affiliateProfile?.commissionRate ?? DEFAULT_AFFILIATE_RATE;
  const commissionAmount = parseFloat(((order.totalAmount * rate) / 100).toFixed(2));
  const commission = await Commission.create({
    type:             'affiliate',
    order:            order._id,
    user:             affiliateUserId,
    saleAmount:       order.totalAmount,
    commissionRate:   rate,
    commissionAmount,
  });
  await Referral.create({
    referrer:         affiliateUserId,
    referee:          order.user,
    order:            order._id,
    commissionAmount,
  });
  return commission;
}

async function getPendingByUser(userId) {
  return Commission.find({ user: userId, status: 'pending' }).populate('order', 'orderId');
}

// Backfill: create Commission records for all paid orders that don't have them yet
async function backfillVendorCommissions() {
  const ordersWithCommissions = await Commission.distinct('order', { type: 'vendor' });
  const orders = await Order.find({
    paymentStatus: 'paid',
    _id: { $nin: ordersWithCommissions },
  }).lean();

  let created = 0;
  let skipped = 0;
  for (const order of orders) {
    try {
      const commissions = await createVendorCommissions(order);
      created += commissions.length;
    } catch (err) {
      console.error(`[Commission backfill] Failed for order ${order._id}:`, err.message);
      skipped++;
    }
  }
  console.log(`[Commission backfill] Done — created ${created} records, skipped ${skipped} orders`);
  return { ordersProcessed: orders.length, commissionsCreated: created, skipped };
}

module.exports = {
  createVendorCommissions,
  createAffiliateCommission,
  getPendingByUser,
  backfillVendorCommissions,
  DEFAULT_VENDOR_RATE,
  DEFAULT_AFFILIATE_RATE,
};
