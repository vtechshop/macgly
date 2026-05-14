const Order = require('../models/Order');
const Commission = require('../models/Commission');
const notificationService = require('../services/notificationService');

const HOLD_DAYS = parseInt(process.env.PAYOUT_HOLD_DAYS) || 7;

async function run() {
  const cutoff = new Date(Date.now() - HOLD_DAYS * 24 * 60 * 60 * 1000);
  // Find delivered orders older than hold period with pending commissions
  const orders = await Order.find({
    status: 'delivered',
    updatedAt: { $lte: cutoff },
  }).select('_id');

  const orderIds = orders.map((o) => o._id);
  if (!orderIds.length) return 0;

  const commissions = await Commission.find({
    order: { $in: orderIds },
    status: 'pending',
  });

  let released = 0;
  for (const commission of commissions) {
    await Commission.findByIdAndUpdate(commission._id, { status: 'approved' });
    await notificationService.notifyCommissionApproved(commission.user, commission.commissionAmount);
    released++;
  }

  if (released > 0) console.log(`[AutoRelease] Released ${released} commissions`);
  return released;
}

module.exports = { run };
