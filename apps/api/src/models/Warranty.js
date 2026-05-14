const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'in_review', 'approved', 'rejected', 'resolved'], default: 'open' },
  resolution: String,
  resolvedAt: Date,
}, { timestamps: true });

const warrantySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  serialNumber: { type: String, unique: true, sparse: true },
  purchaseDate: { type: Date, required: true },
  expiryDate: { type: Date, required: true },
  warrantyPeriodMonths: { type: Number, default: 12 },
  status: { type: String, enum: ['active', 'expired', 'claimed', 'void'], default: 'active' },
  claims: [claimSchema],
}, { timestamps: true });

warrantySchema.index({ user: 1 });
warrantySchema.index({ product: 1 });

warrantySchema.pre('save', function (next) {
  if (this.expiryDate < new Date()) this.status = 'expired';
  next();
});

module.exports = mongoose.model('Warranty', warrantySchema);
