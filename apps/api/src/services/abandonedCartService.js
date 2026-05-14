const Cart = require('../models/Cart');
const AbandonedCart = require('../models/AbandonedCart');
const User = require('../models/User');
const { sendEmail } = require('./emailService');

const ABANDON_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

async function detectAndSave() {
  const cutoff = new Date(Date.now() - ABANDON_THRESHOLD_MS);
  // Find carts not updated in 1 hour with items
  const carts = await Cart.find({
    updatedAt: { $lt: cutoff },
    'items.0': { $exists: true },
  }).populate('items.product', 'title price images').populate('user', 'name email');

  let detected = 0;
  for (const cart of carts) {
    if (!cart.user) continue;
    const existing = await AbandonedCart.findOne({ user: cart.user._id, recovered: false });
    if (existing) continue;
    const totalValue = cart.items.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0);
    await AbandonedCart.findOneAndUpdate(
      { user: cart.user._id },
      {
        user: cart.user._id,
        email: cart.user.email,
        items: cart.items.map((i) => ({
          product: i.product?._id,
          title: i.product?.title,
          price: i.product?.price,
          quantity: i.quantity,
          image: i.product?.images?.[0],
        })),
        totalValue,
        lastSeenAt: cart.updatedAt,
      },
      { upsert: true, new: true }
    );
    detected++;
  }
  return detected;
}

async function sendRecoveryEmails() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const abandoned = await AbandonedCart.find({
    recovered: false,
    recoveryEmailSentAt: null,
    lastSeenAt: { $lt: oneDayAgo },
  }).limit(50);

  let sent = 0;
  for (const ac of abandoned) {
    if (!ac.email) continue;
    try {
      const itemsList = ac.items.slice(0, 3).map((i) =>
        `<li><strong>${i.title}</strong> × ${i.quantity} — ₹${(i.price * i.quantity).toLocaleString()}</li>`
      ).join('');
      await sendEmail({
        to: ac.email,
        subject: 'You left something in your cart!',
        html: `
          <h2>Complete your purchase</h2>
          <p>You left items worth ₹${ac.totalValue.toLocaleString()} in your cart:</p>
          <ul>${itemsList}</ul>
          <p><a href="${process.env.FRONTEND_URL || 'https://macgly.com'}/cart" style="background:#ea580c;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Return to Cart</a></p>
        `,
      });
      await AbandonedCart.findByIdAndUpdate(ac._id, { recoveryEmailSentAt: new Date() });
      sent++;
    } catch { /* skip individual failures */ }
  }
  return sent;
}

async function markRecovered(userId) {
  await AbandonedCart.updateMany({ user: userId, recovered: false }, { recovered: true, recoveredAt: new Date() });
}

module.exports = { detectAndSave, sendRecoveryEmails, markRecovered };
