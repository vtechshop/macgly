const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  variantAttributes: { type: Map, of: String, default: null },
  title: String,
  price: { type: Number, required: true },
  image: String,
  quantity: { type: Number, required: true, min: 1, default: 1 },
}, { _id: true });

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
  sessionId: { type: String, unique: true, sparse: true },
  items: [cartItemSchema],
  coupon: { code: String, discount: Number, type: { type: String, enum: ['percent', 'flat'] } },
}, { timestamps: true });

cartSchema.virtual('total').get(function () {
  return this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
});

cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

// Guest carts are disposable — drop them 30 days after last activity so anonymous
// sessions don't accumulate. The partial filter keeps user-owned carts untouched.
cartSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { user: { $exists: false } },
    name: 'guest_cart_ttl',
  },
);

module.exports = mongoose.model('Cart', cartSchema);
