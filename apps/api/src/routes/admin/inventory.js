const router = require('express').Router();
const Product = require('../../models/Product');
const AppError = require('../../utils/AppError');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 30, lowStock, search } = req.query;
    const filter = { published: true };
    if (lowStock === 'true') filter.stock = { $lte: 10 };
    if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).select('title sku stock images price category brand').sort({ stock: 1 }).skip(skip).limit(parseInt(limit)),
      Product.countDocuments(filter),
    ]);
    res.json({ products, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.patch('/:id/stock', async (req, res, next) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) throw new AppError('Valid stock value required', 400, 'INVALID_STOCK');
    const product = await Product.findByIdAndUpdate(req.params.id, { stock: parseInt(stock) }, { new: true }).select('title sku stock');
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    res.json({ product });
  } catch (err) { next(err); }
});

module.exports = router;
