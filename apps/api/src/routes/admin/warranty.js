const router = require('express').Router();
const mongoose = require('mongoose');
const Warranty = require('../../models/Warranty');
const Order = require('../../models/Order');
const Product = require('../../models/Product');
const AppError = require('../../utils/AppError');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateWarrantyId() {
  const year = new Date().getFullYear();
  const prefix = `W-${year}-`;
  const last = await Warranty.findOne(
    { warrantyId: { $regex: `^${prefix}` } },
    { warrantyId: 1 },
  ).sort({ warrantyId: -1 });

  const seq = last
    ? parseInt(last.warrantyId.split('-')[2] || '0', 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

function durationToDays(duration, durationType) {
  if (!duration) return 365;
  if (durationType === 'lifetime') return 36500;
  if (durationType === 'years') return duration * 365;
  if (durationType === 'months') return duration * 30;
  return duration;
}

// Run status updates and save if changed (non-blocking)
async function refreshStatuses(filter = {}) {
  const warranties = await Warranty.find({
    ...filter,
    status: { $nin: ['void', 'claimed'] },
  });
  for (const w of warranties) {
    const before = w.status;
    w.updateStatus();
    if (w.status !== before) await w.save();
  }
}

// ─── Stats / Enhanced Stats ───────────────────────────────────────────────────

router.get('/stats/enhanced', async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      total, active, expiringSoon, expired, claimed, voided, pendingClaimsAgg,
      typeDistRaw, avgDaysRaw, thisMonthCreated, thisMonthExpiring,
    ] = await Promise.all([
      Warranty.countDocuments(),
      Warranty.countDocuments({ status: 'active' }),
      Warranty.countDocuments({ status: 'expiring_soon' }),
      Warranty.countDocuments({ status: 'expired' }),
      Warranty.countDocuments({ status: 'claimed' }),
      Warranty.countDocuments({ status: 'void' }),
      Warranty.aggregate([
        { $unwind: '$claims' },
        { $match: { 'claims.status': 'pending' } },
        { $count: 'n' },
      ]),
      Warranty.aggregate([{ $group: { _id: '$warrantyType', count: { $sum: 1 } } }]),
      Warranty.aggregate([{ $group: { _id: null, avg: { $avg: '$warrantyPeriodDays' } } }]),
      Warranty.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Warranty.countDocuments({
        warrantyEndDate: { $gte: now, $lte: thirtyDays },
        status: { $nin: ['void', 'claimed'] },
      }),
    ]);

    const typeDistribution = {};
    typeDistRaw.forEach((t) => {
      if (t._id) typeDistribution[t._id] = t.count;
    });

    res.json({
      total,
      active,
      expiringSoon,
      expired,
      claimed,
      voided,
      pendingClaims: pendingClaimsAgg[0]?.n || 0,
      avgWarrantyDays: avgDaysRaw[0] ? Math.round(avgDaysRaw[0].avg) : 365,
      typeDistribution,
      thisMonth: { created: thisMonthCreated, expiring: thisMonthExpiring },
    });
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [total, active, expiringSoon, expired] = await Promise.all([
      Warranty.countDocuments(),
      Warranty.countDocuments({ status: 'active' }),
      Warranty.countDocuments({ status: 'expiring_soon' }),
      Warranty.countDocuments({ status: 'expired' }),
    ]);
    res.json({ total, active, expiringSoon, expired });
  } catch (err) { next(err); }
});

// ─── Export CSV ───────────────────────────────────────────────────────────────

