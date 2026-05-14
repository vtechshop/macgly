const router = require('express').Router();
const Page = require('../../models/Page');
const AppError = require('../../utils/AppError');

router.get('/', async (req, res, next) => {
  try {
    const pages = await Page.find().sort({ createdAt: -1 });
    res.json({ pages });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, slug, content, metaTitle, metaDescription, isPublished } = req.body;
    if (!title || !content) throw new AppError('Title and content required', 400, 'MISSING_FIELDS');
    const autoSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const page = await Page.create({ title, slug: autoSlug, content, metaTitle, metaDescription, isPublished });
    res.status(201).json({ page });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const page = await Page.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!page) throw new AppError('Page not found', 404, 'NOT_FOUND');
    res.json({ page });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Page.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
