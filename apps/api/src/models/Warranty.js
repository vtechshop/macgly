const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  claimId: { type: String },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending',
  },
  claimDate: { type: Date, default: Date.now },
  resolvedDate: Date,
  resolution: String,
});

const notificationSchema = new mongoose.Schema({
  type: String,
  sentAt: { type: Date, default: Date.now },
  sentTo: String,
});

const warrantySchema = new mongoose.Schema({
  warrantyId: { type: String, unique: true },
  purchaseId: String,
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  product: {
    name: String,
    model: String,
    serial: String,
    category: String,
  },
  warrantyType: {
    type: String,
    enum: ['manufacturer', 'extended', 'seller'],
    default: 'manufacturer',
  },
  purchaseDate: Date,
  warrantyStartDate: Date,
  warrantyEndDate: { type: Date, required: true },
  warrantyPeriodDays: { type: Number, default: 365 },
  status: {
    type: String,
    enum: ['active', 'expiring_soon', 'expired', 'claimed', 'void', 'no_warranty'],
    default: 'active',
  },
  isActive: { type: Boolean, default: true },
  claims: [claimSchema],
  notifications: [notificationSchema],
  lastNotificationSent: Date,
  extraInfo: {
    store: String,
    invoiceNo: String,
    remarks: String,
  },
}, { timestamps: true });

warrantySchema.index({ userId: 1 });
warrantySchema.index({ productId: 1 });
warrantySchema.index({ status: 1 });
warrantySchema.index({ warrantyEndDate: 1 });
warrantySchema.index({ purchaseId: 1, productId: 1 }, { unique: true, sparse: true });

warrantySchema.methods.updateStatus = function () {
  if (this.status === 'void' || this.status === 'claimed') return;
  const now = Date.now();
  const end = new Date(this.warrantyEndDate).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (end < now) {
    this.status = 'expired';
  } else if (end - now <= thirtyDays) {
    this.status = 'expiring_soon';
  } else {
    this.status = 'active';
  }
};

warrantySchema.methods.toAdminView = function () {
  const obj = this.toObject({ virtuals: true });
  const now = Date.now();
  const end = new Date(this.warrantyEndDate).getTime();
  const purchaseOrStart = this.purchaseDate || this.warrantyStartDate;
  obj.daysRemaining = Math.ceil((end - now) / 86400000);
  obj.daysSincePurchase = purchaseOrStart
    ? Math.floor((now - new Date(purchaseOrStart).getTime()) / 86400000)
    : null;
  return obj;
};

module.exports = mongoose.model('Warranty', warrantySchema);
