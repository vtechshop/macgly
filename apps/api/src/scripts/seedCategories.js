require('../config/env');
const mongoose = require('mongoose');
const Category = require('../models/Category');

const CATEGORIES = [
  { name: 'Agricultural and Farm Tools',          slug: 'agricultural-industry-farm-tools', displayOrder: 1 },
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

  // Wipe ALL categories
  const deleted = await Category.deleteMany({});
  console.log(`🗑  Deleted all ${deleted.deletedCount} existing categories`);

  // Insert 10 new top-level categories and store their IDs
  const created = {};
  for (const cat of CATEGORIES) {
    const doc = await Category.create({ ...cat, isActive: true });
    created[cat.slug] = doc._id;
    console.log(`✅ ${cat.displayOrder}. ${cat.name}`);
  }

  // Subcategories — Agricultural and Farm Tools
  const agriSubs = [
    { name: 'Home Gardens',  slug: 'home-gardens',  displayOrder: 1 },
    { name: 'Agri Tools',    slug: 'agri-tools',    displayOrder: 2 },
    { name: 'Agri Machines', slug: 'agri-machines', displayOrder: 3 },
    { name: 'Motor Pumps',   slug: 'motor-pumps',   displayOrder: 4 },
  ];
  for (const s of agriSubs) {
    await Category.create({ ...s, parentId: created['agricultural-industry-farm-tools'], isActive: true });
    console.log(`   └─ ${s.name}`);
  }

  // Subcategories — Engineering and Workshop Kits
  const engSubs = [
    { name: 'Power Tools', slug: 'eng-power-tools', displayOrder: 1 },
    { name: 'Welding',     slug: 'eng-welding',     displayOrder: 2 },
    { name: 'Cleaning',    slug: 'eng-cleaning',    displayOrder: 3 },
    { name: 'Hand Tools',  slug: 'eng-hand-tools',  displayOrder: 4 },
    { name: 'Safety',      slug: 'eng-safety',      displayOrder: 5 },
  ];
  for (const s of engSubs) {
    await Category.create({ ...s, parentId: created['engineering-workshop-kits'], isActive: true });
    console.log(`   └─ ${s.name}`);
  }

  // Subcategories — Spare Parts
  const spareSubs = [
    { name: 'Drill Bits',     slug: 'drill-bits',     displayOrder: 1 },
    { name: 'Cutting Blades', slug: 'cutting-blades', displayOrder: 2 },
    { name: 'Machine Spares', slug: 'machine-spares', displayOrder: 3 },
  ];
  for (const s of spareSubs) {
    await Category.create({ ...s, parentId: created['spare-parts'], isActive: true });
    console.log(`   └─ ${s.name}`);
  }

  console.log('\n✅ All categories seeded successfully.');
  await mongoose.disconnect();
}

main().catch(console.error);
