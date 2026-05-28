/**
 * notificationHelper.js
 * Central helper for all in-app notifications (stored in MongoDB, shown in dashboard bell).
 * Uses: apps/api/src/models/Notification.js
 * Field reference: user (ObjectId), type, title, message, data, link, isRead
 */

const Notification = require('../models/Notification');
const User         = require('../models/User');

// ── Primitives ────────────────────────────────────────────────────────────────

async function createNotification({ userId, type, title, message, data = {}, link = null }) {
  try {
    return await Notification.create({ user: userId, type, title, message, data, link });
  } catch (err) {
    console.error('[NotifHelper] create failed:', err.message);
  }
}

async function createBulkNotifications(userIds, { type, title, message, data = {}, link = null }) {
  if (!userIds?.length) return;
  try {
    const docs = userIds.map((userId) => ({ user: userId, type, title, message, data, link }));
    return await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error('[NotifHelper] bulk create failed:', err.message);
  }
}

async function notifyAdmins({ type, title, message, data = {}, link = null }) {
  try {
    const admins = await User.find({ role: 'admin', isActive: { $ne: false } }).select('_id').lean();
    const ids = admins.map((a) => a._id);
    return await createBulkNotifications(ids, { type, title, message, data, link });
  } catch (err) {
    console.error('[NotifHelper] notifyAdmins failed:', err.message);
  }
}

// ── Orders ────────────────────────────────────────────────────────────────────

