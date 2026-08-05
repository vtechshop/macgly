const Commission = require('../models/Commission');
const User = require('../models/User');
const Order = require('../models/Order');
const Referral = require('../models/Referral');
const AppError = require('../utils/AppError');
const { computeCommission } = require('../utils/tax');

const DEFAULT_VENDOR_RATE    = 10;  // platform keeps 10%, vendor gets 90%
const DEFAULT_AFFILIATE_RATE = 5;   // 5% of sale goes to affiliate

async function createVendorCommissions(order) {
  // Idempotency guard — don't double-create
  const existing = await Commission.findOne({ order: order._id, type: 'vendor' });
  if (existing) return [];

  const commissions = [];
  for (const item of order.items) {
    if (!item.vendorId) continue;
    const vendor = await User.findById(item.vendorId).select('vendorProfile.commissionRate');
    const rate = vendor?.vendorProfile?.commissionRate ?? DEFAULT_VENDOR_RATE;

    // MERGE-01: the taxable-value base is kept deliberately over the previous
    // `saleAmount = item.price * item.quantity` formula. item.price is
    // GST-inclusive, so charging the fee on it billed the vendor a commission
    // on tax the platform merely collects for the government (PAY-08).
    //
    // Same helper createOrder used, so the Commission record and the order item
    // can never disagree. See utils/tax.js computeCommission.
    //
    // Older orders have no `taxableValue` snapshot but DO carry `gstRate`, which
    // has had `default: 18` on the Order schema since before this change. So the
    // base for them is derived by extracting GST from the inclusive price rather
    // than falling back to the gross. That is the intended result — the prices
    // were always GST-inclusive — but it does mean a backfilled historical row
    // carries a fee roughly 15% lower than the old formula produced. Nothing is
    // restated: backfill only creates rows for orders that have none.
    const { lineTotal, taxableValue, platformFee, vendorEarning } = computeCommission(item, rate);

    commissions.push({
      type: 'vendor',
      order: order._id,
      user: item.vendorId,
      product: item.product,
      saleAmount: lineTotal,   // gross, unchanged — what the customer paid
      taxableValue,            // the base the fee was charged on (reproducibility)
      commissionRate: rate,
      commissionAmount: vendorEarning,
      platformFee,
    });
  }
  if (commissions.length) await Commission.insertMany(commissions);
  return commissions;
}

async function createAffiliateCommission(order, affiliateUserId) {
  if (!affiliateUserId) return null;
  // Idempotency guard
  const existing = await Commission.findOne({ order: order._id, type: 'affiliate' });
  if (existing) return existing;
  const affiliate      = await User.findById(affiliateUserId).select('affiliateProfile.commissionRate');
  const rate           = affiliate?.affiliateProfile?.commissionRate ?? DEFAULT_AFFILIATE_RATE;
  const commissionAmount = parseFloat(((order.totalAmount * rate) / 100).toFixed(2));
  const commission = await Commission.create({
    type:             'affiliate',
    order:            order._id,
    user:             affiliateUserId,
    saleAmount:       order.totalAmount,
    commissionRate:   rate,
    commissionAmount,
  });
  await Referral.create({
    referrer:         affiliateUserId,
    referee:          order.user,
    order:            order._id,
    commissionAmount,
  });
  return commission;
}

async function getPendingByUser(userId) {
  return Commission.find({ user: userId, status: 'pending' }).populate('order', 'orderId');
}

// Backfill: create Commission records for all paid orders that don't have them yet.
// Kept from upstream unchanged. It routes through createVendorCommissions, so it
// inherits the taxable-value base for orders that carry a tax snapshot and
// reproduces the old gross-based numbers for legacy orders that do not.
async function backfillVendorCommissions() {
  const ordersWithCommissions = await Commission.distinct('order', { type: 'vendor' });
  const orders = await Order.find({
    paymentStatus: 'paid',
    _id: { $nin: ordersWithCommissions },
  }).lean();

  let created = 0;
  let skipped = 0;
  for (const order of orders) {
    try {
      const commissions = await createVendorCommissions(order);
      created += commissions.length;
    } catch (err) {
      console.error(`[Commission backfill] Failed for order ${order._id}:`, err.message);
      skipped++;
    }
  }
  console.log(`[Commission backfill] Done — created ${created} records, skipped ${skipped} orders`);
  return { ordersProcessed: orders.length, commissionsCreated: created, skipped };
}

