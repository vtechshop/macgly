const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const Product  = require('../models/Product');
const Order    = require('../models/Order');
const Category = require('../models/Category');
const AppError = require('../utils/AppError');
const { slugify, generateSKU } = require('../utils/helpers');
const { invalidateCache } = require('../middleware/cache');
const { uploadFile } = require('../services/storageService');
const notif = require('../utils/notificationHelper');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new AppError('Only images allowed', 400, 'INVALID_FILE'));
  },
});

router.use(authenticate);

// POST /vendors/onboard — accessible to any authenticated user (customer/affiliate → becomes vendor)
router.post('/onboard', async (req, res, next) => {
  try {
    const User = require('../models/User');
    if (req.user.role === 'vendor') {
      return res.status(400).json({ error: { code: 'ALREADY_VENDOR', message: 'You are already a vendor' } });
    }

    const { storeName, description, kyc = {}, bank = {} } = req.body;
    if (!storeName?.trim()) {
      return res.status(400).json({ error: { message: 'Store name is required' } });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        role: 'vendor',
        $set: {
          'vendorProfile.storeName':          storeName.trim(),
          'vendorProfile.storeDescription':   description?.trim() || '',
          'vendorProfile.businessName':       kyc.businessName?.trim() || storeName.trim(),
          'vendorProfile.businessType':       kyc.businessType || 'sole_proprietorship',
          'vendorProfile.gstin':              kyc.taxId?.trim().toUpperCase() || '',
          'vendorProfile.bankAccount':        bank.accountNumber?.trim() || '',
          'vendorProfile.bankName':           bank.bankName?.trim() || '',
          'vendorProfile.accountHolderName':  bank.accountName?.trim() || '',
          'vendorProfile.ifsc':               bank.ifscCode?.trim().toUpperCase() || '',
          'vendorProfile.kycStatus':          'pending',
          'vendorProfile.approved':           false,
          'vendorProfile.onboardingComplete': true,
        },
      },
      { new: true },
    );

    notif.notifyAdminNewVendor({
      vendor: updated.vendorProfile,
      userEmail: updated.email,
    }).catch(() => {});

    res.json({ success: true, user: updated.toSafeObject ? updated.toSafeObject() : updated });
  } catch (err) { next(err); }
});

router.use(authorize(['vendor', 'admin']));

function requireApprovedKYC(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.user.vendorProfile?.kycStatus !== 'approved') {
    return res.status(403).json({
      error: {
        code: 'KYC_NOT_APPROVED',
        message: 'Complete KYC verification to access this feature',
        kycStatus: req.user.vendorProfile?.kycStatus || 'not_submitted',
      },
    });
  }
  next();
}

function requireApproved(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (!req.user.vendorProfile?.approved) {
    return res.status(403).json({ error: { message: 'Your vendor account is pending approval', code: 'VENDOR_NOT_APPROVED' } });
  }
  next();
}

router.get('/profile', (req, res) => res.json({ vendor: req.user }));

router.put('/profile', async (req, res, next) => {
  try {
    const { businessName, businessPhone, gstin, accountHolderName, bankAccount, ifsc, panCard } = req.body;
    if (!businessName?.trim()) return res.status(400).json({ error: { message: 'Business name is required' } });
    if (!businessPhone?.trim()) return res.status(400).json({ error: { message: 'Business phone is required' } });
    if (!panCard?.trim()) return res.status(400).json({ error: { message: 'PAN card is required' } });
    if (!accountHolderName?.trim()) return res.status(400).json({ error: { message: 'Account holder name is required' } });
    if (!bankAccount?.trim()) return res.status(400).json({ error: { message: 'Bank account number is required' } });
    if (!ifsc?.trim()) return res.status(400).json({ error: { message: 'IFSC code is required' } });

    const update = {
      'vendorProfile.businessName': businessName.trim(),
      'vendorProfile.businessPhone': businessPhone.trim(),
      'vendorProfile.gstin': gstin?.trim() || '',
      'vendorProfile.accountHolderName': accountHolderName.trim(),
      'vendorProfile.bankAccount': bankAccount.trim(),
      'vendorProfile.ifsc': ifsc.toUpperCase().trim(),
      'vendorProfile.panCard': panCard.toUpperCase().trim(),
      'vendorProfile.onboardingComplete': true,
    };

    const wasComplete = req.user.vendorProfile?.onboardingComplete;
    const updated = await require('../models/User').findByIdAndUpdate(req.user._id, update, { new: true });

    // Notify admins on first-time onboarding submission
    if (!wasComplete) {
      notif.notifyAdminNewVendor({
        vendor:    updated.vendorProfile,
        userEmail: updated.email,
      }).catch(() => {});
    }

    res.json({ vendor: updated.toSafeObject() });
  } catch (err) { next(err); }
});

// ─── Vendor Settings ──────────────────────────────────────────────────────────

router.get('/settings', async (req, res, next) => {
  try {
    const vp = req.user.vendorProfile || {};
    const orders = await Order.find({ 'items.vendorId': req.user._id });
    let pendingEarnings = 0;
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.vendorId?.toString() !== req.user._id.toString()) return;
        if (!['delivered', 'cancelled', 'returned'].includes(order.status)) {
          pendingEarnings += item.vendorEarning || 0;
        }
      });
    });
    res.json({
      user:   { name: req.user.name, email: req.user.email, phone: req.user.phone },
      vendor: {
        storeName:          vp.storeName          || '',
        storeDescription:   vp.storeDescription   || '',
        logo:               vp.logo               || '',
        slug:               vp.slug               || '',
        status:             vp.approved ? 'active' : (vp.kycStatus === 'rejected' ? 'suspended' : 'pending'),
        bankAccount:        vp.bankAccount         || '',
        bankName:           vp.bankName            || '',
        accountHolderName:  vp.accountHolderName   || '',
        ifsc:               vp.ifsc               || '',
        swiftCode:          vp.swiftCode           || '',
        upiId:              vp.upiId              || '',
        panCard:            vp.panCard             || '',
        returnPolicy:       vp.returnPolicy        || '',
        shippingPolicy:     vp.shippingPolicy      || '',
        commissionRate:     vp.commissionRate      ?? 10,
        totalEarnings:      vp.totalEarnings        || 0,
        pendingEarnings:    parseFloat(pendingEarnings.toFixed(2)),
        kycStatus:          vp.kycStatus           || 'not_submitted',
        approved:           vp.approved            || false,
      },
    });
  } catch (err) { next(err); }
});

