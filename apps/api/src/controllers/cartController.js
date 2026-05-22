const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const AppError = require('../utils/AppError');

function cartFilter(req) {
  return req.user ? { user: req.user._id } : { sessionId: req.cookies.sessionId || 'anon' };
}

async function resolveCart(req) {
  if (!req.user) {
    return Cart.findOne({ sessionId: req.cookies?.sessionId || 'anon' });
  }
  let cart = await Cart.findOne({ user: req.user._id });
  if (cart) return cart;
  // Migrate anonymous cart to this user
  const anonCart = await Cart.findOne({ sessionId: req.cookies?.sessionId || 'anon' });
  if (anonCart) {
    anonCart.user = req.user._id;
    anonCart.sessionId = undefined;
    await anonCart.save();
    return anonCart;
  }
  return null;
}

async function getCart(req, res, next) {
  try {
    let cart = await resolveCart(req);
    if (cart) await cart.populate('items.product', 'title images slug stock price gstRate hasVariants variants');
    res.json({ cart: cart || { items: [], total: 0 } });
  } catch (err) { next(err); }
}

async function addItem(req, res, next) {
  try {
    const { productId, quantity = 1, variantId } = req.body;
    if (!productId) throw new AppError('productId required', 400, 'MISSING_FIELDS');

    const product = await Product.findById(productId);
    if (!product || !product.published) throw new AppError('Product not found', 404, 'NOT_FOUND');

    let price = product.price;
    let image = product.images?.[0];
    let variantAttributes = null;
    let resolvedVariantId = null;

    if (product.hasVariants && variantId) {
      const variant = product.variants.id(variantId);
      if (!variant) throw new AppError('Variant not found', 404, 'NOT_FOUND');
      if (variant.stock < quantity) throw new AppError('Insufficient stock', 400, 'OUT_OF_STOCK');
      price = variant.price ?? product.price;
      image = variant.images?.[0] || image;
      variantAttributes = Object.fromEntries(variant.attributes || []);
      resolvedVariantId = variant._id;
    } else {
      if (product.stock < quantity) throw new AppError('Insufficient stock', 400, 'OUT_OF_STOCK');
    }

    let cart = await resolveCart(req);
    if (!cart) cart = new Cart(cartFilter(req));

    const existing = cart.items.find((i) =>
      i.product.toString() === productId &&
      (resolvedVariantId ? i.variantId?.toString() === resolvedVariantId.toString() : !i.variantId)
    );
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (product.hasVariants && resolvedVariantId) {
        const v = product.variants.id(resolvedVariantId);
        if (v.stock < newQty) throw new AppError('Insufficient stock', 400, 'OUT_OF_STOCK');
      } else if (product.stock < newQty) {
        throw new AppError('Insufficient stock', 400, 'OUT_OF_STOCK');
      }
      existing.quantity = newQty;
    } else {
      cart.items.push({
        product: product._id,
        variantId: resolvedVariantId,
        variantAttributes,
        title: product.title,
        price,
        image,
        quantity,
      });
    }

    await cart.save();
    await cart.populate('items.product', 'title images slug stock price gstRate hasVariants');
    res.json({ cart });
  } catch (err) { next(err); }
}

async function updateItem(req, res, next) {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) throw new AppError('quantity must be >= 1', 400, 'INVALID_REQUEST');

    const cart = await resolveCart(req);
    if (!cart) throw new AppError('Cart not found', 404, 'NOT_FOUND');

    const item = cart.items.id(req.params.itemId);
    if (!item) throw new AppError('Item not found', 404, 'NOT_FOUND');

    const product = await Product.findById(item.product);
    if (product && product.stock < quantity) throw new AppError('Insufficient stock', 400, 'OUT_OF_STOCK');

    item.quantity = quantity;
    await cart.save();
    await cart.populate('items.product', 'title images slug stock price gstRate hasVariants variants');
    res.json({ cart });
  } catch (err) { next(err); }
}

async function removeItem(req, res, next) {
  try {
    const cart = await resolveCart(req);
    if (!cart) throw new AppError('Cart not found', 404, 'NOT_FOUND');

    cart.items = cart.items.filter((i) => i._id.toString() !== req.params.itemId);
    await cart.save();
    await cart.populate('items.product', 'title images slug stock price gstRate hasVariants variants');
    res.json({ cart });
  } catch (err) { next(err); }
}

async function applyCoupon(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) throw new AppError('Coupon code required', 400, 'MISSING_FIELDS');

    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) throw new AppError('Invalid or expired coupon', 400, 'INVALID_COUPON');

    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt < now) throw new AppError('Coupon expired', 400, 'COUPON_EXPIRED');
    if (coupon.startsAt && coupon.startsAt > now) throw new AppError('Coupon not active yet', 400, 'COUPON_NOT_ACTIVE');
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new AppError('Coupon usage limit reached', 400, 'COUPON_EXHAUSTED');

    const cart = await resolveCart(req);
    if (!cart) throw new AppError('Cart not found', 404, 'NOT_FOUND');

    const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
    if (subtotal < coupon.minOrderAmount) {
      throw new AppError(`Minimum order amount is ${coupon.minOrderAmount}`, 400, 'COUPON_MIN_NOT_MET');
    }

    let discount = coupon.discountType === 'percent'
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);

    cart.coupon = { code: coupon.code, discount, type: coupon.discountType };
    await cart.save();
    res.json({ cart, discount });
  } catch (err) { next(err); }
}

async function clearCart(req, res, next) {
  try {
    const cart = await resolveCart(req);
    if (cart) await cart.deleteOne();
    res.json({ cart: { items: [], total: 0 } });
  } catch (err) { next(err); }
}

module.exports = { getCart, addItem, updateItem, removeItem, applyCoupon, clearCart };