/**
 * Commission lifecycle.
 *
 *   pending ──► approved ──► paid      (terminal)
 *      │            │
 *      └────────────┴──────► cancelled (terminal)
 *
 * `paid` and `cancelled` are terminal on purpose: money has either left the
 * account or the sale is void, and neither is something a status write should
 * be able to undo. Recovering a paid commission is a manual finance action.
 */
const COMMISSION_TRANSITIONS = Object.freeze({
  pending:   ['approved', 'cancelled'],
  approved:  ['paid', 'cancelled'],
  paid:      [],
  cancelled: [],
});

/** An order in one of these states can never justify approving a commission. */
const INELIGIBLE_ORDER_STATUSES = Object.freeze(['cancelled', 'returned']);

/** Which starting states may legally move to `to`. */
function sourcesFor(to) {
  return Object.entries(COMMISSION_TRANSITIONS)
    .filter(([, targets]) => targets.includes(to))
    .map(([from]) => from);
}

function canTransition(from, to) {
  return (COMMISSION_TRANSITIONS[from] || []).includes(to);
}

/**
 * Of the given order ids, which are cancelled or returned.
 * Used to keep bulk approvals off orders that are no longer sales.
 */
async function ineligibleOrderIds(orderIds) {
  const ids = (orderIds || []).filter(Boolean);
  if (!ids.length) return [];
  const bad = await Order.find({ _id: { $in: ids }, status: { $in: INELIGIBLE_ORDER_STATUSES } })
    .select('_id').lean();
  return bad.map((o) => o._id.toString());
}

/**
 * Moves one commission through the state machine, atomically.
 *
 * The allowed source states are part of the update filter, so an illegal
 * transition cannot slip through between a check and a write. A refusal is
 * reported with the state it actually found, which is what an operator needs.
 *
 * @param {ObjectId|string} commissionId
 * @param {'approved'|'paid'|'cancelled'} to
 * @param {object} [extra] additional fields to set alongside the status
 * @throws {AppError} 404 if missing, 409 if the transition is illegal or the order is void
 */
