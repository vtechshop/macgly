function generateInvoiceHTML(order, user) {
  const items = order.items.map((item) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${item.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">₹${item.price.toLocaleString()}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">₹${(item.price * item.quantity).toLocaleString()}</td>
    </tr>`).join('');

  const addr = order.shippingAddress;
  const addressStr = [addr?.name, addr?.line1, addr?.line2, addr?.city, addr?.state, addr?.pincode, addr?.country]
    .filter(Boolean).join(', ');

  const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice — ${order.orderId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; margin: 0; padding: 32px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .logo { font-size: 24px; font-weight: 800; color: #ea580c; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { margin: 0; font-size: 20px; color: #374151; }
    .invoice-meta p { margin: 4px 0; color: #6b7280; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px; }
    .section-value { font-size: 14px; color: #374151; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th { padding: 10px 12px; background: #f9fafb; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; }
    thead th:last-child, thead th:nth-child(3), thead th:nth-child(2) { text-align: right; }
    thead th:nth-child(2) { text-align: center; }
    .totals { margin-left: auto; width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #374151; }
    .totals-row.total { font-weight: 700; font-size: 16px; border-top: 2px solid #e5e7eb; padding-top: 10px; margin-top: 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .badge-paid { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Macgly</div>
      <p style="margin:4px 0;color:#6b7280;font-size:13px">macgly.com</p>
    </div>
    <div class="invoice-meta">
      <h2>TAX INVOICE</h2>
      <p><strong>${order.orderId}</strong></p>
      <p>Date: ${invoiceDate}</p>
      <p>Payment: <span class="badge ${order.paymentStatus === 'paid' ? 'badge-paid' : 'badge-pending'}">${order.paymentStatus.toUpperCase()}</span></p>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="section-label">Bill To</div>
      <div class="section-value">
        <strong>${user?.name || addr?.name || 'Customer'}</strong><br/>
        ${user?.email || ''}<br/>
        ${user?.phone || ''}
      </div>
    </div>
    <div>
      <div class="section-label">Ship To</div>
      <div class="section-value">${addressStr}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>₹${(order.subtotal || 0).toLocaleString()}</span></div>
    ${order.discount ? `<div class="totals-row"><span>Discount</span><span style="color:#16a34a">−₹${order.discount.toLocaleString()}</span></div>` : ''}
    ${order.shippingCharge ? `<div class="totals-row"><span>Shipping</span><span>₹${order.shippingCharge.toLocaleString()}</span></div>` : '<div class="totals-row"><span>Shipping</span><span style="color:#16a34a">FREE</span></div>'}
    ${order.gstAmount ? `<div class="totals-row"><span>GST (18%)</span><span>₹${order.gstAmount.toLocaleString()}</span></div>` : ''}
    <div class="totals-row total"><span>Total</span><span>₹${(order.totalAmount || 0).toLocaleString()}</span></div>
  </div>

  <div class="footer">
    <p>Thank you for shopping with Macgly · This is a computer-generated invoice</p>
    <p>For support: support@macgly.com</p>
  </div>
</body>
</html>`;
}

module.exports = { generateInvoiceHTML };
