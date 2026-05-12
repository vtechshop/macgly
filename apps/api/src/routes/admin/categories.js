const router = require('express').Router();
const Category = require('../../models/Category');
const AppError = require('../../utils/AppError');
const { slugify } = require('../../utils/helpers');
const { invalidateCache } = require('../../middleware/cache');

router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ displayOrder: 1, name: 1 });
    res.json({ categories });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.slug) data.slug = slugify(data.name || '');
    const category = await Category.create(data);
    await invalidateCache('cache:/api/catalog/categories*');
    res.status(201).json({ category });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!category) throw new AppError('Category not found', 404, 'NOT_FOUND');
    await invalidateCache('cache:/api/catalog/categories*');
    res.json({ category });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    await invalidateCache('cache:/api/catalog/categories*');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
