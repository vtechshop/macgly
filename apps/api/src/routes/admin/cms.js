const router = require('express').Router();
const Page = require('../../models/Page');
const AppError = require('../../utils/AppError');

function autoSlug(title) {
  return title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

router.get('/', async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const filter = {};
    if (search) filter.$or = [
      { title: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      { slug:  { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ];
    if (status === 'published') filter.isPublished = true;
    else if (status === 'draft') filter.isPublished = false;
    const pages = await Page.find(filter).sort({ title: 1 });
    res.json({ data: pages, pages }); // support both formats
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, slug, content, excerpt, metaTitle, metaDescription, isPublished, published } = req.body;
    if (!title?.trim() || !content?.trim()) throw new AppError('Title and content required', 400, 'MISSING_FIELDS');
    const finalSlug = slug?.trim() || autoSlug(title);
    const page = await Page.create({
      title: title.trim(), slug: finalSlug, content, excerpt,
      metaTitle, metaDescription,
      isPublished: published ?? isPublished ?? false,
    });
    res.status(201).json({ page });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { published, ...rest } = req.body;
    const update = { ...rest };
    if (published !== undefined) update.isPublished = published;
    const page = await Page.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
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
