const router = require('express').Router();
const mongoose = require('mongoose');
const AdCampaign = require('../../models/AdCampaign');
const AdPricingSettings = require('../../models/AdPricingSettings');
const AdWallet = require('../../models/AdWallet');
const AdEvent = require('../../models/AdEvent');
const AppError = require('../../utils/AppError');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normCampaign(c) {
  const obj = typeof c.toObject === 'function' ? c.toObject() : c;
  return {
    ...obj,
    name: obj.name || obj.title,
    bid: obj.bid ?? obj.bidPerClick ?? 0,
    dailyBudget: obj.dailyBudget ?? obj.budget ?? 0,
    totalBudget: obj.totalBudget ?? obj.budget ?? 0,
    stats: {
      impressions: (obj.stats?.impressions || 0) + (obj.impressions || 0),
      clicks:      (obj.stats?.clicks || 0) + (obj.clicks || 0),
      conversions:  obj.stats?.conversions || 0,
      spend:       (obj.stats?.spend || 0) + (obj.spent || 0),
      revenue:      obj.stats?.revenue || 0,
    },
    startAt: obj.startAt || obj.startDate,
    endAt:   obj.endAt || obj.endDate,
  };
}

const DEFAULT_PLACEMENTS = [
  { placement: 'homepage_banner',          displayName: 'Homepage Banner',              pricingType: 'CPM', minBid: 100,  maxBid: 500,  recommendedBid: 250, floorPrice: 80,  dailyBudgetMin: 200 },
  { placement: 'homepage_top',             displayName: 'Homepage Top',                 pricingType: 'CPM', minBid: 80,   maxBid: 400,  recommendedBid: 200, floorPrice: 60,  dailyBudgetMin: 150 },
  { placement: 'homepage_sidebar_left',    displayName: 'Homepage Sidebar Left',        pricingType: 'CPC', minBid: 3,    maxBid: 30,   recommendedBid: 10,  floorPrice: 2,   dailyBudgetMin: 50  },
  { placement: 'homepage_sidebar_right',   displayName: 'Homepage Sidebar Right',       pricingType: 'CPC', minBid: 3,    maxBid: 30,   recommendedBid: 10,  floorPrice: 2,   dailyBudgetMin: 50  },
  { placement: 'search_sponsored_products',displayName: 'Search Sponsored Products',    pricingType: 'CPC', minBid: 5,    maxBid: 50,   recommendedBid: 15,  floorPrice: 4,   dailyBudgetMin: 100 },
  { placement: 'search_top',               displayName: 'Search Top',                   pricingType: 'CPC', minBid: 4,    maxBid: 40,   recommendedBid: 12,  floorPrice: 3,   dailyBudgetMin: 80  },
  { placement: 'search_sidebar',           displayName: 'Search Sidebar',               pricingType: 'CPC', minBid: 3,    maxBid: 25,   recommendedBid: 8,   floorPrice: 2,   dailyBudgetMin: 50  },
  { placement: 'category_grid',            displayName: 'Category Grid',                pricingType: 'CPC', minBid: 4,    maxBid: 40,   recommendedBid: 12,  floorPrice: 3,   dailyBudgetMin: 80  },
  { placement: 'category_top_banner',      displayName: 'Category Top Banner',          pricingType: 'CPM', minBid: 50,   maxBid: 200,  recommendedBid: 80,  floorPrice: 40,  dailyBudgetMin: 100 },
  { placement: 'category_sidebar',         displayName: 'Category Sidebar',             pricingType: 'CPC', minBid: 3,    maxBid: 30,   recommendedBid: 10,  floorPrice: 2,   dailyBudgetMin: 60  },
  { placement: 'product_sidebar',          displayName: 'Product Sidebar',              pricingType: 'CPC', minBid: 3,    maxBid: 30,   recommendedBid: 10,  floorPrice: 2,   dailyBudgetMin: 60  },
  { placement: 'product_top',              displayName: 'Product Top',                  pricingType: 'CPC', minBid: 5,    maxBid: 45,   recommendedBid: 15,  floorPrice: 4,   dailyBudgetMin: 80  },
  { placement: 'product_related',          displayName: 'Product Related',              pricingType: 'CPC', minBid: 2,    maxBid: 20,   recommendedBid: 7,   floorPrice: 1.5, dailyBudgetMin: 40  },
  { placement: 'blog_sidebar',             displayName: 'Blog Sidebar',                 pricingType: 'CPM', minBid: 15,   maxBid: 75,   recommendedBid: 40,  floorPrice: 10,  dailyBudgetMin: 50  },
  { placement: 'blog_top',                 displayName: 'Blog Top Banner',              pricingType: 'CPM', minBid: 20,   maxBid: 100,  recommendedBid: 50,  floorPrice: 15,  dailyBudgetMin: 75  },
  { placement: 'blog_in_content',          displayName: 'Blog In-Content',              pricingType: 'CPC', minBid: 2,    maxBid: 15,   recommendedBid: 6,   floorPrice: 1.5, dailyBudgetMin: 30  },
  { placement: 'cart_sidebar',             displayName: 'Cart Sidebar',                 pricingType: 'CPC', minBid: 5,    maxBid: 50,   recommendedBid: 18,  floorPrice: 4,   dailyBudgetMin: 80  },
  { placement: 'vendor_store',             displayName: 'Vendor Store Page',            pricingType: 'CPC', minBid: 3,    maxBid: 25,   recommendedBid: 8,   floorPrice: 2,   dailyBudgetMin: 50  },
];

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics', async (req, res, next) => {
  try {
    const { period = '30days' } = req.query;
    const days = period === '7days' ? 7 : period === '90days' ? 90 : 30;
    const cutoff = new Date(Date.now() - days * 86400000);

    const [allCampaigns, statusAgg, typeAgg, placementAgg, vendorAgg, walletAgg, eventsAgg] = await Promise.all([
      AdCampaign.find().populate('vendor', 'name businessName email').lean(),
      AdCampaign.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      AdCampaign.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 },
          spend: { $sum: { $add: [{ $ifNull: ['$stats.spend', 0] }, { $ifNull: ['$spent', 0] }] } },
        }},
      ]),
      AdCampaign.aggregate([
        { $group: { _id: '$placement',
          clicks:  { $sum: { $add: [{ $ifNull: ['$stats.clicks', 0] }, { $ifNull: ['$clicks', 0] }] } },
          spend:   { $sum: { $add: [{ $ifNull: ['$stats.spend', 0] }, { $ifNull: ['$spent', 0] }] } },
          count:   { $sum: 1 },
        }},
        { $sort: { clicks: -1 } }, { $limit: 15 },
      ]),
      AdCampaign.aggregate([
        { $group: { _id: '$vendor',
          totalSpend: { $sum: { $add: [{ $ifNull: ['$stats.spend', 0] }, { $ifNull: ['$spent', 0] }] } },
          campaigns:  { $sum: 1 },
        }},
        { $sort: { totalSpend: -1 } }, { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
      ]),
      AdWallet.aggregate([
        { $group: { _id: null,
          totalBalance: { $sum: '$balance' }, totalRecharged: { $sum: '$totalRecharged' },
          totalSpent: { $sum: '$totalSpent' }, walletCount: { $sum: 1 },
          activeCount: { $sum: { $cond: [{ $gt: ['$balance', 0] }, 1, 0] } },
        }},
      ]),
      AdEvent.aggregate([
        { $match: { timestamp: { $gte: cutoff } } },
        { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, event: '$event' },
          count: { $sum: 1 }, cost: { $sum: '$cost' }, revenue: { $sum: '$revenue' },
        }},
        { $sort: { '_id.date': 1 } },
      ]),
    ]);

    // Overview totals
    const totalImpressions = allCampaigns.reduce((s, c) => s + (c.stats?.impressions || 0) + (c.impressions || 0), 0);
    const totalClicks      = allCampaigns.reduce((s, c) => s + (c.stats?.clicks || 0) + (c.clicks || 0), 0);
    const totalSpend       = allCampaigns.reduce((s, c) => s + (c.stats?.spend || 0) + (c.spent || 0), 0);
    const totalRevenue     = allCampaigns.reduce((s, c) => s + (c.stats?.revenue || 0), 0);
    const totalConversions = allCampaigns.reduce((s, c) => s + (c.stats?.conversions || 0), 0);
    const activeCampaigns  = allCampaigns.filter((c) => c.status === 'active').length;
    const ctr       = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0;
    const avgCPC    = totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0;
    const roas      = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0;

    // Status/type breakdowns
    const statusBreakdown = {};
    statusAgg.forEach((s) => { if (s._id) statusBreakdown[s._id] = s.count; });
    const typeBreakdown = {};
    typeAgg.forEach((t) => { if (t._id) typeBreakdown[t._id] = { count: t.count, spend: t.spend }; });

    // Time series from AdEvent
    const tsMap = {};
    eventsAgg.forEach(({ _id, count, cost, revenue: rev }) => {
      if (!tsMap[_id.date]) tsMap[_id.date] = { date: _id.date, impressions: 0, clicks: 0, spend: 0, revenue: 0 };
      if (_id.event === 'impression') tsMap[_id.date].impressions += count;
      if (_id.event === 'click') { tsMap[_id.date].clicks += count; tsMap[_id.date].spend += cost; }
      if (_id.event === 'conversion') tsMap[_id.date].revenue += rev;
    });
    const timeSeries = Object.values(tsMap).sort((a, b) => a.date.localeCompare(b.date));

    // Top campaigns by spend
    const topCampaigns = [...allCampaigns]
      .map((c) => ({
        _id: c._id,
        name: c.name || c.title,
        vendorName: c.vendor?.businessName || c.vendor?.name || 'Unknown',
        spend: (c.stats?.spend || 0) + (c.spent || 0),
        clicks: (c.stats?.clicks || 0) + (c.clicks || 0),
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    res.json({
      overview: { totalCampaigns: allCampaigns.length, activeCampaigns, totalImpressions, totalClicks, totalConversions, totalSpend, totalRevenue, ctr, avgCPC, roas },
      statusBreakdown,
      typeBreakdown,
      timeSeries,
      topCampaigns,
      placementStats: placementAgg.map((p) => ({ placement: p._id, clicks: p.clicks, spend: p.spend, count: p.count })),
      vendorStats: vendorAgg.map((v) => ({ vendorId: v._id, name: v.u?.businessName || v.u?.name || v.u?.email || '—', campaigns: v.campaigns, totalSpend: v.totalSpend })),
      walletOverview: walletAgg[0] || { totalBalance: 0, totalRecharged: 0, totalSpent: 0, walletCount: 0, activeCount: 0 },
    });
  } catch (err) { next(err); }
});

