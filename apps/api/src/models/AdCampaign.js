const mongoose = require('mongoose');

const keywordSchema = new mongoose.Schema({
  keyword:   String,
  matchType: { type: String, enum: ['broad', 'phrase', 'exact'], default: 'broad' },
}, { _id: false });

const statsSchema = new mongoose.Schema({
  impressions: { type: Number, default: 0 },
  clicks:      { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  spend:       { type: Number, default: 0 },
  revenue:     { type: Number, default: 0 },
}, { _id: false });

const adCampaignSchema = new mongoose.Schema({
  vendor:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },

  name:  String,
  title: String, // legacy

  type: {
    type: String,
    enum: ['SponsoredProduct', 'SponsoredBrand', 'Banner'],
    default: 'SponsoredProduct',
  },
  pricing: { type: String, enum: ['CPC', 'CPM'], default: 'CPC' },

  bid:         Number,
  bidPerClick: Number, // legacy

  dailyBudget: Number,
  totalBudget: Number,
  budget:      Number, // legacy
  spent:       { type: Number, default: 0 }, // legacy

  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'approved', 'pending_approval', 'pending', 'rejected', 'completed', 'budget_exhausted'],
    default: 'pending',
  },

  placement:   { type: String, default: 'homepage_banner' },
  position:    { type: String, enum: ['top', 'right', 'bottom', 'left', 'center'] },
  bannerSize:  String,
  bannerImage: String,
  targetUrl:   String,
  dimensions:  { width: Number, height: Number },

  targeting: {
    keywords: [keywordSchema],
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },

  stats: { type: statsSchema, default: () => ({}) },

  // Legacy top-level stats
  clicks:      { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },

  approval: {
    status:          String,
    reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:      Date,
    rejectionReason: String,
    adminNotes:      String,
  },
  adminNote: String, // legacy

  qualityScore: {
    overall:        { type: Number, default: 5 },
    ctaScore:       { type: Number, default: 5 },
    relevanceScore: { type: Number, default: 5 },
  },
  auctionScore: { type: Number, default: 0 },

  startAt:   Date,
  endAt:     Date,
  startDate: Date, // legacy
  endDate:   Date, // legacy
}, { timestamps: true });

adCampaignSchema.methods.calculateAuctionScore = function () {
  const bid = this.bid || this.bidPerClick || 0;
  const quality = this.qualityScore?.overall || 5;
  this.auctionScore = bid * (quality / 10);
  return this.auctionScore;
};

adCampaignSchema.index({ vendor: 1, status: 1 });
adCampaignSchema.index({ status: 1, placement: 1 });

module.exports = mongoose.model('AdCampaign', adCampaignSchema);
