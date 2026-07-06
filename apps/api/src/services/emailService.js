const { MAILERSEND_API_KEY, MAILERSEND_FROM_EMAIL, MAILERSEND_FROM_NAME } = require('../config/env');

async function sendEmail({ to, subject, html, text, attachments }) {
  if (!MAILERSEND_API_KEY) {
    console.log(`[Email DEV] To: ${to} | Subject: ${subject}`);
    return;
  }

  const body = {
    from: { email: MAILERSEND_FROM_EMAIL, name: MAILERSEND_FROM_NAME },
    to: [{ email: to }],
    subject,
    html,
    text: text || subject,
    ...(attachments?.length ? { attachments } : {}),
  };

  const res = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MAILERSEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('MailerSend error:', err);
  }
}

async function sendOrderConfirmation({ order, user }) {
  const { generateInvoicePDF } = require('./invoiceService');
  const items = order.items.map((i) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${i.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">×${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">₹${(i.price * i.quantity).toLocaleString('en-IN')}</td>
    </tr>`
  ).join('');

  let attachments = [];
  try {
    const pdfBuf = await generateInvoicePDF(order, user);
    attachments = [{ content: pdfBuf.toString('base64'), filename: `Invoice-${order.orderId}.pdf`, disposition: 'attachment' }];
  } catch (e) {
    console.error('Invoice PDF generation failed:', e.message);
  }

  await sendEmail({
    to: user.email,
    subject: `Order Confirmed — ${order.orderId}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <div style="background:#111827;padding:24px 32px;border-radius:8px 8px 0 0">
          <span style="color:#ea580c;font-size:22px;font-weight:800">MACGLY</span>
          <span style="color:#9ca3af;font-size:11px;margin-left:8px">TOOLS & MACHINERY</span>
        </div>
        <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 8px;color:#111827">Order Confirmed! 🎉</h2>
          <p style="margin:0 0 20px;color:#6b7280">Hi ${user.name}, your order has been placed successfully.</p>
          <p style="margin:0 0 4px"><strong>Order ID:</strong> ${order.orderId}</p>
          <p style="margin:0 0 20px"><strong>Payment:</strong> <span style="background:#d1fae5;color:#065f46;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600">PAID</span></p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
            <thead><tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">Item</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600">Qty</th>
              <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">Total</th>
            </tr></thead>
            <tbody>${items}</tbody>
          </table>
          <div style="text-align:right;font-size:18px;font-weight:700;color:#111827">Total: ₹${(order.totalAmount || 0).toLocaleString('en-IN')}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
          <p style="margin:0;color:#6b7280;font-size:13px">📎 Your tax invoice is attached to this email.</p>
          <p style="margin:8px 0 0;color:#6b7280;font-size:13px">For support: <a href="mailto:support@macgly.com" style="color:#ea580c">support@macgly.com</a></p>
        </div>
      </div>
    `,
    attachments,
  });
}

async function sendShippingUpdate({ order, user }) {
  await sendEmail({
    to: user.email,
    subject: `Your order ${order.orderId} is ${order.status}`,
    html: `
      <h2>Shipping Update</h2>
      <p>Hi ${user.name}, your order <strong>${order.orderId}</strong> is now <strong>${order.status}</strong>.</p>
      ${order.tracking?.trackingId ? `<p>Tracking: <a href="${order.tracking.url}">${order.tracking.trackingId}</a></p>` : ''}
    `,
  });
}

async function sendPasswordReset({ email, name, resetUrl }) {
  await sendEmail({
    to: email,
    subject: 'Reset your Macgly password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#ea580c">Reset your password</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
        <p style="margin:28px 0">
          <a href="${resetUrl}" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
        </p>
        <p style="color:#999;font-size:13px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p style="color:#999;font-size:12px">Or copy this link: ${resetUrl}</p>
      </div>
    `,
  });
}

async function sendContactMessage({ name, email, phone, message }) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.MAILERSEND_FROM_EMAIL || 'support@macgly.com';
  await sendEmail({
    to: adminEmail,
    subject: `New Contact Message from ${name}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#ea580c">New Contact Form Submission</h2>
        <table cellpadding="8" style="width:100%;border-collapse:collapse">
          <tr><td style="font-weight:600;width:100px;color:#555">Name</td><td>${name}</td></tr>
          <tr style="background:#f9fafb"><td style="font-weight:600;color:#555">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
          ${phone ? `<tr><td style="font-weight:600;color:#555">Phone</td><td>${phone}</td></tr>` : ''}
          <tr style="background:#f9fafb"><td style="font-weight:600;color:#555;vertical-align:top;padding-top:12px">Message</td><td style="white-space:pre-line">${message}</td></tr>
        </table>
        <p style="color:#999;font-size:12px;margin-top:16px">Sent via Macgly contact form</p>
      </div>
    `,
  });
}

async function sendBackInStockEmail({ email, product }) {
  const url = `https://macgly.com/product/${product.slug}`;
  await sendEmail({
    to: email,
    subject: `Back in stock: ${product.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#ea580c">Good news! It's back in stock.</h2>
        <p>The item you were waiting for is now available:</p>
        <h3 style="margin:16px 0 8px">${product.title}</h3>
        ${product.price ? `<p style="font-size:18px;font-weight:700;color:#111">₹${product.price}</p>` : ''}
        <p style="margin:24px 0">
          <a href="${url}" style="background:#ea580c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Buy Now
          </a>
        </p>
        <p style="color:#999;font-size:12px">Stock may be limited. Order soon to avoid missing out again.</p>
        <p style="color:#ccc;font-size:11px;margin-top:24px">You received this because you signed up for a back-in-stock alert on Macgly.</p>
      </div>
    `,
  });
}

module.exports = { sendEmail, sendOrderConfirmation, sendShippingUpdate, sendPasswordReset, sendContactMessage, sendBackInStockEmail };
