const Commission = require('../models/Commission');
const Order      = require('../models/Order');
const { transitionCommission } = require('../services/commissionService');

const RETURN_WINDOW_DAYS = 7;

async function run() {
  const cutoff = new Date(Date.now() - RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const pending = await Commission.find({ status: 'pending' }).lean();
  if (!pending.length) return { approved: 0, cancelled: 0 };

  const orderIds = [...new Set(pending.map((c) => c.order.toString()))];
  const orders   = await Order.find({ _id: { $in: orderIds } }).select('status deliveredAt').lean();
  const orderMap = Object.fromEntries(orders.map((o) => [o._id.toString(), o]));

  let approved = 0;
  let cancelled = 0;
  let skipped = 0;

  for (const commission of pending) {
    const order = orderMap[commission.order.toString()];
    if (!order) continue;

    const to = (order.status === 'returned' || order.status === 'cancelled')
      ? 'cancelled'
      : (order.status === 'delivered' && order.deliveredAt && new Date(order.deliveredAt) <= cutoff)
        ? 'approved'
        : null;
    if (!to) continue;

    // MERGE-01: go through the state machine rather than Commission.updateOne.
    //
    // The rows were read with a `status: 'pending'` filter, but the writes ran
    // later in the loop with only `{ _id }` as the filter. A row settled by an
    // admin payout in between would have been written back to `approved`,
    // returning money that had already left the account to the payable pool.
    // transitionCommission puts the legal source states in the update filter, so
    // a row that moved on is refused instead of overwritten.
    try {
      await transitionCommission(commission._id, to, to === 'approved' ? { approvedAt: new Date() } : {});
      if (to === 'approved') approved++; else cancelled++;
    } catch (err) {
      // 409 = the row is no longer pending, or the order stopped being a sale.
      // Both are correct refusals, not failures.
      skipped++;
      if (err.statusCode && err.statusCode !== 409) {
        console.error(`[AutoReleaseCommissions] ${commission._id} -> ${to}:`, err.message);
      }
    }
  }

  console.log(`[AutoReleaseCommissions] Approved: ${approved}, Cancelled: ${cancelled}, Skipped: ${skipped}`);
  return { approved, cancelled, skipped };
}

module.exports = { run };
