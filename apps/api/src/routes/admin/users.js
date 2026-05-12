const router = require('express').Router();
const User = require('../../models/User');
const AppError = require('../../utils/AppError');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: new RegExp(escaped, 'i') },
        { email: new RegExp(escaped, 'i') },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total, roleCounts] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    ]);
    const counts = { total: 0, customer: 0, vendor: 0, affiliate: 0, admin: 0 };
    roleCounts.forEach((r) => { if (counts[r._id] !== undefined) counts[r._id] = r.count; counts.total += r.count; });
    res.json({ users, pagination: { page: parseInt(page), limit: parseInt(limit), total }, counts });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'role', 'isActive', 'phone', 'vendorProfile', 'affiliateProfile'];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ user });
  } catch (err) { next(err); }
});

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) throw new AppError('Password must be at least 8 characters', 400, 'WEAK_PASSWORD');
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.findByIdAndUpdate(req.params.id, { password: hashed }, { new: true });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      throw new AppError('Cannot delete your own account', 400, 'INVALID_REQUEST');
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
