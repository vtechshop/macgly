const mongoose = require('mongoose');

const flashSaleProductSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  discountType: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  discountValue: { type: Number, required: true },
  maxQuantity: { type: Number, default: 0 }, // 0 = unlimited
  soldCount: { type: Number, default: 0 },
}, { _id: true });

const flashSaleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  banner: String,
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  products: [flashSaleProductSchema],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

flashSaleSchema.index({ startTime: 1, endTime: 1, isActive: 1 });

module.exports = mongoose.model('FlashSale', flashSaleSchema);
