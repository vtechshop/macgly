const router = require('express').Router();
const Banner = require('../../models/Banner');
const AppError = require('../../utils/AppError');
const { invalidateCache } = require('../../middleware/cache');

router.get('/', async (req, res, next) => {
  try {
    const banners = await Banner.find().sort({ displayOrder: 1 });
    res.json({ banners });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const banner = await Banner.create(req.body);
    await invalidateCache('cache:/api/catalog/banners*');
    res.status(201).json({ banner });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!banner) throw new AppError('Banner not found', 404, 'NOT_FOUND');
    await invalidateCache('cache:/api/catalog/banners*');
    res.json({ banner });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    await invalidateCache('cache:/api/catalog/banners*');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
