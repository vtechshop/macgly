const router = require('express').Router();
const ContactSubmission = require('../../models/ContactSubmission');
const Communication = require('../../models/Communication');
const AppError = require('../../utils/AppError');

// ─── Stats (before /:id) ──────────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const now = new Date();
    const since24h = new Date(now - 24 * 3600000);

    const [total, newCount, readCount, repliedCount, resolvedCount, spamCount, todayCount, urgentCount, avgAgg] = await Promise.all([
      ContactSubmission.countDocuments(),
      ContactSubmission.countDocuments({ status: 'new' }),
      ContactSubmission.countDocuments({ status: 'read' }),
      ContactSubmission.countDocuments({ status: 'replied' }),
      ContactSubmission.countDocuments({ status: 'resolved' }),
      ContactSubmission.countDocuments({ status: 'spam' }),
      ContactSubmission.countDocuments({ createdAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) } }),
      ContactSubmission.countDocuments({ status: { $in: ['new', 'read'] }, createdAt: { $lte: since24h } }),
      ContactSubmission.aggregate([
        { $match: { repliedAt: { $exists: true }, status: { $in: ['replied', 'resolved'] } } },
        { $project: { responseMs: { $subtract: ['$repliedAt', '$createdAt'] } } },
        { $group: { _id: null, avg: { $avg: '$responseMs' } } },
      ]),
    ]);

    const avgMs = avgAgg[0]?.avg || 0;
    const avgResponseTime = avgMs > 0 ? `${Math.round(avgMs / 3600000)}h` : 'N/A';
    const denominator = total - spamCount;
    const responseRate = denominator > 0 ? Math.round(((repliedCount + resolvedCount) / denominator) * 100) : 0;

    res.json({
      data: {
        total, new: newCount, read: readCount, replied: repliedCount,
        resolved: resolvedCount, spam: spamCount, today: todayCount, urgent: urgentCount,
        avgResponseTime, responseRate, pending: newCount + readCount,
      },
    });
  } catch (err) { next(err); }
});

// ─── Bulk update (before /:id) ────────────────────────────────────────────────
router.post('/bulk-update', async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!ids?.length) throw new AppError('No IDs provided', 400, 'MISSING_FIELDS');
    if (!['new', 'read', 'replied', 'resolved', 'spam'].includes(status)) {
      throw new AppError('Invalid status', 400, 'INVALID_STATUS');
    }
    const update = { status };
    if (status === 'replied') update.repliedAt = new Date();
    if (status === 'resolved') update.resolvedAt = new Date();
    await ContactSubmission.updateMany({ _id: { $in: ids } }, update);
    res.json({ success: true, updated: ids.length });
  } catch (err) { next(err); }
});

// ─── List ─────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search, unreadOnly } = req.query;
    const filter = {};
    if (status) filter.status = status;
    else if (unreadOnly === 'true') filter.isRead = false; // legacy compat
    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: esc, $options: 'i' };
      filter.$or = [{ name: rx }, { email: rx }, { subject: rx }];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [submissions, total] = await Promise.all([
      ContactSubmission.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      ContactSubmission.countDocuments(filter),
    ]);
    res.json({ data: submissions, submissions, meta: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

// ─── Single (auto-read) ───────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const submission = await ContactSubmission.findById(req.params.id);
    if (!submission) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    if (submission.status === 'new') {
      submission.status = 'read';
      submission.isRead = true;
      await submission.save();
    }
    res.json({ data: submission, submission });
  } catch (err) { next(err); }
});

// ─── Status update ────────────────────────────────────────────────────────────
router.put('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const update = { status };
    if (status === 'replied') update.repliedAt = new Date();
    if (status === 'resolved') update.resolvedAt = new Date();
    const s = await ContactSubmission.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!s) throw new AppError('Not found', 404, 'NOT_FOUND');
    res.json({ data: s });
  } catch (err) { next(err); }
});

// ─── Admin notes ──────────────────────────────────────────────────────────────
router.put('/:id/notes', async (req, res, next) => {
  try {
    const s = await ContactSubmission.findByIdAndUpdate(req.params.id, { adminNotes: req.body.adminNotes }, { new: true });
    if (!s) throw new AppError('Not found', 404, 'NOT_FOUND');
    res.json({ data: s });
  } catch (err) { next(err); }
});

// ─── Reply ────────────────────────────────────────────────────────────────────
router.post('/:id/reply', async (req, res, next) => {
  try {
    const { message, subject } = req.body;
    if (!message?.trim()) throw new AppError('Message is required', 400, 'MISSING_FIELDS');
    const submission = await ContactSubmission.findById(req.params.id);
    if (!submission) throw new AppError('Submission not found', 404, 'NOT_FOUND');

    submission.replies.push({ message: message.trim() });
    submission.status = 'replied';
    submission.repliedAt = new Date();
    await submission.save();

    await Communication.create({
      type: 'email', direction: 'outgoing',
      from: process.env.ADMIN_EMAIL || 'vtechshop.customercare@gmail.com',
      fromName: 'Vtech Support',
      to: submission.email, toName: submission.name,
      subject: subject || `Re: ${submission.subject || 'Your inquiry'}`,
      message: message.trim(), status: 'sent', sentAt: new Date(),
      metadata: { contactSubmissionId: submission._id },
    }).catch(() => {}); // non-critical

    res.json({ data: submission });
  } catch (err) { next(err); }
});

// ─── Delete ───────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    await ContactSubmission.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Legacy PATCH ─────────────────────────────────────────────────────────────
router.patch('/:id/read', async (req, res, next) => {
  try {
    const s = await ContactSubmission.findByIdAndUpdate(req.params.id, { status: 'read', isRead: true }, { new: true });
    res.json({ submission: s });
  } catch (err) { next(err); }
});

module.exports = router;
