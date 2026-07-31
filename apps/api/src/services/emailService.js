const { RESEND_API_KEY } = require('../config/env');

async function sendEmail({ to, subject, html, text, attachments }) {
  if (!RESEND_API_KEY) {
    console.log(`[Email DEV] To: ${to} | Subject: ${subject}`);
    return;
  }

  const body = {
    from: 'Macgly <noreply@macgly.com>',
    to: [to],
    subject,
    html,
    text: text || subject,
    ...(attachments?.length ? { attachments } : {}),
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend error [${res.status}] to=${to}:`, err);
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
  const statusLabels = {
    confirmed: 'Order Confirmed', processing: 'Being Processed',
    packed: 'Packed & Ready', shipped: 'Shipped 🚚',
    out_for_delivery: 'Out for Delivery 📦', delivered: 'Delivered ✅',
    cancelled: 'Cancelled',
  };
  const label = statusLabels[order.status] || order.status;
  const trackUrl = `https://macgly.com/track-order?id=${encodeURIComponent(order.orderId)}`;

  const trackingBlock = order.tracking?.trackingId ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.05em">Tracking Details</p>
      <p style="margin:0 0 4px;font-size:14px;color:#1f2937"><strong>Carrier:</strong> ${order.tracking.carrier || 'Courier'}</p>
      <p style="margin:0 0 4px;font-size:14px;color:#1f2937"><strong>AWB / Tracking ID:</strong> ${order.tracking.trackingId}</p>
      ${order.tracking.url ? `<p style="margin:8px 0 0"><a href="${order.tracking.url}" style="background:#16a34a;color:#fff;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">Track on Carrier →</a></p>` : ''}
    </div>` : '';

  await sendEmail({
    to: user.email,
    subject: `${label} — Order ${order.orderId}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <div style="background:#111827;padding:20px 28px;border-radius:8px 8px 0 0">
          <span style="color:#ea580c;font-size:20px;font-weight:800">MACGLY</span>
          <span style="color:#9ca3af;font-size:11px;margin-left:8px">TOOLS & MACHINERY</span>
        </div>
        <div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 4px;color:#111827;font-size:20px">${label}</h2>
          <p style="margin:0 0 16px;color:#6b7280">Hi ${user.name}, here's an update on your order.</p>
          <p style="margin:0 0 4px"><strong>Order ID:</strong> <span style="font-family:monospace">${order.orderId}</span></p>
          ${trackingBlock}
          <p style="margin:20px 0">
            <a href="${trackUrl}" style="background:#ea580c;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Track Your Order →</a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
          <p style="margin:0;color:#9ca3af;font-size:12px">Questions? <a href="mailto:support@macgly.com" style="color:#ea580c">support@macgly.com</a> | <a href="tel:+919944556683" style="color:#ea580c">+91 99445 56683</a></p>
        </div>
      </div>
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
  const adminEmail = process.env.ADMIN_EMAIL || 'macglyshop@gmail.com';
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

async function sendVendorNewOrderEmail({ order, vendorEmail, vendorName, vendorItems }) {
  const itemRows = vendorItems.map((i) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${i.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">×${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">₹${(i.price * i.quantity).toLocaleString('en-IN')}</td>
    </tr>`
  ).join('');
  const itemTotal = vendorItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const addr = order.shippingAddress;
  const addrLine = addr
    ? `${addr.name}, ${addr.phone}<br>${addr.address}, ${addr.city} – ${addr.pincode}, ${addr.state}`
    : 'N/A';

  await sendEmail({
    to: vendorEmail,
    subject: `New Order — ${order.orderId} (${vendorItems.length} item${vendorItems.length > 1 ? 's' : ''})`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <div style="background:#111827;padding:24px 32px;border-radius:8px 8px 0 0">
          <span style="color:#ea580c;font-size:22px;font-weight:800">MACGLY</span>
          <span style="color:#9ca3af;font-size:11px;margin-left:8px">VENDOR NOTIFICATION</span>
        </div>
        <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 4px;color:#111827">New Order Received</h2>
          <p style="margin:0 0 20px;color:#6b7280">Hi ${vendorName}, a customer just placed an order for your product${vendorItems.length > 1 ? 's' : ''}.</p>
          <p style="margin:0 0 4px"><strong>Order ID:</strong> <span style="font-family:monospace">${order.orderId}</span></p>
          <p style="margin:0 0 20px"><strong>Payment:</strong> ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online'}</p>
          <table style="width:100%;border-collapse:collapse;margin:0 0 8px">
            <thead><tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">Item</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600">Qty</th>
              <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">Total</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="text-align:right;font-weight:700;color:#111827;margin-bottom:20px">Your items total: ₹${itemTotal.toLocaleString('en-IN')}</div>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:20px">
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Ship To</p>
            <p style="margin:0;font-size:14px;line-height:1.7">${addrLine}</p>
          </div>
          <p style="margin:0 0 20px;background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e">
            Please arrange dispatch within <strong>1–2 business days</strong> and update the tracking details in your dashboard.
          </p>
          <a href="https://www.macgly.com/dashboard/vendor/orders" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">View in Vendor Dashboard →</a>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="margin:0;color:#9ca3af;font-size:12px">Questions? <a href="mailto:macglyshop@gmail.com" style="color:#ea580c">macglyshop@gmail.com</a> | +91 99445 56683</p>
        </div>
      </div>
    `,
  });
}

async function sendAdminNewOrderEmail({ order, customer }) {
  const adminEmail = process.env.ADMIN_EMAIL || 'macglyshop@gmail.com';
  const itemRows = order.items.map((i) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${i.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">×${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">₹${(i.price * i.quantity).toLocaleString('en-IN')}</td>
    </tr>`
  ).join('');
  const addr = order.shippingAddress;
  const addrLine = addr
    ? `${addr.name}, ${addr.phone} — ${addr.address}, ${addr.city} – ${addr.pincode}, ${addr.state}`
    : 'N/A';

  await sendEmail({
    to: adminEmail,
    subject: `New Order — ${order.orderId} (₹${(order.totalAmount || 0).toLocaleString('en-IN')})`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <div style="background:#111827;padding:24px 32px;border-radius:8px 8px 0 0">
          <span style="color:#ea580c;font-size:22px;font-weight:800">MACGLY</span>
          <span style="color:#9ca3af;font-size:11px;margin-left:8px">ADMIN NOTIFICATION</span>
        </div>
        <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 4px;color:#111827">New Order Placed</h2>
          <p style="margin:0 0 20px;color:#6b7280">A new order has been placed on Macgly.</p>
          <p style="margin:0 0 4px"><strong>Order ID:</strong> <span style="font-family:monospace">${order.orderId}</span></p>
          <p style="margin:0 0 4px"><strong>Customer:</strong> ${customer?.name || 'N/A'} (${customer?.email || 'N/A'})</p>
          <p style="margin:0 0 4px"><strong>Payment:</strong> ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Paid Online'}</p>
          <p style="margin:0 0 20px"><strong>Ship to:</strong> ${addrLine}</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
            <thead><tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">Item</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600">Qty</th>
              <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">Total</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div style="text-align:right;font-size:18px;font-weight:700;color:#111827;margin-bottom:24px">Order Total: ₹${(order.totalAmount || 0).toLocaleString('en-IN')}</div>
          <a href="https://www.macgly.com/dashboard/admin/orders" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">View in Admin Dashboard →</a>
        </div>
      </div>
    `,
  });
}

async function sendAdminOrderCancelledEmail({ order, customer }) {
  const adminEmail = process.env.ADMIN_EMAIL || 'macglyshop@gmail.com';
  const itemRows = order.items.map((i) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${i.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">×${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">₹${(i.price * i.quantity).toLocaleString('en-IN')}</td>
    </tr>`
  ).join('');

  await sendEmail({
    to: adminEmail,
    subject: `⚠️ Order Cancelled — ${order.orderId} (Refund Pending)`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <div style="background:#111827;padding:24px 32px;border-radius:8px 8px 0 0">
          <span style="color:#ea580c;font-size:22px;font-weight:800">MACGLY</span>
          <span style="color:#9ca3af;font-size:11px;margin-left:8px">ADMIN NOTIFICATION</span>
        </div>
        <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 4px;color:#dc2626">Order Cancelled — Refund Required</h2>
          <p style="margin:0 0 20px;color:#6b7280">A customer has cancelled a paid order. Please process the refund.</p>
          <p style="margin:0 0 4px"><strong>Order ID:</strong> <span style="font-family:monospace">${order.orderId}</span></p>
          <p style="margin:0 0 4px"><strong>Customer:</strong> ${customer?.name || 'N/A'} (${customer?.email || 'N/A'})</p>
          <p style="margin:0 0 20px"><strong>Refund Amount:</strong> <span style="font-size:18px;font-weight:700;color:#dc2626">₹${(order.totalAmount || 0).toLocaleString('en-IN')}</span></p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <thead><tr style="background:#f9fafb">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">Item</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600">Qty</th>
              <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">Total</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
          <a href="https://www.macgly.com/dashboard/admin/orders" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Process Refund in Dashboard →</a>
        </div>
      </div>
    `,
  });
}

async function sendVendorKYCDecisionEmail({ vendor, status, rejectionReason }) {
  const name = vendor.vendorProfile?.businessName || vendor.name || 'Vendor';
  const approved = status === 'approved';
  await sendEmail({
    to: vendor.email,
    subject: approved ? '🎉 Your Macgly vendor account is approved!' : '❌ Your Macgly vendor application was not approved',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:${approved ? '#16a34a' : '#dc2626'}">${approved ? '🎉 Congratulations!' : '❌ Application Not Approved'}</h2>
        <p>Hi ${vendor.name || name},</p>
        ${approved
          ? `<p>Your vendor application for <strong>${name}</strong> has been <strong style="color:#16a34a">approved</strong>! You now have full access to the Macgly vendor dashboard.</p>
             <p>You can start listing your products immediately.</p>
             <a href="${process.env.FRONTEND_URL || 'https://macgly.com'}/dashboard/vendor/products"
               style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-top:8px">
               Start Listing Products →
             </a>`
          : `<p>Unfortunately, your vendor application for <strong>${name}</strong> was <strong style="color:#dc2626">not approved</strong> at this time.</p>
             ${rejectionReason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:12px 0"><strong>Reason:</strong> ${rejectionReason}</div>` : ''}
             <p>Please fix the issue mentioned above and resubmit your application.</p>
             <a href="${process.env.FRONTEND_URL || 'https://macgly.com'}/dashboard/vendor/kyc"
               style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-top:8px">
               Update & Resubmit →
             </a>`
        }
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">Macgly · macgly.com · support@macgly.com</p>
      </div>
    `,
  });
}

async function sendVendorKYCSubmittedEmail({ vendor, adminEmail }) {
  const name = vendor.vendorProfile?.businessName || vendor.name || 'A vendor';
  const email = vendor.email;

  // Email to admin
  await sendEmail({
    to: adminEmail || process.env.ADMIN_EMAIL || 'macglyshop@gmail.com',
    subject: `⚠️ Vendor KYC Approval Required — ${name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#ea580c">Vendor KYC Approval Required</h2>
        <p>A vendor has submitted their KYC and is awaiting your approval.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#6b7280;font-size:14px">Business Name</td><td style="padding:8px;font-weight:600">${name}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280;font-size:14px">Email</td><td style="padding:8px">${email}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;font-size:14px">Phone</td><td style="padding:8px">${vendor.vendorProfile?.businessPhone || '—'}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280;font-size:14px">GSTIN</td><td style="padding:8px">${vendor.vendorProfile?.gstin || '—'}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;font-size:14px">Business Type</td><td style="padding:8px">${vendor.vendorProfile?.businessType || '—'}</td></tr>
        </table>
        <a href="${process.env.FRONTEND_URL || 'https://macgly.com'}/dashboard/admin/vendors"
          style="display:inline-block;padding:12px 24px;background:#ea580c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          Review in Admin Panel →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">Macgly Admin · macgly.com</p>
      </div>
    `,
  });

  // Confirmation email to vendor
  await sendEmail({
    to: email,
    subject: 'Your Macgly vendor application is under review',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#ea580c">Application Submitted!</h2>
        <p>Hi ${vendor.name || name},</p>
        <p>Your vendor application for <strong>${name}</strong> has been submitted successfully and is now under review.</p>
        <p style="color:#6b7280">Our team will review your documents and get back to you within <strong>2–3 business days</strong>. You'll receive an email once a decision is made.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;font-size:14px;color:#374151">If you have any questions, contact us at <a href="mailto:support@macgly.com">support@macgly.com</a></p>
        </div>
        <p style="color:#9ca3af;font-size:12px">Macgly · macgly.com</p>
      </div>
    `,
  });
}

async function sendAffiliateKYCSubmittedEmail({ affiliate }) {
  const name  = affiliate.name || 'An affiliate';
  const email = affiliate.email;
  const now   = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

  await sendEmail({
    to: process.env.ADMIN_EMAIL || 'macglyshop@gmail.com',
    subject: `⚠️ Affiliate KYC Approval Required — ${name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#7c3aed">Affiliate KYC Approval Required</h2>
        <p>An affiliate has submitted their KYC and is awaiting your approval.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;color:#6b7280;font-size:14px">Name</td><td style="padding:8px;font-weight:600">${name}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280;font-size:14px">Email</td><td style="padding:8px">${email}</td></tr>
          <tr><td style="padding:8px;color:#6b7280;font-size:14px">Submitted At</td><td style="padding:8px">${now} IST</td></tr>
        </table>
        <a href="${process.env.FRONTEND_URL || 'https://macgly.com'}/dashboard/admin/kyc"
          style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          Review KYC in Admin Panel →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">Macgly Admin · macgly.com</p>
      </div>
    `,
  });

  await sendEmail({
    to: email,
    subject: 'Your Macgly affiliate KYC is under review',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#7c3aed">KYC Submitted!</h2>
        <p>Hi ${name},</p>
        <p>Your KYC has been submitted successfully and is now under review.</p>
        <p style="color:#6b7280">Our team will review your documents and get back to you within <strong>1–2 business days</strong>. You'll receive an email once a decision is made.</p>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;font-size:14px;color:#374151">Questions? Contact us at <a href="mailto:support@macgly.com">support@macgly.com</a></p>
        </div>
        <p style="color:#9ca3af;font-size:12px">Macgly · macgly.com</p>
      </div>
    `,
  });
}

async function sendAffiliateKYCDecisionEmail({ affiliate, status, rejectionReason }) {
  const name     = affiliate.name || 'Affiliate';
  const approved = status === 'approved';
  await sendEmail({
    to: affiliate.email,
    subject: approved ? '🎉 Your Macgly affiliate KYC is approved!' : '❌ Your Macgly affiliate KYC was not approved',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:${approved ? '#16a34a' : '#dc2626'}">${approved ? '🎉 KYC Approved!' : '❌ KYC Not Approved'}</h2>
        <p>Hi ${name},</p>
        ${approved
          ? `<p>Your affiliate KYC has been <strong style="color:#16a34a">approved</strong>! You now have full access to your affiliate dashboard and can start earning commissions.</p>
             <a href="${process.env.FRONTEND_URL || 'https://macgly.com'}/dashboard/affiliate"
               style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-top:8px">
               Go to Affiliate Dashboard →
             </a>`
          : `<p>Unfortunately, your affiliate KYC was <strong style="color:#dc2626">not approved</strong> at this time.</p>
             ${rejectionReason ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:12px 0"><strong>Reason:</strong> ${rejectionReason}</div>` : ''}
             <p>Please fix the issue mentioned and resubmit your KYC documents.</p>
             <a href="${process.env.FRONTEND_URL || 'https://macgly.com'}/dashboard/affiliate/kyc"
               style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-top:8px">
               Update & Resubmit →
             </a>`
        }
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">Macgly · macgly.com · support@macgly.com</p>
      </div>
    `,
  });
}

module.exports = { sendEmail, sendOrderConfirmation, sendShippingUpdate, sendPasswordReset, sendContactMessage, sendBackInStockEmail, sendVendorNewOrderEmail, sendAdminNewOrderEmail, sendAdminOrderCancelledEmail, sendVendorKYCSubmittedEmail, sendVendorKYCDecisionEmail, sendAffiliateKYCSubmittedEmail, sendAffiliateKYCDecisionEmail };
