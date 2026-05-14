const Order = require('../models/Order');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

const REVIEW_DELAY_DAYS = parseInt(process.env.REVIEW_DELAY_DAYS) || 3;

async function run() {
  const cutoff = new Date(Date.now() - REVIEW_DELAY_DAYS * 24 * 60 * 60 * 1000);
  const orders = await Order.find({
    status: 'delivered',
    updatedAt: { $lte: cutoff },
    reviewRequestSent: { $ne: true },
  }).populate('user', 'name email').limit(50);

  let sent = 0;
  for (const order of orders) {
    if (!order.user?.email) continue;
    try {
      const items = order.items.slice(0, 2).map((i) => `<li>${i.title}</li>`).join('');
      await sendEmail({
        to: order.user.email,
        subject: `How was your order? Share your review — ${order.orderId}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>How did we do?</h2>
            <p>Hi ${order.user.name}, your order <strong>${order.orderId}</strong> was delivered. We'd love your feedback!</p>
            <ul>${items}</ul>
            <p style="margin:24px 0">
              <a href="${process.env.FRONTEND_URL || 'https://macgly.com'}/dashboard/customer/orders"
                 style="background:#ea580c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
                Leave a Review
              </a>
            </p>
          </div>
        `,
      });
      await Order.findByIdAndUpdate(order._id, { reviewRequestSent: true });
      sent++;
    } catch { /* skip individual failures */ }
  }
  if (sent > 0) console.log(`[ReviewRequestJob] Sent ${sent} review requests`);
  return sent;
}

module.exports = { run };
