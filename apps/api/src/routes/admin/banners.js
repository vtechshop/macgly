const router = require('express').Router();
const multer = require('multer');
const Banner = require('../../models/Banner');
const AppError = require('../../utils/AppError');
const { uploadFile } = require('../../services/storageService');
const { invalidateCache } = require('../../middleware/cache');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new AppError('Only images allowed', 400, 'INVALID_FILE'));
  },
});

function normPlatform(p) {
  if (p === 'web') return 'website';
  if (['website', 'mobile', 'both'].includes(p)) return p;
  return 'website';
}

function parseBool(v) {
  if (v === 'true' || v === true) return true;
  if (v === 'false' || v === false) return false;
  return Boolean(v);
}

// GET /admin/banners — all banners (admin)
router.get('/', async (req, res, next) => {
  try {
    const banners = await Banner.find().sort({ displayOrder: 1, createdAt: -1 });
    res.json({ data: banners, banners });
  } catch (err) { next(err); }
});

// POST /admin/banners/fix-platform — must be before /:id routes
router.post('/fix-platform', async (req, res, next) => {
  try {
    const result = await Banner.updateMany(
      { $or: [{ platform: { $exists: false } }, { platform: null }, { platform: 'web' }] },
      { $set: { platform: 'website' } }
    );
    await invalidateCache('cache:/api/catalog/banners*');
    res.json({ success: true, fixed: result.modifiedCount });
  } catch (err) { next(err); }
});

// POST /admin/banners — create with optional image upload
router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    const { title, subtitle, link, order, isActive, imagePosition, platform, startDate, endDate } = req.body;
    if (!title?.trim()) throw new AppError('Title is required', 400, 'MISSING_FIELDS');

    let imageUrl = req.body.image;
    if (req.file) {
      const result = await uploadFile(req.file, 'banners');
      imageUrl = result.url;
    }
    if (!imageUrl) throw new AppError('Banner image is required', 400, 'MISSING_FILE');

    const displayOrder = Number(order ?? 0);
    const banner = await Banner.create({
      title: title.trim(), subtitle, image: imageUrl, link,
      displayOrder,
      isActive: isActive !== undefined ? parseBool(isActive) : true,
      imagePosition: imagePosition || '50',
      platform: normPlatform(platform),
      startsAt: startDate || undefined,
      endsAt:   endDate   || undefined,
    });
    await invalidateCache('cache:/api/catalog/banners*');
    res.status(201).json({ banner, data: banner });
  } catch (err) { next(err); }
});

// PUT /admin/banners/:id — update with optional image re-upload
router.put('/:id', upload.single('image'), async (req, res, next) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw new AppError('Banner not found', 404, 'NOT_FOUND');

    if (req.file) {
      const result = await uploadFile(req.file, 'banners');
      banner.image = result.url;
    } else if (req.body.image) {
      banner.image = req.body.image;
    }

    const { title, subtitle, link, order, isActive, imagePosition, platform, startDate, endDate } = req.body;
    if (title !== undefined) banner.title = title;
    if (subtitle !== undefined) banner.subtitle = subtitle;
    if (link !== undefined) banner.link = link;
    if (order !== undefined) banner.displayOrder = Number(order);
    if (isActive !== undefined) banner.isActive = parseBool(isActive);
    if (imagePosition !== undefined) banner.imagePosition = imagePosition;
    if (platform !== undefined) banner.platform = normPlatform(platform);
    if (startDate !== undefined) banner.startsAt = startDate || null;
    if (endDate !== undefined) banner.endsAt = endDate || null;

    await banner.save();
    await invalidateCache('cache:/api/catalog/banners*');
    res.json({ banner, data: banner });
  } catch (err) { next(err); }
});

// DELETE /admin/banners/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) throw new AppError('Banner not found', 404, 'NOT_FOUND');
    await invalidateCache('cache:/api/catalog/banners*');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
