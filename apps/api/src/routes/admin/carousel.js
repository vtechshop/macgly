const router = require('express').Router();
const multer = require('multer');
const Carousel = require('../../models/Carousel');
const AppError = require('../../utils/AppError');
const { uploadFile } = require('../../services/storageService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', async (req, res, next) => {
  try {
    const slides = await Carousel.find().sort({ order: 1, createdAt: -1 });
    res.json({ slides });
  } catch (err) { next(err); }
});

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    const { title, subtitle, link, buttonText, order, isActive, validFrom, validTo } = req.body;
    if (!title) return next(new AppError('Title is required', 400));

    let image = req.body.imageUrl || req.body.image;
    if (req.file) image = await uploadFile(req.file, 'carousel');
    if (!image) return next(new AppError('Image is required', 400));

    const slide = await Carousel.create({ title, subtitle, image, link, buttonText, order: order || 0, isActive: isActive !== 'false', validFrom, validTo });
    res.status(201).json({ slide });
  } catch (err) { next(err); }
});

router.put('/:id', upload.single('image'), async (req, res, next) => {
  try {
    const update = { ...req.body };
    if (req.file) update.image = await uploadFile(req.file, 'carousel');
    if (update.isActive !== undefined) update.isActive = update.isActive !== 'false';
    const slide = await Carousel.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!slide) return next(new AppError('Slide not found', 404));
    res.json({ slide });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Carousel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

// Reorder
router.patch('/reorder', async (req, res, next) => {
  try {
    const { order } = req.body; // [{ id, order }]
    await Promise.all((order || []).map(({ id, order: o }) => Carousel.findByIdAndUpdate(id, { order: o })));
    res.json({ message: 'Reordered' });
  } catch (err) { next(err); }
});

module.exports = router;
