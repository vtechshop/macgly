const Commission = require('../models/Commission');
const Order      = require('../models/Order');

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

  for (const commission of pending) {
    const order = orderMap[commission.order.toString()];
    if (!order) continue;

    if (order.status === 'returned' || order.status === 'cancelled') {
      await Commission.updateOne({ _id: commission._id }, { $set: { status: 'cancelled' } });
      cancelled++;
    } else if (
      order.status === 'delivered' &&
      order.deliveredAt &&
      new Date(order.deliveredAt) <= cutoff
    ) {
      await Commission.updateOne(
        { _id: commission._id },
        { $set: { status: 'approved', approvedAt: new Date() } }
      );
      approved++;
    }
  }

  console.log(`[AutoReleaseCommissions] Approved: ${approved}, Cancelled: ${cancelled}`);
  return { approved, cancelled };
}

module.exports = { run };
