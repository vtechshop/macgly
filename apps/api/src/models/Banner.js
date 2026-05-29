const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  subtitle:      String,
  image:         { type: String, required: true },
  imageAlt:      String,
  imagePosition: { type: String, default: '50' },
  link:          String,
  platform:      { type: String, enum: ['website', 'mobile', 'both'], default: 'website' },
  displayOrder:  { type: Number, default: 0 },
  isActive:      { type: Boolean, default: true },
  startsAt:      Date,
  endsAt:        Date,
}, { timestamps: true });

module.exports = mongoose.model('Banner', bannerSchema);
