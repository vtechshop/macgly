const Product = require('../models/Product');
const Category = require('../models/Category');
const Banner = require('../models/Banner');
const AppError = require('../utils/AppError');

async function getProducts(req, res, next) {
  try {
    const {
      page = 1, limit = 24, sort = 'displayOrder',
      category, search, featured, brand, minPrice, maxPrice,
    } = req.query;

    const filter = { published: true };

    if (category) {
      filter.category = category.toLowerCase();
    }
    if (featured === 'true') filter.featured = true;
    if (brand) filter.brand = new RegExp(brand, 'i');
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { title: re },
        { brand: re },
        { tags: re },
        { category: re },
        { sku: re },
        { description: re },
      ];
    }

    const sortMap = {
      displayOrder: { displayOrder: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      newest: { createdAt: -1 },
      rating: { rating: -1 },
    };
    const sortObj = sortMap[sort] || sortMap.displayOrder;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit))
        .select('-faqs -specifications -description'),
      Product.countDocuments(filter),
    ]);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await Product.findOne({ slug: req.params.slug, published: true })
      .populate('categoryIds', 'name slug')
      .populate('vendorId', 'name vendorProfile.businessName');
    if (!product) throw new AppError('Product not found', 404, 'NOT_FOUND');
    res.json({ product });
  } catch (err) {
    next(err);
  }
}

async function getCategories(req, res, next) {
  try {
    const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
}

async function getCategory(req, res, next) {
  try {
    const category = await Category.findOne({ slug: req.params.slug, isActive: true });
    if (!category) throw new AppError('Category not found', 404, 'NOT_FOUND');
    res.json({ category });
  } catch (err) {
    next(err);
  }
}

async function getBanners(req, res, next) {
  try {
    const { platform = 'website' } = req.query;
    const now = new Date();
    const banners = await Banner.find({
      isActive: true,
      platform: { $in: [platform, 'both'] },
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).sort({ displayOrder: 1 });
    res.json({ banners });
  } catch (err) {
    next(err);
  }
}

async function getFeatured(req, res, next) {
  try {
    const products = await Product.find({ published: true, featured: true })
      .sort({ displayOrder: -1 })
      .limit(12)
      .select('-faqs -specifications -description');
    res.json({ products });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProducts, getProduct, getCategories, getCategory, getBanners, getFeatured };
