const router = require('express').Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { uploadFile } = require('../services/storageService');
const AppError = require('../utils/AppError');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    if (allowed) cb(null, true);
    else cb(new AppError('Only image and PDF files are allowed', 400));
  },
});

const ALLOWED_FOLDERS = new Set(['uploads', 'products', 'kyc', 'avatars', 'blog', 'banners', 'reviews', 'warranty']);

function resolveFolder(raw) {
  const f = (raw || 'uploads').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
  return ALLOWED_FOLDERS.has(f) ? f : 'uploads';
}

router.post('/', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No file uploaded', 400));
    const result = await uploadFile(req.file, resolveFolder(req.body.folder));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/multiple', authenticate, upload.array('files', 10), async (req, res, next) => {
  try {
    if (!req.files?.length) return next(new AppError('No files uploaded', 400));
    const folder = resolveFolder(req.body.folder);
    const urls = await Promise.all(req.files.map((f) => uploadFile(f, folder)));
    res.json({ urls });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
