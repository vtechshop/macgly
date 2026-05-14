const router = require('express').Router();
const ContactSubmission = require('../../models/ContactSubmission');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unread } = req.query;
    const filter = {};
    if (unread === 'true') filter.isRead = false;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [submissions, total] = await Promise.all([
      ContactSubmission.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      ContactSubmission.countDocuments(filter),
    ]);
    res.json({ submissions, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const s = await ContactSubmission.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    res.json({ submission: s });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await ContactSubmission.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
