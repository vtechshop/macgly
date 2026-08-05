const router = require('express').Router();
const { optionalAuth, authenticate } = require('../middleware/auth');
const { getCart, addItem, updateItem, removeItem, clearCart } = require('../controllers/cartController');
const Cart = require('../models/Cart');
const Coupon = require('../models/Coupon');
const AppError = require('../utils/AppError');
const { computeCouponDiscount } = require('../utils/coupon');

router.use(optionalAuth);

router.get('/', getCart);
router.post('/items', addItem);
router.put('/items/:itemId', updateItem);
router.delete('/items/:itemId', removeItem);
router.delete('/', clearCart);

// Apply coupon to cart — requires auth
router.post('/coupon', authenticate, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code?.trim()) throw new AppError('Coupon code is required', 400, 'MISSING_FIELDS');

    const coupon = await Coupon.findOne({ code: code.trim().toUpperCase(), active: true });
    if (!coupon) throw new AppError('Invalid or expired coupon code', 400, 'INVALID_COUPON');
    if (coupon.expiry && coupon.expiry < new Date()) throw new AppError('This coupon has expired', 400, 'COUPON_EXPIRED');
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      throw new AppError('This coupon has reached its usage limit', 400, 'COUPON_LIMIT_REACHED');
    }
    if (coupon.perUserLimit > 0) {
      const used = coupon.usedBy.filter((u) => u.user.toString() === req.user._id.toString()).length;
      if (used >= coupon.perUserLimit) throw new AppError('You have already used this coupon', 400, 'COUPON_ALREADY_USED');
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart?.items?.length) throw new AppError('Cart is empty', 400, 'EMPTY_CART');

    const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) {
      throw new AppError(`Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`, 400, 'MIN_ORDER_NOT_MET');
    }

    // Same helper createOrder uses, so the figure shown here and the one charged
    // can never come from different rules. The stored value is a display
    // convenience — checkout always recomputes against its own subtotal.
    const discount = computeCouponDiscount(coupon, subtotal);

    cart.coupon = { code: coupon.code, discount, type: coupon.type };
    await cart.save();

    res.json({ discount, code: coupon.code, type: coupon.type, description: coupon.description });
  } catch (err) { next(err); }
});

// Remove coupon from cart
router.delete('/coupon', authenticate, async (req, res, next) => {
  try {
    await Cart.findOneAndUpdate({ user: req.user._id }, { $unset: { coupon: 1 } });
    res.json({ message: 'Coupon removed' });
  } catch (err) { next(err); }
});

module.exports = router;
