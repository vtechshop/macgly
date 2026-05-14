const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  commissionAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'credited', 'cancelled'], default: 'pending' },
  creditedAt: Date,
}, { timestamps: true });

referralSchema.index({ referrer: 1, status: 1 });
referralSchema.index({ referee: 1 });

module.exports = mongoose.model('Referral', referralSchema);