// ─── Campaigns ────────────────────────────────────────────────────────────────
router.get('/campaigns', async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } },
    ];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [campaigns, total] = await Promise.all([
      AdCampaign.find(filter).populate('vendor', 'name businessName email').populate('product', 'title images').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      AdCampaign.countDocuments(filter),
    ]);
    res.json({ campaigns: campaigns.map(normCampaign), pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

router.post('/campaigns', async (req, res, next) => {
  try {
    const { name, type, pricing, bid, dailyBudget, totalBudget, placement, position,
      bannerSize, bannerImage, targetUrl, dimensions, targeting, startAt, endAt,
      status = 'draft', vendor } = req.body;
    const campaign = await AdCampaign.create({
      vendor: vendor || req.user._id,
      name, type, pricing, bid,
      dailyBudget, totalBudget,
      budget: totalBudget || dailyBudget,
      placement, position, bannerSize, bannerImage, targetUrl, dimensions, targeting,
      startAt, endAt, status,
    });
    res.status(201).json({ campaign: normCampaign(campaign) });
  } catch (err) { next(err); }
});

router.put('/campaigns/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid ID', 400, 'INVALID_ID');
    const campaign = await AdCampaign.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('vendor', 'name businessName email').populate('product', 'title images');
    if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    res.json({ campaign: normCampaign(campaign) });
  } catch (err) { next(err); }
});

