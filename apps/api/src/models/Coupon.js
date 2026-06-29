const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, default: '' },
  type: { type: String, enum: ['percent', 'flat'], required: true },
  value: { type: Number, required: true, min: 0 },
  minOrderAmount: { type: Number, default: 0 },
  maxDiscount: { type: Number, default: 0 }, // 0 = no cap (percent coupons only)
  usageLimit: { type: Number, default: 0 }, // 0 = unlimited
  perUserLimit: { type: Number, default: 1 }, // 0 = unlimited per user
  usedCount: { type: Number, default: 0 },
  usedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    usedAt: { type: Date, default: Date.now },
  }],
  expiry: { type: Date, default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true });

couponSchema.index({ code: 1, active: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
