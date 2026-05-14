const router = require('express').Router();
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');

router.post('/', async (req, res, next) => {
  try {
    const { customerEmail, items, paymentMethod = 'cod', paymentStatus = 'pending', shippingAddress, note } = req.body;
    if (!customerEmail || !items?.length || !shippingAddress) {
      throw new AppError('customerEmail, items and shippingAddress required', 400, 'MISSING_FIELDS');
    }

    const customer = await User.findOne({ email: customerEmail.toLowerCase() });
    if (!customer) throw new AppError('Customer not found', 404, 'NOT_FOUND');

    // Build order items from product IDs
    const orderItems = [];
    let subtotal = 0;
    for (const { productId, quantity } of items) {
      const product = await Product.findById(productId);
      if (!product) throw new AppError(`Product ${productId} not found`, 404, 'NOT_FOUND');
      const price = product.salePrice || product.price;
      orderItems.push({
        product: product._id,
        title: product.title,
        sku: product.sku,
        image: product.images?.[0] || '',
        price,
        quantity,
        vendorId: product.vendorId,
        vendorEarning: 0,
        platformFee: 0,
      });
      subtotal += price * quantity;
    }

    const orderId = 'MAN-' + Date.now();
    const order = await Order.create({
      orderId,
      user: customer._id,
      items: orderItems,
      subtotal,
      shippingCharge: 0,
      totalAmount: subtotal,
      paymentMethod,
      paymentStatus,
      status: 'confirmed',
      shippingAddress,
      notes: note || 'Manual order created by admin',
    });

    res.status(201).json({ order });
  } catch (err) { next(err); }
});

module.exports = router;
