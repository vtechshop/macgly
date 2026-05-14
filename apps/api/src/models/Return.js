const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema({
  returnId: { type: String, unique: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    title: String,
    quantity: Number,
    price: Number,
    reason: String,
  }],
  reason: { type: String, required: true },
  description: String,
  images: [String],
  status: {
    type: String,
    enum: ['requested', 'approved', 'rejected', 'pickup_scheduled', 'picked_up', 'refunded'],
    default: 'requested',
  },
  refundAmount: { type: Number, default: 0 },
  refundStatus: { type: String, enum: ['pending', 'initiated', 'completed'], default: 'pending' },
  razorpayRefundId: String,
  adminNote: String,
  resolvedAt: Date,
}, { timestamps: true });

returnSchema.pre('save', function (next) {
  if (!this.returnId) this.returnId = 'RET-' + Date.now();
  next();
});

returnSchema.index({ order: 1 });
returnSchema.index({ user: 1 });

module.exports = mongoose.model('Return', returnSchema);
