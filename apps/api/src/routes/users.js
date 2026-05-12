const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const AppError = require('../utils/AppError');

router.use(authenticate);

router.get('/profile', (req, res) => res.json({ user: req.user.toSafeObject() }));

router.post('/become-vendor', async (req, res, next) => {
  try {
    if (req.user.role === 'vendor') return res.json({ user: req.user.toSafeObject() });
    const { businessName, gstin } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { role: 'vendor', vendorProfile: { businessName: businessName || '', gstin: gstin || '', approved: false } },
      { new: true }
    );
    res.json({ user: user.toSafeObject() });
  } catch (err) { next(err); }
});

router.post('/become-affiliate', async (req, res, next) => {
  try {
    if (req.user.role === 'affiliate') return res.json({ user: req.user.toSafeObject() });
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { role: 'affiliate', 'affiliateProfile.commissionRate': 5 },
      { new: true }
    );
    res.json({ user: user.toSafeObject() });
  } catch (err) { next(err); }
});

router.put('/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new AppError('Both passwords required', 400, 'MISSING_FIELDS');
    if (newPassword.length < 6) throw new AppError('Password must be at least 6 characters', 400, 'WEAK_PASSWORD');
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');
    user.password = newPassword;
    user.refreshTokens = [];
    await user.save();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.put('/profile', async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'avatar'];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    res.json({ user: user.toSafeObject() });
  } catch (err) { next(err); }
});

router.post('/addresses', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.isDefault) {
      user.addresses.forEach((a) => { a.isDefault = false; });
    }
    user.addresses.push(req.body);
    await user.save();
    res.json({ addresses: user.addresses });
  } catch (err) { next(err); }
});

router.put('/addresses/:addressId', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const addr = user.addresses.id(req.params.addressId);
    if (!addr) throw new AppError('Address not found', 404, 'NOT_FOUND');
    const fields = ['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode', 'country', 'label'];
    fields.forEach((f) => { if (req.body[f] !== undefined) addr[f] = req.body[f]; });
    if (req.body.isDefault) user.addresses.forEach((a) => { a.isDefault = a._id.equals(addr._id); });
    await user.save();
    res.json({ addresses: user.addresses });
  } catch (err) { next(err); }
});

router.delete('/addresses/:addressId', async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { addresses: { _id: req.params.addressId } },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Wishlist
router.get('/wishlist', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist');
    res.json({ wishlist: user.wishlist || [] });
  } catch (err) { next(err); }
});

router.get('/wishlist/ids', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('wishlist');
    res.json({ ids: (user.wishlist || []).map((id) => id.toString()) });
  } catch (err) { next(err); }
});

router.post('/wishlist/:productId', async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { wishlist: req.params.productId },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/wishlist/:productId', async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { wishlist: req.params.productId },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/account', async (req, res, next) => {
  try {
    const Cart = require('../models/Cart');
    await Promise.all([
      User.findByIdAndDelete(req.user._id),
      Cart.deleteOne({ user: req.user._id }),
    ]);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
