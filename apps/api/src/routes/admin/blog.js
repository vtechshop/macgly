const router = require('express').Router();
const Blog = require('../../models/Blog');
const AppError = require('../../utils/AppError');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (search) filter.title = { $regex: search, $options: 'i' };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [posts, total] = await Promise.all([
      Blog.find(filter).populate('author', 'name').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Blog.countDocuments(filter),
    ]);
    res.json({ posts, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, slug, excerpt, content, coverImage, tags } = req.body;
    if (!title || !content) throw new AppError('Title and content required', 400, 'MISSING_FIELDS');
    const autoSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const post = await Blog.create({ title, slug: autoSlug, excerpt, content, coverImage, tags, author: req.user._id });
    res.status(201).json({ post });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const post = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!post) throw new AppError('Post not found', 404, 'NOT_FOUND');
    res.json({ post });
  } catch (err) { next(err); }
});

router.patch('/:id/publish', async (req, res, next) => {
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) throw new AppError('Post not found', 404, 'NOT_FOUND');
    post.isPublished = !post.isPublished;
    if (post.isPublished && !post.publishedAt) post.publishedAt = new Date();
    await post.save();
    res.json({ post });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
