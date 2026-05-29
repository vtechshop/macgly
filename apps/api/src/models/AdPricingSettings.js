const mongoose = require('mongoose');

const adPricingSettingsSchema = new mongoose.Schema({
  placement:      { type: String, required: true, unique: true },
  displayName:    { type: String, required: true },
  description:    String,
  pricingType:    { type: String, enum: ['CPC', 'CPM'], default: 'CPC' },
  minBid:         { type: Number, default: 1 },
  maxBid:         { type: Number, default: 100 },
  recommendedBid: { type: Number, default: 10 },
  floorPrice:     { type: Number, default: 1 },
  dailyBudgetMin: { type: Number, default: 50 },
  auctionType:    { type: String, enum: ['second_price', 'first_price'], default: 'second_price' },
  requiresApproval: { type: Boolean, default: false },
  status:         { type: String, enum: ['active', 'inactive'], default: 'active' },
  updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('AdPricingSettings', adPricingSettingsSchema);
