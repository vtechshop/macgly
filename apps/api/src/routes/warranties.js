const router = require('express').Router();
const Warranty = require('../models/Warranty');
const Order = require('../models/Order');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const { authenticate } = require('../middleware/auth');

// Public: check warranty by serial number
router.get('/check/:serial', async (req, res, next) => {
  try {
    const warranty = await Warranty.findOne({ serialNumber: req.params.serial })
      .populate('product', 'title images')
      .select('-user');
    if (!warranty) throw new AppError('No warranty found for this serial number', 404, 'NOT_FOUND');
    res.json({ warranty });
  } catch (err) { next(err); }
});

// Protected: register warranty
router.post('/register', authenticate, async (req, res, next) => {
  try {
    const { productId, orderId, serialNumber, purchaseDate, warrantyPeriodMonths = 12 } = req.body;
    if (!productId || !purchaseDate) throw new AppError('productId and purchaseDate required', 400, 'MISSING_FIELDS');

    const product = await Product.findById(productId);
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');

    const purchase = new Date(purchaseDate);
    const expiry = new Date(purchase);
    expiry.setMonth(expiry.getMonth() + warrantyPeriodMonths);

    const warranty = await Warranty.create({
      user: req.user._id,
      product: productId,
      order: orderId || undefined,
      serialNumber: serialNumber || undefined,
      purchaseDate: purchase,
      expiryDate: expiry,
      warrantyPeriodMonths,
    });

    res.status(201).json({ warranty });
  } catch (err) { next(err); }
});

// Protected: my warranties
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const warranties = await Warranty.find({ user: req.user._id })
      .populate('product', 'title images sku')
      .sort({ createdAt: -1 });
    res.json({ warranties });
  } catch (err) { next(err); }
});

// Protected: raise a claim on a warranty
router.post('/:id/claim', authenticate, async (req, res, next) => {
  try {
    const { description } = req.body;
    if (!description) throw new AppError('Description required', 400, 'MISSING_FIELDS');
    const warranty = await Warranty.findOne({ _id: req.params.id, user: req.user._id });
    if (!warranty) throw new AppError('Warranty not found', 404, 'NOT_FOUND');
    if (warranty.status === 'expired') throw new AppError('Warranty has expired', 400, 'WARRANTY_EXPIRED');
    if (warranty.status === 'void') throw new AppError('Warranty is void', 400, 'WARRANTY_VOID');
    warranty.claims.push({ description });
    warranty.status = 'claimed';
    await warranty.save();
    res.json({ warranty });
  } catch (err) { next(err); }
});

module.exports = router;