router.put('/settings/profile', async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { storeName, storeDescription, logo } = req.body;
    const update = {};
    if (storeName?.trim()) {
      update['vendorProfile.storeName'] = storeName.trim();
      update['vendorProfile.slug']      = slugify(storeName.trim());
    }
    if (storeDescription !== undefined) update['vendorProfile.storeDescription'] = storeDescription;
    if (logo            !== undefined) update['vendorProfile.logo']             = logo;
    await User.findByIdAndUpdate(req.user._id, update);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/settings/bank', async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { accountHolderName, bankName, bankAccount, ifsc, swiftCode, upiId, panCard } = req.body;
    const update = {};
    if (accountHolderName !== undefined) update['vendorProfile.accountHolderName'] = accountHolderName.trim();
    if (bankName          !== undefined) update['vendorProfile.bankName']           = bankName.trim();
    if (bankAccount       !== undefined) update['vendorProfile.bankAccount']        = bankAccount.trim();
    if (ifsc              !== undefined) update['vendorProfile.ifsc']               = ifsc.toUpperCase().trim();
    if (swiftCode         !== undefined) update['vendorProfile.swiftCode']          = swiftCode.toUpperCase().trim();
    if (upiId             !== undefined) update['vendorProfile.upiId']             = upiId.trim();
    if (panCard           !== undefined) update['vendorProfile.panCard']            = panCard.toUpperCase().trim();
    await User.findByIdAndUpdate(req.user._id, update);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/settings/policies', async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { returnPolicy, shippingPolicy } = req.body;
    const update = {};
    if (returnPolicy   !== undefined) update['vendorProfile.returnPolicy']   = returnPolicy;
    if (shippingPolicy !== undefined) update['vendorProfile.shippingPolicy'] = shippingPolicy;
    await User.findByIdAndUpdate(req.user._id, update);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/settings/payout', async (req, res, next) => {
  res.json({ success: true });
});

router.get('/stats', requireApproved, async (req, res, next) => {
  try {
    const vendorId = req.user._id;
    const orders = await Order.find({ 'items.vendorId': vendorId });

    let pendingEarnings = 0;
    let totalRevenue = 0;

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.vendorId?.toString() !== vendorId.toString()) return;
        const itemTotal = item.price * item.quantity;
        totalRevenue += itemTotal;
        if (!['delivered', 'cancelled', 'returned'].includes(order.status)) {
          pendingEarnings += item.vendorEarning || 0;
        }
      });
    });

    res.json({
      commissionRate: req.user.vendorProfile?.commissionRate ?? 10,
      confirmedEarnings: parseFloat((req.user.vendorProfile?.totalEarnings || 0).toFixed(2)),
      pendingEarnings: parseFloat(pendingEarnings.toFixed(2)),
      grossRevenue: parseFloat(totalRevenue.toFixed(2)),
    });
  } catch (err) { next(err); }
});

router.post('/upload/image', requireApproved, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('Image required', 400, 'MISSING_FILE');
    const result = await uploadFile(req.file, req.query.folder || 'products');
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /vendors/products/stats — MUST be before /products/:id ────────────────
router.get('/products/stats', requireApproved, async (req, res, next) => {
  try {
    const vendorId = req.user._id;
    const [total, published, outOfStock, lowStock, invAgg] = await Promise.all([
      Product.countDocuments({ vendorId }),
      Product.countDocuments({ vendorId, published: true }),
      Product.countDocuments({ vendorId, stock: 0 }),
      Product.countDocuments({ vendorId, stock: { $gt: 0, $lte: 10 } }),
      Product.aggregate([
        { $match: { vendorId } },
        { $group: { _id: null, value: { $sum: { $multiply: ['$price', '$stock'] } } } },
      ]),
    ]);
    res.json({
      total, published,
      draft: total - published,
      lowStock, outOfStock,
      inventoryValue: Math.round((invAgg[0]?.value || 0) * 100) / 100,
    });
  } catch (err) { next(err); }
});

// ── GET /vendors/products/export — CSV download ───────────────────────────────
router.get('/products/export', requireApproved, async (req, res, next) => {
  try {
    const products = await Product.find({ vendorId: req.user._id }).sort({ createdAt: -1 }).lean();
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Title', 'SKU', 'Brand', 'Price', 'Compare At', 'Stock', 'Status', 'Category', 'Tags', 'HSN', 'Published'];
    const rows = products.map((p) => [
      p.title, p.sku || '', p.brand || '',
      p.price, p.compareAt || '', p.stock,
      p.published ? 'Published' : 'Draft',
      p.category || '',
      (p.tags || []).join(';'),
      p.hsnCode || '',
      new Date(p.createdAt).toLocaleDateString('en-IN'),
    ].map(esc).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.send([headers.map(esc).join(','), ...rows].join('\n'));
  } catch (err) { next(err); }
});

// Products — vendor sees only their own
router.get('/products', requireApproved, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const skip = (parseInt(page) - 1) * safeLimit;
    const filter = { vendorId: req.user._id };
    if (search?.trim()) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: re }, { sku: re }, { brand: re }];
    }
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      Product.countDocuments(filter),
    ]);
    res.json({ products, pagination: { page: parseInt(page), limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } });
  } catch (err) { next(err); }
});

router.post('/products', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const data = { ...req.body, vendorId: req.user._id };
    if (!data.slug) data.slug = slugify(data.title || '');
    if (!data.sku) data.sku = generateSKU('VND');
    const product = await Product.create(data);
    await invalidateCache('cache:/api/catalog*');

    // Notify admins of new product submission
    notif.notifyAdminNewProduct({
      product,
      vendorName: req.user.vendorProfile?.businessName || req.user.name,
    }).catch(() => {});

    res.status(201).json({ product });
  } catch (err) { next(err); }
});

router.put('/products/:id', requireApproved, async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    await invalidateCache('cache:/api/catalog*');
    res.json({ product });
  } catch (err) { next(err); }
});

router.delete('/products/:id', requireApproved, async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, vendorId: req.user._id });
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    await invalidateCache('cache:/api/catalog*');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /vendors/products/bulk-delete ────────────────────────────────────────
router.post('/products/bulk-delete', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const { productIds = [] } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0 || productIds.length > 50) {
      throw new AppError('Provide between 1 and 50 product IDs', 400, 'INVALID_INPUT');
    }
    const { deletedCount } = await Product.deleteMany({ _id: { $in: productIds }, vendorId: req.user._id });
    await invalidateCache('cache:/api/catalog*');
    res.json({ ok: true, deleted: deletedCount });
  } catch (err) { next(err); }
});

// ── POST /vendors/products/bulk-price-update ──────────────────────────────────
router.post('/products/bulk-price-update', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const { productIds = [], percentageChange } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0 || productIds.length > 100) {
      throw new AppError('Provide between 1 and 100 product IDs', 400, 'INVALID_INPUT');
    }
    const pct = parseFloat(percentageChange);
    if (isNaN(pct) || pct < -99 || pct > 1000) throw new AppError('Invalid percentage', 400, 'INVALID_INPUT');
    const multiplier = 1 + pct / 100;
    const result = await Product.updateMany(
      { _id: { $in: productIds }, vendorId: req.user._id },
      [{ $set: { price: { $max: [1, { $round: [{ $multiply: ['$price', multiplier] }, 2] }] } } }],
    );
    await invalidateCache('cache:/api/catalog*');
    res.json({ ok: true, updated: result.modifiedCount });
  } catch (err) { next(err); }
});

// Orders — vendor sees orders containing their products
// ─── Dashboard Stats ──────────────────────────────────────────────────────────

