const mongoose = require('mongoose');

const abandonedCartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: String, // for guest recovery
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    title: String,
    price: Number,
    quantity: Number,
    image: String,
  }],
  totalValue: { type: Number, default: 0 },
  recoveryEmailSentAt: Date,
  recovered: { type: Boolean, default: false },
  recoveredAt: Date,
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

abandonedCartSchema.index({ user: 1, recovered: 1 });
abandonedCartSchema.index({ lastSeenAt: 1 }); // for TTL cleanup

module.exports = mongoose.model('AbandonedCart', abandonedCartSchema);
