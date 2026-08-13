const router = require('express').Router();
const Warranty = require('../models/Warranty');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

// Public: check warranty by serial number — returns non-PII fields only
router.get('/check/:serial', async (req, res, next) => {
  try {
    const serial = req.params.serial.trim();
    const warranty = await Warranty.findOne({ 'product.serial': serial })
      .populate('productId', 'title images');
    if (!warranty) throw new AppError('No warranty found for this serial number', 404, 'NOT_FOUND');
    warranty.updateStatus();
    res.json({
      warranty: {
        warrantyId: warranty.warrantyId,
        status: warranty.status,
        product: warranty.product,
        purchaseDate: warranty.purchaseDate,
        warrantyStartDate: warranty.warrantyStartDate,
        warrantyEndDate: warranty.warrantyEndDate,
        warrantyType: warranty.warrantyType,
        productId: warranty.productId,
      },
    });
  } catch (err) { next(err); }
});

// Protected: register warranty manually (customer self-registers with serial number)
router.post('/register', authenticate, async (req, res, next) => {
  try {
    const { productId, orderId, serialNumber, purchaseDate } = req.body;
    if (!productId || !purchaseDate) throw new AppError('productId and purchaseDate required', 400, 'MISSING_FIELDS');

    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

    // Warranty duration must come from the product config, not the client.
    // Fallback: 12 months. Cap: 36 months (3 years) to prevent abuse.
    const Order = require('../models/Order');
    let derivedMonths = 12;
    if (product.hasWarranty && product.warranty?.duration) {
      const wd = product.warranty;
      derivedMonths = wd.durationType === 'lifetime' ? 36 :
        wd.durationType === 'years' ? Math.min((wd.duration || 1) * 12, 36) :
        Math.min(wd.duration || 12, 36);
    }
    const periodDays = Math.min(derivedMonths, 36) * 30;

    // If orderId supplied, verify the user owns the order and it contains the product
    if (orderId) {
      const order = await Order.findOne({ _id: orderId, user: req.user._id });
      if (!order) throw new AppError('Order not found or does not belong to you', 404, 'NOT_FOUND');
      const hasProduct = order.items.some((i) => i.product?.toString() === productId.toString());
      if (!hasProduct) throw new AppError('This product was not in the specified order', 400, 'INVALID_REQUEST');
    }
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
