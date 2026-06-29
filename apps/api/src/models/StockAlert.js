const mongoose = require('mongoose');

const stockAlertSchema = new mongoose.Schema({
  email:      { type: String, required: true, lowercase: true, trim: true },
  productId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  notifiedAt: { type: Date, default: null },
}, { timestamps: true });

stockAlertSchema.index({ email: 1, productId: 1 }, { unique: true });
stockAlertSchema.index({ productId: 1, notifiedAt: 1 });

module.exports = mongoose.model('StockAlert', stockAlertSchema);
