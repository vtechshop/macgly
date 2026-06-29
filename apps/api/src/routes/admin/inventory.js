const router   = require('express').Router();
const Product  = require('../../models/Product');
const Order    = require('../../models/Order');
const User     = require('../../models/User');
const AppError = require('../../utils/AppError');
const StockAlert          = require('../../models/StockAlert');
const emailService        = require('../../services/emailService');
const notificationHelper  = require('../../utils/notificationHelper');

// ── helpers ──────────────────────────────────────────────────────────────────

function stockStatusFilter(stockStatus) {
  switch (stockStatus) {
    case 'out':        return { $expr: { $eq: ['$stock', 0] } };
    case 'low':        return { $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', 10] }] }] } };
    case 'healthy':    return { $expr: { $and: [{ $gt: ['$stock', { $ifNull: ['$lowStockThreshold', 10] }] }, { $lte: ['$stock', { $multiply: [{ $ifNull: ['$lowStockThreshold', 10] }, 5] }] }] } };
    case 'overstocked':return { $expr: { $gt: ['$stock', { $multiply: [{ $ifNull: ['$lowStockThreshold', 10] }, 5] }] } };
    default:           return {};
  }
}

async function getReservedAndSales(productIds) {
  if (!productIds.length) return { reservedMap: {}, salesMap: {} };
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [reservedData, salesData] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $in: ['pending', 'confirmed', 'processing', 'shipped'] } } },
      { $unwind: '$items' },
      { $match: { 'items.product': { $in: productIds } } },
      { $group: { _id: '$items.product', reserved: { $sum: '$items.quantity' } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $nin: ['cancelled'] } } },
      { $unwind: '$items' },
      { $match: { 'items.product': { $in: productIds } } },
      { $group: { _id: '$items.product', totalSold: { $sum: '$items.quantity' } } },
    ]),
  ]);

  const reservedMap = {};
  reservedData.forEach(({ _id, reserved }) => { reservedMap[_id.toString()] = reserved; });
  const salesMap = {};
  salesData.forEach(({ _id, totalSold }) => { salesMap[_id.toString()] = totalSold; });

  return { reservedMap, salesMap };
}

// ── GET /admin/inventory/stats ────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const base = { published: true };
    const [totalSKUs, outOfStock, lowStock, overstocked, healthyStock] = await Promise.all([
      Product.countDocuments(base),
      Product.countDocuments({ ...base, stock: 0 }),
      Product.countDocuments({ ...base, $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', 10] }] }] } }),
      Product.countDocuments({ ...base, $expr: { $gt: ['$stock', { $multiply: [{ $ifNull: ['$lowStockThreshold', 10] }, 5] }] } }),
      Product.countDocuments({ ...base, $expr: { $and: [{ $gt: ['$stock', { $ifNull: ['$lowStockThreshold', 10] }] }, { $lte: ['$stock', { $multiply: [{ $ifNull: ['$lowStockThreshold', 10] }, 5] }] }] } }),
    ]);
    res.json({ success: true, totalSKUs, outOfStock, lowStock, overstocked, healthyStock });
  } catch (err) { next(err); }
});

