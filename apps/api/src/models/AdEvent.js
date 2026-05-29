const mongoose = require('mongoose');

const adEventSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdCampaign', required: true },
  event:      { type: String, enum: ['impression', 'click', 'conversion'], required: true },
  timestamp:  { type: Date, default: Date.now },
  cost:       { type: Number, default: 0 },
  revenue:    { type: Number, default: 0 },
}, { timestamps: false });

adEventSchema.index({ campaignId: 1, timestamp: -1 });
adEventSchema.index({ event: 1, timestamp: -1 });

module.exports = mongoose.model('AdEvent', adEventSchema);
