const { PLATFORM_PARTY } = require('../config/platform');
const { stateNameFromCode } = require('../utils/indianStates');

/**
 * Invoice rendering.
 *
 * Both generators accept EITHER an issued Invoice document (PAY-03) or a legacy
 * Order. They normalise to one view model first, so there is a single rendering
 * path and orders placed before invoices existed keep working untouched.
 *
 * An Invoice is recognised by having `lines`; an Order has `items`.
 */

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const fmtDate = (d) => new Date(d || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const isInvoice = (src) => Array.isArray(src?.lines);

const joinAddress = (a = {}) => [a.line1, a.line2, a.city, a.state, a.pincode, a.country]
  .filter(Boolean).join(', ');

// ── View model ────────────────────────────────────────────────────────────────

function fromInvoice(invoice) {
  const t = invoice.totals || {};
  const lines = (invoice.lines || []).map((l) => {
    const pick = (c) => l.taxes?.find((x) => x.component === c)?.amount;
    const gstRate = l.taxes?.length
      ? round2(l.taxes.filter((x) => x.component !== 'CESS').reduce((s, x) => s + x.rate, 0))
      : null;
    return {
      title: l.title, hsn: l.hsnCode, unit: l.unit,
      qty: l.quantity, unitPrice: l.unitPrice,
      taxableValue: l.taxableValue, gstRate,
      cgst: pick('CGST'), sgst: pick('SGST'), igst: pick('IGST'),
      total: l.totalAmount,
    };
  });

  return {
    isLegacy: false,
    title: 'TAX INVOICE',
    number: invoice.number || invoice.orderNumber,
    orderNumber: invoice.orderNumber,
    date: invoice.issueDate,
    paymentStatus: 'paid',
    paymentMethod: null,
    paymentRef: null,
    supplier: invoice.supplier || {},
    recipient: invoice.recipient || {},
    shipTo: joinAddress(invoice.recipient?.address),
    placeOfSupply: invoice.placeOfSupplyStateCode,
    lines,
    totals: {
      taxableValue: t.taxableValue || 0,
      cgst: t.cgst || 0, sgst: t.sgst || 0, igst: t.igst || 0,
      gstTotal: round2((t.cgst || 0) + (t.sgst || 0) + (t.igst || 0)),
      shipping: t.shipping || 0, discount: t.discount || 0,
      grandTotal: t.grandTotal || 0,
    },
  };
}

/** Legacy path: an order with no Invoice record. Derives what it can, shows the rest as blank. */
function fromOrder(order, user) {
  const paid = order.paymentStatus === 'paid';
  let taxable = 0;
  let gstTotal = 0;

  const lines = (order.items || []).map((i) => {
    const lineTotal = round2((i.price || 0) * (i.quantity || 0));
    const rate = i.gstRate || 18;
    const gst = round2((lineTotal * rate) / (100 + rate));
    const lineTaxable = i.taxableValue ?? round2(lineTotal - gst);
    taxable += lineTaxable;
    gstTotal += gst;
    return {
      title: i.title, hsn: i.hsnCode, unit: i.unit,
      qty: i.quantity, unitPrice: i.price,
      taxableValue: lineTaxable, gstRate: rate,
      cgst: i.cgst, sgst: i.sgst, igst: i.igst,
      total: lineTotal,
    };
  });

  const addr = order.shippingAddress || {};
  return {
    isLegacy: true,
    title: paid ? 'TAX INVOICE' : 'ORDER SUMMARY',
    number: order.orderId,
    orderNumber: order.orderId,
    date: order.createdAt,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentRef: order.razorpayPaymentId,
    supplier: PLATFORM_PARTY,
    recipient: {
      legalName: order.billing?.companyName || user?.name || order.customerName || addr.name || 'Customer',
      gstin: order.billing?.gstin || '',
      email: user?.email || '',
      phone: user?.phone || order.customerPhone || addr.phone || '',
      address: addr,
    },
    shipTo: joinAddress(addr),
    placeOfSupply: order.placeOfSupplyStateCode,
    lines,
    totals: {
      taxableValue: round2(taxable),
      cgst: round2(lines.reduce((s, l) => s + (l.cgst || 0), 0)),
      sgst: round2(lines.reduce((s, l) => s + (l.sgst || 0), 0)),
      igst: round2(lines.reduce((s, l) => s + (l.igst || 0), 0)),
      gstTotal: order.gstAmount ?? round2(gstTotal),
      shipping: order.shippingCharge || 0,
      discount: order.discount || 0,
      grandTotal: order.totalAmount || 0,
    },
  };
}

function toViewModel(source, user) {
  return isInvoice(source) ? fromInvoice(source) : fromOrder(source, user);
}

// ── HTML ──────────────────────────────────────────────────────────────────────

function generateInvoiceHTML(source, user) {
  const vm = toViewModel(source, user);
  const showSplit = vm.totals.cgst > 0 || vm.totals.sgst > 0 || vm.totals.igst > 0;
  const dash = '<span style="color:#9ca3af">—</span>';

  const rows = vm.lines.map((l) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${esc(l.title)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace">${l.hsn ? esc(l.hsn) : dash}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${l.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">₹${money(l.unitPrice)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">₹${money(l.taxableValue)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${l.gstRate != null ? `${l.gstRate}%` : dash}</td>
      ${showSplit ? `
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${l.cgst != null ? `₹${money(l.cgst)}` : dash}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${l.sgst != null ? `₹${money(l.sgst)}` : dash}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${l.igst != null ? `₹${money(l.igst)}` : dash}</td>` : ''}
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">₹${money(l.total)}</td>
    </tr>`).join('');

  const posName = stateNameFromCode(vm.placeOfSupply);
  const sup = vm.supplier || {};

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice — ${esc(vm.number)}</title>
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
      <div class="logo">${esc(sup.tradeName || sup.legalName || 'Macgly')}</div>
      <div class="section-value" style="font-size:12px;color:#6b7280;max-width:280px">
        ${esc(sup.legalName || '')}<br/>
        ${esc(joinAddress(sup.address))}<br/>
        ${sup.gstin ? `<strong>GSTIN:</strong> ${esc(sup.gstin)}` : '<span style="color:#9ca3af">GSTIN not on record</span>'}
      </div>
    </div>
    <div class="invoice-meta">
      <h2>${vm.title}</h2>
      <p><strong>${esc(vm.number)}</strong></p>
      ${vm.orderNumber && vm.orderNumber !== vm.number ? `<p>Order: ${esc(vm.orderNumber)}</p>` : ''}
      <p>Date: ${fmtDate(vm.date)}</p>
      <p>Payment: <span class="badge ${vm.paymentStatus === 'paid' ? 'badge-paid' : 'badge-pending'}">${esc(String(vm.paymentStatus || '').toUpperCase())}</span></p>
      ${posName ? `<p>Place of Supply: ${esc(posName)} (${esc(vm.placeOfSupply)})</p>` : ''}
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="section-label">Bill To</div>
      <div class="section-value">
        <strong>${esc(vm.recipient.legalName)}</strong><br/>
        ${esc(vm.recipient.email || '')}<br/>
        ${esc(vm.recipient.phone || '')}
        ${vm.recipient.gstin ? `<br/><strong>GSTIN:</strong> ${esc(vm.recipient.gstin)}` : ''}
      </div>
    </div>
    <div>
      <div class="section-label">Ship To</div>
      <div class="section-value">${esc(vm.shipTo)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>HSN/SAC</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Taxable Value</th>
        <th style="text-align:center">GST %</th>
        ${showSplit ? '<th style="text-align:right">CGST</th><th style="text-align:right">SGST</th><th style="text-align:right">IGST</th>' : ''}
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Taxable Value</span><span>₹${money(vm.totals.taxableValue)}</span></div>
    ${showSplit ? `
    ${vm.totals.cgst ? `<div class="totals-row"><span>CGST</span><span>₹${money(vm.totals.cgst)}</span></div>` : ''}
    ${vm.totals.sgst ? `<div class="totals-row"><span>SGST</span><span>₹${money(vm.totals.sgst)}</span></div>` : ''}
    ${vm.totals.igst ? `<div class="totals-row"><span>IGST</span><span>₹${money(vm.totals.igst)}</span></div>` : ''}`
    : `<div class="totals-row"><span>GST</span><span>₹${money(vm.totals.gstTotal)}</span></div>`}
    ${vm.totals.discount ? `<div class="totals-row"><span>Discount</span><span style="color:#16a34a">−₹${money(vm.totals.discount)}</span></div>` : ''}
    <div class="totals-row"><span>Shipping</span>${vm.totals.shipping ? `<span>₹${money(vm.totals.shipping)}</span>` : '<span style="color:#16a34a">FREE</span>'}</div>
    <div class="totals-row total"><span>Total</span><span>₹${money(vm.totals.grandTotal)}</span></div>
  </div>

  <div class="footer">
    <p>Tax is payable on reverse charge: No</p>
    <p>Thank you for shopping with Macgly · This is a computer-generated invoice</p>
    <p>For support: ${esc(sup.email || 'support@macgly.com')}</p>
  </div>
</body>
</html>`;
}

// ── PDF (same layout and drawing path as before, extra columns only) ──────────

function generateInvoicePDF(source, user) {
  const vm = toViewModel(source, user);
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

    // pdfkit's built-in Helvetica has no rupee glyph.
    const fmt = (n) => 'Rs.' + Number(n || 0).toFixed(2);
    const sup = vm.supplier || {};

    // Header bar
    doc.rect(0, 0, doc.page.width, 80).fill(dark);
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text((sup.tradeName || 'MACGLY').toUpperCase(), 50, 20);
    doc.fillColor(orange).fontSize(8).font('Helvetica').text(sup.legalName || 'Tools & Machinery', 50, 44);
    doc.fillColor('#CCCCCC').fontSize(7).text(joinAddress(sup.address), 50, 55, { width: 260 });
    doc.fillColor('#CCCCCC').fontSize(7).text(sup.gstin ? `GSTIN: ${sup.gstin}` : 'GSTIN not on record', 50, 66);

    doc.fillColor(orange).fontSize(16).font('Helvetica-Bold').text(vm.title, 0, 20, { align: 'right', width: doc.page.width - 50 });
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica').text(`No: ${vm.number}`, 0, 41, { align: 'right', width: doc.page.width - 50 });
    doc.text(`Date: ${new Date(vm.date || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 0, 53, { align: 'right', width: doc.page.width - 50 });
    const posName = stateNameFromCode(vm.placeOfSupply);
    if (posName) doc.text(`Place of Supply: ${posName} (${vm.placeOfSupply})`, 0, 65, { align: 'right', width: doc.page.width - 50 });

    let y = 100;

    // Bill To
    doc.fillColor(dark).fontSize(9).font('Helvetica-Bold').text('BILL TO', 50, y);
    doc.moveTo(50, y + 13).lineTo(180, y + 13).strokeColor(orange).lineWidth(1.5).stroke();
    y += 20;
    const r = vm.recipient || {};
    const ra = r.address || {};
    [r.legalName, ra.line1, ra.line2, [ra.city, ra.state].filter(Boolean).join(', '), ra.pincode,
      r.phone, r.email, r.gstin ? `GSTIN: ${r.gstin}` : null]
      .filter(Boolean).forEach((l) => { doc.fillColor(dark).fontSize(8).font('Helvetica').text(l, 50, y); y += 13; });

    // Payment info — real values, no longer hardcoded
    let ry = 100;
    doc.fillColor(dark).fontSize(9).font('Helvetica-Bold').text('PAYMENT INFO', 360, ry);
    doc.moveTo(360, ry + 13).lineTo(545, ry + 13).strokeColor(orange).lineWidth(1.5).stroke();
    ry += 20;
    [
      ['Payment ID', vm.paymentRef || '—'],
      ['Method', vm.paymentMethod ? String(vm.paymentMethod).toUpperCase() : 'ONLINE'],
      ['Status', String(vm.paymentStatus || '').toUpperCase() || '—'],
    ].forEach(([k, v]) => {
      doc.fillColor(gray).fontSize(8).font('Helvetica').text(k, 360, ry);
      doc.fillColor(dark).text(v, 460, ry, { width: 85, ellipsis: true }); ry += 13;
    });

    y = Math.max(y, ry) + 16;

    // Table header — Item / HSN / Qty / Rate / Taxable / GST% / Total
    const COLS = [['#', 50], ['Item', 68], ['HSN', 230], ['Qty', 288], ['Rate', 320], ['Taxable', 378], ['GST%', 445], ['Total', 490]];
    doc.rect(50, y, 495, 20).fill(dark);
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
    COLS.forEach(([t, x]) => doc.text(t, x, y + 6));
    y += 20;

    vm.lines.forEach((l, i) => {
      const h = 20;
      if (i % 2 === 0) doc.rect(50, y, 495, h).fill(light);
      doc.fillColor(dark).fontSize(8).font('Helvetica');
      doc.text(String(i + 1), 50, y + 6);
      doc.text(l.title || '', 68, y + 6, { width: 155, ellipsis: true });
      doc.text(l.hsn || '-', 230, y + 6, { width: 52, ellipsis: true });
      doc.text(String(l.qty || 1), 288, y + 6);
      doc.text(fmt(l.unitPrice), 320, y + 6);
      doc.text(fmt(l.taxableValue), 378, y + 6);
      doc.text(l.gstRate != null ? `${l.gstRate}%` : '-', 445, y + 6);
      doc.text(fmt(l.total), 490, y + 6);
      y += h;
    });

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 10;

    // Totals — component split when known, single GST line otherwise
    const t = vm.totals;
    const showSplit = t.cgst > 0 || t.sgst > 0 || t.igst > 0;
    const rows = [['Taxable Value', fmt(t.taxableValue)]];
    if (showSplit) {
      if (t.cgst) rows.push(['CGST', fmt(t.cgst)]);
      if (t.sgst) rows.push(['SGST', fmt(t.sgst)]);
      if (t.igst) rows.push(['IGST', fmt(t.igst)]);
    } else {
      rows.push(['GST', fmt(t.gstTotal)]);
    }
    if (t.discount > 0) rows.push(['Discount', `-${fmt(t.discount)}`]);
    if (t.shipping > 0) rows.push(['Shipping', fmt(t.shipping)]);

    rows.forEach(([k, v]) => {
      doc.fillColor(gray).fontSize(9).font('Helvetica').text(k, 355, y);
      doc.fillColor(dark).text(v, 490, y, { align: 'right', width: 55 }); y += 15;
    });
    y += 4;
    doc.rect(348, y, 197, 22).fill(dark);
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
      .text('TOTAL', 358, y + 6).text(fmt(t.grandTotal), 490, y + 6, { align: 'right', width: 55 });
    y += 32;

    doc.fillColor(gray).fontSize(8).font('Helvetica')
      .text('Tax is payable on reverse charge: No', 50, y, { align: 'center', width: 495 });
    doc.text('This is a computer-generated invoice and does not require a signature.', 50, y + 12, { align: 'center', width: 495 });
    doc.fillColor(orange).fontSize(8).text('Thank you for shopping with Macgly!', 50, y + 25, { align: 'center', width: 495 });

    doc.end();
  });
}

module.exports = { generateInvoiceHTML, generateInvoicePDF, toViewModel };