// ── GET /admin/inventory/export ───────────────────────────────────────────────
router.get('/export', async (req, res, next) => {
  try {
    const { stockStatus, vendorId, categoryId, search } = req.query;
    const filter = { published: true };
    if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    if (vendorId) filter.vendorId = vendorId;
    if (categoryId) filter.categoryIds = categoryId;
    if (stockStatus) Object.assign(filter, stockStatusFilter(stockStatus));

    const products = await Product.find(filter)
      .select('title sku stock lowStockThreshold price category vendorId images')
      .populate('vendorId', 'name email')
      .sort({ stock: 1 })
      .lean();

    const date = new Date().toISOString().split('T')[0];
    const header = 'Product Name,SKU,Vendor,Category,Current Stock,Threshold,Status,Price\n';
    const rows = products.map((p) => {
      const threshold = p.lowStockThreshold ?? 10;
      let status = 'Healthy';
      if (p.stock === 0) status = 'Out of Stock';
      else if (p.stock <= threshold) status = 'Low Stock';
      else if (p.stock > threshold * 5) status = 'Overstocked';
      const vendor = p.vendorId?.name || 'Admin';
      return [
        `"${(p.title || '').replace(/"/g, '""')}"`,
        p.sku || '',
        `"${vendor}"`,
        p.category || '',
        p.stock,
        threshold,
        status,
        p.price,
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-${date}.csv"`);
    res.send(header + rows);
  } catch (err) { next(err); }
});

// ── GET /admin/inventory ──────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, stockStatus, vendorId, categoryId, search } = req.query;
    const filter = { published: true };
    if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    if (vendorId) filter.vendorId = vendorId;
    if (categoryId) filter.categoryIds = categoryId;
    if (stockStatus) Object.assign(filter, stockStatusFilter(stockStatus));

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('title sku stock lowStockThreshold images price categoryIds vendorId')
        .populate('vendorId', 'name email storeName')
        .populate('categoryIds', 'name')
        .sort({ stock: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter),
    ]);

    const productIds = products.map((p) => p._id);
    const { reservedMap, salesMap } = await getReservedAndSales(productIds);

    const data = products.map((p) => {
      const id = p._id.toString();
      const threshold = p.lowStockThreshold ?? 10;
      const reserved = reservedMap[id] ?? 0;
      const available = Math.max(0, p.stock - reserved);
      const totalSold = salesMap[id] ?? 0;
      const avgDailySales = totalSold / 30;
      const daysOfSupply = p.stock === 0 ? 0 : avgDailySales > 0 ? Math.floor(p.stock / avgDailySales) : 999;

      let status = 'healthy';
      if (p.stock === 0) status = 'out';
      else if (p.stock <= threshold) status = 'low';
      else if (p.stock > threshold * 5) status = 'overstocked';

      return { ...p, reserved, available, daysOfSupply, status };
    });

    // Alerts
    const alerts = [];
    const outCount = data.filter((p) => p.status === 'out').length;
    const lowCount = data.filter((p) => p.status === 'low').length;
    if (outCount) alerts.push({ type: 'critical', message: `${outCount} product${outCount > 1 ? 's are' : ' is'} out of stock` });
    if (lowCount) alerts.push({ type: 'warning', message: `${lowCount} product${lowCount > 1 ? 's need' : ' needs'} restocking` });

    res.json({
      success: true,
      data,
      alerts,
      meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

// ── PUT /admin/inventory/:productId/stock ─────────────────────────────────────
router.put('/:productId/stock', async (req, res, next) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock === null || stock < 0) throw new AppError('Valid stock value required (>= 0)', 400, 'INVALID_STOCK');
    const product = await Product.findById(req.params.productId).select('title sku stock');
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    const previousStock = product.stock;
    product.stock = parseInt(stock);
    await product.save();

    // Fire back-in-stock emails if stock went from 0 to >0
    if (previousStock === 0 && product.stock > 0) {
      const alerts = await StockAlert.find({ productId: product._id, notifiedAt: null }).lean();
      if (alerts.length > 0) {
        const notifiedAt = new Date();
        await StockAlert.updateMany({ productId: product._id, notifiedAt: null }, { $set: { notifiedAt } });
        Promise.all(alerts.map((a) =>
          emailService.sendBackInStockEmail({ email: a.email, product }).catch(() => {})
        )).catch(() => {});
      }
    }

    res.json({ success: true, productId: product._id, title: product.title, previousStock, newStock: product.stock });
  } catch (err) { next(err); }
});

// ── POST /admin/inventory/:productId/restock-reminder ─────────────────────────
router.post('/:productId/restock-reminder', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId)
      .select('title sku stock lowStockThreshold vendorId')
      .populate('vendorId', 'name email')
      .lean();
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

    const vendor = product.vendorId;
    if (!vendor?._id) throw new AppError('No vendor assigned to this product', 400, 'NO_VENDOR');

    const threshold   = product.lowStockThreshold ?? 10;
    // Use custom message from frontend if provided, else auto-generate
    const customMsg   = req.body?.message?.trim();
    const notifMsg    = customMsg
      || `Your product "${product.title}" (SKU: ${product.sku || 'N/A'}) has only ${product.stock} unit(s) left. Threshold is ${threshold}. Please restock soon.`;
    const notifTitle  = product.stock <= threshold
      ? `Low Stock Alert: ${product.title}`
      : `Stock Message: ${product.title}`;

    // In-app notification to vendor
    await notificationHelper.createNotification({
      userId:  vendor._id,
      type:    'product',
      title:   notifTitle,
      message: notifMsg,
      data:    { productId: product._id, currentStock: product.stock, threshold, sku: product.sku },
      link:    '/dashboard/vendor/products',
    });

    // Email notification (fails silently if no MAILERSEND key)
    if (vendor.email) {
      await emailService.sendEmail({
        to:      vendor.email,
        subject: notifTitle,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto">
            <h2 style="color:#1a1a1a">📦 ${notifTitle}</h2>
            <p style="color:#444">${notifMsg.replace(/\n/g, '<br>')}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
            <p style="color:#999;font-size:12px">— Macgly Admin · <a href="https://macgly.com/dashboard/vendor/products">View Products Dashboard</a></p>
          </div>
        `,
      }).catch((e) => console.error('[Inventory] Email error:', e.message));
    }

    res.json({ success: true, message: `Message sent to ${vendor.name || 'vendor'}` });
  } catch (err) { next(err); }
});

module.exports = router;