router.get('/dashboard/stats', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const vendorId = req.user._id;
    const { period = '30days' } = req.query;
    const now = new Date();

    // Current period start date
    let startDate;
    if (period === 'today') {
      startDate = new Date(now); startDate.setHours(0, 0, 0, 0);
    } else if (period === '7days') {
      startDate = new Date(now.getTime() - 7 * 86400000);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getTime() - 30 * 86400000);
    }

    const periodLength = now - startDate;
    const prevStart = new Date(startDate.getTime() - periodLength);

    const [
      totalProducts,
      activeProducts,
      lowStockProducts,
      currentOrders,
      prevOrders,
      pendingOrders,
    ] = await Promise.all([
      Product.countDocuments({ vendorId }),
      Product.countDocuments({ vendorId, published: true }),
      Product.countDocuments({ vendorId, stock: { $lte: 5, $gt: 0 } }),
      Order.find({ 'items.vendorId': vendorId, createdAt: { $gte: startDate } }).lean(),
      Order.find({ 'items.vendorId': vendorId, createdAt: { $gte: prevStart, $lt: startDate } }).lean(),
      Order.countDocuments({ 'items.vendorId': vendorId, status: { $in: ['pending', 'placed', 'confirmed'] } }),
    ]);

    function vendorTotals(orders) {
      let sales = 0; let earnings = 0;
      orders.forEach((order) => {
        order.items.forEach((item) => {
          if (item.vendorId?.toString() !== vendorId.toString()) return;
          sales += (item.price || 0) * (item.quantity || 1);
          earnings += item.vendorEarning || 0;
        });
      });
      return { sales: Math.round(sales * 100) / 100, earnings: Math.round(earnings * 100) / 100 };
    }

    const curr = vendorTotals(currentOrders);
    const prev = vendorTotals(prevOrders);

    // Build chart data
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let salesChart;

    if (period === 'today') {
      const hourMap = {};
      for (let h = 0; h < 24; h += 3) hourMap[`${h}:00`] = 0;
      currentOrders.forEach((order) => {
        const h = new Date(order.createdAt).getHours();
        const bucket = `${Math.floor(h / 3) * 3}:00`;
        if (hourMap[bucket] !== undefined) {
          order.items.forEach((item) => {
            if (item.vendorId?.toString() === vendorId.toString()) {
              hourMap[bucket] += (item.price || 0) * (item.quantity || 1);
            }
          });
        }
      });
      salesChart = Object.entries(hourMap).map(([name, sales]) => ({ name, sales: Math.round(sales) }));
    } else if (period === '7days') {
      const dayMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        dayMap[DAY_NAMES[d.getDay()]] = 0;
      }
      currentOrders.forEach((order) => {
        const key = DAY_NAMES[new Date(order.createdAt).getDay()];
        if (dayMap[key] !== undefined) {
          order.items.forEach((item) => {
            if (item.vendorId?.toString() === vendorId.toString()) {
              dayMap[key] += (item.price || 0) * (item.quantity || 1);
            }
          });
        }
      });
      salesChart = Object.entries(dayMap).map(([name, sales]) => ({ name, sales: Math.round(sales) }));
    } else {
      const daysInPeriod = period === 'month'
        ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        : 30;
      const dayMap = {};
      for (let i = 1; i <= daysInPeriod; i++) dayMap[String(i)] = 0;
      currentOrders.forEach((order) => {
        const key = String(new Date(order.createdAt).getDate());
        if (dayMap[key] !== undefined) {
          order.items.forEach((item) => {
            if (item.vendorId?.toString() === vendorId.toString()) {
              dayMap[key] += (item.price || 0) * (item.quantity || 1);
            }
          });
        }
      });
      salesChart = Object.entries(dayMap).map(([name, sales]) => ({ name, sales: Math.round(sales) }));
    }

    res.json({
      success: true,
      data: {
        totalProducts,
        activeProducts,
        lowStockProducts,
        totalOrders: currentOrders.length,
        pendingOrders,
        totalSales: curr.sales,
        totalEarnings: curr.earnings,
        pendingReviews: 0,
        previousPeriod: {
          totalProducts,
          totalOrders: prevOrders.length,
          totalSales: prev.sales,
          totalEarnings: prev.earnings,
        },
        salesChart,
      },
    });
  } catch (err) { next(err); }
});

// GET /vendors/orders/counts — MUST be before /orders/:id
router.get('/orders/counts', requireApproved, async (req, res, next) => {
  try {
    const vendorId = req.user._id;
    const base = { 'items.vendorId': vendorId };
    const [total, paid, packed, shipped, out_for_delivery, delivered, cancelled] = await Promise.all([
      Order.countDocuments(base),
      Order.countDocuments({ ...base, status: 'paid' }),
      Order.countDocuments({ ...base, status: 'packed' }),
      Order.countDocuments({ ...base, status: 'shipped' }),
      Order.countDocuments({ ...base, status: 'out_for_delivery' }),
      Order.countDocuments({ ...base, status: 'delivered' }),
      Order.countDocuments({ ...base, status: 'cancelled' }),
    ]);
    res.json({ success: true, data: { total, paid, packed, shipped, out_for_delivery, delivered, cancelled } });
  } catch (err) { next(err); }
});

router.get('/orders', requireApproved, async (req, res, next) => {
  try {
    const { page = 1, limit = 15, status, search } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 15, 50);
    const skip = (parseInt(page) - 1) * safeLimit;
    const filter = { 'items.vendorId': req.user._id };
    if (status) filter.status = status;
    if (search) filter.orderId = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).populate('user', 'name email phone'),
      Order.countDocuments(filter),
    ]);
    // Filter items to only this vendor's items
    const enriched = orders.map((o) => ({
      ...o.toObject(),
      items: o.items.filter((i) => i.vendorId?.toString() === req.user._id.toString()),
    }));
    res.json({ orders: enriched, pagination: { page: parseInt(page), limit: safeLimit, total, pages: Math.ceil(total / safeLimit) } });
  } catch (err) { next(err); }
});

router.get('/orders/:id', requireApproved, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, 'items.vendorId': req.user._id })
      .populate('user', 'name email phone');
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    // Filter items to only this vendor's items
    const vendorItems = order.items.filter((i) => i.vendorId?.toString() === req.user._id.toString());
    res.json({ order: { ...order.toObject(), items: vendorItems } });
  } catch (err) { next(err); }
});

