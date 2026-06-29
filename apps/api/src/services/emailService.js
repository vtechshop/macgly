const { MAILERSEND_API_KEY, MAILERSEND_FROM_EMAIL, MAILERSEND_FROM_NAME } = require('../config/env');

async function sendEmail({ to, subject, html, text }) {
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
  const items = order.items.map((i) =>
    `<tr><td>${i.title}</td><td>×${i.quantity}</td><td>₹${i.price * i.quantity}</td></tr>`
  ).join('');

  await sendEmail({
    to: user.email,
    subject: `Order Confirmed — ${order.orderId}`,
    html: `
      <h2>Order Confirmed!</h2>
      <p>Hi ${user.name}, your order <strong>${order.orderId}</strong> has been placed.</p>
      <table border="1" cellpadding="8">
        <thead><tr><th>Product</th><th>Qty</th><th>Total</th></tr></thead>
        <tbody>${items}</tbody>
      </table>
      <p><strong>Order Total: ₹${order.totalAmount}</strong></p>
    `,
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
