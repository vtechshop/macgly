const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  title: String,
  sku: String,
  price: Number,
  quantity: Number,
  gstRate: { type: Number, default: 18 },
  image: String,
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  platformFee: { type: Number, default: 0 },   // platform's cut for this item
  vendorEarning: { type: Number, default: 0 },  // vendor's net after platform cut
}, { _id: true });

const addressSchema = new mongoose.Schema({
  name: String,
  phone: String,
  line1: String,
  line2: String,
  city: String,
  state: String,
  pincode: String,
  country: { type: String, default: 'India' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [orderItemSchema],
  shippingAddress: addressSchema,

  subtotal: Number,
  gstAmount: { type: Number, default: 0 },
  shippingCharge: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: Number,

  coupon: { code: String, discount: Number },

  paymentMethod: { type: String, enum: ['razorpay', 'cod'], default: 'razorpay' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  razorpayOrderId: String,
  razorpayPaymentId: String,

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending',
  },

  tracking: {
    carrier: String,
    trackingId: String,
    url: String,
    history: [{ status: String, timestamp: Date, description: String }],
  },

  totalPlatformFee: { type: Number, default: 0 },

  affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  affiliateCommission: { type: Number, default: 0 },

  deliveredAt: Date,
  notes: String,
}, { timestamps: true });

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ affiliateId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);