// PUT /vendors/orders/:id/status — sequential forward-only status update
router.put('/orders/:id/status', requireApproved, async (req, res, next) => {
  try {
    const { status } = req.body;
    const ALLOWED = ['packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!ALLOWED.includes(status)) {
      throw new AppError(`Invalid status. Allowed: ${ALLOWED.join(', ')}`, 400, 'INVALID_STATUS');
    }
    const order = await Order.findOne({ _id: req.params.id, 'items.vendorId': req.user._id });
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');

    if (status === 'shipped') {
      if (!order.tracking?.carrier || !order.tracking?.trackingId) {
        throw new AppError('Assign a courier and tracking ID before marking as shipped', 400, 'CARRIER_NOT_ASSIGNED');
      }
    }

    order.status = status;
    if (status === 'delivered') order.deliveredAt = new Date();
    if (status === 'cancelled') order.cancellation = { reason: 'Cancelled by vendor', cancelledAt: new Date(), cancelledBy: req.user._id };
    order.tracking = order.tracking || {};
    order.tracking.history = order.tracking.history || [];
    order.tracking.history.push({ status, timestamp: new Date(), description: `Status updated to ${status}` });

    await order.save();
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// Vendor: can only mark as shipped
router.patch('/orders/:id/ship', requireApproved, async (req, res, next) => {
  try {
    const { carrier, trackingId, trackingUrl } = req.body;
    const order = await Order.findOne({ _id: req.params.id, 'items.vendorId': req.user._id });
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (!['confirmed', 'processing'].includes(order.status)) {
      throw new AppError('Can only ship confirmed or processing orders', 400, 'INVALID_STATUS');
    }
    const historyEntry = { status: 'shipped', timestamp: new Date(), description: `Shipped via ${carrier || 'courier'}` };
    await Order.findByIdAndUpdate(order._id, {
      status: 'shipped',
      'tracking.carrier': carrier,
      'tracking.trackingId': trackingId,
      'tracking.url': trackingUrl,
      $push: { 'tracking.history': historyEntry },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Inventory routes — MUST put /stats before /:id ───────────────────────────

router.get('/inventory/stats', requireApproved, async (req, res, next) => {
  try {
    const products = await Product.find({ vendorId: req.user._id })
      .select('stock lowStockThreshold price').lean();
    const totalProducts  = products.length;
    const outOfStock     = products.filter((p) => p.stock === 0).length;
    const lowStock       = products.filter((p) => p.stock > 0 && p.stock <= (p.lowStockThreshold || 10)).length;
    const totalUnits     = products.reduce((s, p) => s + (p.stock || 0), 0);
    const inventoryValue = products.reduce((s, p) => s + ((p.price || 0) * (p.stock || 0)), 0);
    res.json({ success: true, data: { totalProducts, outOfStock, lowStock, totalUnits, inventoryValue: Math.round(inventoryValue * 100) / 100, needsAttention: outOfStock + lowStock } });
  } catch (err) { next(err); }
});

// Vendor inventory — their products only
router.get('/inventory', requireApproved, async (req, res, next) => {
  try {
    const { search, lowStock, page = 1, limit = 50 } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 50, 100);
    const filter = { vendorId: req.user._id };
    if (lowStock === 'true') filter.stock = { $lte: 10 };
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: re }, { sku: re }];
    }
    const skip = (parseInt(page) - 1) * safeLimit;
    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('title sku stock lowStockThreshold images price')
        .sort({ stock: 1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Product.countDocuments(filter),
    ]);
    res.json({ products, pagination: { page: parseInt(page), total, pages: Math.ceil(total / safeLimit) } });
  } catch (err) { next(err); }
});

// PUT /vendors/inventory/:id — stock update (frontend uses PUT)
router.put('/inventory/:id', requireApproved, async (req, res, next) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) throw new AppError('Valid stock required', 400, 'INVALID_STOCK');
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      { stock: parseInt(stock) },
      { new: true }
    ).select('title sku stock lowStockThreshold');
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
});

router.patch('/inventory/:id/stock', requireApproved, async (req, res, next) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) throw new AppError('Valid stock required', 400, 'INVALID_STOCK');
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      { stock: parseInt(stock) },
      { new: true }
    ).select('title sku stock');
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    res.json({ product });
  } catch (err) { next(err); }
});

// ── Settlement routes — MUST put /stats + /export before /:id ────────────────

router.get('/settlements/stats', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const Commission = require('../models/Commission');
    const base = { user: req.user._id, type: 'vendor' };
    const [byStatus, lifetime] = await Promise.all([
      Commission.aggregate([
        { $match: base },
        { $group: { _id: '$status', total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } },
      ]),
      Commission.aggregate([
        { $match: base },
        { $group: { _id: null, totalEarnings: { $sum: '$commissionAmount' }, totalTransactions: { $sum: 1 }, avgEarningsPerOrder: { $avg: '$commissionAmount' } } },
      ]),
    ]);
    const s = {};
    byStatus.forEach(({ _id, total, count }) => { s[_id] = { total: Math.round(total * 100) / 100, count }; });
    const lf = lifetime[0] || {};
    res.json({
      success: true,
      data: {
        pending:          s.pending   || { total: 0, count: 0 },
        approved:         s.approved  || { total: 0, count: 0 },
        paid:             s.paid      || { total: 0, count: 0 },
        cancelled:        s.cancelled || { total: 0, count: 0 },
        availableBalance: Math.round((s.approved?.total || 0) * 100) / 100,
        lifetime: {
          totalEarnings:       Math.round((lf.totalEarnings || 0) * 100) / 100,
          totalTransactions:   lf.totalTransactions || 0,
          avgEarningsPerOrder: Math.round((lf.avgEarningsPerOrder || 0) * 100) / 100,
        },
      },
    });
  } catch (err) { next(err); }
});

router.get('/settlements/export', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const Commission = require('../models/Commission');
    const { startDate, endDate, status } = req.query;
    const filter = { user: req.user._id, type: 'vendor' };
    if (status && status !== 'all') filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); filter.createdAt.$lte = e; }
    }
    const commissions = await Commission.find(filter)
      .populate('order', 'orderId totalAmount createdAt')
      .sort({ createdAt: -1 }).lean();

    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Order ID', 'Date', 'Order Amount', 'Commission %', 'Your Earnings', 'Status', 'Paid Date', 'Payment Ref'];
    const rows = commissions.map((c) => [
      c.order?.orderId || c._id, new Date(c.createdAt).toLocaleDateString('en-IN'),
      c.saleAmount || 0, c.commissionRate || 0, c.commissionAmount || 0,
      c.status, c.paidAt ? new Date(c.paidAt).toLocaleDateString('en-IN') : '',
      c.paymentRef || '',
    ].map(esc).join(','));

    const totalEarnings  = commissions.reduce((s, c) => s + (c.commissionAmount || 0), 0);
    const pendingSum     = commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + (c.commissionAmount || 0), 0);
    const approvedSum    = commissions.filter((c) => c.status === 'approved').reduce((s, c) => s + (c.commissionAmount || 0), 0);
    const paidSum        = commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + (c.commissionAmount || 0), 0);
    const summaryRows    = [
      '', `"Total Records","${commissions.length}"`,
      `"Total Earnings","${totalEarnings.toFixed(2)}"`,
      `"Pending","${pendingSum.toFixed(2)}"`,
      `"Approved","${approvedSum.toFixed(2)}"`,
      `"Paid","${paidSum.toFixed(2)}"`,
    ];

    const csv = [headers.map(esc).join(','), ...rows, ...summaryRows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="settlements_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// Settlements — vendor's commission records
router.get('/settlements', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const Commission = require('../models/Commission');
    const { status, page = 1, limit = 20 } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const filter = { user: req.user._id, type: 'vendor' };
    if (status && status !== 'all') filter.status = status;
    const skip = (parseInt(page) - 1) * safeLimit;
    const [commissions, total] = await Promise.all([
      Commission.find(filter).populate('order', 'orderId totalAmount createdAt').sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      Commission.countDocuments(filter),
    ]);
    res.json({
      data: commissions,
      pagination: { page: parseInt(page), total, pages: Math.ceil(total / safeLimit) },
    });
  } catch (err) { next(err); }
});