router.get('/export', async (req, res, next) => {
  try {
    const warranties = await Warranty.find().sort({ createdAt: -1 }).limit(5000);

    const rows = [
      ['Warranty ID', 'Order ID', 'Product Name', 'Product Model', 'Customer Name',
        'Customer Email', 'Warranty Type', 'Purchase Date', 'Start Date', 'End Date',
        'Period (Days)', 'Status', 'Claims Count'],
    ];

    for (const w of warranties) {
      rows.push([
        w.warrantyId || '',
        w.purchaseId || '',
        w.product?.name || '',
        w.product?.model || '',
        w.customerName || '',
        w.customerEmail || '',
        w.warrantyType || '',
        w.purchaseDate ? new Date(w.purchaseDate).toLocaleDateString('en-IN') : '',
        w.warrantyStartDate ? new Date(w.warrantyStartDate).toLocaleDateString('en-IN') : '',
        w.warrantyEndDate ? new Date(w.warrantyEndDate).toLocaleDateString('en-IN') : '',
        w.warrantyPeriodDays || '',
        w.status || '',
        w.claims?.length || 0,
      ]);
    }

    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="warranties-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// ─── Sync from Orders ─────────────────────────────────────────────────────────

router.post('/sync', async (req, res, next) => {
  try {
    const orders = await Order.find({
      status: { $in: ['delivered', 'cancelled'] },
    })
      .populate('user', 'name email phone')
      .populate('items.product', 'title sku category hasWarranty warranty');

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (const order of orders) {
      const deliveryDate = order.deliveredAt || order.updatedAt || order.createdAt;

      for (const item of order.items) {
        const prod = item.product;
        if (!prod?.hasWarranty || !prod?.warranty?.duration) {
          skipped++;
          continue;
        }

        // Check if warranty already exists for this order+product combination
        const exists = await Warranty.findOne({
          purchaseId: order.orderId,
          productId: prod._id,
        });
        if (exists) { skipped++; continue; }

        try {
          const periodDays = durationToDays(prod.warranty.duration, prod.warranty.durationType);
          const startDate = new Date(deliveryDate);
          const endDate = new Date(startDate.getTime() + periodDays * 24 * 60 * 60 * 1000);
          const warrantyId = await generateWarrantyId();

          const w = await Warranty.create({
            warrantyId,
            purchaseId: order.orderId,
            orderId: order._id,
            productId: prod._id,
            userId: order.user?._id || null,
            customerName: order.user?.name || order.customerName || order.shippingAddress?.name || '',
            customerEmail: order.user?.email || '',
            customerPhone: order.user?.phone || order.customerPhone || order.shippingAddress?.phone || '',
            product: {
              name: prod.title || item.title || '',
              model: prod.sku || item.sku || '',
              category: prod.category || '',
            },
            warrantyType: 'manufacturer',
            purchaseDate: order.createdAt,
            warrantyStartDate: startDate,
            warrantyEndDate: endDate,
            warrantyPeriodDays: periodDays,
            extraInfo: { invoiceNo: order.orderId },
          });

          // If order is cancelled, void the warranty
          if (order.status === 'cancelled') {
            w.status = 'void';
            w.isActive = false;
            await w.save();
          } else {
            w.updateStatus();
            await w.save();
          }

          created++;
        } catch (err) {
          failed++;
          if (errors.length < 10) errors.push({ orderId: order.orderId, error: err.message });
        }
      }
    }

    res.json({ created, skipped, failed, errors });
  } catch (err) { next(err); }
});

// ─── Bulk Action ──────────────────────────────────────────────────────────────

router.post('/bulk-action', async (req, res, next) => {
  try {
    const { action, warrantyIds, data } = req.body;
    if (!warrantyIds?.length) throw new AppError('No warranty IDs provided', 400, 'MISSING_IDS');

    const objectIds = warrantyIds.map((id) => new mongoose.Types.ObjectId(id));

    if (action === 'void') {
      await Warranty.updateMany(
        { _id: { $in: objectIds }, status: { $ne: 'void' } },
        { status: 'void', isActive: false },
      );
    } else if (action === 'send_reminder') {
      const warranties = await Warranty.find({ _id: { $in: objectIds } });
      for (const w of warranties) {
        w.notifications.push({
          type: 'bulk_reminder',
          sentAt: new Date(),
          sentTo: w.customerEmail,
        });
        w.lastNotificationSent = new Date();
        await w.save();
      }
    } else if (action === 'extend') {
      const days = data?.days || 30;
      const warranties = await Warranty.find({
        _id: { $in: objectIds },
        status: { $ne: 'void' },
      });
      for (const w of warranties) {
        const newEnd = new Date(w.warrantyEndDate);
        newEnd.setDate(newEnd.getDate() + days);
        w.warrantyEndDate = newEnd;
        w.warrantyPeriodDays = (w.warrantyPeriodDays || 0) + days;
        w.warrantyType = 'extended';
        w.updateStatus();
        await w.save();
      }
    } else {
      throw new AppError('Invalid action', 400, 'INVALID_ACTION');
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Check Notifications (cron) ───────────────────────────────────────────────

router.post('/check-notifications', async (req, res, next) => {
  try {
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const expiringSoon = await Warranty.find({
      warrantyEndDate: { $gte: new Date(), $lte: thirtyDays },
      status: 'expiring_soon',
      $or: [
        { lastNotificationSent: { $lt: yesterday } },
        { lastNotificationSent: { $exists: false } },
      ],
    });

    let notified = 0;
    for (const w of expiringSoon) {
      w.notifications.push({
        type: 'expiry_warning',
        sentAt: new Date(),
        sentTo: w.customerEmail,
      });
      w.lastNotificationSent = new Date();
      await w.save();
      notified++;
    }

    res.json({ notified });
  } catch (err) { next(err); }
});

// ─── List All Warranties ──────────────────────────────────────────────────────

router.get('/all', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, type, search, expiringIn } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    if (status) query.status = status;
    if (type) query.warrantyType = type;
    if (expiringIn) {
      const days = parseInt(expiringIn);
      query.warrantyEndDate = {
        $gte: new Date(),
        $lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      };
    }

    let warranties, total;

    if (search) {
      const q = search.trim();
      const regex = { $regex: q, $options: 'i' };
      const searchQuery = {
        ...query,
        $or: [
          { warrantyId: regex },
          { purchaseId: regex },
          { 'product.name': regex },
          { customerName: regex },
          { customerEmail: regex },
          { customerPhone: regex },
        ],
      };
      [warranties, total] = await Promise.all([
        Warranty.find(searchQuery).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
        Warranty.countDocuments(searchQuery),
      ]);
    } else {
      [warranties, total] = await Promise.all([
        Warranty.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
        Warranty.countDocuments(query),
      ]);
    }

    const adminViews = warranties.map((w) => w.toAdminView());

    res.json({
      data: adminViews,
      pagination: {
        total,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) { next(err); }
});

// ─── Single Warranty ──────────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const warranty = await Warranty.findById(req.params.id);
    if (!warranty) throw new AppError('Warranty not found', 404, 'NOT_FOUND');
    res.json({ warranty: warranty.toAdminView() });
  } catch (err) { next(err); }
});

// ─── Extend ───────────────────────────────────────────────────────────────────

router.put('/:id/extend', async (req, res, next) => {
  try {
    const { days } = req.body;
    if (!days || days < 1) throw new AppError('Valid days required', 400, 'INVALID_DAYS');

    const warranty = await Warranty.findById(req.params.id);
    if (!warranty) throw new AppError('Warranty not found', 404, 'NOT_FOUND');
    if (warranty.status === 'void') throw new AppError('Cannot extend a voided warranty', 400, 'VOIDED');

    const newEnd = new Date(warranty.warrantyEndDate);
    newEnd.setDate(newEnd.getDate() + parseInt(days));
    warranty.warrantyEndDate = newEnd;
    warranty.warrantyPeriodDays = (warranty.warrantyPeriodDays || 0) + parseInt(days);
    warranty.warrantyType = 'extended';
    warranty.updateStatus();
    await warranty.save();

    res.json({ warranty: warranty.toAdminView() });
  } catch (err) { next(err); }
});

// ─── Void ─────────────────────────────────────────────────────────────────────

router.put('/:id/void', async (req, res, next) => {
  try {
    const warranty = await Warranty.findById(req.params.id);
    if (!warranty) throw new AppError('Warranty not found', 404, 'NOT_FOUND');
    if (warranty.status === 'void') throw new AppError('Warranty is already void', 400, 'ALREADY_VOID');

    warranty.status = 'void';
    warranty.isActive = false;
    await warranty.save();

    res.json({ warranty: warranty.toAdminView() });
  } catch (err) { next(err); }
});

// ─── Send Reminder ────────────────────────────────────────────────────────────

router.post('/:id/send-reminder', async (req, res, next) => {
  try {
    const warranty = await Warranty.findById(req.params.id);
    if (!warranty) throw new AppError('Warranty not found', 404, 'NOT_FOUND');
    if (warranty.status === 'void' || warranty.status === 'expired') {
      throw new AppError('Cannot send reminder for void/expired warranty', 400, 'INVALID_STATUS');
    }

    warranty.notifications.push({
      type: 'manual_reminder',
      sentAt: new Date(),
      sentTo: warranty.customerEmail,
    });
    warranty.lastNotificationSent = new Date();
    await warranty.save();

    res.json({ ok: true, warranty: warranty.toAdminView() });
  } catch (err) { next(err); }
});

// ─── Process Claim ────────────────────────────────────────────────────────────

router.put('/:id/claims/:claimId', async (req, res, next) => {
  try {
    const { status, resolution } = req.body;
    if (!['approved', 'rejected', 'completed'].includes(status)) {
      throw new AppError('Invalid claim status', 400, 'INVALID_STATUS');
    }

    const warranty = await Warranty.findById(req.params.id);
    if (!warranty) throw new AppError('Warranty not found', 404, 'NOT_FOUND');

    const claim = warranty.claims.find((c) => c._id.toString() === req.params.claimId || c.claimId === req.params.claimId);
    if (!claim) throw new AppError('Claim not found', 404, 'NOT_FOUND');

    claim.status = status;
    claim.resolvedDate = new Date();
    if (resolution) claim.resolution = resolution;

    if (['completed', 'approved'].includes(status)) {
      warranty.status = 'claimed';
    }

    await warranty.save();
    res.json({ warranty: warranty.toAdminView() });
  } catch (err) { next(err); }
});

module.exports = router;