async function transitionCommission(commissionId, to, extra = {}) {
  const allowedFrom = sourcesFor(to);
  if (!allowedFrom.length) {
    throw new AppError(`'${to}' is not a reachable commission state`, 400, 'INVALID_TRANSITION');
  }

  const current = await Commission.findById(commissionId).select('status order').lean();
  if (!current) throw new AppError('Commission not found', 404, 'NOT_FOUND');

  // Approving is the only transition that depends on the order still being a sale.
  if (to === 'approved' && current.order) {
    const [blocked] = await ineligibleOrderIds([current.order]);
    if (blocked) {
      throw new AppError(
        'Cannot approve a commission for a cancelled or returned order',
        409,
        'ORDER_NOT_ELIGIBLE',
      );
    }
  }

  const updated = await Commission.findOneAndUpdate(
    { _id: commissionId, status: { $in: allowedFrom } },
    { status: to, ...extra },
    { new: true },
  );
  if (updated) return updated;

  const now = await Commission.findById(commissionId).select('status').lean();
  throw new AppError(
    `Cannot move a ${now?.status || 'missing'} commission to ${to}`,
    409,
    'INVALID_TRANSITION',
  );
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Marks approved commissions as paid and reports what was actually paid.
 *
 * The amount is always the sum of the rows this call marked paid — a caller can
 * choose *which* rows, never *how much*. `maxAmount` selects whole rows FIFO up
 * to a ceiling; a row is never marked paid for less than its full value, since
 * the schema has no way to represent a part-paid commission.
 *
 * `status: 'approved'` stays in the update filter, so a void landing mid-flight
 * is not overwritten. The returned `shortfall` reports any row that slipped away
 * between selection and the write.
 *
 * @param {object}   opts
 * @param {ObjectId} opts.userId       vendor or affiliate being paid
 * @param {'vendor'|'affiliate'} opts.type
 * @param {Array}   [opts.commissionIds] restrict to these rows
 * @param {number}  [opts.maxAmount]     ceiling for FIFO selection
 * @param {object}  [opts.payment]       { paymentRef, paymentMethod, paymentProof, note }
 * @returns {Promise<{paidCount:number,totalPaid:number,selectedCount:number,selectedTotal:number,shortfall:number,commissionIds:Array}>}
 */
async function payApprovedCommissions({ userId, type, commissionIds, maxAmount, payment = {} }) {
  const filter = { user: userId, type, status: 'approved' };
  if (commissionIds?.length) filter._id = { $in: commissionIds };

  const approved = await Commission.find(filter)
    .select('_id commissionAmount')
    .sort({ createdAt: 1 })   // FIFO — oldest owed is settled first
    .lean();

  // Apply the ceiling by whole rows only.
  let selected = approved;
  if (Number.isFinite(maxAmount) && maxAmount > 0) {
    selected = [];
    let budget = maxAmount;
    for (const c of approved) {
      const amt = c.commissionAmount || 0;
      if (amt > budget + 0.01) break;   // this row does not fit — stop, never part-pay
      selected.push(c);
      budget = round2(budget - amt);
    }
  }

  if (!selected.length) {
    return { paidCount: 0, totalPaid: 0, selectedCount: 0, selectedTotal: 0, shortfall: 0, commissionIds: [] };
  }

  const ids = selected.map((c) => c._id);
  const selectedTotal = round2(selected.reduce((s, c) => s + (c.commissionAmount || 0), 0));

  const update = {
    status: 'paid',
    paidAt: new Date(),
    ...(payment.paymentRef && { paymentRef: payment.paymentRef }),
    ...(payment.paymentProof && { paymentProof: payment.paymentProof }),
    ...(payment.note && { note: payment.note }),
  };

  // Claim each row individually. `updateMany` reports how many rows moved but not
  // which, so a caller that lost a race could not tell its own rows from ones a
  // concurrent payout had already settled — and would report the other caller's
  // money as its own. Per-row claims make "what did I pay" exact.
  const claimed = await Promise.all(selected.map(async (c) => {
    const won = await Commission.findOneAndUpdate({ _id: c._id, status: 'approved' }, update);
    return won ? (c.commissionAmount || 0) : null;
  }));

  const won = claimed.filter((a) => a !== null);
  const totalPaid = round2(won.reduce((s, a) => s + a, 0));
  const shortfall = round2(selectedTotal - totalPaid);

  if (shortfall > 0) {
    console.warn(`[payout] ${type} ${userId}: selected ${ids.length} row(s) worth Rs.${selectedTotal}, settled ${won.length} worth Rs.${totalPaid}`);
  }

  return {
    paidCount: won.length,
    totalPaid,
    selectedCount: ids.length,
    selectedTotal,
    shortfall,
    commissionIds: ids,
  };
}

/**
 * Voids the commission ledger for an order that is no longer a sale.
 *
 * Only `pending` and `approved` rows are touched. A `paid` row is money that has
 * already left the account — reversing it here would misstate history; recovering
 * it is a manual finance action, not something a status change should do.
 *
 * Idempotent: the status filter matches nothing on a second run, so repeated
 * cancellations cannot double-void or resurrect a paid row.
 *
 * @param {ObjectId|string} orderId
 * @param {string} [reason]
 * @returns {Promise<number>} rows voided
 */
async function voidCommissionsForOrder(orderId, reason = 'Order cancelled') {
  if (!orderId) return 0;
  const { modifiedCount } = await Commission.updateMany(
    { order: orderId, status: { $in: ['pending', 'approved'] } },
    { status: 'cancelled', rejectedAt: new Date(), note: reason },
  );
  if (modifiedCount) {
    console.log(`[commission] voided ${modifiedCount} row(s) for order ${orderId}: ${reason}`);
  }
  return modifiedCount;
}

module.exports = {
  createVendorCommissions, createAffiliateCommission, getPendingByUser,
  backfillVendorCommissions,
  voidCommissionsForOrder,
  transitionCommission, canTransition, sourcesFor, ineligibleOrderIds,
  payApprovedCommissions,
  COMMISSION_TRANSITIONS, INELIGIBLE_ORDER_STATUSES,
  DEFAULT_VENDOR_RATE, DEFAULT_AFFILIATE_RATE,
};
