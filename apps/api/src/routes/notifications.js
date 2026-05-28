const router       = require('express').Router();
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /notifications/unread-count  — fast badge count
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.json({ count });
  } catch (err) { next(err); }
});

// GET /notifications  — paginated list, unread first
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = { user: req.user._id };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ isRead: 1, createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);
    res.json({ notifications, total, unreadCount, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// PATCH /notifications/read-all  — mark all as read
router.patch('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PUT /notifications/read-all  — alias for compatibility
router.put('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /notifications/:id/read  — mark single as read
router.patch('/:id/read', async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PUT /notifications/:id/read  — alias
router.put('/:id/read', async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /notifications/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
