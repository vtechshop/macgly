const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed },
  type: {
    type: String,
    enum: ['string', 'number', 'boolean', 'json', 'array'],
    default: 'string',
  },
  category: {
    type: String,
    enum: [
      'general', 'website', 'ads', 'email', 'payment', 'shipping',
      'security', 'notifications', 'features', 'integrations', 'maintenance', 'seo',
    ],
    default: 'general',
  },
  description: String,
  isPublic: { type: Boolean, default: false },
}, { timestamps: true });

settingSchema.index({ category: 1, key: 1 });

settingSchema.statics.get = async function (key, defaultValue) {
  const setting = await this.findOne({ key });
  return setting != null ? setting.value : defaultValue;
};

settingSchema.statics.set = async function (key, value, type = 'string', category = 'general') {
  return this.findOneAndUpdate(
    { key },
    { $set: { value, type, category } },
    { upsert: true, new: true },
  );
};

module.exports = mongoose.model('Setting', settingSchema);
