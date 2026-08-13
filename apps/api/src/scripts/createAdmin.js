require('../config/env');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * Seed / update admin accounts. Credentials MUST be supplied via environment
 * variables — never hardcoded. Any account whose EMAIL + PASSWORD vars are
 * both absent is simply skipped.
 *
 * Required env vars (at least one pair must be set):
 *   ADMIN_EMAIL, ADMIN_PASSWORD      — platform admin
 *   VENDOR_EMAIL, VENDOR_PASSWORD    — test vendor (optional)
 *   AFFILIATE_EMAIL, AFFILIATE_PASSWORD — test affiliate (optional)
 *
 * Optional name overrides (default names used when unset):
 *   ADMIN_NAME, VENDOR_NAME, AFFILIATE_NAME
 *
 * Credential rotation for an existing account:
 *   Set NEW_ADMIN_PASSWORD (etc.) and run this script again — it will
 *   call User.updateOne with the new hash, bypassing the pre-save hook.
 */

const ACCOUNT_SPECS = [
  { envKey: 'ADMIN',     role: 'admin',     defaultName: 'Macgly Admin' },
  { envKey: 'VENDOR',    role: 'vendor',    defaultName: 'Test Vendor' },
  { envKey: 'AFFILIATE', role: 'affiliate', defaultName: 'Test Affiliate' },
];

const ACCOUNTS = ACCOUNT_SPECS.map(({ envKey, role, defaultName }) => ({
  name:     process.env[`${envKey}_NAME`] || defaultName,
  email:    process.env[`${envKey}_EMAIL`],
  password: process.env[`${envKey}_PASSWORD`],
  role,
})).filter((acc) => acc.email && acc.password);

if (!ACCOUNTS.length) {
  console.error('FATAL: No account credentials found in environment variables.');
  console.error('Set at least ADMIN_EMAIL + ADMIN_PASSWORD before running this script.');
  process.exit(1);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shop');

  for (const acc of ACCOUNTS) {
    const existing = await User.findOne({ email: acc.email });
    if (existing) {
      // updateOne bypasses the pre-save hook — hash manually
      const hash = await bcrypt.hash(acc.password, 12);
      await User.updateOne({ email: acc.email }, { role: acc.role, password: hash });
      console.log(`Updated  [${acc.role}] ${acc.email}`);
    } else {
      // create() triggers the pre-save hook which hashes the password
      await User.create({ name: acc.name, email: acc.email, password: acc.password, role: acc.role });
      console.log(`Created  [${acc.role}] ${acc.email}`);
    }
  }

  console.log('\nAccounts seeded:');
  ACCOUNTS.forEach((a) => console.log(`  ${a.role.padEnd(10)} ${a.email}`));

  await mongoose.disconnect();
}

main().catch(console.error);
