const router = require('express').Router();
const Coupon = require('../../models/Coupon');
const AppError = require('../../utils/AppError');

router.get('/', async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ coupons });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const coupon = await Coupon.create({ ...req.body, code: req.body.code?.toUpperCase() });
    res.status(201).json({ coupon });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!coupon) throw new AppError('Coupon not found', 404, 'NOT_FOUND');
    res.json({ coupon });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
