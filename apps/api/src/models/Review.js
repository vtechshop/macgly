const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  rating:  { type: Number, required: true, min: 1, max: 5 },
  title:   { type: String, trim: true, maxlength: 100 },
  body:    { type: String, trim: true, maxlength: 2000 },
  comment: { type: String, trim: true, maxlength: 2000 }, // alias kept in sync
  images:  [String],
  verified: { type: Boolean, default: false },
  status:   { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  rejectionReason: String,
  helpfulCount:   { type: Number, default: 0 },
  unhelpfulCount: { type: Number, default: 0 },
  vendorResponse: {
    text:         String,
    respondedAt:  Date,
    respondedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
}, { timestamps: true });

reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
