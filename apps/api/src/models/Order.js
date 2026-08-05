const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  // Which variant of the product was sold. Absent for simple products and for
  // orders written before variant inventory was tracked, both of which fall
  // back to the parent product's stock.
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  title: String,
  sku: String,
  price: Number,          // what the customer was actually charged per unit
  // Catalogue price at the time of sale, recorded only when a manual order was
  // written at a different price. Makes the override auditable, and is the base
  // the platform commission was charged on.
  listPrice: Number,
  quantity: Number,
  gstRate: { type: Number, default: 18 },
  image: String,
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  platformFee: { type: Number, default: 0 },   // platform's cut for this item
  vendorEarning: { type: Number, default: 0 },  // vendor's net after platform cut

  // ── Tax snapshot (optional, written by the future tax engine) ───────────────
  // All undefined today. Nothing reads them yet, and no existing calculation
  // changes. They exist so per-line tax can be persisted at order time rather
  // than re-derived whenever an invoice is rendered.
  hsnCode:      String,
  unit:         String,   // NOS, KG, MTR…
  taxableValue: Number,   // pre-tax base for this line
  cgst:         Number,
  sgst:         Number,
  igst:         Number,
  cess:         Number,
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
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },   // null for walk-in / manual orders
  customerName:  String,   // for manual orders without a registered user
  customerPhone: String,
  source: { type: String, enum: ['online', 'in-store', 'phone'], default: 'online' },
  items: [orderItemSchema],
  shippingAddress: addressSchema,

  // ── B2B billing (optional) ──────────────────────────────────────────────────
  // Persistence target for GSTIN capture at checkout. Absent on every existing
  // order and on every B2C order; checkout does not send it yet.
  billing: {
    companyName: String,
    gstin:       String,
    poNumber:    String,
    address:     addressSchema,   // when billing differs from shipping
  },

  // Delivery state code for goods — decides CGST+SGST vs IGST. Written by the
  // future tax engine; not derived today.
  placeOfSupplyStateCode: String,

  // True once stock has been taken for this order. Undefined on orders written
  // before inventory was tracked here, which lets cancellation tell "restore
  // what we took" apart from "there was never anything to restore".
  inventoryApplied: { type: Boolean },

  subtotal: Number,
  gstAmount: { type: Number, default: 0 },
  shippingCharge: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: Number,

  coupon: { code: String, discount: Number },

  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cod', 'cash', 'upi', 'card', 'bank_transfer', 'other'],
    default: 'razorpay',
  },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  razorpayOrderId: String,
  razorpayPaymentId: String,

  status: {
    type: String,
    enum: [
      'pending', 'pending_payment', 'placed', 'paid',
      'confirmed', 'processing', 'packed',
      'shipped', 'out_for_delivery',
      'delivered', 'cancelled', 'returned',
    ],
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
  internalNotes: String,

  cancellation: {
    reason:      String,
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
}, { timestamps: true });

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ affiliateId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'items.vendorId': 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
