import { useState } from 'react';
import { Plus, Trash2, Copy, Link, Share2 } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isExpired(expiresAt) {
  return new Date(expiresAt) < new Date();
}

export default function AdminShareCatalog() {
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-share-catalog', rev],
    () => api.get('/admin/share-catalog').then((r) => r.data)
  );

  const shares = data?.shares || [];

  function getPublicUrl(token) {
    return `${window.location.origin}/catalog/${token}`;
  }

  async function create(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/share-catalog', { label: label || 'Product Catalog', expiresInDays: parseInt(expiresInDays) || 30 });
      toast.success('Share link created');
      setLabel('');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally {
      setCreating(false);
    }
  }

  async function revoke(token) {
    if (!confirm('Revoke this share link?')) return;
    try {
      await api.delete(`/admin/share-catalog/${token}`);
      toast.success('Link revoked');
      setRev((r) => r + 1);
    } catch { toast.error('Failed to revoke'); }
  }

  function copy(token) {
    navigator.clipboard.writeText(getPublicUrl(token));
    toast.success('Link copied!');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Share Catalog</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Generate shareable links for your product catalog</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create form */}
        <form onSubmit={create} className="card p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Share2 size={16} /> Create Share Link</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Label</label>
            <input
              className="input w-full"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. For Dealer ABC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expires in (days)</label>
            <input
              className="input w-full"
              type="number"
              min="1"
              max="365"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            />
          </div>
          <button type="submit" disabled={creating} className="btn-primary flex items-center gap-2 w-full justify-center">
            {creating ? <Spinner size="sm" /> : <Plus size={14} />}
            {creating ? 'Creating…' : 'Generate Link'}
          </button>
        </form>

        {/* Active links */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-secondary-100 font-semibold text-sm flex items-center gap-2">
            <Link size={14} className="text-secondary-400" /> Active Links
          </div>
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : shares.length === 0 ? (
            <p className="text-center py-10 text-secondary-400 text-sm">No share links created yet</p>
          ) : (
            <div className="divide-y divide-secondary-100">
              {shares.map((s) => {
                const expired = isExpired(s.expiresAt);
                return (
                  <div key={s.token} className={`px-4 py-3 ${expired ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{s.label}</p>
                        <p className="text-xs text-secondary-400 mt-0.5 font-mono truncate">{getPublicUrl(s.token)}</p>
                        <p className={`text-xs mt-1 ${expired ? 'text-red-500' : 'text-secondary-400'}`}>
                          {expired ? 'Expired' : 'Expires'} {fmtDate(s.expiresAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!expired && (
                          <button onClick={() => copy(s.token)} className="p-1.5 hover:bg-secondary-100 rounded-lg" title="Copy link">
                            <Copy size={13} className="text-blue-600" />
                          </button>
                        )}
                        <button onClick={() => revoke(s.token)} className="p-1.5 hover:bg-secondary-100 rounded-lg" title="Revoke">
                          <Trash2 size={13} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