// Razorpay onboarding stubs
router.get('/razorpay/status', requireApproved, async (req, res, next) => {
  try {
    // TODO: integrate with Razorpay Route API when configured
    res.json({ success: true, data: { status: 'not_connected' } });
  } catch (err) { next(err); }
});

router.post('/razorpay/connect', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const { email, phone, contactName } = req.body;
    if (!email || !phone || !contactName) throw new AppError('email, phone, contactName required', 400, 'MISSING_FIELDS');
    // TODO: call Razorpay Route API to create linked account
    res.json({ success: true, data: { status: 'created', message: 'Account creation initiated. Razorpay will verify your details.' } });
  } catch (err) { next(err); }
});

// ─── Vendor Ads ────────────────────────────────────────────────────────────────
const AdCampaign = require('../models/AdCampaign');
const AdWallet   = require('../models/AdWallet');

function normC(c) {
  const obj = typeof c.toObject === 'function' ? c.toObject() : c;
  return {
    ...obj,
    name:        obj.name || obj.title,
    bid:         obj.bid ?? obj.bidPerClick ?? 0,
    dailyBudget: obj.dailyBudget ?? obj.budget ?? 0,
    stats: {
      impressions: (obj.stats?.impressions || 0) + (obj.impressions || 0),
      clicks:      (obj.stats?.clicks || 0)      + (obj.clicks || 0),
      conversions:  obj.stats?.conversions || 0,
      spend:       (obj.stats?.spend || 0)       + (obj.spent || 0),
    },
    startAt: obj.startAt || obj.startDate,
    endAt:   obj.endAt   || obj.endDate,
  };
}

router.get('/ads/campaigns', requireApproved, async (req, res, next) => {
  try {
    const campaigns = await AdCampaign.find({ vendor: req.user._id })
      .populate('targeting.products', 'title images')
      .sort({ createdAt: -1 });
    res.json({ campaigns: campaigns.map(normC) });
  } catch (err) { next(err); }
});

router.post('/ads/campaigns', requireApproved, async (req, res, next) => {
  try {
    const { name, type, pricing, bid, dailyBudget, startAt, endAt,
      placement, position, bannerSize, targeting } = req.body;
    if (!name?.trim())      throw new AppError('Campaign name is required', 400, 'MISSING_FIELDS');
    if (!bid || bid <= 0)   throw new AppError('Bid amount is required', 400, 'MISSING_FIELDS');
    if (!dailyBudget || dailyBudget <= 0) throw new AppError('Daily budget is required', 400, 'MISSING_FIELDS');
    const campaign = await AdCampaign.create({
      vendor: req.user._id,
      name: name.trim(),
      type:        type        || 'SponsoredProduct',
      pricing:     pricing     || 'CPC',
      bid:         parseFloat(bid),
      dailyBudget: parseFloat(dailyBudget),
      budget:      parseFloat(dailyBudget),
      startAt, endAt,
      placement:  placement || 'homepage_banner',
      position, bannerSize, targeting,
      status: 'draft',
    });
    res.status(201).json({ campaign: normC(campaign) });
  } catch (err) { next(err); }
});

router.put('/ads/campaigns/:id', requireApproved, async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid ID', 400, 'INVALID_ID');
    const campaign = await AdCampaign.findOne({ _id: req.params.id, vendor: req.user._id });
    if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    const { name, type, pricing, bid, dailyBudget, startAt, endAt,
      placement, position, bannerSize, targeting, status } = req.body;
    if (name      !== undefined) campaign.name = name.trim();
    if (type      !== undefined) campaign.type = type;
    if (pricing   !== undefined) campaign.pricing = pricing;
    if (bid       !== undefined) campaign.bid = parseFloat(bid);
    if (dailyBudget !== undefined) { campaign.dailyBudget = parseFloat(dailyBudget); campaign.budget = parseFloat(dailyBudget); }
    if (startAt   !== undefined) campaign.startAt = startAt;
    if (endAt     !== undefined) campaign.endAt = endAt;
    if (placement !== undefined) campaign.placement = placement;
    if (position  !== undefined) campaign.position = position;
    if (bannerSize !== undefined) campaign.bannerSize = bannerSize;
    if (targeting !== undefined) campaign.targeting = targeting;
    if (status !== undefined) {
      if (!['paused', 'active', 'draft'].includes(status)) throw new AppError('Invalid status transition', 400, 'INVALID_STATUS');
      if (status === 'active' && campaign.approval?.status !== 'approved') {
        throw new AppError('Campaign must be approved before activating', 400, 'NOT_APPROVED');
      }
      campaign.status = status;
    }
    await campaign.save();
    res.json({ campaign: normC(campaign) });
  } catch (err) { next(err); }
});

router.delete('/ads/campaigns/:id', requireApproved, async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid ID', 400, 'INVALID_ID');
    const campaign = await AdCampaign.findOneAndDelete({ _id: req.params.id, vendor: req.user._id });
    if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/ads/wallet', requireApproved, async (req, res, next) => {
  try {
    const wallet = await AdWallet.findOne({ vendorId: req.user._id });
    res.json({ balance: wallet?.balance || 0 });
  } catch (err) { next(err); }
});

router.post('/ads/wallet/recharge/create-order', requireApproved, async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || parseFloat(amount) < 100) throw new AppError('Minimum recharge amount is ₹100', 400, 'INVALID_AMOUNT');
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../config/env');
    if (!RAZORPAY_KEY_ID) throw new AppError('Payment gateway not configured', 503, 'SERVICE_UNAVAILABLE');
    const Razorpay = require('razorpay');
    const rz = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
    const order = await rz.orders.create({
      amount:   Math.round(parseFloat(amount) * 100),
      currency: 'INR',
      receipt:  `adwallet_${req.user._id}_${Date.now()}`,
    });
    res.json({ order, key: RAZORPAY_KEY_ID });
  } catch (err) { next(err); }
});

router.post('/ads/wallet/recharge/verify', requireApproved, async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new AppError('Payment verification data missing', 400, 'MISSING_FIELDS');
    }
    const { RAZORPAY_KEY_SECRET } = require('../config/env');
    const crypto = require('crypto');
    const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    if (expected !== razorpaySignature) throw new AppError('Payment verification failed', 400, 'PAYMENT_INVALID');
    const credit = Math.round(parseFloat(amount || 0) * 100) / 100;
    const wallet = await AdWallet.findOneAndUpdate(
      { vendorId: req.user._id },
      {
        $inc:  { balance: credit, totalRecharged: credit },
        $push: { transactions: { amount: credit, type: 'recharge', description: `Razorpay ${razorpayPaymentId}` } },
      },
      { upsert: true, new: true }
    );
    res.json({ balance: wallet.balance });
  } catch (err) { next(err); }
});

