import { useState, useRef } from 'react';
import {
  Megaphone, BarChart2, Settings, Wallet,
  RefreshCw, Plus, Search, Download, CheckCircle, XCircle,
  Eye, Pencil, Trash2, ChevronDown, X,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const STATUS_CONFIG = {
  draft:            { label: 'Draft',            class: 'bg-secondary-100 text-secondary-600' },
  active:           { label: 'Active',           class: 'bg-green-100 text-green-700' },
  paused:           { label: 'Paused',           class: 'bg-yellow-100 text-yellow-700' },
  approved:         { label: 'Approved',         class: 'bg-blue-100 text-blue-700' },
  pending_approval: { label: 'Pending',          class: 'bg-orange-100 text-orange-700' },
  pending:          { label: 'Pending',          class: 'bg-orange-100 text-orange-700' },
  rejected:         { label: 'Rejected',         class: 'bg-red-100 text-red-700' },
  completed:        { label: 'Completed',        class: 'bg-blue-100 text-blue-600' },
  budget_exhausted: { label: 'Budget Exhausted', class: 'bg-red-100 text-red-600' },
};

const ALL_PLACEMENTS = [
  { group: 'Homepage', options: ['homepage_banner','homepage_top','homepage_middle','homepage_bottom','homepage_sidebar_left','homepage_sidebar_right'] },
  { group: 'Search',   options: ['search_sponsored_products','search_top','search_sidebar'] },
  { group: 'Category', options: ['category_top_banner','category_sidebar','category_grid'] },
  { group: 'Product',  options: ['product_sidebar','product_top','product_bottom','product_related'] },
  { group: 'Blog',     options: ['blog_sidebar','blog_top','blog_in_content','blog_bottom'] },
  { group: 'Cart',     options: ['cart_sidebar','cart_bottom','checkout_top'] },
  { group: 'Other',    options: ['vendor_store','vendor_list','about_us','contact_us','faq'] },
];

const BANNER_SIZES = ['Hero','Leaderboard','Large Sidebar','Small Sidebar','Rectangle','Skyscraper','Square','Custom'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCur(v) { return `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtNum(v) { return Number(v || 0).toLocaleString('en-IN'); }
function pct(a, b) { return b > 0 ? ((a - b) / b * 100).toFixed(1) : null; }

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.class}`}>{cfg.label}</span>;
}

function TrendBadge({ current, previous }) {
  const diff = pct(current, previous);
  if (diff === null) return <span className="text-xs text-secondary-400">—</span>;
  const up = parseFloat(diff) >= 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '↑' : '↓'} {Math.abs(diff)}%
    </span>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ analytics, period, setPeriod, onRefresh }) {
  const ov = analytics?.overview || {};
  const ts = analytics?.timeSeries || [];
  const topCampaigns = analytics?.topCampaigns || [];
  const placements = analytics?.placementStats || [];
  const vendors = analytics?.vendorStats || [];
  const walletOv = analytics?.walletOverview || {};
  const statusBD = analytics?.statusBreakdown || {};
  const typeBD = analytics?.typeBreakdown || {};

  const kpis = [
    { label: 'Total Campaigns', value: fmtNum(ov.totalCampaigns), sub: `${ov.activeCampaigns || 0} active` },
    { label: 'Total Spend',     value: fmtCur(ov.totalSpend),     sub: <TrendBadge current={ov.totalSpend} previous={ov.prevSpend} /> },
    { label: 'Impressions',     value: fmtNum(ov.totalImpressions), sub: <TrendBadge current={ov.totalImpressions} previous={ov.prevImpressions} /> },
    { label: 'Clicks',          value: fmtNum(ov.totalClicks),    sub: <TrendBadge current={ov.totalClicks} previous={ov.prevClicks} /> },
    { label: 'CTR',             value: `${ov.ctr || 0}%`,         sub: `Avg CPC: ${fmtCur(ov.avgCPC)}` },
    { label: 'Revenue',         value: fmtCur(ov.totalRevenue),   sub: `ROAS: ${ov.roas || 0}x` },
  ];

  const typeEntries = Object.entries(typeBD);
  const pieData = typeEntries.map(([name, d]) => ({ name, value: d.count }));

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center gap-1 bg-secondary-100 p-1 rounded-lg w-fit">
        {['7 Days', '30 Days', '90 Days'].map((label) => {
          const val = label.replace(' ', '').toLowerCase() + 's'; // "7days" etc
          return (
            <button
              key={val}
              onClick={() => setPeriod(val)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${period === val ? 'bg-white shadow-sm text-secondary-800' : 'text-secondary-500 hover:text-secondary-700'}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(({ label, value, sub }) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-secondary-500 font-medium">{label}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
            <div className="text-xs text-secondary-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-5 gap-4">
        {/* Performance trend */}
        <div className="card p-5 col-span-3">
          <p className="font-semibold text-sm mb-4">Performance Trend</p>
          {ts.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-secondary-400 text-sm">No event data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ts}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="impressions" stroke="#3b82f6" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="clicks"      stroke="#10b981" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="spend"       stroke="#f59e0b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Campaign breakdown */}
        <div className="card p-5 col-span-2">
          <p className="font-semibold text-sm mb-4">Campaign Breakdown</p>
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-xs text-secondary-400 mb-2">BY STATUS</p>
              <div className="space-y-1.5">
                {Object.entries(statusBD).filter(([, v]) => v > 0).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-xs">
                    <StatusBadge status={status} />
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-secondary-400 mb-2">BY TYPE</p>
              {pieData.length > 0 ? (
                <PieChart width={100} height={100}>
                  <Pie data={pieData} cx={45} cy={45} innerRadius={28} outerRadius={45} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-secondary-100 flex items-center justify-center text-xs text-secondary-300">—</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="font-semibold text-sm mb-3">Top Campaigns (Spend)</p>
          <div className="space-y-2">
            {topCampaigns.slice(0, 6).map((c, i) => (
              <div key={c._id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-secondary-400 shrink-0">#{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-xs">{c.name}</p>
                    <p className="text-xs text-secondary-400 truncate">{c.vendorName}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold shrink-0 ml-2">{fmtCur(c.spend)}</span>
              </div>
            ))}
            {topCampaigns.length === 0 && <p className="text-xs text-secondary-400">No data</p>}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold text-sm mb-3">Placement Performance</p>
          <div className="space-y-2">
            {placements.slice(0, 6).map((p) => (
              <div key={p.placement} className="flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium capitalize">{(p.placement || '').replace(/_/g, ' ')}</p>
                  <p className="text-secondary-400">{p.count} campaign{p.count !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{fmtNum(p.clicks)} clicks</p>
                  <p className="text-secondary-400">{fmtCur(p.spend)}</p>
                </div>
              </div>
            ))}
            {placements.length === 0 && <p className="text-xs text-secondary-400">No data</p>}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-semibold text-sm mb-3">Vendor Ad Spend</p>
          <div className="space-y-2">
            {vendors.slice(0, 6).map((v, i) => (
              <div key={v.vendorId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-secondary-400 shrink-0">#{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{v.name}</p>
                    <p className="text-secondary-400">{v.campaigns} campaign{v.campaigns !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className="font-semibold shrink-0 ml-2">{fmtCur(v.totalSpend)}</span>
              </div>
            ))}
            {vendors.length === 0 && <p className="text-xs text-secondary-400">No data</p>}
          </div>
        </div>
      </div>

      {/* Wallet bar */}
      <div className="card p-4 flex items-center gap-6 text-sm flex-wrap">
        <span className="flex items-center gap-2 font-semibold text-secondary-700">
          <Wallet size={15} className="text-blue-600" /> Platform Wallets
        </span>
        <span className="text-secondary-500">Active: <b>{walletOv.activeCount || 0}</b></span>
        <span className="text-secondary-500">Total Balance: <b>{fmtCur(walletOv.totalBalance)}</b></span>
        <span className="text-secondary-500">Recharged: <b>{fmtCur(walletOv.totalRecharged)}</b></span>
        <span className="text-secondary-500">Spent: <b>{fmtCur(walletOv.totalSpent)}</b></span>
      </div>
    </div>
  );
}

// ─── Create/Edit Campaign Modal ───────────────────────────────────────────────
function CampaignModal({ campaign, vendors, onClose, onSave }) {
  const isEdit = !!campaign?._id;
  const [form, setForm] = useState({
    name: campaign?.name || '',
    vendor: campaign?.vendor?._id || campaign?.vendor || '',
    type: campaign?.type || 'SponsoredProduct',
    pricing: campaign?.pricing || 'CPC',
    bid: campaign?.bid || '',
    dailyBudget: campaign?.dailyBudget || '',
    totalBudget: campaign?.totalBudget || '',
    startAt: campaign?.startAt ? campaign.startAt.slice(0, 10) : '',
    endAt: campaign?.endAt ? campaign.endAt.slice(0, 10) : '',
    status: campaign?.status || 'draft',
    placement: campaign?.placement || 'homepage_banner',
    position: campaign?.position || '',
    bannerSize: campaign?.bannerSize || '',
    bannerImage: campaign?.bannerImage || '',
    customWidth: campaign?.dimensions?.width || '',
    customHeight: campaign?.dimensions?.height || '',
    keywords: campaign?.targeting?.keywords?.map((k) => k.keyword).join(', ') || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Campaign name is required');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        vendor: form.vendor || undefined,
        type: form.type,
        pricing: form.pricing,
        bid: Number(form.bid) || 0,
        dailyBudget: Number(form.dailyBudget) || 0,
        totalBudget: Number(form.totalBudget) || 0,
        startAt: form.startAt || undefined,
        endAt: form.endAt || undefined,
        status: form.status,
        placement: form.placement,
        position: form.position || undefined,
        bannerSize: form.bannerSize || undefined,
        bannerImage: form.bannerImage || undefined,
        dimensions: form.bannerSize === 'Custom' ? { width: Number(form.customWidth), height: Number(form.customHeight) } : undefined,
        targeting: { keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean).map((k) => ({ keyword: k, matchType: 'broad' })) },
      };
      if (isEdit) {
        await api.put(`/admin/ads/campaigns/${campaign._id}`, payload);
      } else {
        await api.post('/admin/ads/campaigns', payload);
      }
      toast.success(isEdit ? 'Campaign updated' : 'Campaign created');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <h2 className="font-bold text-lg">{isEdit ? 'Edit Campaign' : 'Create Campaign'}</h2>
          <button onClick={onClose}><X size={18} className="text-secondary-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label text-sm">Campaign Name *</label>
              <input className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            {vendors?.length > 0 && (
              <div>
                <label className="label text-sm">Vendor *</label>
                <select className="input w-full" value={form.vendor} onChange={(e) => set('vendor', e.target.value)}>
                  <option value="">Select vendor</option>
                  {vendors.map((v) => <option key={v._id} value={v._id}>{v.businessName || v.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label text-sm">Type *</label>
              <select className="input w-full" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="SponsoredProduct">Sponsored Product</option>
                <option value="SponsoredBrand">Sponsored Brand</option>
                <option value="Banner">Banner</option>
              </select>
            </div>
            <div>
              <label className="label text-sm">Pricing *</label>
              <select className="input w-full" value={form.pricing} onChange={(e) => set('pricing', e.target.value)}>
                <option value="CPC">CPC (Per Click)</option>
                <option value="CPM">CPM (Per 1000 Views)</option>
              </select>
            </div>
            <div>
              <label className="label text-sm">Bid (₹) *</label>
              <input className="input w-full" type="number" min="0" step="0.01" value={form.bid} onChange={(e) => set('bid', e.target.value)} />
            </div>
            <div>
              <label className="label text-sm">Daily Budget (₹) *</label>
              <input className="input w-full" type="number" min="0" value={form.dailyBudget} onChange={(e) => set('dailyBudget', e.target.value)} />
            </div>
            <div>
              <label className="label text-sm">Total Budget (₹)</label>
              <input className="input w-full" type="number" min="0" value={form.totalBudget} onChange={(e) => set('totalBudget', e.target.value)} />
            </div>
            <div>
              <label className="label text-sm">Status</label>
              <select className="input w-full" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
            <div>
              <label className="label text-sm">Start Date *</label>
              <input className="input w-full" type="date" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
            </div>
            <div>
              <label className="label text-sm">End Date</label>
              <input className="input w-full" type="date" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label text-sm">Placement *</label>
              <select className="input w-full" value={form.placement} onChange={(e) => set('placement', e.target.value)}>
                {ALL_PLACEMENTS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-sm">Position</label>
              <select className="input w-full" value={form.position} onChange={(e) => set('position', e.target.value)}>
                <option value="">None</option>
                {['top','right','bottom','left','center'].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-sm">Banner Size</label>
              <select className="input w-full" value={form.bannerSize} onChange={(e) => set('bannerSize', e.target.value)}>
                <option value="">None</option>
                {BANNER_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {form.bannerSize === 'Custom' && (
              <>
                <div>
                  <label className="label text-sm">Width (px)</label>
                  <input className="input w-full" type="number" value={form.customWidth} onChange={(e) => set('customWidth', e.target.value)} />
                </div>
                <div>
                  <label className="label text-sm">Height (px)</label>
                  <input className="input w-full" type="number" value={form.customHeight} onChange={(e) => set('customHeight', e.target.value)} />
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="label text-sm">Banner Image URL</label>
              <input className="input w-full" placeholder="https://..." value={form.bannerImage} onChange={(e) => set('bannerImage', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label text-sm">Target Keywords (comma-separated)</label>
              <input className="input w-full" placeholder="keyword1, keyword2, keyword3" value={form.keywords} onChange={(e) => set('keywords', e.target.value)} />
            </div>
          </div>
        </form>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-secondary-100">
          <button onClick={onClose} className="btn text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving…' : isEdit ? 'Update Campaign' : 'Create Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────
function CampaignsTab({ rev, setRev }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useFetch(
    ['admin-ads-campaigns', search, statusFilter, page, rev],
    () => api.get('/admin/ads/campaigns', { params: { search: search || undefined, status: statusFilter || undefined, page, limit: 30 } }).then((r) => r.data)
  );

  const { data: vendorsData } = useFetch(['admin-vendors-list'], () =>
    api.get('/admin/users', { params: { role: 'vendor', limit: 100 } }).then((r) => r.data)
  );

  const campaigns = data?.campaigns || [];
  const pagination = data?.pagination || {};
  const vendors = vendorsData?.users || [];

  async function changeStatus(id, status) {
    try {
      await api.put(`/admin/ads/campaigns/${id}/status`, { status });
      toast.success(`Status → ${status}`);
      setRev((r) => r + 1);
    } catch { toast.error('Failed'); }
  }

  async function deleteCampaign(id) {
    if (!confirm('Delete this campaign?')) return;
    try {
      await api.delete(`/admin/ads/campaigns/${id}`);
      toast.success('Deleted');
      setRev((r) => r + 1);
    } catch { toast.error('Failed to delete'); }
  }

  async function bulkAction(action) {
    if (!selected.size) return;
    await Promise.all([...selected].map((id) =>
      api.put(`/admin/ads/campaigns/${id}/status`, { status: action }).catch(() => {})
    ));
    toast.success(`${selected.size} campaign(s) ${action}`);
    setSelected(new Set());
    setRev((r) => r + 1);
  }

  function exportCSV() {
    const header = 'Name,Vendor,Type,Placement,Bid,Daily Budget,Impressions,Clicks,CTR%,Spend,Status';
    const rows = campaigns.map((c) => [
      c.name, c.vendor?.businessName || c.vendor?.name || '',
      c.type, c.placement, c.bid, c.dailyBudget,
      c.stats?.impressions || 0, c.stats?.clicks || 0,
      c.stats?.impressions > 0 ? ((c.stats.clicks / c.stats.impressions) * 100).toFixed(2) : 0,
      c.stats?.spend || 0, c.status,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'ad-campaigns.csv'; a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input className="input pl-8 text-sm w-full" placeholder="Search campaigns…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        {selected.size > 0 && (
          <>
            <button onClick={() => bulkAction('active')} className="btn text-xs text-green-700">Activate ({selected.size})</button>
            <button onClick={() => bulkAction('paused')} className="btn text-xs text-yellow-700">Pause ({selected.size})</button>
          </>
        )}
        <button onClick={exportCSV} className="btn text-sm flex items-center gap-1.5 shrink-0"><Download size={13} /> Export</button>
        <button onClick={() => setCreating(true)} className="btn-primary text-sm flex items-center gap-1.5 shrink-0"><Plus size={13} /> Create Campaign</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : campaigns.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400"><Megaphone size={36} className="mx-auto mb-3 opacity-30" /><p>No campaigns found</p></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase border-b border-secondary-100">
              <tr>
                <th className="px-3 py-3 w-8"><input type="checkbox" className="rounded" onChange={(e) => setSelected(e.target.checked ? new Set(campaigns.map((c) => c._id)) : new Set())} /></th>
                <th className="px-4 py-3 text-left">Campaign</th>
                <th className="px-4 py-3 text-left">Vendor</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Placement</th>
                <th className="px-4 py-3 text-right">Bid</th>
                <th className="px-4 py-3 text-right">Budget/day</th>
                <th className="px-4 py-3 text-right">Impr.</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">Spend</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {campaigns.map((c) => {
                const impr = c.stats?.impressions || 0;
                const clicks = c.stats?.clicks || 0;
                const ctrVal = impr > 0 ? ((clicks / impr) * 100).toFixed(1) : '0';
                return (
                  <tr key={c._id} className="hover:bg-secondary-50">
                    <td className="px-3 py-3"><input type="checkbox" className="rounded" checked={selected.has(c._id)} onChange={(e) => { const s = new Set(selected); e.target.checked ? s.add(c._id) : s.delete(c._id); setSelected(s); }} /></td>
                    <td className="px-4 py-3">
                      <p className="font-medium line-clamp-1">{c.name}</p>
                      <p className="text-xs text-secondary-400">{c.pricing} · {ctrVal}% CTR</p>
                    </td>
                    <td className="px-4 py-3 text-xs">{c.vendor?.businessName || c.vendor?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-secondary-600">{(c.type || '—').replace('Sponsored', 'Sp.')}</td>
                    <td className="px-4 py-3 text-xs capitalize">{(c.placement || '—').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium">{fmtCur(c.bid)}</td>
                    <td className="px-4 py-3 text-right text-xs">{fmtCur(c.dailyBudget)}</td>
                    <td className="px-4 py-3 text-right text-xs">{fmtNum(impr)}</td>
                    <td className="px-4 py-3 text-right text-xs">{fmtNum(clicks)}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium">{fmtCur(c.stats?.spend)}</td>
                    <td className="px-4 py-3">
                      <select
                        className="text-xs border border-secondary-200 rounded px-1.5 py-1 bg-white"
                        value={c.status}
                        onChange={(e) => changeStatus(c._id, e.target.value)}
                      >
                        {Object.entries(STATUS_CONFIG).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditing(c)} className="p-1.5 hover:bg-secondary-100 rounded"><Pencil size={13} className="text-secondary-400" /></button>
                        <button onClick={() => deleteCampaign(c._id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 size={13} className="text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex justify-between text-sm text-secondary-500">
              <span>Page {pagination.page} of {pagination.pages} · {pagination.total} campaigns</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {(creating || editing) && (
        <CampaignModal
          campaign={editing}
          vendors={vendors}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={() => { setCreating(false); setEditing(null); setRev((r) => r + 1); }}
        />
      )}
    </div>
  );
}

// ─── Pricing Tab ──────────────────────────────────────────────────────────────
function PricingTab() {
  const [rev, setRev] = useState(0);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useFetch(['admin-ads-pricing', rev], () =>
    api.get('/admin/ads/pricing-settings').then((r) => r.data)
  );
  const settings = data?.settings || [];

  async function initDefaults() {
    try {
      const r = await api.post('/admin/ads/pricing-settings/initialize');
      toast.success(`Created ${r.data.created} placements`);
      setRev((v) => v + 1);
    } catch { toast.error('Failed to initialize'); }
  }

  async function savePricing(form) {
    setSaving(true);
    try {
      await api.post('/admin/ads/pricing-settings', form);
      toast.success('Pricing saved');
      setEditing(null);
      setRev((v) => v + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary-500">{settings.length} placement(s) configured</p>
        <button onClick={initDefaults} className="btn text-sm">Init Defaults</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : settings.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <Settings size={36} className="mx-auto mb-3 opacity-30" />
          <p>No pricing settings. Click "Init Defaults" to set up standard placements.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase border-b border-secondary-100">
              <tr>
                <th className="px-4 py-3 text-left">Placement</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Min Bid</th>
                <th className="px-4 py-3 text-right">Max Bid</th>
                <th className="px-4 py-3 text-right">Recommended</th>
                <th className="px-4 py-3 text-right">Floor</th>
                <th className="px-4 py-3 text-left">Auction</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {settings.map((s) => (
                <tr key={s._id} className="hover:bg-secondary-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.displayName}</p>
                    <p className="text-xs text-secondary-400 font-mono">{s.placement}</p>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{s.pricingType}</span></td>
                  <td className="px-4 py-3 text-right text-xs">{fmtCur(s.minBid)}</td>
                  <td className="px-4 py-3 text-right text-xs">{fmtCur(s.maxBid)}</td>
                  <td className="px-4 py-3 text-right text-xs font-medium">{fmtCur(s.recommendedBid)}</td>
                  <td className="px-4 py-3 text-right text-xs">{fmtCur(s.floorPrice)}</td>
                  <td className="px-4 py-3 text-xs capitalize">{(s.auctionType || '').replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(s)} className="p-1.5 hover:bg-secondary-100 rounded"><Pencil size={13} className="text-secondary-400" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <PricingModal setting={editing} saving={saving} onClose={() => setEditing(null)} onSave={savePricing} />}
    </div>
  );
}

function PricingModal({ setting, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    placement:       setting?.placement || '',
    displayName:     setting?.displayName || '',
    description:     setting?.description || '',
    pricingType:     setting?.pricingType || 'CPC',
    auctionType:     setting?.auctionType || 'second_price',
    minBid:          setting?.minBid || '',
    maxBid:          setting?.maxBid || '',
    recommendedBid:  setting?.recommendedBid || '',
    floorPrice:      setting?.floorPrice || '',
    dailyBudgetMin:  setting?.dailyBudgetMin || '',
    status:          setting?.status || 'active',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <h2 className="font-bold">Edit Pricing — {setting?.displayName}</h2>
          <button onClick={onClose}><X size={18} className="text-secondary-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label text-sm">Placement ID</label>
              <input className="input w-full bg-secondary-50 text-secondary-500" value={form.placement} readOnly />
            </div>
            <div>
              <label className="label text-sm">Display Name *</label>
              <input className="input w-full" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} />
            </div>
            <div>
              <label className="label text-sm">Pricing Type</label>
              <select className="input w-full" value={form.pricingType} onChange={(e) => set('pricingType', e.target.value)}>
                <option value="CPC">CPC</option><option value="CPM">CPM</option>
              </select>
            </div>
            <div>
              <label className="label text-sm">Auction Type</label>
              <select className="input w-full" value={form.auctionType} onChange={(e) => set('auctionType', e.target.value)}>
                <option value="second_price">2nd Price</option><option value="first_price">1st Price</option>
              </select>
            </div>
            {[['minBid','Min Bid (₹)'],['maxBid','Max Bid (₹)'],['recommendedBid','Recommended (₹)'],['floorPrice','Floor Price (₹)'],['dailyBudgetMin','Min Daily Budget (₹)']].map(([k, label]) => (
              <div key={k}>
                <label className="label text-sm">{label}</label>
                <input className="input w-full" type="number" min="0" step="0.01" value={form[k]} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
            <div>
              <label className="label text-sm">Status</label>
              <select className="input w-full" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-secondary-100">
          <button onClick={onClose} className="btn text-sm">Cancel</button>
          <button onClick={() => onSave({ ...form, minBid: +form.minBid, maxBid: +form.maxBid, recommendedBid: +form.recommendedBid, floorPrice: +form.floorPrice, dailyBudgetMin: +form.dailyBudgetMin })} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Saving…' : 'Save Pricing'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wallets Tab ──────────────────────────────────────────────────────────────
function WalletsTab() {
  const { data, isLoading } = useFetch(['admin-ads-wallets'], () =>
    api.get('/admin/ads/wallets').then((r) => r.data)
  );
  const wallets = data?.wallets || [];

  return isLoading ? (
    <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  ) : wallets.length === 0 ? (
    <div className="card p-14 text-center text-secondary-400"><Wallet size={36} className="mx-auto mb-3 opacity-30" /><p>No ad wallets yet</p></div>
  ) : (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase border-b border-secondary-100">
          <tr>
            <th className="px-4 py-3 text-left">Vendor</th>
            <th className="px-4 py-3 text-right">Balance</th>
            <th className="px-4 py-3 text-right">Total Recharged</th>
            <th className="px-4 py-3 text-right">Total Spent</th>
            <th className="px-4 py-3 text-left">Spend Rate</th>
            <th className="px-4 py-3 text-right">Transactions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-100">
          {wallets.map((w) => {
            const spendRate = w.totalRecharged > 0 ? Math.round((w.totalSpent / w.totalRecharged) * 100) : 0;
            const balColor = w.balance > 500 ? 'text-green-600' : w.balance > 100 ? 'text-yellow-600' : 'text-red-600';
            return (
              <tr key={w._id} className="hover:bg-secondary-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{w.vendorId?.businessName || w.vendorId?.name || '—'}</p>
                  <p className="text-xs text-secondary-400">{w.vendorId?.email}</p>
                </td>
                <td className={`px-4 py-3 text-right font-bold ${balColor}`}>{fmtCur(w.balance)}</td>
                <td className="px-4 py-3 text-right text-xs">{fmtCur(w.totalRecharged)}</td>
                <td className="px-4 py-3 text-right text-xs">{fmtCur(w.totalSpent)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-secondary-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(spendRate, 100)}%` }} />
                    </div>
                    <span className="text-xs text-secondary-500 shrink-0">{spendRate}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-xs text-secondary-500">{w.transactions?.length || 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminAdsManagement() {
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('30days');
  const [analyticsRev, setAnalyticsRev] = useState(0);
  const [campaignsRev, setCampaignsRev] = useState(0);

  const { data: analytics, isLoading: analyticsLoading } = useFetch(
    ['admin-ads-analytics', period, analyticsRev],
    () => api.get('/admin/ads/analytics', { params: { period } }).then((r) => r.data)
  );

  const TABS = [
    { value: 'overview',   label: 'Overview',   icon: BarChart2 },
    { value: 'campaigns',  label: 'Campaigns',  icon: Megaphone },
    { value: 'pricing',    label: 'Pricing',    icon: Settings },
    { value: 'wallets',    label: 'Wallets',    icon: Wallet },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Advertising Console</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Amazon-style campaign management & analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAnalyticsRev((r) => r + 1)} className="btn flex items-center gap-1.5 text-sm"><RefreshCw size={13} /> Refresh</button>
          <button
            onClick={() => { setTab('campaigns'); }}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus size={13} /> Create Campaign
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-secondary-200">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === value ? 'border-blue-600 text-blue-600' : 'border-transparent text-secondary-500 hover:text-secondary-800'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        analyticsLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
          <OverviewTab analytics={analytics} period={period} setPeriod={(p) => { setPeriod(p); setAnalyticsRev((r) => r + 1); }} onRefresh={() => setAnalyticsRev((r) => r + 1)} />
        )
      )}
      {tab === 'campaigns' && <CampaignsTab rev={campaignsRev} setRev={setCampaignsRev} />}
      {tab === 'pricing'   && <PricingTab />}
      {tab === 'wallets'   && <WalletsTab />}
    </div>
  );
}
