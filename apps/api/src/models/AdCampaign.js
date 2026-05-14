const mongoose = require('mongoose');

const adCampaignSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  title: { type: String, required: true },
  budget: { type: Number, required: true }, // total budget in ₹
  spent: { type: Number, default: 0 },
  bidPerClick: { type: Number, required: true }, // ₹ per click
  targetUrl: String,
  bannerImage: String,
  placement: { type: String, enum: ['homepage', 'search', 'category', 'product'], default: 'homepage' },
  status: { type: String, enum: ['pending', 'active', 'paused', 'rejected', 'completed'], default: 'pending' },
  adminNote: String,
  clicks: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  startDate: Date,
  endDate: Date,
}, { timestamps: true });

adCampaignSchema.index({ vendor: 1, status: 1 });
adCampaignSchema.index({ status: 1, placement: 1 });

module.exports = mongoose.model('AdCampaign', adCampaignSchema);
