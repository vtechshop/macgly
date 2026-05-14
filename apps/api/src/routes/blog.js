const router = require('express').Router();
const Blog = require('../models/Blog');
const AppError = require('../utils/AppError');

// List published posts
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 12, tag, search } = req.query;
    const filter = { isPublished: true };
    if (tag) filter.tags = tag;
    if (search) filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { excerpt: { $regex: search, $options: 'i' } },
    ];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [posts, total] = await Promise.all([
      Blog.find(filter)
        .select('title slug excerpt coverImage tags publishedAt createdAt author')
        .populate('author', 'name avatar')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Blog.countDocuments(filter),
    ]);
    res.json({ posts, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

// Single post by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const post = await Blog.findOne({ slug: req.params.slug, isPublished: true })
      .populate('author', 'name avatar');
    if (!post) throw new AppError('Post not found', 404, 'NOT_FOUND');
    res.json({ post });
  } catch (err) { next(err); }
});

module.exports = router;
