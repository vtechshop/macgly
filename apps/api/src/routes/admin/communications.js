const router = require('express').Router();
const Communication = require('../../models/Communication');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');

// ─── Stats (before /:id) ──────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const now = new Date();
    const since24h = new Date(now - 24 * 3600000);

    const [total, recent24h, byType, byStatus, delivered, pending, failed] = await Promise.all([
      Communication.countDocuments(),
      Communication.countDocuments({ createdAt: { $gte: since24h } }),
      Communication.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      Communication.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Communication.countDocuments({ status: 'delivered' }),
      Communication.countDocuments({ status: 'pending' }),
      Communication.countDocuments({ status: 'failed' }),
    ]);

    const byTypeMap = {};
    byType.forEach((t) => { if (t._id) byTypeMap[t._id] = t.count; });
    const byStatusMap = {};
    byStatus.forEach((s) => { if (s._id) byStatusMap[s._id] = s.count; });

    res.json({
      data: { total, recent24h, delivered, pending, failed, byType: byTypeMap, byStatus: byStatusMap },
    });
  } catch (err) { next(err); }
});

// ─── History (legacy — before /:id) ──────────────────────────────────────────
router.get('/history', async (req, res, next) => {
  try {
    const history = await Communication.find({ type: { $in: ['email', 'marketing'] }, direction: 'outgoing' })
      .sort({ createdAt: -1 }).limit(50).lean();
    res.json({ history });
  } catch (err) { next(err); }
});

// ─── Bulk update (POST — no route conflict) ───────────────────────────────────
router.post('/bulk-update', async (req, res, next) => {
  try {
    const { ids, action, status, priority, tags } = req.body;
    if (!ids?.length) throw new AppError('No IDs provided', 400, 'MISSING_FIELDS');

    if (action === 'delete') {
      await Communication.deleteMany({ _id: { $in: ids } });
      return res.json({ success: true, deleted: ids.length });
    }
    if (action === 'read') {
      await Communication.updateMany({ _id: { $in: ids } }, { status: 'read', readAt: new Date() });
      return res.json({ success: true, updated: ids.length });
    }
    if (action === 'archive') {
      await Communication.updateMany({ _id: { $in: ids } }, { $addToSet: { tags: 'archived' } });
      return res.json({ success: true, updated: ids.length });
    }

    // Field-based update
    const update = {};
    if (status) update.status = status;
    if (priority) update.priority = priority;
    if (tags) update.$addToSet = { tags: { $each: tags } };
    await Communication.updateMany({ _id: { $in: ids } }, update);
    res.json({ success: true, updated: ids.length });
  } catch (err) { next(err); }
});

// ─── List ─────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, status, direction, search, startDate, endDate } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (direction) filter.direction = direction;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: esc, $options: 'i' };
      filter.$or = [{ message: rx }, { from: rx }, { to: rx }, { fromName: rx }, { toName: rx }, { subject: rx }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [messages, total] = await Promise.all([
      Communication.find(filter).populate('userId', 'name email').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Communication.countDocuments(filter),
    ]);

    res.json({
      data: messages,
      meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) { next(err); }
});

// ─── Single ───────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const msg = await Communication.findById(req.params.id).populate('userId', 'name email');
    if (!msg) throw new AppError('Message not found', 404, 'NOT_FOUND');
    res.json({ data: msg });
  } catch (err) { next(err); }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    const msg = await Communication.findByIdAndUpdate(req.params.id, { status: 'read', readAt: new Date() }, { new: true });
    if (!msg) throw new AppError('Not found', 404, 'NOT_FOUND');
    res.json({ data: msg });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const msg = await Communication.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!msg) throw new AppError('Not found', 404, 'NOT_FOUND');
    res.json({ data: msg });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Communication.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Legacy send (bulk email blast) ──────────────────────────────────────────
router.post('/send', async (req, res, next) => {
  try {
    const { to, subject, message } = req.body;
    if (!subject || !message) throw new AppError('Subject and message required', 400, 'MISSING_FIELDS');

    const roleMap = { all: undefined, customers: 'customer', vendors: 'vendor', affiliates: 'affiliate' };
    const role = roleMap[to];
    const filter = { isActive: true };
    if (role) filter.role = role;
    const users = await User.find(filter).select('name email _id');

    const { sendEmail } = require('../../services/emailService');
    let sent = 0;
    for (const user of users) {
      try {
        await sendEmail({ to: user.email, subject, html: `<p>Hi ${user.name},</p><p>${message.replace(/\n/g, '<br>')}</p>` });
        sent++;
        await Communication.create({
          type: 'marketing', direction: 'outgoing',
          from: process.env.ADMIN_EMAIL || 'vtechshop.customercare@gmail.com',
          fromName: 'VTech Support',
          to: user.email, toName: user.name,
          subject, message, status: 'sent', sentAt: new Date(),
          userId: user._id,
          metadata: { blast: true, target: to },
        });
      } catch { /* skip individual failures */ }
    }

    res.json({ sent, total: users.length });
  } catch (err) { next(err); }
});

module.exports = router;
