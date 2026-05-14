const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Ticket = require('../models/Ticket');
const Loyalty = require('../models/Loyalty');
const Notification = require('../models/Notification');
const Return = require('../models/Return');

async function exportUserData(userId) {
  const [user, orders, reviews, tickets, loyalty] = await Promise.all([
    User.findById(userId).select('-password -refreshTokens -passwordResetToken'),
    Order.find({ user: userId }).select('-__v'),
    Review.find({ user: userId }),
    Ticket.find({ user: userId }).select('-__v'),
    Loyalty.findOne({ user: userId }),
  ]);

  return {
    exportDate: new Date().toISOString(),
    profile: user?.toObject(),
    orders: orders.map((o) => o.toObject()),
    reviews: reviews.map((r) => r.toObject()),
    tickets: tickets.map((t) => t.toObject()),
    loyalty: loyalty ? { balance: loyalty.balance, totalEarned: loyalty.totalEarned, totalRedeemed: loyalty.totalRedeemed } : null,
  };
}

async function deleteAccount(userId) {
  const hasActiveOrders = await Order.exists({
    user: userId,
    status: { $in: ['pending', 'confirmed', 'processing', 'shipped'] },
  });
  if (hasActiveOrders) throw new Error('Cannot delete account with active orders');

  await Promise.all([
    // Anonymize user rather than hard delete (preserve order history integrity)
    User.findByIdAndUpdate(userId, {
      name: 'Deleted User',
      email: `deleted_${userId}@macgly.com`,
      phone: null,
      avatar: null,
      addresses: [],
      wishlist: [],
      isActive: false,
      emailVerified: false,
      refreshTokens: [],
    }),
    Notification.deleteMany({ user: userId }),
    Loyalty.deleteOne({ user: userId }),
  ]);

  return { deleted: true };
}

module.exports = { exportUserData, deleteAccount };
