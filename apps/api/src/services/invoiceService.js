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

function generateInvoicePDF(order, user) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const orange = '#EA580C';
    const dark   = '#111827';
    const gray   = '#6B7280';
    const light  = '#F3F4F6';

    const fmt = (n) => 'Rs.' + Number(n || 0).toFixed(2);

    // Header bar
    doc.rect(0, 0, doc.page.width, 80).fill(dark);
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('MACGLY', 50, 24);
    doc.fillColor(orange).fontSize(9).font('Helvetica').text('TOOLS & MACHINERY', 50, 50);
    doc.fillColor('#CCCCCC').fontSize(8).text('macgly.com  |  support@macgly.com', 50, 63);
    doc.fillColor(orange).fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', 0, 26, { align: 'right', width: doc.page.width - 50 });
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica').text(`Invoice: ${order.orderId}`, 0, 48, { align: 'right', width: doc.page.width - 50 });
    const dateStr = new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(`Date: ${dateStr}`, 0, 60, { align: 'right', width: doc.page.width - 50 });

    let y = 100;

    // Bill To
    doc.fillColor(dark).fontSize(9).font('Helvetica-Bold').text('BILL TO', 50, y);
    doc.moveTo(50, y + 13).lineTo(180, y + 13).strokeColor(orange).lineWidth(1.5).stroke();
    y += 20;
    const addr = order.shippingAddress || {};
    [user?.name || addr.name, addr.line1, addr.line2, [addr.city, addr.state].filter(Boolean).join(', '), addr.pincode, user?.phone || addr.phone, user?.email]
      .filter(Boolean).forEach((l) => { doc.fillColor(dark).fontSize(8).font('Helvetica').text(l, 50, y); y += 13; });

    // Payment info (right column)
    let ry = 100;
    doc.fillColor(dark).fontSize(9).font('Helvetica-Bold').text('PAYMENT INFO', 360, ry);
    doc.moveTo(360, ry + 13).lineTo(545, ry + 13).strokeColor(orange).lineWidth(1.5).stroke();
    ry += 20;
    [['Payment ID', order.razorpayPaymentId || '—'], ['Method', 'Online (Razorpay)'], ['Status', 'PAID']].forEach(([k, v]) => {
      doc.fillColor(gray).fontSize(8).font('Helvetica').text(k, 360, ry);
      doc.fillColor(dark).text(v, 460, ry); ry += 13;
    });

    y = Math.max(y, ry) + 16;

    // Table header
    doc.rect(50, y, 495, 20).fill(dark);
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
    [['#', 50], ['Item', 72], ['Qty', 340], ['Rate', 385], ['GST', 445], ['Total', 495]].forEach(([t, x]) => doc.text(t, x, y + 6));
    y += 20;

    let subEx = 0, gstTot = 0;
    (order.items || []).forEach((item, i) => {
      const h = 20;
      if (i % 2 === 0) doc.rect(50, y, 495, h).fill(light);
      const rate = item.gstRate || 18;
      const line = (item.price || 0) * (item.quantity || 1);
      const gst  = line * rate / (100 + rate);
      subEx += line - gst; gstTot += gst;
      doc.fillColor(dark).fontSize(8).font('Helvetica');
      doc.text(String(i + 1), 50, y + 6);
      doc.text(item.title || '', 72, y + 6, { width: 255, ellipsis: true });
      doc.text(String(item.quantity || 1), 340, y + 6);
      doc.text(fmt(item.price), 385, y + 6);
      doc.text(`${rate}%`, 445, y + 6);
      doc.text(fmt(line), 495, y + 6);
      y += h;
    });

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 10;

    // Totals
    const rows = [['Subtotal (excl. GST)', fmt(subEx)], ['GST', fmt(gstTot)]];
    if (order.shippingCharge > 0) rows.push(['Shipping', fmt(order.shippingCharge)]);
    if (order.discount > 0)       rows.push(['Discount', `-${fmt(order.discount)}`]);
    rows.forEach(([k, v]) => {
      doc.fillColor(gray).fontSize(9).font('Helvetica').text(k, 355, y);
      doc.fillColor(dark).text(v, 490, y, { align: 'right', width: 55 }); y += 15;
    });
    y += 4;
    doc.rect(348, y, 197, 22).fill(dark);
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold').text('TOTAL', 358, y + 6).text(fmt(order.totalAmount), 490, y + 6, { align: 'right', width: 55 });
    y += 32;

    doc.fillColor(gray).fontSize(8).font('Helvetica').text('This is a computer-generated invoice and does not require a signature.', 50, y, { align: 'center', width: 495 });
    doc.fillColor(orange).fontSize(8).text('Thank you for shopping with Macgly!', 50, y + 13, { align: 'center', width: 495 });

    doc.end();
  });
}

module.exports = { generateInvoiceHTML, generateInvoicePDF };
