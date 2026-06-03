require('../config/env');
const mongoose = require('mongoose');
const Category = require('../models/Category');

const CATEGORIES = [
  { name: 'Agricultural, Industry and Farm Tools', slug: 'agricultural-industry-farm-tools', displayOrder: 1 },
  { name: 'Engineering and Workshop Kits',         slug: 'engineering-workshop-kits',         displayOrder: 2 },
  { name: 'Hardware & Tools',                      slug: 'hardware-tools',                    displayOrder: 3 },
  { name: 'Electronics and Instruments',           slug: 'electronics-instruments',           displayOrder: 4 },
  { name: 'General Machineries',                   slug: 'general-machineries',               displayOrder: 5 },
  { name: 'Spare Parts',                           slug: 'spare-parts',                       displayOrder: 6 },
  { name: 'Household and Cleaning Equipment',      slug: 'household-cleaning-equipment',      displayOrder: 7 },
  { name: 'Plumbing and Hardware / Construction',  slug: 'plumbing-hardware-construction',    displayOrder: 8 },
  { name: 'Hotel and Food Processing',             slug: 'hotel-food-processing',             displayOrder: 9 },
  { name: 'Wood & Carvings',                       slug: 'wood-carvings',                     displayOrder: 10 },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shop');

  // Remove all existing top-level categories (no parentId)
  const deleted = await Category.deleteMany({ parentId: null });
  console.log(`🗑  Deleted ${deleted.deletedCount} existing top-level categories`);

  // Insert new categories
  for (const cat of CATEGORIES) {
    await Category.findOneAndUpdate(
      { slug: cat.slug },
      { ...cat, isActive: true },
      { upsert: true, new: true }
    );
    console.log(`✅ ${cat.displayOrder}. ${cat.name}`);
  }

  console.log('\n✅ All 10 categories seeded.');
  await mongoose.disconnect();
}

main().catch(console.error);
