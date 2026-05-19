import { useState } from 'react';
import { Plus, Megaphone, TrendingUp } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  pending:   { label: 'Pending Review', class: 'bg-yellow-100 text-yellow-700' },
  active:    { label: 'Active',         class: 'bg-green-100 text-green-700' },
  paused:    { label: 'Paused',         class: 'bg-secondary-100 text-secondary-600' },
  rejected:  { label: 'Rejected',       class: 'bg-red-100 text-red-700' },
  completed: { label: 'Completed',      class: 'bg-blue-100 text-blue-700' },
};

const EMPTY = { productId: '', title: '', budget: '', bidPerClick: '', placement: 'homepage' };

export default function VendorAds() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['vendor-ads', rev],
    () => api.get('/vendors/ads').then((r) => r.data)
  );
  const { data: products } = useFetch(
    ['vendor-products-for-ads'],
    () => api.get('/vendors/products', { params: { limit: 100 } }).then((r) => r.data)
  );

  const campaigns = data?.campaigns || [];
  const productList = products?.products || [];

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/vendors/ads', { ...form, budget: parseFloat(form.budget), bidPerClick: parseFloat(form.bidPerClick) });
      toast.success('Campaign submitted for review');
      setForm({ ...EMPTY });
      setShowForm(false);
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    if (!confirm('Delete this campaign?')) return;
    try {
      await api.delete(`/vendors/ads/${id}`);
      toast.success('Campaign deleted');
      setRev((r) => r + 1);
    } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sponsored Ads</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Promote your products to more buyers</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> {showForm ? 'Cancel' : 'Create Campaign'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <h2 className="font-semibold">New Ad Campaign</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Product *</label>
              <select className="input w-full" value={form.productId} onChange={set('productId')} required>
                <option value="">Select a product…</option>
                {productList.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Campaign Title *</label>
              <input className="input w-full" value={form.title} onChange={set('title')} required placeholder="e.g. Summer Drill Promo" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Total Budget (₹) *</label>
              <input className="input w-full" type="number" min="100" value={form.budget} onChange={set('budget')} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bid per Click (₹) *</label>
              <input className="input w-full" type="number" min="1" step="0.5" value={form.bidPerClick} onChange={set('bidPerClick')} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Placement</label>
              <select className="input w-full" value={form.placement} onChange={set('placement')}>
                <option value="homepage">Homepage</option>
                <option value="search">Search Results</option>
                <option value="category">Category Page</option>
                <option value="product">Product Page</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-secondary-400">Campaigns go to admin review before going live. Estimated reach based on your bid vs. competition.</p>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Spinner size="sm" /> : null} {saving ? 'Submitting…' : 'Submit for Approval'}
          </button>
        </form>
      )}

      {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : campaigns.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No campaigns yet</p>
          <p className="text-sm mt-1">Create your first sponsored ad to reach more buyers</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((c) => {
            const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
            const progress = c.budget > 0 ? Math.min(100, (c.spent / c.budget) * 100) : 0;
            return (
              <div key={c._id} className="card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    {c.product?.images?.[0] && <img src={c.product.images[0]} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                    <div>
                      <p className="font-semibold">{c.title}</p>
                      <p className="text-xs text-secondary-400">{c.product?.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.class}`}>{cfg.label}</span>
                    {['pending', 'paused'].includes(c.status) && (
                      <button onClick={() => del(c._id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-sm mb-3">
                  {[
                    { label: 'Budget', value: `₹${c.budget.toLocaleString()}` },
                    { label: 'Spent', value: `₹${(c.spent || 0).toLocaleString()}` },
                    { label: 'Clicks', value: c.clicks || 0 },
                    { label: 'Placement', value: c.placement },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-secondary-400">{label}</p>
                      <p className="font-semibold capitalize">{value}</p>
                    </div>
                  ))}
                </div>
                {c.status === 'active' && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-secondary-400 mb-1">
                      <span>Budget used</span><span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
