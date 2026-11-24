const Product = require('../models/Product');
const Category = require('../models/Category');
const Banner = require('../models/Banner');
const AppError = require('../utils/AppError');
const { parseTerms, anyTermRegex, scoreProduct } = require('../utils/productSearch');

async function getProducts(req, res, next) {
  try {
    const {
      page = 1, limit = 24, sort = 'displayOrder',
      category, search, featured, brand, minPrice, maxPrice, minRating, vendor,
    } = req.query;

    // status=active is treated as published=true (affiliate page uses this param)
    if (req.query.status && req.query.status !== 'active') {
      return res.json({ products: [], pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 } });
    }

    const filter = { published: true };

    if (category) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(category)) {
        // Sent as ObjectId — match by categoryIds array OR legacy category slug
        filter.$or = [{ categoryIds: category }, { category: category.toLowerCase() }];
      } else {
        // Sent as slug — also check categoryIds by resolving the slug to an id
        const catDoc = await Category.findOne({ slug: category.toLowerCase() }).select('_id');
        if (catDoc) {
          filter.$or = [{ category: category.toLowerCase() }, { categoryIds: catDoc._id }];
        } else {
          filter.category = category.toLowerCase();
        }
      }
    }
    // /store/:id lists one vendor's catalogue. Without this the parameter was
    // silently ignored and the store page rendered every product on the site.
    if (vendor) {
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(vendor)) {
        return res.json({ products: [], pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 } });
      }
      filter.vendorId = vendor;
    }
    if (featured === 'true') filter.featured = true;
    if (brand) filter.brand = new RegExp(brand, 'i');
    if (minRating) filter.rating = { $gte: parseFloat(minRating) };
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    const terms = search ? parseTerms(search) : [];
    if (search && terms.length) {
      // Any word may match (see utils/productSearch.js); category names count
      // too, so "drill" finds products filed under "Drill and Demolishing Hammers".
      const re = anyTermRegex(terms);
      const matchingCats = await Category.find({ name: re }).select('_id').lean();
      const searchOr = [{ title: re }, { brand: re }, { tags: re }, { category: re }, { sku: re }, { description: re }];
      if (matchingCats.length) searchOr.push({ categoryIds: { $in: matchingCats.map((c) => c._id) } });
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
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

    // Searching with the default order ("Featured"): rank by relevance so the
    // products that match every word, in the title, come first.
    if (terms.length && (sort === 'displayOrder' || !sortMap[sort])) {
      const candidates = await Product.find(filter)
        .select('title brand tags category sku description categoryIds displayOrder createdAt')
        .limit(2000).lean();
      const catIds = [...new Set(candidates.flatMap((p) => (p.categoryIds || []).map(String)))];
      const catNames = Object.fromEntries(
        (await Category.find({ _id: { $in: catIds } }).select('name').lean()).map((c) => [String(c._id), c.name]),
      );
      const ranked = candidates
        .map((p) => ({
          id: p._id,
          score: scoreProduct(p, terms, (p.categoryIds || []).map((id) => catNames[String(id)]).filter(Boolean), search),
          displayOrder: p.displayOrder || 0,
          createdAt: p.createdAt,
        }))
        .sort((a, b) => b.score - a.score || b.displayOrder - a.displayOrder || b.createdAt - a.createdAt);
      const pageIds = ranked.slice(skip, skip + parseInt(limit)).map((r) => r.id);
      const pageDocs = await Product.find({ _id: { $in: pageIds } })
        .select('-faqs -specifications -description')
        .populate('vendorId', 'name vendorProfile.storeName')
        .populate('categoryIds', 'name slug');
      const byId = new Map(pageDocs.map((d) => [String(d._id), d]));
      const products = pageIds.map((id) => byId.get(String(id))).filter(Boolean);
      return res.json({
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: ranked.length,
          pages: Math.ceil(ranked.length / parseInt(limit)),
        },
      });
    }

    const [products, total] = await Promise.all([
      Product.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit))
        .select('-faqs -specifications -description')
        .populate('vendorId', 'name vendorProfile.storeName')
        .populate('categoryIds', 'name slug'),
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

/** Active categories that hold at least one published product, plus their parents. */
async function findVisibleCategories() {
  const allCategories = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });

  // Find every category referenced by at least one published product
  const [productCategoryIds, productCategorySlugs] = await Promise.all([
    Product.distinct('categoryIds', { published: true }),
    Product.distinct('category',    { published: true }),
  ]);

  // Seed the active set with IDs from the categoryIds array field
  const activeIds = new Set(productCategoryIds.map((id) => id.toString()));

  // Resolve legacy slug references → IDs
  const slugToId = Object.fromEntries(allCategories.map((c) => [c.slug, c._id.toString()]));
  for (const slug of productCategorySlugs) {
    if (slug && slugToId[slug]) activeIds.add(slugToId[slug]);
  }

  // If a subcategory is active, its parent must also be visible
  const idToParent = Object.fromEntries(
    allCategories
      .filter((c) => c.parentId)
      .map((c) => [c._id.toString(), c.parentId.toString()])
  );
  for (const id of [...activeIds]) {
    const parentId = idToParent[id];
    if (parentId) activeIds.add(parentId);
  }

  return allCategories.filter((c) => activeIds.has(c._id.toString()));
}

async function getCategories(req, res, next) {
  try {
    res.json({ categories: await findVisibleCategories() });
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

module.exports = { findVisibleCategories, getProducts, getProduct, getCategories, getCategory, getBanners, getFeatured };
