const router = require('express').Router();
const User   = require('../../models/User');
const AppError          = require('../../utils/AppError');
const notificationHelper = require('../../utils/notificationHelper');
const emailService       = require('../../services/emailService');

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

// POST /admin/users/:id/message  — send in-app notification + email to any user
router.post('/:id/message', async (req, res, next) => {
  try {
    const { subject, message } = req.body;
    if (!message?.trim()) throw new AppError('Message body is required', 400, 'MISSING_MESSAGE');

    const user = await User.findById(req.params.id).select('name email role').lean();
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

    const title = subject?.trim() || 'Message from Macgly Admin';

    // In-app bell notification
    await notificationHelper.createNotification({
      userId:  user._id,
      type:    'system',
      title,
      message: message.trim(),
      data:    { fromAdmin: true, adminId: req.user._id },
      link:    null,
    });

    // Email (fails silently if no key configured)
    if (user.email) {
      await emailService.sendEmail({
        to:      user.email,
        subject: title,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto">
            <h2 style="color:#1a1a1a">${title}</h2>
            <div style="color:#444;line-height:1.6">${message.trim().replace(/\n/g, '<br>')}</div>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
            <p style="color:#999;font-size:12px">— Macgly Admin Team</p>
          </div>
        `,
      }).catch((e) => console.error('[AdminMsg] Email error:', e.message));
    }

    res.json({ success: true, message: `Message sent to ${user.name}` });
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
