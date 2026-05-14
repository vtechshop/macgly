const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['earn', 'redeem', 'expire', 'admin_adjust'], required: true },
  points: { type: Number, required: true }, // positive = earned, negative = redeemed
  balance: { type: Number, required: true }, // running balance after this tx
  description: String,
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  expiresAt: Date,
}, { timestamps: true, _id: true });

const loyaltySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalRedeemed: { type: Number, default: 0 },
  transactions: { type: [transactionSchema], default: [] },
}, { timestamps: true });

loyaltySchema.index({ user: 1 });

// Earn points: 1 point per ₹10 spent by default (configurable)
loyaltySchema.methods.earn = function (points, description, orderId) {
  this.balance += points;
  this.totalEarned += points;
  this.transactions.push({ type: 'earn', points, balance: this.balance, description, order: orderId });
  if (this.transactions.length > 200) this.transactions = this.transactions.slice(-200);
};

loyaltySchema.methods.redeem = function (points, description, orderId) {
  if (points > this.balance) throw new Error('Insufficient loyalty points');
  this.balance -= points;
  this.totalRedeemed += points;
  this.transactions.push({ type: 'redeem', points: -points, balance: this.balance, description, order: orderId });
};

module.exports = mongoose.model('Loyalty', loyaltySchema);
