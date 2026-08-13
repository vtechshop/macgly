const Order = require('../models/Order');
const { releaseStock } = require('../services/inventoryService');
const { writeAuditLog } = require('../middleware/audit');

const PAYMENT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Expire orders that were created but never paid.
 *
 * Safety guarantees:
 * - Atomic: `findOneAndUpdate` with a status filter means only one worker
 *   can ever claim any given order. Two workers running simultaneously both
 *   call the same query; the second one simply gets no document back.
 * - Idempotent: the status filter (`pending` / `pending_payment`) prevents
 *   re-processing an order that was already cancelled by a prior run.
 * - Inventory-safe: stock is only released when `inventoryApplied === true`
 *   (i.e., the reservation actually happened). Orders that failed before
 *   `reserveStock` was called are skipped.
 * - Observable: each expired order writes an audit log entry.
 */
async function run() {
  const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MS);
  let processed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Atomically claim one stale order per iteration.
    // Using `new: false` returns the document in its pre-update state so we
    // can read `inventoryApplied` before it is overwritten.
    const order = await Order.findOneAndUpdate(
      {
        paymentStatus: 'pending',
        status: { $in: ['pending', 'pending_payment'] },
        createdAt: { $lt: cutoff },
      },
      {
        status: 'cancelled',
        paymentStatus: 'failed',
        cancellation: {
          reason: 'Payment not completed within the allowed window',
          cancelledAt: new Date(),
        },
      },
      { new: false },
    );

    if (!order) break; // No more stale orders this run

    // Restore stock only if inventory was actually reserved for this order.
    // `inventoryApplied` is undefined on very old orders — treat as false.
    if (order.inventoryApplied) {
      try {
        await releaseStock(order.items);
      } catch (err) {
        console.error(
          `[CleanupStaleOrders] STOCK_RESTORE_FAILED orderId=${order.orderId}:`,
          err.message,
        );
        // Continue — the order is cancelled; stock failure is logged for manual
        // reconciliation and must not prevent other stale orders from expiring.
      }
    }

    writeAuditLog({
      actorRole: 'system',
      action: 'ORDER_AUTO_EXPIRED',
      target: order._id,
      targetModel: 'Order',
      meta: {
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        inventoryReleased: !!order.inventoryApplied,
      },
    });

    processed++;
  }

  if (processed > 0) {
    console.log(`[CleanupStaleOrders] Expired ${processed} order(s), stock restored where applicable`);
  }
}

module.exports = { run };
