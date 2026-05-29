const router = require('express').Router();
const Blog = require('../../models/Blog');
const AppError = require('../../utils/AppError');

function toStatus(post) {
  if (post.status && post.status !== 'draft') return post.status; // published / archived
  return post.isPublished ? 'published' : (post.status || 'draft');
}

function autoSlug(title) {
  return title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// GET /admin/blog/stats — must be before /:id
router.get('/stats', async (req, res, next) => {
  try {
    const publishedFilter = { $or: [{ status: 'published' }, { isPublished: true }] };
    const [totalBlogs, publishedBlogs, draftBlogs, agg, recentBlogs] = await Promise.all([
      Blog.countDocuments(),
      Blog.countDocuments(publishedFilter),
      Blog.countDocuments({ $or: [{ status: 'draft' }, { isPublished: false, status: { $ne: 'published' } }] }),
      Blog.aggregate([{ $group: { _id: null, views: { $sum: '$views' }, likes: { $sum: '$likes' }, comments: { $sum: '$commentsCount' } } }]),
      Blog.find(publishedFilter).sort('-publishedAt').limit(5).select('title slug views likes commentsCount publishedAt'),
    ]);
    const totals = agg[0] || {};
    res.json({
      data: {
        totalBlogs, publishedBlogs, draftBlogs,
        byStatus: { published: publishedBlogs, draft: draftBlogs },
        totalViews: totals.views || 0,
        totalLikes: totals.likes || 0,
        totalComments: totals.comments || 0,
        recentBlogs,
      },
    });
  } catch (err) { next(err); }
});

// GET /admin/blog/:id — full post with content
router.get('/:id', async (req, res, next) => {
  try {
    const post = await Blog.findById(req.params.id).populate('author', 'name email');
    if (!post) throw new AppError('Post not found', 404, 'NOT_FOUND');
    res.json({ data: { ...post.toObject(), status: toStatus(post) } });
  } catch (err) { next(err); }
});

// GET /admin/blog — paginated list (no content field)
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, category, type } = req.query;
    const filter = {};
    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ title: { $regex: esc, $options: 'i' } }, { excerpt: { $regex: esc, $options: 'i' } }];
    }
    if (status === 'published') filter.$or = [{ status: 'published' }, { isPublished: true }];
    else if (status === 'draft') filter.status = { $in: ['draft', undefined] };
    else if (status === 'archived') filter.status = 'archived';
    if (category) filter.category = { $regex: category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [posts, total] = await Promise.all([
      Blog.find(filter).select('-content').populate('author', 'name').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Blog.countDocuments(filter),
    ]);

    const data = posts.map((p) => ({ ...p.toObject(), status: toStatus(p) }));
    const meta = { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) };
    res.json({ data, meta, posts: data, pagination: meta }); // support all formats
  } catch (err) { next(err); }
});

// POST /admin/blog — create
router.post('/', async (req, res, next) => {
  try {
    const { title, slug, excerpt, content, category, featuredImage, coverImage, tags, status = 'draft', type = 'post' } = req.body;
    if (!title?.trim() || !content?.trim()) throw new AppError('Title and content required', 400, 'MISSING_FIELDS');
    const finalSlug = slug?.trim() || autoSlug(title);
    const isPublished = status === 'published';
    const post = await Blog.create({
      title: title.trim(), slug: finalSlug, excerpt, content, category,
      featuredImage: featuredImage || coverImage,
      coverImage: coverImage || featuredImage,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []),
      status, isPublished, type, author: req.user._id,
      publishedAt: isPublished ? new Date() : undefined,
    });
    res.status(201).json({ data: { ...post.toObject(), status: toStatus(post) }, post });
  } catch (err) { next(err); }
});

// PUT /admin/blog/:id — update
router.put('/:id', async (req, res, next) => {
  try {
    const { status, tags, ...rest } = req.body;
    const update = { ...rest };
    if (tags !== undefined) update.tags = Array.isArray(tags) ? tags : (tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []);
    if (status !== undefined) {
      update.status = status;
      update.isPublished = status === 'published';
      if (status === 'published') update.publishedAt = update.publishedAt || new Date();
    }
    const post = await Blog.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: false });
    if (!post) throw new AppError('Post not found', 404, 'NOT_FOUND');
    res.json({ data: { ...post.toObject(), status: toStatus(post) }, post });
  } catch (err) { next(err); }
});

// DELETE /admin/blog/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