router.delete('/campaigns/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid ID', 400, 'INVALID_ID');
    const campaign = await AdCampaign.findByIdAndDelete(req.params.id);
    if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/campaigns/:id/status', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid ID', 400, 'INVALID_ID');
    const { status } = req.body;
    const campaign = await AdCampaign.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    res.json({ campaign: normCampaign(campaign) });
  } catch (err) { next(err); }
});

// Legacy PATCH for backward compat
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    const campaign = await AdCampaign.findByIdAndUpdate(req.params.id, { status, ...(adminNote && { adminNote }) }, { new: true });
    if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    res.json({ campaign });
  } catch (err) { next(err); }
});

router.put('/campaigns/:id/approve', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid ID', 400, 'INVALID_ID');
    const { adminNotes } = req.body;
    const campaign = await AdCampaign.findById(req.params.id);
    if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    campaign.status = 'approved';
    campaign.approval = { status: 'approved', reviewedBy: req.user._id, reviewedAt: new Date(), adminNotes };
    campaign.calculateAuctionScore();
    await campaign.save();
    res.json({ campaign: normCampaign(campaign) });
  } catch (err) { next(err); }
});

router.put('/campaigns/:id/reject', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid ID', 400, 'INVALID_ID');
    const { rejectionReason, adminNotes } = req.body;
    if (!rejectionReason?.trim()) throw new AppError('Rejection reason is required', 400, 'MISSING_FIELDS');
    const campaign = await AdCampaign.findById(req.params.id);
    if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    campaign.status = 'rejected';
    campaign.approval = { status: 'rejected', reviewedBy: req.user._id, reviewedAt: new Date(), rejectionReason: rejectionReason.trim(), adminNotes };
    await campaign.save();
    res.json({ campaign: normCampaign(campaign) });
  } catch (err) { next(err); }
});

