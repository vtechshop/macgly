const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  clicks: { type: Number, default: 0 },
});

schema.index({ affiliateId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AffiliateClick', schema);
