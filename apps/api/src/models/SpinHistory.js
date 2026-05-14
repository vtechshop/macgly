const mongoose = require('mongoose');

const spinHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  result: {
    label: String,
    type: String,
    value: Number,
  },
  couponCode: String,
  pointsAwarded: { type: Number, default: 0 },
}, { timestamps: true });

spinHistorySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('SpinHistory', spinHistorySchema);
