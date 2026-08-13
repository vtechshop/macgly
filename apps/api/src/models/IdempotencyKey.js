const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  key:          { type: String, required: true },
  status:       { type: String, enum: ['processing', 'completed'], default: 'processing' },
  orderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
  expiresAt:    { type: Date, required: true },
}, { timestamps: true, versionKey: false });

// Unique per user — different users may use the same key string
idempotencyKeySchema.index({ userId: 1, key: 1 }, { unique: true });
// MongoDB TTL — automatically removes expired records
idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);
