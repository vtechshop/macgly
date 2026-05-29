require('../config/env');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const ACCOUNTS = [
  { name: 'Macgly Admin',     email: 'admin@macgly.com',     password: 'Admin@1234',     role: 'admin' },
  { name: 'Test Vendor',      email: 'vendor@macgly.com',    password: 'Vendor@1234',    role: 'vendor' },
  { name: 'Test Affiliate',   email: 'affiliate@macgly.com', password: 'Affiliate@1234', role: 'affiliate' },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shop');

  for (const acc of ACCOUNTS) {
    const existing = await User.findOne({ email: acc.email });
    if (existing) {
      // updateOne bypasses pre-save hook — hash manually
      const hash = await bcrypt.hash(acc.password, 12);
      await User.updateOne({ email: acc.email }, { role: acc.role, password: hash });
      console.log(`✅ Updated  [${acc.role}] ${acc.email}`);
    } else {
      // create triggers pre-save hook — pass plain password
      await User.create({ name: acc.name, email: acc.email, password: acc.password, role: acc.role });
      console.log(`✅ Created  [${acc.role}] ${acc.email}`);
    }
  }

  console.log('\n--- Login Credentials ---');
  ACCOUNTS.forEach(a => console.log(`${a.role.padEnd(10)} ${a.email.padEnd(30)} ${a.password}`));

  await mongoose.disconnect();
}

main().catch(console.error);