// ── Manual orders — in-store / phone sales ────────────────────────────────────

// GET /vendors/manual-orders
router.get('/manual-orders', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, source } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 20, 50);
    const filter = { 'items.vendorId': req.user._id, source: { $in: ['in-store', 'phone'] } };
    if (source && source !== 'all') filter.source = source;
    if (search?.trim()) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ orderId: re }, { customerPhone: re }, { customerName: re }, { 'shippingAddress.name': re }];
    }
    const skip = (parseInt(page) - 1) * safeLimit;
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      Order.countDocuments(filter),
    ]);
    // Attach warranty count per order
    const Warranty = require('../models/Warranty');
    const orderIds = orders.map((o) => o._id);
    const wCounts = await Warranty.aggregate([
      { $match: { orderId: { $in: orderIds }, status: { $ne: 'void' } } },
      { $group: { _id: '$orderId', count: { $sum: 1 } } },
    ]);
    const wcMap = {};
    wCounts.forEach(({ _id, count }) => { wcMap[_id.toString()] = count; });
    const enriched = orders.map((o) => ({ ...o, warrantyCount: wcMap[o._id.toString()] || 0 }));
    res.json({ success: true, data: enriched, pagination: { page: parseInt(page), limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } });
  } catch (err) { next(err); }
});

