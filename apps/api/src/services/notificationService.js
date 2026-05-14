const Notification = require('../models/Notification');

async function create(userId, { title, message, type = 'system', data, link } = {}) {
  try {
    return await Notification.create({ user: userId, title, message, type, data, link });
  } catch (err) {
    console.error('[Notification] Failed to create:', err.message);
  }
}

async function createMany(userIds, payload) {
  try {
    const docs = userIds.map((userId) => ({ user: userId, ...payload }));
    return await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error('[Notification] Failed to create bulk:', err.message);
  }
}

async function notifyOrderStatus(order, user) {
  const messages = {
    confirmed: 'Your order has been confirmed!',
    processing: 'Your order is being processed.',
    shipped: `Your order is on the way. Tracking: ${order.tracking?.trackingId || 'N/A'}`,
    delivered: 'Your order has been delivered!',
    cancelled: 'Your order has been cancelled.',
    returned: 'Your return has been processed.',
  };
  const msg = messages[order.status];
  if (!msg) return;
  await create(user._id || order.user, {
    title: `Order ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`,
    message: `Order #${order.orderId}: ${msg}`,
    type: 'order',
    data: { orderId: order._id, orderCode: order.orderId },
    link: `/dashboard/customer/orders`,
  });
}

async function notifyCommissionApproved(userId, amount) {
  await create(userId, {
    title: 'Commission Approved',
    message: `₹${amount.toFixed(2)} commission has been approved and will be paid out soon.`,
    type: 'commission',
    link: '/dashboard/vendor/settlements',
  });
}

async function notifyKYCResult(userId, approved, reason) {
  await create(userId, {
    title: approved ? 'KYC Approved' : 'KYC Rejected',
    message: approved
      ? 'Your KYC has been approved. You can now list products.'
      : `KYC rejected: ${reason || 'Please resubmit your documents.'}`,
    type: 'kyc',
  });
}

module.exports = { create, createMany, notifyOrderStatus, notifyCommissionApproved, notifyKYCResult };
