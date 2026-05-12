const router = require('express').Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const { slugify, generateSKU } = require('../utils/helpers');
const { invalidateCache } = require('../middleware/cache');
const { uploadFile } = require('../services/storageService');

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

    const updated = await require('../models/User').findByIdAndUpdate(req.user._id, update, { new: true });
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
router.get('/orders', requireApproved, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { 'items.vendorId': req.user._id };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate('user', 'name email'),
      Order.countDocuments(filter),
    ]);
    res.json({ orders, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

module.exports = router;
