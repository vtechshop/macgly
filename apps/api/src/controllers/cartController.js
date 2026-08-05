const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const abandonedCartService = require('../services/abandonedCartService');
const { resolveCart } = require('../services/cartService');

async function getCart(req, res, next) {
  try {
    let cart = await resolveCart(req);
    if (cart) await cart.populate('items.product', 'title images slug stock price taxRate hasVariants variants');
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

    const cart = await resolveCart(req, { create: true });
    if (!cart) throw new AppError('Session unavailable — please enable cookies', 400, 'NO_SESSION');

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
    await cart.populate('items.product', 'title images slug stock price taxRate hasVariants');
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
    await cart.populate('items.product', 'title images slug stock price taxRate hasVariants variants');
    res.json({ cart });
  } catch (err) { next(err); }
}

async function removeItem(req, res, next) {
  try {
    const cart = await resolveCart(req);
    if (!cart) throw new AppError('Cart not found', 404, 'NOT_FOUND');

    cart.items = cart.items.filter((i) => i._id.toString() !== req.params.itemId);
    await cart.save();
    await cart.populate('items.product', 'title images slug stock price taxRate hasVariants variants');
    res.json({ cart });
  } catch (err) { next(err); }
}

async function clearCart(req, res, next) {
  try {
    const cart = await resolveCart(req);
    if (cart) await cart.deleteOne();
    if (req.user) abandonedCartService.markRecovered(req.user._id).catch(() => {});
    res.json({ cart: { items: [], total: 0 } });
  } catch (err) { next(err); }
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
