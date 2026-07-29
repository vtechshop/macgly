const Order = require('../models/Order');
const Product = require('../models/Product');

async function run() {
  // Cancel pending_payment orders older than 30 minutes and restore their stock
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const stale = await Order.find({ status: 'pending_payment', createdAt: { $lt: cutoff } });

  for (const order of stale) {
    await Promise.all(
      order.items.map((item) =>
        Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } })
      )
    );
    order.status = 'cancelled';
    order.cancellation = { reason: 'Payment not completed', cancelledAt: new Date() };
    await order.save();
  }

  if (stale.length) {
    console.log(`[CleanupStaleOrders] Expired ${stale.length} order(s), stock restored`);
  }
}

module.exports = { run };
