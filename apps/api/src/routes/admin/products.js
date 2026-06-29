const router = require('express').Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const Product = require('../../models/Product');
const AppError = require('../../utils/AppError');
const { slugify, generateSKU } = require('../../utils/helpers');
const { invalidateCache } = require('../../middleware/cache');
const notif = require('../../utils/notificationHelper');
const StockAlert = require('../../models/StockAlert');
const { sendBackInStockEmail } = require('../../services/emailService');

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, published, categoryId, notInCategoryId } = req.query;
    const filter = {};
    if (search) filter.$text = { $search: search };
    if (published !== undefined) filter.published = published === 'true';
    if (categoryId) filter.categoryIds = categoryId;
    if (notInCategoryId) filter.categoryIds = { $nin: [notInCategoryId] };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Product.countDocuments(filter),
    ]);
    res.json({ products, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.slug) data.slug = slugify(data.title || '');
    if (!data.sku) data.sku = generateSKU('PRD');
    const product = await Product.create(data);
    await invalidateCache('cache:/api/catalog*');
    res.status(201).json({ product });
  } catch (err) { next(err); }
});

// POST /admin/products/assign-category — add products to a category
router.post('/assign-category', async (req, res, next) => {
  try {
    const { productIds, categoryId } = req.body;
    if (!productIds?.length || !categoryId) throw new AppError('productIds and categoryId required', 400, 'MISSING_FIELDS');
    await Product.updateMany({ _id: { $in: productIds } }, { $addToSet: { categoryIds: categoryId } });
    await invalidateCache('cache:/api/catalog*');
    res.json({ success: true, updated: productIds.length });
  } catch (err) { next(err); }
});

// POST /admin/products/remove-from-category — remove a product from a category
router.post('/remove-from-category', async (req, res, next) => {
  try {
    const { productId, categoryId } = req.body;
    if (!productId || !categoryId) throw new AppError('productId and categoryId required', 400, 'MISSING_FIELDS');
    await Product.findByIdAndUpdate(productId, { $pull: { categoryIds: categoryId } });
    await invalidateCache('cache:/api/catalog*');
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    res.json({ product });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const prev = await Product.findById(req.params.id).select('published vendorId stock').lean();
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    await invalidateCache('cache:/api/catalog*');

    // Notify vendor when their product gets published (approved) or unpublished (rejected)
    if (product.vendorId && prev) {
      const nowPublished   = product.published === true;
      const wasPublished   = prev.published === true;
      const publishChange  = req.body.published !== undefined;
      if (publishChange && nowPublished && !wasPublished) {
        notif.notifyVendorProductStatus({
          vendorUserId: product.vendorId,
          product,
          status: 'approved',
        }).catch(() => {});
      } else if (publishChange && !nowPublished && wasPublished) {
        notif.notifyVendorProductStatus({
          vendorUserId: product.vendorId,
          product,
          status: 'rejected',
          rejectionReason: req.body.rejectionReason || '',
        }).catch(() => {});
      }
    }

    // Fire back-in-stock emails if stock went from 0 to >0 via product edit
    if (prev && prev.stock === 0 && product.stock > 0) {
      StockAlert.find({ productId: product._id, notifiedAt: null }).lean().then((alerts) => {
        if (!alerts.length) return;
        StockAlert.updateMany({ productId: product._id, notifiedAt: null }, { $set: { notifiedAt: new Date() } }).catch(() => {});
        alerts.forEach((a) => sendBackInStockEmail({ email: a.email, product }).catch(() => {}));
      }).catch(() => {});
    }

    res.json({ product });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    await invalidateCache('cache:/api/catalog*');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /admin/products/import — bulk import via CSV
router.post('/import', csvUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('CSV file required', 400, 'MISSING_FILE');
    const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    if (!rows.length) throw new AppError('CSV is empty', 400, 'EMPTY_CSV');

    const results = { created: 0, updated: 0, errors: [] };
    for (const row of rows) {
      try {
        const title = row.title || row.Title;
        if (!title) { results.errors.push({ row, reason: 'Missing title' }); continue; }
        const slug = row.slug || slugify(title);
        const sku = row.sku || row.SKU || generateSKU('CSV');
        const price = parseFloat(row.price || row.Price || 0);
        const stock = parseInt(row.stock || row.Stock || 0);
        const data = {
          title,
          slug,
          sku,
          price,
          stock,
          description: row.description || row.Description || title,
          brand: row.brand || row.Brand || '',
          category: row.category || row.Category || '',
          tags: row.tags ? row.tags.split('|').map((t) => t.trim()) : [],
          published: (row.published || row.Published || 'false').toLowerCase() === 'true',
          gstRate: parseInt(row.gstRate || row.gst_rate || 18),
          hsn: row.hsn || row.HSN || '',
          compareAt: row.compareAt ? parseFloat(row.compareAt) : undefined,
          images: row.images ? row.images.split('|').map((u) => u.trim()) : [],
        };
        const existing = await Product.findOne({ $or: [{ sku }, { slug }] });
        if (existing) {
          await Product.findByIdAndUpdate(existing._id, data);
          results.updated++;
        } else {
          await Product.create(data);
          results.created++;
        }
      } catch (err) {
        results.errors.push({ row: row.sku || row.title, reason: err.message });
      }
    }
    await invalidateCache('cache:/api/catalog*');
    res.json({ results });
  } catch (err) { next(err); }
});

module.exports = router;
