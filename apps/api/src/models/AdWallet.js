const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  amount:      { type: Number, required: true },
  type:        { type: String, enum: ['recharge', 'spend', 'refund'], required: true },
  description: String,

  // Razorpay identifiers, recorded on 'recharge' rows only.
  // `paymentId` is the idempotency key: the credit is applied with a
  // `'transactions.paymentId': { $ne: <id> }` guard, so a given Razorpay payment
  // can be credited exactly once even under concurrent retries.
  // Rows written before this field existed simply omit it.
  paymentId:   { type: String },
  orderId:     { type: String },
}, { timestamps: true });

const adWalletSchema = new mongoose.Schema({
  vendorId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance:        { type: Number, default: 0 },
  totalRecharged: { type: Number, default: 0 },
  totalSpent:     { type: Number, default: 0 },
  transactions:   [transactionSchema],
}, { timestamps: true });

// Backs the replay guard on the recharge-verify path.
adWalletSchema.index({ vendorId: 1, 'transactions.paymentId': 1 });

module.exports = mongoose.model('AdWallet', adWalletSchema);
