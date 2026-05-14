const router = require('express').Router();
const Newsletter = require('../../models/Newsletter');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, active } = req.query;
    const filter = {};
    if (active !== undefined) filter.isActive = active === 'true';
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [subscribers, total] = await Promise.all([
      Newsletter.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Newsletter.countDocuments(filter),
    ]);
    const activeCount = await Newsletter.countDocuments({ isActive: true });
    res.json({ subscribers, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) }, activeCount });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Newsletter.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
