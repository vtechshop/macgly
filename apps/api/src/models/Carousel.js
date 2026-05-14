const mongoose = require('mongoose');

const carouselSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: String,
  image: { type: String, required: true },
  link: String,
  buttonText: { type: String, default: 'Shop Now' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  validFrom: Date,
  validTo: Date,
}, { timestamps: true });

module.exports = mongoose.model('Carousel', carouselSchema);
