const Order = require('../models/Order');
const Razorpay = require('razorpay');

async function run() {
  if (!process.env.RAZORPAY_KEY_ID) {
    console.log('[ReconcilePayments] Skipped — no Razorpay key');
    return 0;
  }
  const rz = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

  // Find orders paid via Razorpay but still marked pending
  const pendingOrders = await Order.find({
    paymentMethod: 'razorpay',
    paymentStatus: 'pending',
    razorpayOrderId: { $exists: true, $ne: null },
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  }).limit(50);

  let reconciled = 0;
  for (const order of pendingOrders) {
    try {
      const payments = await rz.orders.fetchPayments(order.razorpayOrderId);
      const paid = payments.items?.find((p) => p.status === 'captured');
      if (paid) {
        await Order.findByIdAndUpdate(order._id, {
          paymentStatus: 'paid',
          status: 'confirmed',
          razorpayPaymentId: paid.id,
        });
        reconciled++;
        console.log(`[Reconcile] Fixed order ${order.orderId}`);
      }
    } catch (err) {
      console.error(`[Reconcile] Error for ${order.orderId}:`, err.message);
    }
  }
  return reconciled;
}

module.exports = { run };
