const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  amount:      { type: Number, required: true },
  type:        { type: String, enum: ['recharge', 'spend', 'refund'], required: true },
  description: String,
}, { timestamps: true });

const adWalletSchema = new mongoose.Schema({
  vendorId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance:        { type: Number, default: 0 },
  totalRecharged: { type: Number, default: 0 },
  totalSpent:     { type: Number, default: 0 },
  transactions:   [transactionSchema],
}, { timestamps: true });

module.exports = mongoose.model('AdWallet', adWalletSchema);
