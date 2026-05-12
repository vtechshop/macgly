const router = require('express').Router();
const multer = require('multer');
const { uploadFile } = require('../../services/storageService');
const AppError = require('../../utils/AppError');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new AppError('Only images allowed', 400, 'INVALID_FILE'));
  },
});

router.post('/image', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('Image required', 400, 'MISSING_FILE');
    const folder = req.query.folder || 'products';
    const result = await uploadFile(req.file, folder);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/images', upload.array('images', 10), async (req, res, next) => {
  try {
    if (!req.files?.length) throw new AppError('Images required', 400, 'MISSING_FILE');
    const folder = req.query.folder || 'products';
    const results = await Promise.all(req.files.map((f) => uploadFile(f, folder)));
    res.json({ images: results });
  } catch (err) { next(err); }
});

module.exports = router;
