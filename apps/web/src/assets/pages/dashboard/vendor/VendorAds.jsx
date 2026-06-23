import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Info, RefreshCw, Plus, Pause, Play, Pencil, Trash2, BarChart2, Wallet,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, invalidateCache } from '../../../../hooks';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import toast from 'react-hot-toast';

// ─── Static config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  draft:            { label: 'Draft',            cls: 'bg-secondary-100 text-secondary-600' },
  pending:          { label: 'Pending Review',   cls: 'bg-blue-100 text-blue-700' },
  pending_approval: { label: 'Pending Review',   cls: 'bg-blue-100 text-blue-700' },
  active:           { label: 'Active',           cls: 'bg-green-100 text-green-700' },
  approved:         { label: 'Approved',         cls: 'bg-green-100 text-green-700' },
  paused:           { label: 'Paused',           cls: 'bg-yellow-100 text-yellow-700' },
  rejected:         { label: 'Rejected',         cls: 'bg-red-100 text-red-700' },
  budget_exhausted: { label: 'Budget Exhausted', cls: 'bg-red-100 text-red-700' },
  completed:        { label: 'Completed',        cls: 'bg-secondary-100 text-secondary-500' },
};

const PLACEMENT_GROUPS = [
  {
    label: 'Homepage',
    placements: [
      { value: 'homepage_banner',        label: 'Homepage Banner' },
      { value: 'homepage_top',           label: 'Homepage Top' },
      { value: 'homepage_sidebar_left',  label: 'Homepage Sidebar Left' },
      { value: 'homepage_sidebar_right', label: 'Homepage Sidebar Right' },
    ],
  },
  {
    label: 'Search & Category',
    placements: [
      { value: 'search_sponsored_products', label: 'Search Sponsored Products' },
      { value: 'category_top_banner',       label: 'Category Top Banner' },
      { value: 'category_grid',             label: 'Category Grid' },
    ],
  },
  {
    label: 'Product Pages',
    placements: [
      { value: 'product_sidebar', label: 'Product Sidebar' },
      { value: 'product_related', label: 'Product Related' },
    ],
  },
];

const POSITIONS    = ['top', 'right', 'bottom', 'left', 'center', 'top-right', 'top-left', 'bottom-right', 'bottom-left'];
const BANNER_SIZES = [
  { value: 'hero',                  label: 'Hero' },
  { value: 'leaderboard',           label: 'Leaderboard (728×90)' },
  { value: 'rectangle',             label: 'Rectangle (300×250)' },
  { value: 'skyscraper',            label: 'Skyscraper (160×600)' },
  { value: 'square',                label: 'Square' },
  { value: 'side-small',            label: 'Side Small' },
  { value: 'side-large',            label: 'Side Large' },
];

