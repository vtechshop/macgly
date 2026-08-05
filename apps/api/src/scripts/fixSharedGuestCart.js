/**
 * One-time remediation for the shared guest cart (audit SEC-02 / P0-01).
 *
 * Before the session middleware existed, every anonymous visitor fell back to
 * `sessionId: 'anon'`, so the whole internet shared a single cart document.
 * This removes that document plus any guest cart whose sessionId is not a
 * 128-bit hex id, since those can no longer be reached by a valid session.
 *
 * User-owned carts are never touched.
 *
 * Usage:  node apps/api/src/scripts/fixSharedGuestCart.js [--dry-run]
 */
require('../config/env');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');

const VALID_SESSION_ID = /^[0-9a-f]{32}$/;
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/shop');
  console.log(`Connected. Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);

  const guestCarts = await Cart.find({ user: { $exists: false } })
    .select('sessionId items updatedAt')
    .lean();

  const orphans = guestCarts.filter((c) => !VALID_SESSION_ID.test(c.sessionId || ''));

  console.log(`Guest carts total:        ${guestCarts.length}`);
  console.log(`Unreachable (bad id):     ${orphans.length}`);
  orphans.forEach((c) => {
    console.log(`  - ${c._id}  sessionId=${JSON.stringify(c.sessionId)}  items=${c.items?.length || 0}  updated=${c.updatedAt?.toISOString?.() || 'n/a'}`);
  });

  if (!orphans.length) {
    console.log('Nothing to clean up.');
  } else if (DRY_RUN) {
    console.log('\nDry run — re-run without --dry-run to delete the carts listed above.');
  } else {
    const { deletedCount } = await Cart.deleteMany({ _id: { $in: orphans.map((c) => c._id) } });
    console.log(`\nDeleted ${deletedCount} unreachable guest cart(s).`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('fixSharedGuestCart failed:', err);
  process.exit(1);
});
