const Order = require('../models/Order');
const delhiveryService = require('../services/delhiveryService');
const notificationService = require('../services/notificationService');

async function run() {
  const orders = await Order.find({
    status: { $in: ['shipped', 'processing'] },
    'tracking.trackingId': { $exists: true, $ne: null },
  }).limit(50);

  let updated = 0;
  for (const order of orders) {
    try {
      const tracking = await delhiveryService.trackShipment(order.tracking.trackingId);
      if (!tracking) continue;

      const lastKnown = order.tracking.history?.slice(-1)[0]?.status;
      const newStatus = tracking.status;

      if (newStatus && newStatus !== lastKnown) {
        const update = {
          $push: {
            'tracking.history': {
              status: newStatus,
              timestamp: tracking.statusDate || new Date(),
              description: tracking.location || '',
            },
          },
        };
        // Auto-advance order status
        if (newStatus.toLowerCase().includes('delivered')) {
          update.status = 'delivered';
        }
        await Order.findByIdAndUpdate(order._id, update);
        // Notify customer
        await notificationService.create(order.user, {
          title: 'Shipment Update',
          message: `Order #${order.orderId}: ${newStatus}`,
          type: 'order',
          data: { orderId: order._id, orderCode: order.orderId },
        });
        updated++;
      }
    } catch (err) {
      console.error(`[TrackingSync] Error for ${order.orderId}:`, err.message);
    }
  }
  if (updated > 0) console.log(`[TrackingSync] Updated ${updated} orders`);
  return updated;
}

module.exports = { run };