// POST /vendors/manual-orders
router.post('/manual-orders', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const {
      customerName, customerPhone, customerEmail,
      items, paymentMethod = 'cash', amountPaid,
      source = 'in-store', notes, discount = 0,
    } = req.body;
    if (!customerName?.trim()) throw new AppError('Customer name required', 400, 'MISSING_FIELDS');
    if (!customerPhone?.trim()) throw new AppError('Customer phone required', 400, 'MISSING_FIELDS');
    if (!items?.length) throw new AppError('At least one item required', 400, 'MISSING_FIELDS');

    const orderItems = [];
    let subtotal = 0;
    const productDetails = [];

    for (const item of items) {
      const product = await Product.findOne({ _id: item.productId, vendorId: req.user._id })
        .select('title sku images price hasWarranty warranty');
      if (!product) throw new AppError(`Product not found or not yours: ${item.productId}`, 400, 'NOT_FOUND');
      const price = parseFloat(item.price) || product.price;
      const qty   = Math.max(1, parseInt(item.qty) || 1);
      subtotal += price * qty;
      orderItems.push({ product: product._id, title: product.title, sku: product.sku, image: product.images?.[0] || '', price, quantity: qty, vendorId: req.user._id, vendorEarning: 0, platformFee: 0 });
      productDetails.push({ product, item, idx: orderItems.length - 1 });
    }

    const safeDiscount = parseFloat(discount) || 0;
    const totalAmount  = amountPaid != null ? parseFloat(amountPaid) : Math.max(0, subtotal - safeDiscount);
    const orderId      = 'VMAN-' + Date.now();

    const order = await Order.create({
      orderId, customerName: customerName.trim(), customerPhone: customerPhone.trim(),
      items: orderItems,
      shippingAddress: { name: customerName.trim(), phone: customerPhone.trim(), line1: 'In-store', city: '-', state: '-', pincode: '000000' },
      subtotal, discount: safeDiscount, totalAmount,
      paymentMethod, paymentStatus: 'paid',
      source: ['in-store', 'phone'].includes(source) ? source : 'in-store',
      status: 'delivered', deliveredAt: new Date(),
      notes: notes?.trim() || undefined,
      tracking: { history: [{ status: 'delivered', timestamp: new Date(), description: `Manual ${source} sale` }] },
    });

    // Create Warranty records
    const Warranty = require('../models/Warranty');
    let warrantyCount = 0;
    for (const { product, item } of productDetails) {
      if (!product.hasWarranty || !product.warranty) continue;
      const wid = `WR-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const now = new Date();
      const dur = product.warranty;
      let days = dur.durationType === 'lifetime' ? 36500 : dur.durationType === 'years' ? (dur.duration || 1) * 365 : (dur.duration || 1) * 30;
      const endDate = new Date(now); endDate.setDate(endDate.getDate() + days);
      try {
        await Warranty.create({
          warrantyId: wid, purchaseId: orderId, orderId: order._id,
          productId: product._id,
          customerName: customerName.trim(), customerEmail: customerEmail?.trim() || undefined, customerPhone: customerPhone.trim(),
          product: { name: product.title, model: product.sku || '', serial: item.serialNumber?.trim() || '' },
          purchaseDate: now, warrantyStartDate: now, warrantyEndDate: endDate, warrantyPeriodDays: days,
          warrantyType: 'manufacturer', status: 'active',
          extraInfo: { store: 'Vendor Store', invoiceNo: orderId },
        });
        warrantyCount++;
      } catch {} // skip duplicate if same product added twice
    }

    res.status(201).json({ success: true, data: { ...order.toObject(), warrantyCount } });
  } catch (err) { next(err); }
});

// PUT /vendors/manual-orders/:id/cancel — MUST be before /:id
router.put('/manual-orders/:id/cancel', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const { reason = 'Cancelled by vendor' } = req.body;
    if (!reason?.trim()) throw new AppError('Cancellation reason required', 400, 'MISSING_FIELDS');
    const order = await Order.findOne({ _id: req.params.id, 'items.vendorId': req.user._id, source: { $in: ['in-store', 'phone'] } });
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (order.status === 'cancelled') throw new AppError('Order already cancelled', 400, 'ALREADY_CANCELLED');
    order.status = 'cancelled';
    order.cancellation = { reason: reason.trim(), cancelledAt: new Date(), cancelledBy: req.user._id };
    order.paymentStatus = 'refunded';
    if (!order.tracking) order.tracking = { history: [] };
    order.tracking.history.push({ status: 'cancelled', timestamp: new Date(), description: reason.trim() });
    await order.save();
    const Warranty = require('../models/Warranty');
    const { modifiedCount } = await Warranty.updateMany({ orderId: order._id, status: { $nin: ['void', 'expired'] } }, { status: 'void' });
    res.json({ success: true, data: order, voidedWarranties: modifiedCount });
  } catch (err) { next(err); }
});

// PUT /vendors/manual-orders/:id
router.put('/manual-orders/:id', requireApproved, requireApprovedKYC, async (req, res, next) => {
  try {
    const { customerName, customerPhone, customerEmail, source, paymentMethod, notes } = req.body;
    const order = await Order.findOne({ _id: req.params.id, 'items.vendorId': req.user._id, source: { $in: ['in-store', 'phone'] } });
    if (!order) throw new AppError('Order not found', 404, 'NOT_FOUND');
    if (order.status === 'cancelled') throw new AppError('Cannot update a cancelled order', 400, 'CANCELLED');
    if (customerName?.trim()) { order.customerName = customerName.trim(); if (order.shippingAddress) order.shippingAddress.name = customerName.trim(); }
    if (customerPhone?.trim()) { order.customerPhone = customerPhone.trim(); if (order.shippingAddress) order.shippingAddress.phone = customerPhone.trim(); }
    if (source && ['in-store', 'phone'].includes(source)) order.source = source;
    if (paymentMethod) order.paymentMethod = paymentMethod;
    if (notes !== undefined) order.notes = notes?.trim() || undefined;
    await order.save();
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// ─── KYC Routes ───────────────────────────────────────────────────────────────

const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    ok ? cb(null, true) : cb(new AppError('Only images and PDFs allowed', 400));
  },
});

router.get('/kyc', async (req, res, next) => {
  try {
    const user = await require('../models/User').findById(req.user._id)
      .select('vendorProfile name email');
    if (!user) throw new AppError('Vendor not found', 404);
    const vp = user.vendorProfile || {};
    res.json({
      success: true,
      data: {
        status:          vp.kycStatus || 'not_submitted',
        businessName:    vp.businessName || '',
        businessType:    vp.businessType || '',
        businessAddress: vp.businessAddress || '',
        taxId:           vp.gstin || '',
        phoneNumber:     vp.businessPhone || '',
        gstVerified:     vp.gstVerified || false,
        gstDetails:      vp.gstDetails || null,
        documents:       vp.kycDocuments || [],
        rejectionReason: vp.kycRejectionReason || '',
      },
    });
  } catch (err) { next(err); }
});

router.get('/kyc/stats', async (req, res, next) => {
  try {
    const user = await require('../models/User').findById(req.user._id).select('vendorProfile');
    const vp = user?.vendorProfile || {};

    const businessInfoComplete = !!(vp.businessName && vp.businessType && vp.businessAddress && vp.businessPhone);
    const gstComplete = vp.gstVerified === true;
    const docs = vp.kycDocuments || [];
    const hasIdProof = docs.some((d) => d.type === 'id_proof');
    const hasAddressProof = docs.some((d) => d.type === 'address_proof');
    const docsComplete = hasIdProof && hasAddressProof;
    const overall = businessInfoComplete && gstComplete && docsComplete;
    const isApproved = vp.kycStatus === 'approved';

    const businessPct = businessInfoComplete ? 100 : 0;
    const gstPct = gstComplete ? 100 : 0;
    const docPct = (hasIdProof ? 50 : 0) + (hasAddressProof ? 50 : 0);
    const overallPct = Math.round(businessPct * 0.3 + gstPct * 0.3 + docPct * 0.4);

    function stepStatus(stepNum) {
      if (isApproved) return 'completed';
      if (stepNum === 1) return businessInfoComplete ? 'completed' : 'current';
      if (stepNum === 2) return gstComplete ? 'completed' : businessInfoComplete ? 'current' : 'pending';
      if (stepNum === 3) return docsComplete ? 'completed' : gstComplete ? 'current' : 'pending';
      if (stepNum === 4) return overall ? 'current' : 'pending';
    }

    res.json({
      completion: {
        businessInfo: { percentage: businessPct },
        gst:          { verified: gstComplete, percentage: gstPct },
        documents:    { percentage: docPct },
        overall:      overallPct,
      },
      steps: [
        { number: 1, title: 'Business Info', status: stepStatus(1) },
        { number: 2, title: 'GST Verify',    status: stepStatus(2) },
        { number: 3, title: 'Documents',     status: stepStatus(3) },
        { number: 4, title: 'Approved',      status: stepStatus(4) },
      ],
    });
  } catch (err) { next(err); }
});

router.put('/kyc', async (req, res, next) => {
  try {
    const {
      businessName, businessType, businessAddress, taxId, phoneNumber,
      gstVerified, gstDetails, submit,
    } = req.body;

    if (submit) {
      const user = await require('../models/User').findById(req.user._id).select('vendorProfile');
      const vp = user?.vendorProfile || {};
      const docs = vp.kycDocuments || [];
      const missing = [];
      if (!businessName)    missing.push('Business Name');
      if (!businessType)    missing.push('Business Type');
      if (!businessAddress) missing.push('Business Address');
      if (!phoneNumber)     missing.push('Phone Number');
      if (!gstVerified)     missing.push('GST Verification');
      if (!docs.some((d) => d.type === 'id_proof'))      missing.push('ID Proof Document');
      if (!docs.some((d) => d.type === 'address_proof')) missing.push('Address Proof Document');
      if (missing.length) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_REQUIRED_FIELDS', message: `Please complete: ${missing.join(', ')}` },
        });
      }
    }

    const update = {};
    if (businessName    !== undefined) update['vendorProfile.businessName']    = businessName;
    if (businessType    !== undefined) update['vendorProfile.businessType']    = businessType;
    if (businessAddress !== undefined) update['vendorProfile.businessAddress'] = businessAddress;
    if (taxId           !== undefined) update['vendorProfile.gstin']           = taxId;
    if (phoneNumber     !== undefined) update['vendorProfile.businessPhone']   = phoneNumber;
    if (gstVerified     !== undefined) update['vendorProfile.gstVerified']     = gstVerified;
    if (gstDetails      !== undefined) update['vendorProfile.gstDetails']      = gstDetails;
    if (submit)                        update['vendorProfile.kycStatus']       = 'pending';

    const updated = await require('../models/User').findByIdAndUpdate(
      req.user._id, { $set: update }, { new: true },
    );
    res.json({ success: true, data: updated.vendorProfile });
  } catch (err) { next(err); }
});

router.post('/kyc/documents', kycUpload.single('file'), async (req, res, next) => {
  try {
    const { type, url: bodyUrl, filename: bodyFilename } = req.body;
    if (!type) throw new AppError('Document type required', 400);

    let docUrl = bodyUrl;
    let docFilename = bodyFilename;

    if (req.file) {
      docUrl = await uploadFile(req.file, 'kyc-documents');
      docFilename = req.file.originalname;
    }

    if (!docUrl) throw new AppError('File or URL required', 400);

    const user = await require('../models/User').findByIdAndUpdate(
      req.user._id,
      { $push: { 'vendorProfile.kycDocuments': { type, url: docUrl, filename: docFilename, uploadedAt: new Date() } } },
      { new: true },
    );

    const doc = user.vendorProfile.kycDocuments[user.vendorProfile.kycDocuments.length - 1];
    res.json({ success: true, document: doc });
  } catch (err) { next(err); }
});

router.delete('/kyc/documents/:id', async (req, res, next) => {
  try {
    await require('../models/User').findByIdAndUpdate(
      req.user._id,
      { $pull: { 'vendorProfile.kycDocuments': { _id: req.params.id } } },
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── GST Verify ───────────────────────────────────────────────────────────────

router.post('/gst/verify', async (req, res, next) => {
  try {
    const { gstNumber } = req.body;
    if (!gstNumber) throw new AppError('GST number required', 400);

    const gstin = gstNumber.toUpperCase().trim();
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(gstin)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid GSTIN format. Expected: 22AAAAA0000A1Z5' } });
    }

    const pan = gstin.slice(2, 12);
    const stateCode = gstin.slice(0, 2);
    const stateNames = {
      '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
      '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
      '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
      '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
      '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh',
      '24':'Gujarat','27':'Maharashtra','28':'Andhra Pradesh','29':'Karnataka',
      '30':'Goa','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','36':'Telangana',
    };
    const stateName = stateNames[stateCode] || 'India';

    res.json({
      success: true,
      data: {
        tradeName:   `Business (PAN: ${pan})`,
        legalName:   `Registered Entity ${pan}`,
        gstNumber:   gstin,
        status:      'Active',
        address:     `${stateName}, India`,
        stateCode,
        pan,
      },
      active: true,
    });
  } catch (err) { next(err); }
});

// Public vendor store info
router.get('/:id/public', async (req, res, next) => {
  try {
    const User = require('../models/User');
    const vendor = await User.findById(req.params.id).select('name vendorProfile');
    if (!vendor || vendor.role !== 'vendor') return next(new AppError('Vendor not found', 404));
    const productCount = await Product.countDocuments({ vendorId: req.params.id, status: 'approved' });
    res.json({
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        storeName: vendor.vendorProfile?.storeName || vendor.name,
        storeDescription: vendor.vendorProfile?.storeDescription,
        logo: vendor.vendorProfile?.logo,
        rating: vendor.vendorProfile?.rating || 0,
        location: vendor.vendorProfile?.location,
        productCount,
      },
    });
  } catch (err) { next(err); }
});

// ── Category routes — no requireApprovedKYC (category CRUD is KYC-free) ────────

// GET /vendors/categories/stats — MUST be before /categories/:id
router.get('/categories/stats', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [total, active, yours, allCats] = await Promise.all([
      Category.countDocuments(),
      Category.countDocuments({ isActive: true }),
      Category.countDocuments({ createdBy: userId }),
      Category.find().select('_id deleteRequested').lean(),
    ]);
    const pendingDeletion = allCats.filter((c) => c.deleteRequested).length;
    const catIds = allCats.map((c) => c._id);
    const withProductsAgg = await Product.aggregate([
      { $match: { categoryIds: { $in: catIds } } },
      { $unwind: '$categoryIds' },
      { $group: { _id: '$categoryIds' } },
    ]);
    res.json({
      success: true,
      data: {
        totalCategories:        total,
        activeCategories:       active,
        yourCategories:         yours,
        categoriesWithProducts: withProductsAgg.length,
        pendingDeletion,
      },
    });
  } catch (err) { next(err); }
});

// GET /vendors/categories
router.get('/categories', async (req, res, next) => {
  try {
    const { search, includeInactive } = req.query;
    const filter = {};
    if (includeInactive !== 'true') filter.isActive = true;
    if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const categories = await Category.find(filter).sort({ sortOrder: -1, name: 1 }).lean();

    const catIds = categories.map((c) => c._id);
    const productCounts = await Product.aggregate([
      { $match: { categoryIds: { $in: catIds } } },
      { $unwind: '$categoryIds' },
      { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    productCounts.forEach(({ _id, count }) => { countMap[_id.toString()] = count; });

    res.json({
      success: true,
      data: categories.map((c) => ({ ...c, productCount: countMap[c._id.toString()] || 0 })),
    });
  } catch (err) { next(err); }
});

// POST /vendors/categories
router.post('/categories', async (req, res, next) => {
  try {
    const { name, description, image, parentId, sortOrder } = req.body;
    if (!name?.trim()) throw new AppError('Category name is required', 400, 'MISSING_NAME');

    const slug = name.trim().toLowerCase()
      .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

    const existing = await Category.findOne({ slug });
    if (existing) throw new AppError('A category with this name already exists', 400, 'DUPLICATE_SLUG');

    const category = await Category.create({
      name: name.trim(), slug, description, image,
      parentId: parentId || null,
      sortOrder: sortOrder ?? 0,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: category });
  } catch (err) { next(err); }
});

// PUT /vendors/categories/:id
router.put('/categories/:id', async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) throw new AppError('Category not found', 404, 'NOT_FOUND');
    if (req.user.role !== 'admin' && category.createdBy?.toString() !== req.user._id.toString()) {
      throw new AppError('You can only edit categories you created', 403, 'FORBIDDEN');
    }

    const { name, description, image, parentId, sortOrder, isActive } = req.body;
    if (name !== undefined) {
      category.name = name.trim();
      category.slug = name.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (description !== undefined) category.description = description;
    if (image       !== undefined) category.image       = image;
    if (parentId    !== undefined) category.parentId    = parentId || null;
    if (sortOrder   !== undefined) category.sortOrder   = sortOrder;
    if (isActive    !== undefined) category.isActive    = isActive;

    await category.save();
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
});

// DELETE /vendors/categories/:id
// Vendors: submit delete request. Admins: direct delete.
router.delete('/categories/:id', async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) throw new AppError('Category not found', 404, 'NOT_FOUND');

    if (req.user.role !== 'admin') {
      if (category.createdBy?.toString() !== req.user._id.toString()) {
        throw new AppError('You can only request deletion of categories you created', 403, 'FORBIDDEN');
      }
      if (category.deleteRequested) {
        throw new AppError('Delete request already submitted for this category', 400, 'ALREADY_REQUESTED');
      }
      category.deleteRequested   = true;
      category.deleteRequestedBy = req.user._id;
      category.deleteRequestedAt = new Date();
      await category.save();
      return res.json({ success: true, requested: true, message: 'Delete request submitted. Admin will review it.' });
    }

    const productCount = await Product.countDocuments({ categoryIds: category._id });
    if (productCount > 0) {
      throw new AppError(`Cannot delete: ${productCount} product(s) are using this category`, 400, 'HAS_PRODUCTS');
    }
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { next(err); }
});

// POST /vendors/products/assign-category — requires KYC
router.post('/products/assign-category', requireApprovedKYC, async (req, res, next) => {
  try {
    const { categoryId, productIds } = req.body;
    if (!categoryId || !Array.isArray(productIds) || productIds.length === 0) {
      throw new AppError('categoryId and productIds are required', 400, 'INVALID_INPUT');
    }
    const result = await Product.updateMany(
      { _id: { $in: productIds }, vendorId: req.user._id },
      { $addToSet: { categoryIds: categoryId } },
    );
    await invalidateCache('cache:/api/catalog*');
    res.json({ success: true, data: { updated: result.modifiedCount } });
  } catch (err) { next(err); }
});

// POST /vendors/products/remove-from-category — requires KYC
router.post('/products/remove-from-category', requireApprovedKYC, async (req, res, next) => {
  try {
    const { categoryId, productIds } = req.body;
    if (!categoryId || !Array.isArray(productIds) || productIds.length === 0) {
      throw new AppError('categoryId and productIds are required', 400, 'INVALID_INPUT');
    }
    const result = await Product.updateMany(
      { _id: { $in: productIds }, vendorId: req.user._id },
      { $pull: { categoryIds: new (require('mongoose').Types.ObjectId)(categoryId) } },
    );
    await invalidateCache('cache:/api/catalog*');
    res.json({ success: true, data: { updated: result.modifiedCount } });
  } catch (err) { next(err); }
});

module.exports = router;
