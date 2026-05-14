const mongoose = require('mongoose');

const sliceSchema = new mongoose.Schema({
  label: { type: String, required: true },
  type: { type: String, enum: ['points', 'discount', 'free_shipping', 'no_win'], required: true },
  value: { type: Number, default: 0 },
  probability: { type: Number, required: true },
  color: { type: String, default: '#f59e0b' },
});

const spinConfigSchema = new mongoose.Schema({
  isEnabled: { type: Boolean, default: true },
  dailySpinsPerUser: { type: Number, default: 1 },
  spinsOnRegister: { type: Number, default: 1 },
  slices: [sliceSchema],
}, { timestamps: true });

module.exports = mongoose.model('SpinConfig', spinConfigSchema);