async function notifyVendorNewOrder({ vendorUserId, order, items }) {
  const qty = (items || order.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
  return createNotification({
    userId: vendorUserId,
    type:   'order',
    title:  'New Order Received',
    message: `Order #${order.orderId} — ${qty} item(s) worth ₹${(order.totalAmount || 0).toFixed(2)}`,
    data:   { orderId: order._id, orderNumber: order.orderId, amount: order.totalAmount },
    link:   '/dashboard/vendor/orders',
  });
}

async function notifyAdminNewOrder({ order, vendorName }) {
  return notifyAdmins({
    type:    'order',
    title:   'New Order Placed',
    message: `#${order.orderId} placed${vendorName ? ` · Vendor: ${vendorName}` : ''}`,
    data:    { orderId: order._id, orderNumber: order.orderId },
    link:    '/dashboard/admin/orders',
  });
}

async function notifyCustomerOrderStatus({ userId, order, status }) {
  const msgs = {
    processing: 'Your order is being processed.',
    shipped:    `Your order is on the way! Tracking: ${order.tracking?.trackingId || 'N/A'}`,
    delivered:  'Your order has been delivered! We hope you love it.',
    cancelled:  'Your order has been cancelled.',
  };
  const msg = msgs[status];
  if (!msg) return;
  return createNotification({
    userId,
    type:    'order',
    title:   `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: msg,
    data:    { orderId: order._id, orderNumber: order.orderId, status },
    link:    `/dashboard/customer/orders/${order._id}`,
  });
}

// ── Products ──────────────────────────────────────────────────────────────────

async function notifyAdminNewProduct({ product, vendorName }) {
  return notifyAdmins({
    type:    'product',
    title:   'New Product Submitted',
    message: `${vendorName} submitted: "${product.title}"`,
    data:    { productId: product._id, vendorName },
    link:    '/dashboard/admin/products',
  });
}

async function notifyVendorProductStatus({ vendorUserId, product, status, rejectionReason }) {
  const ok = status === 'approved';
  return createNotification({
    userId:  vendorUserId,
    type:    'product',
    title:   `Product ${ok ? 'Approved' : 'Rejected'}`,
    message: ok
      ? `"${product.title}" is now live on the store.`
      : `"${product.title}" was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    data:    { productId: product._id, status, rejectionReason },
    link:    '/dashboard/vendor/products',
  });
}

// ── Vendors / KYC ─────────────────────────────────────────────────────────────

async function notifyAdminNewVendor({ vendor, userEmail }) {
  return notifyAdmins({
    type:    'vendor_approval',
    title:   'New Vendor Application',
    message: `${vendor.storeName || userEmail} has applied to become a vendor.`,
    data:    { vendorId: vendor._id, userEmail },
    link:    '/dashboard/admin/vendors',
  });
}

async function notifyVendorApprovalStatus({ vendorUserId, vendor, status, rejectionReason }) {
  const ok = status === 'approved';
  return createNotification({
    userId:  vendorUserId,
    type:    'vendor_approval',
    title:   `Vendor Application ${ok ? 'Approved' : 'Rejected'}`,
    message: ok
      ? 'Congratulations! Your vendor account has been approved. You can now start listing products.'
      : `Your application was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    data:    { vendorId: vendor._id, status, rejectionReason },
    link:    ok ? '/dashboard/vendor' : null,
  });
}

async function notifyVendorKYCStatus({ vendorUserId, status, rejectionReason }) {
  const msgs = {
    approved: 'Your KYC has been verified successfully.',
    rejected: `Your KYC was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    pending:  'Your KYC documents are under review.',
  };
  return createNotification({
    userId:  vendorUserId,
    type:    'kyc',
    title:   `KYC ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: msgs[status] || `KYC status: ${status}`,
    data:    { status, rejectionReason },
    link:    '/dashboard/vendor/kyc',
  });
}

async function notifyAdminNewKYC({ vendor, userEmail }) {
  return notifyAdmins({
    type:    'kyc',
    title:   'New KYC Submission',
    message: `${vendor.storeName || userEmail} submitted KYC documents for review.`,
    data:    { vendorId: vendor._id, userEmail },
    link:    '/dashboard/admin/kyc',
  });
}

// ── Affiliates / Commissions ──────────────────────────────────────────────────

async function notifyAdminNewAffiliate({ affiliate, userEmail }) {
  return notifyAdmins({
    type:    'affiliate_approval',
    title:   'New Affiliate Application',
    message: `${userEmail} has applied for the affiliate program.`,
    data:    { affiliateId: affiliate._id, userEmail },
    link:    '/dashboard/admin/affiliates',
  });
}

async function notifyAffiliateApprovalStatus({ affiliateUserId, status, rejectionReason }) {
  const ok = status === 'approved';
  return createNotification({
    userId:  affiliateUserId,
    type:    'affiliate_approval',
    title:   `Affiliate Application ${ok ? 'Approved' : 'Rejected'}`,
    message: ok
      ? 'Congratulations! Your affiliate account is active. Start sharing links to earn commissions.'
      : `Your application was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    data:    { status, rejectionReason },
    link:    ok ? '/dashboard/affiliate' : null,
  });
}

async function notifyAffiliateNewCommission({ affiliateUserId, commission, orderNumber }) {
  return createNotification({
    userId:  affiliateUserId,
    type:    'commission',
    title:   'Commission Earned',
    message: `You earned ₹${(commission.amount || 0).toFixed(2)} from order #${orderNumber}`,
    data:    { commissionId: commission._id, amount: commission.amount, orderNumber },
    link:    '/dashboard/affiliate/commissions',
  });
}

async function notifyAffiliateCommissionPaid({ affiliateUserId, commission, amount }) {
  return createNotification({
    userId:  affiliateUserId,
    type:    'commission',
    title:   'Commission Paid',
    message: `₹${(amount || 0).toFixed(2)} has been transferred to your account.`,
    data:    { commissionId: commission._id, amount },
    link:    '/dashboard/affiliate/earnings',
  });
}

async function notifyAdminPendingCommissions({ count, totalAmount }) {
  return notifyAdmins({
    type:    'commission',
    title:   'Pending Commissions',
    message: `${count} commissions totalling ₹${(totalAmount || 0).toFixed(2)} are awaiting payout.`,
    data:    { count, totalAmount },
    link:    '/dashboard/admin/commissions',
  });
}

// ── Tickets ───────────────────────────────────────────────────────────────────

async function notifyAdminNewTicket({ ticket, userEmail }) {
  return notifyAdmins({
    type:    'ticket',
    title:   'New Support Ticket',
    message: `#${ticket.ticketId || ticket._id} from ${userEmail}: "${ticket.subject}"`,
    data:    { ticketId: ticket._id, userEmail },
    link:    '/dashboard/admin/tickets',
  });
}

async function notifyUserTicketStatusChange({ userId, ticket, status }) {
  const msgs = {
    in_progress: 'Your ticket is now being investigated by our support team.',
    resolved:    'Your support ticket has been resolved!',
    closed:      'Your ticket has been closed.',
  };
  return createNotification({
    userId,
    type:    'ticket',
    title:   `Ticket ${status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: msgs[status] || `Ticket status updated to: ${status}`,
    data:    { ticketId: ticket._id, status },
    link:    '/dashboard/customer/tickets',
  });
}

async function notifyUserTicketReply({ userId, ticket, repliedBy }) {
  return createNotification({
    userId,
    type:    'ticket',
    title:   'New Reply on Your Ticket',
    message: `${repliedBy || 'Support'} replied to: "${ticket.subject}"`,
    data:    { ticketId: ticket._id },
    link:    '/dashboard/customer/tickets',
  });
}

// ── Ads ───────────────────────────────────────────────────────────────────────

async function notifyAdminNewAdCampaign({ campaign, vendor }) {
  return notifyAdmins({
    type:    'ad',
    title:   'New Ad Campaign',
    message: `${vendor?.storeName || 'A vendor'} submitted: "${campaign.title}"`,
    data:    { campaignId: campaign._id, vendorId: vendor?._id },
    link:    '/dashboard/admin/ads',
  });
}

async function notifyVendorAdStatusChange({ vendorUserId, campaign, status, rejectionReason }) {
  const ok = status === 'approved';
  return createNotification({
    userId:  vendorUserId,
    type:    'ad',
    title:   `Ad Campaign ${ok ? 'Approved' : 'Rejected'}`,
    message: ok
      ? `Your campaign "${campaign.title}" is now live.`
      : `"${campaign.title}" was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    data:    { campaignId: campaign._id, status, rejectionReason },
    link:    '/dashboard/vendor/ads',
  });
}

async function notifyVendorLowAdBudget({ vendorUserId, campaign, remainingBudget }) {
  return createNotification({
    userId:  vendorUserId,
    type:    'ad',
    title:   'Low Ad Budget Warning',
    message: `"${campaign.title}" has ₹${(remainingBudget || 0).toFixed(2)} budget remaining. Top up to keep it running.`,
    data:    { campaignId: campaign._id, remainingBudget },
    link:    '/dashboard/vendor/ads',
  });
}

// ── Payments ──────────────────────────────────────────────────────────────────

async function notifyUserPaymentSuccess({ userId, order, amount }) {
  return createNotification({
    userId,
    type:    'payment',
    title:   'Payment Successful',
    message: `₹${(amount || 0).toFixed(2)} paid for order #${order.orderId}. Thank you!`,
    data:    { orderId: order._id, orderNumber: order.orderId, amount },
    link:    `/dashboard/customer/orders/${order._id}`,
  });
}

async function notifyUserPaymentFailed({ userId, order, amount }) {
  return createNotification({
    userId,
    type:    'payment',
    title:   'Payment Failed',
    message: `Payment of ₹${(amount || 0).toFixed(2)} for order #${order.orderId} failed. Please retry.`,
    data:    { orderId: order._id, orderNumber: order.orderId, amount },
    link:    `/dashboard/customer/orders/${order._id}`,
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  createNotification,
  createBulkNotifications,
  notifyAdmins,
  // Orders
  notifyVendorNewOrder,
  notifyAdminNewOrder,
  notifyCustomerOrderStatus,
  // Products
  notifyAdminNewProduct,
  notifyVendorProductStatus,
  // Vendors / KYC
  notifyAdminNewVendor,
  notifyVendorApprovalStatus,
  notifyVendorKYCStatus,
  notifyAdminNewKYC,
  // Affiliates
  notifyAdminNewAffiliate,
  notifyAffiliateApprovalStatus,
  notifyAffiliateNewCommission,
  notifyAffiliateCommissionPaid,
  notifyAdminPendingCommissions,
  // Tickets
  notifyAdminNewTicket,
  notifyUserTicketStatusChange,
  notifyUserTicketReply,
  // Ads
  notifyAdminNewAdCampaign,
  notifyVendorAdStatusChange,
  notifyVendorLowAdBudget,
  // Payments
  notifyUserPaymentSuccess,
  notifyUserPaymentFailed,
};
