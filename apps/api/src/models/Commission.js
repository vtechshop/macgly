const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  type: { type: String, enum: ['vendor', 'affiliate'], required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // vendor or affiliate
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  saleAmount: { type: Number, required: true },
  commissionRate: { type: Number, required: true }, // percentage
  commissionAmount: { type: Number, required: true },
  platformFee: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'approved', 'paid', 'cancelled'], default: 'pending' },
  approvedAt:   Date,
  rejectedAt:   Date,
  paidAt:       Date,
  payoutId:     String,
  paymentRef:   String, // UTR or transaction ID
  paymentProof: String, // screenshot URL
  note:         String,
}, { timestamps: true });

commissionSchema.index({ user: 1, status: 1 });
commissionSchema.index({ order: 1 });
commissionSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Commission', commissionSchema);
