const router = require('express').Router();
const Coupon = require('../../models/Coupon');
const AppError = require('../../utils/AppError');

// List all coupons
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, active } = req.query;
    const filter = {};
    if (search) filter.code = { $regex: search.toUpperCase(), $options: 'i' };
    if (active !== undefined) filter.active = active === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [coupons, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Coupon.countDocuments(filter),
    ]);
    res.json({ coupons, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// Get single coupon
router.get('/:id', async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) throw new AppError('Coupon not found', 404, 'NOT_FOUND');
    res.json({ coupon });
  } catch (err) { next(err); }
});

// Create coupon
router.post('/', async (req, res, next) => {
  try {
    const { code, description, type, value, minOrderAmount, maxDiscount, usageLimit, perUserLimit, expiry, active } = req.body;
    if (!code?.trim()) throw new AppError('Coupon code is required', 400, 'MISSING_FIELDS');
    if (!type || !['percent', 'flat'].includes(type)) throw new AppError('Type must be percent or flat', 400, 'MISSING_FIELDS');
    if (!value || value <= 0) throw new AppError('Value must be greater than 0', 400, 'MISSING_FIELDS');
    if (type === 'percent' && value > 100) throw new AppError('Percent discount cannot exceed 100', 400, 'INVALID_VALUE');

    const coupon = await Coupon.create({
      code: code.trim().toUpperCase(),
      description: description?.trim() || '',
      type,
      value: parseFloat(value),
      minOrderAmount: parseFloat(minOrderAmount) || 0,
      maxDiscount: parseFloat(maxDiscount) || 0,
      usageLimit: parseInt(usageLimit) || 0,
      perUserLimit: parseInt(perUserLimit) ?? 1,
      expiry: expiry || null,
      active: active !== false,
    });
    res.status(201).json({ coupon });
  } catch (err) { next(err); }
});

// Update coupon
router.put('/:id', async (req, res, next) => {
  try {
    const { code, description, type, value, minOrderAmount, maxDiscount, usageLimit, perUserLimit, expiry, active } = req.body;
    if (type && !['percent', 'flat'].includes(type)) throw new AppError('Type must be percent or flat', 400, 'INVALID_VALUE');
    if (type === 'percent' && value > 100) throw new AppError('Percent discount cannot exceed 100', 400, 'INVALID_VALUE');

    const update = {};
    if (code) update.code = code.trim().toUpperCase();
    if (description !== undefined) update.description = description.trim();
    if (type) update.type = type;
    if (value !== undefined) update.value = parseFloat(value);
    if (minOrderAmount !== undefined) update.minOrderAmount = parseFloat(minOrderAmount) || 0;
    if (maxDiscount !== undefined) update.maxDiscount = parseFloat(maxDiscount) || 0;
    if (usageLimit !== undefined) update.usageLimit = parseInt(usageLimit) || 0;
    if (perUserLimit !== undefined) update.perUserLimit = parseInt(perUserLimit) ?? 1;
    if (expiry !== undefined) update.expiry = expiry || null;
    if (active !== undefined) update.active = Boolean(active);

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!coupon) throw new AppError('Coupon not found', 404, 'NOT_FOUND');
    res.json({ coupon });
  } catch (err) { next(err); }
});

// Delete coupon
router.delete('/:id', async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) throw new AppError('Coupon not found', 404, 'NOT_FOUND');
    res.json({ message: 'Coupon deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
