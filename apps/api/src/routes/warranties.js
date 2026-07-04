const router = require('express').Router();
const Warranty = require('../models/Warranty');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

// Public: check warranty by serial number (stored in product.serial)
router.get('/check/:serial', async (req, res, next) => {
  try {
    const serial = req.params.serial.trim();
    const warranty = await Warranty.findOne({ 'product.serial': serial })
      .populate('productId', 'title images');
    if (!warranty) throw new AppError('No warranty found for this serial number', 404, 'NOT_FOUND');
    warranty.updateStatus();
    res.json({ warranty });
  } catch (err) { next(err); }
});

// Protected: register warranty manually (customer self-registers with serial number)
router.post('/register', authenticate, async (req, res, next) => {
  try {
    const { productId, orderId, serialNumber, purchaseDate, warrantyPeriodMonths = 12 } = req.body;
    if (!productId || !purchaseDate) throw new AppError('productId and purchaseDate required', 400, 'MISSING_FIELDS');

    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

    const periodDays = warrantyPeriodMonths * 30;
    const start = new Date(purchaseDate);
    const end = new Date(start.getTime() + periodDays * 24 * 60 * 60 * 1000);
    const warrantyId = `WR-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    const warranty = await Warranty.create({
      warrantyId,
      userId: req.user._id,
      productId,
      orderId: orderId || undefined,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerPhone: req.user.phone || '',
      product: {
        name: product.title,
        model: product.sku || '',
        serial: serialNumber || '',
      },
      purchaseDate: start,
      warrantyStartDate: start,
      warrantyEndDate: end,
      warrantyPeriodDays: periodDays,
      warrantyType: 'manufacturer',
      extraInfo: { invoiceNo: orderId || '' },
    });

    warranty.updateStatus();
    await warranty.save();

    res.status(201).json({ warranty });
  } catch (err) { next(err); }
});

// Protected: warranties for a specific order (by orderId string like MGY-XXXXX)
router.get('/order/:orderId', authenticate, async (req, res, next) => {
  try {
    const warranties = await Warranty.find({
      userId: req.user._id,
      purchaseId: req.params.orderId,
    }).populate('productId', 'title images sku');
    warranties.forEach((w) => w.updateStatus());
    res.json({ warranties });
  } catch (err) { next(err); }
});

// Protected: my warranties
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const warranties = await Warranty.find({ userId: req.user._id })
      .populate('productId', 'title images sku')
      .sort({ createdAt: -1 });
    const updated = warranties.map((w) => { w.updateStatus(); return w; });
    res.json({ warranties: updated });
  } catch (err) { next(err); }
});

// Protected: raise a claim
router.post('/:id/claim', authenticate, async (req, res, next) => {
  try {
    const { description } = req.body;
    if (!description) throw new AppError('Description required', 400, 'MISSING_FIELDS');
    const warranty = await Warranty.findOne({ _id: req.params.id, userId: req.user._id });
    if (!warranty) throw new AppError('Warranty not found', 404, 'NOT_FOUND');
    if (warranty.status === 'expired') throw new AppError('Warranty has expired', 400, 'WARRANTY_EXPIRED');
    if (warranty.status === 'void') throw new AppError('Warranty is void', 400, 'WARRANTY_VOID');
    const claimId = `CLM-${Date.now()}`;
    warranty.claims.push({ claimId, description });
    warranty.status = 'claimed';
    await warranty.save();
    res.json({ warranty });
  } catch (err) { next(err); }
});

module.exports = router;
