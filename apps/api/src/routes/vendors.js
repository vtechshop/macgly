const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');
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
router.use(authorize(['vendor', 'admin']));

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

// Products — vendor sees only their own
router.get('/products', requireApproved, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { vendorId: req.user._id };
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Product.countDocuments(filter),
    ]);
    res.json({ products, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.post('/products', requireApproved, async (req, res, next) => {
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

// Orders — vendor sees orders containing their products
// ─── Dashboard Stats ──────────────────────────────────────────────────────────

router.get('/dashboard/stats', requireApproved, async (req, res, next) => {
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

router.get('/orders', requireApproved, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { 'items.vendorId': req.user._id };
    if (status) filter.status = status;
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate('user', 'name email phone'),
      Order.countDocuments(filter),
    ]);
    res.json({ orders, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
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

// Vendor inventory — their products only
router.get('/inventory', requireApproved, async (req, res, next) => {
  try {
    const { search, lowStock, page = 1, limit = 30 } = req.query;
    const filter = { vendorId: req.user._id };
    if (lowStock === 'true') filter.stock = { $lte: 10 };
    if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).select('title sku stock images price category').sort({ stock: 1 }).skip(skip).limit(parseInt(limit)),
      Product.countDocuments(filter),
    ]);
    res.json({ products, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
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

// Settlements — vendor's commission records
router.get('/settlements', requireApproved, async (req, res, next) => {
  try {
    const Commission = require('../models/Commission');
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { user: req.user._id, type: 'vendor' };
    if (status) filter.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [commissions, total] = await Promise.all([
      Commission.find(filter).populate('order', 'orderId totalAmount').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Commission.countDocuments(filter),
    ]);
    const [pending, paid] = await Promise.all([
      Commission.aggregate([{ $match: { user: req.user._id, type: 'vendor', status: 'pending' } }, { $group: { _id: null, total: { $sum: '$commissionAmount' } } }]),
      Commission.aggregate([{ $match: { user: req.user._id, type: 'vendor', status: 'paid' } }, { $group: { _id: null, total: { $sum: '$commissionAmount' } } }]),
    ]);
    res.json({
      commissions,
      pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) },
      summary: { pendingAmount: pending[0]?.total || 0, paidAmount: paid[0]?.total || 0 },
    });
  } catch (err) { next(err); }
});

// Vendor ads
router.get('/ads', requireApproved, async (req, res, next) => {
  try {
    const AdCampaign = require('../models/AdCampaign');
    const campaigns = await AdCampaign.find({ vendor: req.user._id })
      .populate('product', 'title images')
      .sort({ createdAt: -1 });
    res.json({ campaigns });
  } catch (err) { next(err); }
});

router.post('/ads', requireApproved, async (req, res, next) => {
  try {
    const AdCampaign = require('../models/AdCampaign');
    const { productId, title, budget, bidPerClick, placement, startDate, endDate, bannerImage } = req.body;
    if (!productId || !title || !budget || !bidPerClick) {
      throw new AppError('productId, title, budget, bidPerClick required', 400, 'MISSING_FIELDS');
    }
    const product = await Product.findOne({ _id: productId, vendorId: req.user._id });
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    const campaign = await AdCampaign.create({
      vendor: req.user._id, product: productId, title, budget, bidPerClick,
      placement: placement || 'homepage', startDate, endDate, bannerImage,
    });
    res.status(201).json({ campaign });
  } catch (err) { next(err); }
});

router.delete('/ads/:id', requireApproved, async (req, res, next) => {
  try {
    const AdCampaign = require('../models/AdCampaign');
    await AdCampaign.findOneAndDelete({ _id: req.params.id, vendor: req.user._id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Manual order by vendor
router.post('/manual-orders', requireApproved, async (req, res, next) => {
  try {
    const User = require('../models/User');
    const { customerEmail, items, shippingAddress, note } = req.body;
    if (!customerEmail || !items?.length || !shippingAddress) {
      throw new AppError('customerEmail, items, shippingAddress required', 400, 'MISSING_FIELDS');
    }
    const customer = await User.findOne({ email: customerEmail.toLowerCase() });
    if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');
    const orderItems = [];
    let subtotal = 0;
    for (const { productId, quantity } of items) {
      const product = await Product.findOne({ _id: productId, vendorId: req.user._id });
      if (!product) throw new AppError(`Product ${productId} not yours`, 403, 'FORBIDDEN');
      const price = product.salePrice || product.price;
      orderItems.push({ product: product._id, title: product.title, sku: product.sku, image: product.images?.[0] || '', price, quantity, vendorId: req.user._id, vendorEarning: 0, platformFee: 0 });
      subtotal += price * quantity;
    }
    const orderId = 'VMAN-' + Date.now();
    const order = await Order.create({
      orderId, user: customer._id, items: orderItems, subtotal, shippingCharge: 0,
      totalAmount: subtotal, paymentMethod: 'cod', paymentStatus: 'pending',
      status: 'confirmed', shippingAddress, notes: note || `Manual order by vendor ${req.user._id}`,
    });
    res.status(201).json({ order });
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

module.exports = router;
