const mongoose = require('mongoose');
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const productSchema = new Schema({

  // ── Identity ─────────────────────────────────────────────────
  vendorId:    { type: ObjectId, ref: 'User' },   // null = admin product
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, unique: true, sparse: true, lowercase: true },
  description: { type: String, required: true },
  brand:       String,
  sku:         { type: String, unique: true, sparse: true },
  tags:        [{ type: String, trim: true, lowercase: true }],

  // ── Media ─────────────────────────────────────────────────────
  images:    [String],         // Cloudinary URLs
  imageAlts: [String],         // alt text per image (index-matched)
  videoUrl:  { type: String, trim: true },

  // ── Pricing ───────────────────────────────────────────────────
  price:     { type: Number, required: true, min: 0 },
  compareAt: { type: Number, min: 0 },
  cost:      { type: Number, min: 0 },   // internal cost price

  // ── Tax / GST ─────────────────────────────────────────────────
  hsnCode:     { type: String, trim: true },
  taxable:     { type: Boolean, default: true },
  taxRate:     { type: Number, default: 0 },     // e.g. 18 for 18%
  taxIncluded: { type: Boolean, default: false },

  // ── Inventory ─────────────────────────────────────────────────
  stock:             { type: Number, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 10 },
  trackInventory:    { type: Boolean, default: true },
  displayOrder:      { type: Number, default: 0 },

  // ── Shipping ──────────────────────────────────────────────────
  weight:           Number,                              // kg
  shippingCharge:   { type: Number, default: 0 },        // flat override (₹)
  delhiveryEnabled: { type: Boolean, default: true },
  shippingZones: [{
    zone:   { type: String, enum: ['tamilnadu', 'south', 'north', 'east', 'west'] },
    charge: { type: Number, min: 0 },
  }],
  dimensions: {
    length: Number, width: Number, height: Number,
    unit: { type: String, enum: ['in', 'cm'], default: 'in' },
  },

  // ── Status ────────────────────────────────────────────────────
  published: { type: Boolean, default: false },
  featured:  { type: Boolean, default: false },

  // ── Stats (auto-managed) ──────────────────────────────────────
  viewCount:   { type: Number, default: 0 },
  soldCount:   { type: Number, default: 0 },
  rating:      { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },

  // ── Categories ────────────────────────────────────────────────
  category:   { type: String, trim: true, lowercase: true },   // legacy slug
  categoryIds:[{ type: ObjectId, ref: 'Category' }],

  // ── Commission (admin override) ───────────────────────────────
  vendorCommissionPercentage:    { type: Number, min: 0, max: 100 },
  affiliateCommissionPercentage: { type: Number, min: 0, max: 100 },

  // ── Warranty ──────────────────────────────────────────────────
  hasWarranty: { type: Boolean, default: false },
  warranty: {
    duration:           Number,
    durationType:       { type: String, enum: ['months', 'years', 'lifetime'], default: 'months' },
    description:        String,
    terms:              String,
    provider:           String,
    activationRequired: { type: Boolean, default: false },
  },

  // ── FAQs ──────────────────────────────────────────────────────
  faqs: [{ question: String, answer: String }],

  // ── Specifications ────────────────────────────────────────────
  specifications: [{ label: String, value: String }],

  // ── SEO ───────────────────────────────────────────────────────
  seo: {
    title:       String,
    description: String,
    keywords:    [String],
  },

  // ── Structured Data (JSON-LD / Schema.org) ────────────────────
  structuredData: {
    schemaType: {
      type: String,
      enum: ['Product', 'Book', 'Movie', 'MusicAlbum', 'Recipe', 'SoftwareApplication', 'VideoGame', 'Event', 'Course'],
      default: 'Product',
    },
    properties:     Schema.Types.Mixed,
    customSnippets: [{ name: String, content: String }],
  },

  // ── Variants ──────────────────────────────────────────────────
  hasVariants:    { type: Boolean, default: false },
  variantOptions: [{ name: String, values: [String] }],   // option definitions (e.g. Color, Size)
  variants: [{
    name:       String,
    sku:        String,
    price:      Number,
    compareAt:  Number,
    stock:      { type: Number, default: 0 },
    attributes: Schema.Types.Mixed,
    images:     [String],
  }],

  attributes: Schema.Types.Mixed,   // flat key-value product attributes

}, { timestamps: true });

// ── Indexes ──────────────────────────────────────────────────────
productSchema.index({ vendorId: 1 });
productSchema.index({ categoryIds: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ published: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ displayOrder: -1 });

// Compound
productSchema.index({ vendorId: 1, published: 1, createdAt: -1 });
productSchema.index({ categoryIds: 1, published: 1, price: 1 });
productSchema.index({ categoryIds: 1, featured: 1, published: 1 });
productSchema.index({ published: 1, price: 1, rating: 1 });
productSchema.index({ vendorId: 1, stock: 1, trackInventory: 1 });

// Full-text
productSchema.index({ title: 'text', description: 'text', brand: 'text', tags: 'text' });

module.exports = mongoose.model('Product', productSchema);