const EMPTY_FORM = {
  name: '', type: 'SponsoredProduct', pricing: 'CPC',
  bid: '', dailyBudget: '',
  startAt: '', endAt: '',
  placement: 'search_sponsored_products',
  position: 'top', bannerSize: '',
  productIds: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function getBidFeedback(bid, ps) {
  if (!ps || !bid) return null;
  const b = parseFloat(bid);
  if (!b || isNaN(b)) return null;
  if (b < ps.floorPrice)     return { type: 'error',   msg: `Bid must be above floor price of ${formatCurrency(ps.floorPrice)}` };
  if (b < ps.minBid)         return { type: 'error',   msg: `Minimum bid for this placement is ${formatCurrency(ps.minBid)}` };
  if (b < ps.recommendedBid) return { type: 'warning', msg: `Recommended bid is ${formatCurrency(ps.recommendedBid)} for better visibility` };
  return { type: 'success', msg: 'Your bid is competitive!' };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function ApprovalBadge({ approval }) {
  if (!approval?.status || approval.status === 'pending') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">⏳ Pending Review</span>;
  }
  if (approval.status === 'approved') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✓ Approved</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">✗ Rejected</span>;
}

function StatCell({ label, value }) {
  return (
    <div>
      <p className="text-xs text-secondary-400">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VendorAds() {
  const { user } = useSelector((s) => s.auth);

  const [rev, setRev] = useState(0);

  // Modals
  const [isRechargeOpen,   setIsRechargeOpen]   = useState(false);
  const [isCreateOpen,     setIsCreateOpen]     = useState(false);
  const [editingCampaign,  setEditingCampaign]  = useState(null); // null = create, obj = edit

  // Wallet recharge
  const [rechargeAmount,       setRechargeAmount]       = useState('');
  const [isProcessingPayment,  setIsProcessingPayment]  = useState(false);

  // Campaign form
  const [form,    setForm]    = useState({ ...EMPTY_FORM });
  const [saving,  setSaving]  = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: campData, isLoading: campLoading } = useFetch(
    ['ad-campaigns', rev],
    () => api.get('/vendors/ads/campaigns').then((r) => r.data)
  );

  const { data: walletData, isLoading: walletLoading } = useFetch(
    ['ad-wallet', rev],
    () => api.get('/vendors/ads/wallet').then((r) => r.data)
  );

  const { data: productsData } = useFetch(
    ['vendor-products-ads'],
    () => api.get('/vendors/products', { params: { limit: 100 } }).then((r) => r.data)
  );

  const { data: pricingData } = useFetch(
    ['ad-pricing', form.placement],
    () => api.get(`/admin/ads/pricing-settings/${form.placement}`).then((r) => r.data),
    { enabled: isCreateOpen && !!form.placement }
  );

  const campaigns  = campData?.campaigns || [];
  const balance    = walletData?.balance ?? 0;
  const products   = productsData?.products || [];
  const pricing    = pricingData?.setting || null;
  const bidFb      = getBidFeedback(form.bid, pricing);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function refresh() {
    invalidateCache('ad-campaigns');
    invalidateCache('ad-wallet');
    setRev((r) => r + 1);
  }

  function openCreate() {
    setEditingCampaign(null);
    setForm({ ...EMPTY_FORM });
    setIsCreateOpen(true);
  }

  function openEdit(c) {
    setEditingCampaign(c);
    setForm({
      name:       c.name || '',
      type:       c.type || 'SponsoredProduct',
      pricing:    c.pricing || 'CPC',
      bid:        c.bid?.toString() || '',
      dailyBudget: c.dailyBudget?.toString() || '',
      startAt:    c.startAt ? c.startAt.slice(0, 10) : '',
      endAt:      c.endAt   ? c.endAt.slice(0, 10)   : '',
      placement:  c.placement || 'search_sponsored_products',
      position:   c.position || 'top',
      bannerSize: c.bannerSize || '',
      productIds: c.targeting?.products?.map((p) => (typeof p === 'object' ? p._id : p)) || [],
    });
    setIsCreateOpen(true);
  }

  function setF(k) { return (e) => setForm((f) => ({ ...f, [k]: e.target.value })); }

  function toggleProduct(id) {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id)
        ? f.productIds.filter((x) => x !== id)
        : [...f.productIds, id],
    }));
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────

  async function handleSaveCampaign(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        type:        form.type,
        pricing:     form.pricing,
        bid:         parseFloat(form.bid),
        dailyBudget: parseFloat(form.dailyBudget),
        placement:   form.placement,
        position:    form.position,
        bannerSize:  form.bannerSize || undefined,
        startAt:     form.startAt || undefined,
        endAt:       form.endAt   || undefined,
        targeting:   form.type === 'SponsoredProduct' ? { products: form.productIds } : undefined,
      };
      if (editingCampaign) {
        await api.put(`/vendors/ads/campaigns/${editingCampaign._id}`, payload);
        toast.success('Campaign updated');
      } else {
        await api.post('/vendors/ads/campaigns', payload);
        toast.success('Campaign submitted for review');
      }
      setIsCreateOpen(false);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(c) {
    const next = c.status === 'paused' ? 'active' : 'paused';
    try {
      await api.put(`/vendors/ads/campaigns/${c._id}`, { status: next });
      toast.success(next === 'paused' ? 'Campaign paused' : 'Campaign resumed');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/vendors/ads/campaigns/${c._id}`);
      toast.success('Campaign deleted');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete campaign');
    }
  }

  async function handleRecharge(e) {
    e.preventDefault();
    const amt = parseFloat(rechargeAmount);
    if (!amt || amt < 100) return toast.error('Minimum recharge amount is ₹100');

    setIsProcessingPayment(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Could not load payment gateway');

      const { data } = await api.post('/vendors/ads/wallet/recharge/create-order', { amount: amt });
      setIsProcessingPayment(false);

      const rzp = new window.Razorpay({
        key:        data.key,
        amount:     data.order.amount,
        currency:   'INR',
        order_id:   data.order.id,
        name:       'Macgly Ad Wallet',
        description: 'Ad Wallet Recharge',
        prefill:    { name: user?.name || '', email: user?.email || '', contact: user?.phone || '' },
        theme:      { color: '#7c3aed' },
        handler: async (response) => {
          try {
            await api.post('/vendors/ads/wallet/recharge/verify', {
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              amount: amt,
            });
            setIsRechargeOpen(false);
            setRechargeAmount('');
            refresh();
            toast.success('Wallet recharged successfully!');
          } catch (err) {
            toast.error(err.response?.data?.error?.message || 'Payment verification failed');
          }
        },
      });
      rzp.open();
    } catch (err) {
      setIsProcessingPayment(false);
      toast.error(err.response?.data?.error?.message || 'Could not initiate payment');
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sponsored Ads</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Promote your products in premium positions</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={refresh} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <div className="flex items-center gap-2 text-sm">
            <Wallet size={15} className="text-secondary-400" />
            <span className="text-secondary-500">Wallet Balance</span>
            {walletLoading
              ? <Spinner size="sm" />
              : <span className="font-bold text-primary-600 text-lg">{formatCurrency(balance)}</span>
            }
          </div>
          <button onClick={() => setIsRechargeOpen(true)} className="btn-secondary text-sm">
            Recharge Wallet
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Create Campaign
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-purple-700 font-semibold">
          <Info size={16} />
          <span>What are Sponsored Ads?</span>
        </div>
        <p className="text-sm text-purple-600">
          Promote your products in premium positions across Macgly — homepage banners, category pages, and search
          results. Choose from CPC (pay per click), CPM (pay per 1000 views), or CPA (pay per sale) models.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'CPC Pricing',     value: '₹5–₹20',    sub: 'per click' },
            { label: 'CPM Pricing',     value: '₹100–₹300', sub: 'per 1000 views' },
            { label: 'Starter Budget',  value: '₹500+',     sub: 'daily minimum' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white/70 rounded-lg p-3 border border-purple-100">
              <p className="text-xs text-purple-500 font-medium">{label}</p>
              <p className="text-purple-700 font-bold text-lg">{value}</p>
              <p className="text-xs text-purple-400">{sub}</p>
            </div>
          ))}
        </div>
        <a href="/page/vendor-guide#sponsor-ads" className="inline-block text-sm text-purple-700 font-medium hover:underline">
          Learn More About Sponsored Ads →
        </a>
      </div>

      {/* Campaign list */}
      {campLoading
        ? <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        : campaigns.length === 0
          ? (
            <div className="card p-14 text-center text-secondary-400">
              <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No campaigns yet</p>
              <p className="text-sm mt-1">Create your first sponsored ad to reach more buyers</p>
            </div>
          )
          : (
            <div className="grid gap-4">
              {campaigns.map((c) => {
                const ctr = c.stats.impressions > 0
                  ? ((c.stats.clicks / c.stats.impressions) * 100).toFixed(2)
                  : '0.00';
                const canPauseResume = ['active', 'paused'].includes(c.status) && c.approval?.status === 'approved';
                return (
                  <div key={c._id} className="card p-4 space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{c.name}</span>
                          <StatusBadge status={c.status} />
                          <ApprovalBadge approval={c.approval} />
                          {c.qualityScore?.overall != null && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-600">
                              Quality: {c.qualityScore.overall}/10
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-secondary-400 mt-1">
                          {c.type} • {c.pricing} • Bid: {formatCurrency(c.bid)} • Score: {(c.auctionScore || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-secondary-400">
                          Daily Budget: {formatCurrency(c.dailyBudget)} • Spend: {formatCurrency(c.stats.spend)}
                        </p>
                        {c.approval?.rejectionReason && (
                          <p className="text-xs text-red-500 mt-1">
                            Rejection reason: {c.approval.rejectionReason}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {canPauseResume && (
                          <button
                            onClick={() => handleToggleStatus(c)}
                            className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
                          >
                            {c.status === 'paused'
                              ? <><Play size={12} /> Resume</>
                              : <><Pause size={12} /> Pause</>
                            }
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors text-secondary-500"
                          title="Edit campaign"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          disabled
                          className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3 opacity-50 cursor-not-allowed"
                          title="Coming soon"
                        >
                          <BarChart2 size={12} /> View Report
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-red-400"
                          title="Delete campaign"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-5 gap-3 pt-2 border-t border-secondary-100">
                      <StatCell label="Impressions" value={c.stats.impressions.toLocaleString()} />
                      <StatCell label="Clicks"      value={c.stats.clicks.toLocaleString()} />
                      <StatCell label="CTR"         value={`${ctr}%`} />
                      <StatCell label="Conversions" value={c.stats.conversions.toLocaleString()} />
                      <StatCell label="Spend"       value={<span className="text-red-500">{formatCurrency(c.stats.spend)}</span>} />
                    </div>
                  </div>
                );
              })}
            </div>
          )
      }

      {/* ── Recharge Wallet Modal ─────────────────────────────────────────────── */}
      <Modal open={isRechargeOpen} onClose={() => setIsRechargeOpen(false)} title="Recharge Ad Wallet">
        <form onSubmit={handleRecharge} className="space-y-4">
          <p className="text-sm text-secondary-500">
            Add funds to your ad wallet to run campaigns. Minimum recharge is ₹100.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
            <input
              className="input w-full"
              type="number"
              min="100"
              step="50"
              placeholder="Enter amount"
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[500, 1000, 2000, 5000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setRechargeAmount(String(amt))}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  rechargeAmount === String(amt)
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-secondary-200 hover:border-secondary-300'
                }`}
              >
                ₹{amt.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-secondary-100">
            <span className="text-sm text-secondary-500">
              Current Balance: <strong>{formatCurrency(balance)}</strong>
            </span>
            <Button type="submit" loading={isProcessingPayment}>
              Pay with Razorpay
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Create / Edit Campaign Modal ──────────────────────────────────────── */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
        size="lg"
      >
        <form onSubmit={handleSaveCampaign} className="space-y-4">

          {/* Name + Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Campaign Name *</label>
              <input
                className="input w-full"
                placeholder="Enter campaign name"
                value={form.name}
                onChange={setF('name')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Campaign Type</label>
              <select className="input w-full" value={form.type} onChange={setF('type')}>
                <option value="SponsoredProduct">Sponsored Product</option>
                <option value="SponsoredBrand">Sponsored Brand</option>
                <option value="Banner">Banner</option>
              </select>
            </div>
          </div>

          {/* Pricing + Placement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pricing Model</label>
              <select className="input w-full" value={form.pricing} onChange={setF('pricing')}>
                <option value="CPC">CPC — Pay per click</option>
                <option value="CPM">CPM — Pay per 1000 views</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Placement</label>
              <select className="input w-full" value={form.placement} onChange={setF('placement')}>
                {PLACEMENT_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.placements.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Position + Banner size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Position</label>
              <select className="input w-full" value={form.position} onChange={setF('position')}>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Banner Size</label>
              <select className="input w-full" value={form.bannerSize} onChange={setF('bannerSize')}>
                <option value="">— Select —</option>
                {BANNER_SIZES.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Bid + Daily budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Bid Amount (₹) *
                {pricing && (
                  <span className="text-xs text-secondary-400 ml-1 font-normal">
                    Min: ₹{pricing.minBid} · Rec: ₹{pricing.recommendedBid}
                  </span>
                )}
              </label>
              <input
                className={`input w-full ${bidFb?.type === 'error' ? 'border-red-400 focus:ring-red-400' : ''}`}
                type="number"
                min="0.5"
                step="0.5"
                placeholder="Enter amount"
                value={form.bid}
                onChange={setF('bid')}
                required
              />
              {bidFb && (
                <p className={`text-xs mt-1 ${bidFb.type === 'error' ? 'text-red-500' : bidFb.type === 'warning' ? 'text-yellow-600' : 'text-green-600'}`}>
                  {bidFb.msg}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Daily Budget (₹) *
                {pricing && (
                  <span className="text-xs text-secondary-400 ml-1 font-normal">Min: ₹{pricing.dailyBudgetMin}</span>
                )}
              </label>
              <input
                className="input w-full"
                type="number"
                min="50"
                step="50"
                placeholder="Enter amount"
                value={form.dailyBudget}
                onChange={setF('dailyBudget')}
                required
              />
            </div>
          </div>

          {/* Start / End dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                className="input w-full"
                type="date"
                min={today()}
                value={form.startAt}
                onChange={setF('startAt')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date (optional)</label>
              <input
                className="input w-full"
                type="date"
                min={form.startAt || today()}
                value={form.endAt}
                onChange={setF('endAt')}
              />
            </div>
          </div>

          {/* Product selector — only for SponsoredProduct */}
          {form.type === 'SponsoredProduct' && products.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Target Products</label>
              <div className="max-h-40 overflow-y-auto border border-secondary-200 rounded-lg divide-y divide-secondary-100">
                {products.map((p) => (
                  <label key={p._id} className="flex items-center gap-3 px-3 py-2 hover:bg-secondary-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.productIds.includes(p._id)}
                      onChange={() => toggleProduct(p._id)}
                      className="rounded"
                    />
                    {p.images?.[0] && (
                      <img src={p.images[0]} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                    )}
                    <span className="text-sm">{p.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-secondary-400">
            New campaigns start as <strong>Draft</strong> and require admin approval before going live.
          </p>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-secondary text-sm">
              Cancel
            </button>
            <Button type="submit" loading={saving} disabled={bidFb?.type === 'error'}>
              {editingCampaign ? 'Save Changes' : 'Submit for Approval'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
