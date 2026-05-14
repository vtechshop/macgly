const Product = require('../models/Product');
const User = require('../models/User');
const { sendEmail } = require('./emailService');
const notificationService = require('./notificationService');

const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD) || 5;

async function checkAndAlert() {
  const lowStockProducts = await Product.find({
    published: true,
    stock: { $lte: LOW_STOCK_THRESHOLD, $gte: 0 },
  }).select('title sku stock vendorId').limit(100);

  if (!lowStockProducts.length) return 0;

  // Group by vendorId
  const byVendor = {};
  lowStockProducts.forEach((p) => {
    const vid = p.vendorId?.toString() || 'admin';
    if (!byVendor[vid]) byVendor[vid] = [];
    byVendor[vid].push(p);
  });

  let alerted = 0;
  for (const [vendorId, products] of Object.entries(byVendor)) {
    // Notify vendor
    if (vendorId !== 'admin') {
      const vendor = await User.findById(vendorId).select('email name');
      if (vendor) {
        const list = products.map((p) => `<li>${p.title} (SKU: ${p.sku || 'N/A'}) — <strong>${p.stock} left</strong></li>`).join('');
        await sendEmail({
          to: vendor.email,
          subject: `Low stock alert — ${products.length} product${products.length > 1 ? 's' : ''} running low`,
          html: `<h3>Low Stock Alert</h3><p>The following products are running low:</p><ul>${list}</ul><p>Please restock to avoid losing sales.</p>`,
        }).catch(() => {});
        await notificationService.create(vendor._id, {
          title: 'Low Stock Alert',
          message: `${products.length} product${products.length > 1 ? 's are' : ' is'} low on stock.`,
          type: 'system',
          link: '/dashboard/vendor/inventory',
        });
        alerted += products.length;
      }
    }
  }

  // Notify admin for all low stock
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const list = lowStockProducts.map((p) => `<li>${p.title} — <strong>${p.stock} left</strong></li>`).join('');
    await sendEmail({
      to: adminEmail,
      subject: `[Macgly] ${lowStockProducts.length} products low on stock`,
      html: `<h3>Low Stock Report</h3><ul>${list}</ul>`,
    }).catch(() => {});
  }

  return alerted;
}

module.exports = { checkAndAlert, LOW_STOCK_THRESHOLD };
