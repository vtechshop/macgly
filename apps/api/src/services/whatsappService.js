/**
 * WhatsApp Business Cloud API service.
 * Env vars required:
 *   WHATSAPP_TOKEN          — permanent access token from Meta
 *   WHATSAPP_PHONE_NUMBER_ID — phone number ID from Meta Business dashboard
 *
 * If env vars are not set the functions resolve silently — safe to call always.
 */

const axios = require('axios');

const TOKEN    = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const BASE_URL = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`;

function isConfigured() {
  return !!(TOKEN && PHONE_ID);
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function sendText(phone, message) {
  if (!isConfigured()) return;
  const to = normalizePhone(phone);
  if (!to) return;
  try {
    await axios.post(
      BASE_URL,
      { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } },
      { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[WhatsApp] send failed:', err.response?.data?.error?.message || err.message);
  }
}

function fmt(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
}

// ── Order events ──────────────────────────────────────────────────────────────

async function notifyOrderPlaced(order, user) {
  const phone = order.shippingAddress?.phone || user?.phone;
  const name  = order.shippingAddress?.name  || user?.name || 'Customer';
  await sendText(phone, [
    `✅ *Order Confirmed!*`,
    `Hi ${name},`,
    `Your order *#${order.orderId}* has been placed successfully.`,
    `Amount: *${fmt(order.totalAmount)}*`,
    `Items: ${(order.items || []).length} item(s)`,
    ``,
    `Track your order: https://macgly.com/track-order`,
    `_Thank you for shopping at Macgly!_ 🛠️`,
  ].join('\n'));
}

async function notifyOrderShipped(order, user) {
  const phone   = order.shippingAddress?.phone || user?.phone;
  const name    = order.shippingAddress?.name  || user?.name || 'Customer';
  const trackId = order.tracking?.trackingId;
  const carrier = order.tracking?.carrier;
  await sendText(phone, [
    `🚚 *Order Shipped!*`,
    `Hi ${name},`,
    `Your order *#${order.orderId}* is on its way!`,
    trackId ? `Tracking ID: *${trackId}*${carrier ? ` (${carrier})` : ''}` : '',
    ``,
    `Track here: https://macgly.com/track-order`,
    `_Macgly Tools & Machinery_ 🔧`,
  ].filter(Boolean).join('\n'));
}

async function notifyOrderDelivered(order, user) {
  const phone = order.shippingAddress?.phone || user?.phone;
  const name  = order.shippingAddress?.name  || user?.name || 'Customer';
  await sendText(phone, [
    `🎉 *Order Delivered!*`,
    `Hi ${name},`,
    `Your order *#${order.orderId}* has been delivered. Hope you love it!`,
    ``,
    `Please leave a review: https://macgly.com/product/${order.items?.[0]?.slug || ''}`,
    `Need help? Contact us on WhatsApp.`,
    `_Macgly Tools & Machinery_ 🛠️`,
  ].join('\n'));
}

async function notifyOrderCancelled(order, user) {
  const phone = order.shippingAddress?.phone || user?.phone;
  const name  = order.shippingAddress?.name  || user?.name || 'Customer';
  await sendText(phone, [
    `❌ *Order Cancelled*`,
    `Hi ${name},`,
    `Your order *#${order.orderId}* has been cancelled.`,
    `Amount: *${fmt(order.totalAmount)}* (refund will be processed if applicable)`,
    ``,
    `Questions? Reply to this message or visit https://macgly.com/info/contact`,
    `_Macgly Tools & Machinery_`,
  ].join('\n'));
}

module.exports = { notifyOrderPlaced, notifyOrderShipped, notifyOrderDelivered, notifyOrderCancelled };