router.put('/campaigns/:id/pause', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new AppError('Invalid ID', 400, 'INVALID_ID');
    const { reason } = req.body;
    const campaign = await AdCampaign.findById(req.params.id);
    if (!campaign) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
    campaign.status = 'paused';
    if (reason) campaign.approval = { ...campaign.approval, adminNotes: `[Paused by admin]: ${reason}` };
    await campaign.save();
    res.json({ campaign: normCampaign(campaign) });
  } catch (err) { next(err); }
});

// ─── Pricing Settings ─────────────────────────────────────────────────────────
router.get('/pricing-settings', async (req, res, next) => {
  try {
    const settings = await AdPricingSettings.find().sort({ placement: 1 });
    res.json({ settings });
  } catch (err) { next(err); }
});

// Must come before /:placement
router.post('/pricing-settings/initialize', async (req, res, next) => {
  try {
    const existing = await AdPricingSettings.find().distinct('placement');
    const toCreate = DEFAULT_PLACEMENTS.filter((p) => !existing.includes(p.placement));
    if (toCreate.length > 0) {
      await AdPricingSettings.insertMany(toCreate.map((p) => ({ ...p, updatedBy: req.user._id })));
    }
    res.json({ created: toCreate.length, skipped: existing.length });
  } catch (err) { next(err); }
});

router.post('/pricing-settings', async (req, res, next) => {
  try {
    const { placement, displayName, description, pricingType, minBid, maxBid,
      recommendedBid, floorPrice, dailyBudgetMin, auctionType, requiresApproval, status } = req.body;
    if (!placement || !displayName) throw new AppError('Placement and displayName are required', 400, 'MISSING_FIELDS');
    if (minBid > maxBid) throw new AppError('minBid must be ≤ maxBid', 400, 'INVALID_BID');
    if (floorPrice > maxBid) throw new AppError('floorPrice must be ≤ maxBid', 400, 'INVALID_BID');
    const setting = await AdPricingSettings.findOneAndUpdate(
      { placement },
      { placement, displayName, description, pricingType, minBid, maxBid, recommendedBid, floorPrice, dailyBudgetMin, auctionType, requiresApproval, status, updatedBy: req.user._id },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ setting });
  } catch (err) { next(err); }
});

router.get('/pricing-settings/:placement', async (req, res, next) => {
  try {
    const setting = await AdPricingSettings.findOne({ placement: req.params.placement });
    if (!setting) throw new AppError('Placement not found', 404, 'NOT_FOUND');
    res.json({ setting });
  } catch (err) { next(err); }
});

// ─── Wallets ──────────────────────────────────────────────────────────────────
router.get('/wallets', async (req, res, next) => {
  try {
    const wallets = await AdWallet.find().populate('vendorId', 'name businessName email').sort({ balance: -1 });
    res.json({ wallets });
  } catch (err) { next(err); }
});

module.exports = router;
