import { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck, ShieldX, RefreshCw, Download, AlertTriangle, XCircle,
  Package, TrendingUp, Search, X, CheckCircle2, Plus, Bell, Eye,
  Calendar, User, ClipboardList, ChevronRight,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatDate } from '../../../../utils/format';
import { useFetch, useAction } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:        { label: 'Active',        badge: 'bg-green-100 text-green-700',   icon: CheckCircle2, iconColor: 'text-green-500' },
  expiring_soon: { label: 'Expiring Soon', badge: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle, iconColor: 'text-yellow-500' },
  expired:       { label: 'Expired',       badge: 'bg-red-100 text-red-700',       icon: XCircle, iconColor: 'text-red-500' },
  no_warranty:   { label: 'No Warranty',   badge: 'bg-secondary-100 text-secondary-500', icon: XCircle, iconColor: 'text-secondary-400' },
  claimed:       { label: 'Claimed',       badge: 'bg-blue-100 text-blue-700',     icon: Package, iconColor: 'text-blue-500' },
  void:          { label: 'Void',          badge: 'bg-secondary-100 text-secondary-400', icon: ShieldX, iconColor: 'text-secondary-400' },
};

const TYPE_CONFIG = {
  manufacturer: { label: 'Manufacturer', badge: 'bg-blue-100 text-blue-700' },
  extended:     { label: 'Extended',     badge: 'bg-purple-100 text-purple-700' },
  seller:       { label: 'Seller',       badge: 'bg-amber-100 text-amber-700' },
};

const CLAIM_STATUS_STYLES = {
  pending:   'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
};

// ─── Days Remaining display ────────────────────────────────────────────────────

function DaysRemaining({ days }) {
  if (days < 0)  return <span className="text-xs font-bold text-red-500">Expired {Math.abs(days)}d ago</span>;
  if (days === 0) return <span className="text-xs font-bold text-red-500">Expires today</span>;
  if (days <= 30) return <span className="text-xs font-bold text-yellow-600">{days} days remaining</span>;
  return <span className="text-xs font-bold text-green-600">{days} days remaining</span>;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-300 w-44 shrink-0">{label} ({count})</span>
      <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-gray-400 w-10 text-right shrink-0">{pct}%</span>
    </div>
  );
}

// ─── View Warranty Modal ──────────────────────────────────────────────────────

function ViewWarrantyModal({ warranty: init, onClose, onExtend, onReminder, onVoid, onClaimProcess, onRefresh }) {
  const [warranty, setWarranty] = useState(init);
  const [processingClaim, setProcessingClaim] = useState(null);
  const [claimAction, setClaimAction] = useState({ status: '', resolution: '' });
  const [saving, setSaving] = useState(false);

  async function handleVoid() {
    if (!window.confirm('Void this warranty? This cannot be undone.')) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/warranty/${warranty._id}/void`);
      setWarranty(data.warranty);
      toast.success('Warranty voided');
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Failed to void warranty');
    } finally { setSaving(false); }
  }

  async function handleReminder() {
    setSaving(true);
    try {
      const { data } = await api.post(`/admin/warranty/${warranty._id}/send-reminder`);
      setWarranty(data.warranty);
      toast.success('Reminder logged');
    } catch {
      toast.error('Failed');
    } finally { setSaving(false); }
  }

  async function submitClaimAction() {
    if (!claimAction.status) { toast.error('Select a decision'); return; }
    setSaving(true);
    try {
      const { data } = await api.put(
        `/admin/warranty/${warranty._id}/claims/${processingClaim._id}`,
        claimAction,
      );
      setWarranty(data.warranty);
      setProcessingClaim(null);
      toast.success('Claim updated');
      onRefresh();
    } catch {
      toast.error('Failed to update claim');
    } finally { setSaving(false); }
  }

  const statusCfg = STATUS_CONFIG[warranty.status] || STATUS_CONFIG.active;
  const typeCfg = TYPE_CONFIG[warranty.warrantyType] || {};

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100 shrink-0">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-blue-500" />
            <div>
              <h3 className="font-bold text-secondary-900">{warranty.warrantyId}</h3>
              <p className="text-xs text-secondary-400">{warranty.purchaseId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg"><X size={16} /></button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Status + quick actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.badge}`}>{statusCfg.label}</span>
            <DaysRemaining days={warranty.daysRemaining} />
            <div className="flex gap-2 ml-auto">
              {warranty.status !== 'void' && warranty.status !== 'expired' && (
                <>
                  <button
                    onClick={() => { onClose(); onExtend(warranty); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-secondary-200 rounded-lg hover:bg-secondary-50"
                  >
                    <Plus size={12} /> Extend
                  </button>
                  <button
                    onClick={handleReminder}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-secondary-200 rounded-lg hover:bg-secondary-50"
                  >
                    <Bell size={12} /> Reminder
                  </button>
                </>
              )}
              {warranty.status !== 'void' && (
                <button
                  onClick={handleVoid}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100"
                >
                  <ShieldX size={12} /> Void
                </button>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="p-4 bg-secondary-50 rounded-xl border border-secondary-100">
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Product Information</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div><span className="text-secondary-400">Name: </span><span className="font-medium">{warranty.product?.name || '—'}</span></div>
              <div><span className="text-secondary-400">Model/SKU: </span><span className="font-medium">{warranty.product?.model || '—'}</span></div>
              <div><span className="text-secondary-400">Serial: </span><span className="font-medium">{warranty.product?.serial || '—'}</span></div>
              <div><span className="text-secondary-400">Category: </span><span className="font-medium">{warranty.product?.category || '—'}</span></div>
            </div>
          </div>

          {/* Warranty Info */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Warranty Information</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div>
                <span className="text-secondary-400">Type: </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeCfg.badge || 'bg-secondary-100 text-secondary-600'}`}>
                  {typeCfg.label || warranty.warrantyType || '—'}
                </span>
              </div>
              <div><span className="text-secondary-400">Period: </span><span className="font-medium">{warranty.warrantyPeriodDays || '—'} days</span></div>
              <div><span className="text-secondary-400">Start: </span><span className="font-medium">{warranty.warrantyStartDate ? formatDate(warranty.warrantyStartDate) : '—'}</span></div>
              <div><span className="text-secondary-400">End: </span><span className="font-medium">{warranty.warrantyEndDate ? formatDate(warranty.warrantyEndDate) : '—'}</span></div>
              <div><span className="text-secondary-400">Purchase: </span><span className="font-medium">{warranty.purchaseDate ? formatDate(warranty.purchaseDate) : '—'}</span></div>
              <div><span className="text-secondary-400">Days since purchase: </span><span className="font-medium">{warranty.daysSincePurchase ?? '—'}</span></div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="p-4 bg-secondary-50 rounded-xl border border-secondary-100">
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Customer Information</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <div><span className="text-secondary-400">Name: </span><span className="font-medium">{warranty.customerName || '—'}</span></div>
              <div><span className="text-secondary-400">Email: </span><span className="font-medium">{warranty.customerEmail || '—'}</span></div>
              <div><span className="text-secondary-400">Order ID: </span><span className="font-mono text-blue-600 font-medium">{warranty.purchaseId || '—'}</span></div>
              <div><span className="text-secondary-400">Invoice: </span><span className="font-medium">{warranty.extraInfo?.invoiceNo || '—'}</span></div>
            </div>
          </div>

          {/* Claims */}
          {warranty.claims?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Claims ({warranty.claims.length})</p>
              <div className="space-y-2">
                {warranty.claims.map((claim) => (
                  <div key={claim._id} className="p-3 border border-secondary-100 rounded-xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-secondary-400">{formatDate(claim.claimDate)}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${CLAIM_STATUS_STYLES[claim.status] || 'bg-secondary-100 text-secondary-600'}`}>
                        {claim.status}
                      </span>
                    </div>
                    <p className="text-sm text-secondary-700">{claim.description}</p>
                    {claim.resolution && (
                      <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 mt-1.5">{claim.resolution}</p>
                    )}
                    {claim.status === 'pending' && (
                      processingClaim?._id === claim._id ? (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <button onClick={() => setClaimAction((a) => ({ ...a, status: 'approved' }))}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${claimAction.status === 'approved' ? 'bg-green-500 text-white border-green-500' : 'border-secondary-200 hover:bg-green-50'}`}>
                              Approve
                            </button>
                            <button onClick={() => setClaimAction((a) => ({ ...a, status: 'rejected' }))}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${claimAction.status === 'rejected' ? 'bg-red-500 text-white border-red-500' : 'border-secondary-200 hover:bg-red-50'}`}>
                              Reject
                            </button>
                          </div>
                          <textarea
                            className="input w-full h-16 resize-none text-sm"
                            placeholder="Resolution notes (optional)"
                            value={claimAction.resolution}
                            onChange={(e) => setClaimAction((a) => ({ ...a, resolution: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <button onClick={submitClaimAction} disabled={saving}
                              className="px-4 py-1.5 bg-primary-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                              Submit
                            </button>
                            <button onClick={() => { setProcessingClaim(null); setClaimAction({ status: '', resolution: '' }); }}
                              className="px-4 py-1.5 border border-secondary-200 rounded-lg text-xs hover:bg-secondary-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setProcessingClaim(claim)}
                          className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">
                          <ChevronRight size={12} /> Process Claim
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notification History */}
          {warranty.notifications?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">
                Notification History ({warranty.notifications.length})
              </p>
              <div className="space-y-1.5">
                {[...warranty.notifications].reverse().slice(0, 5).map((n, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-secondary-500">
                    <Bell size={11} className="text-secondary-300 shrink-0" />
                    <span className="font-medium">{n.type?.replace(/_/g, ' ')}</span>
                    <span>{n.sentTo}</span>
                    <span className="ml-auto">{formatDate(n.sentAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Extend Modal ─────────────────────────────────────────────────────────────

function ExtendModal({ warranty, onClose, onSuccess }) {
  const [days, setDays] = useState(90);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const effectiveDays = custom ? parseInt(custom) || 0 : days;

  const newExpiry = warranty?.warrantyEndDate
    ? new Date(new Date(warranty.warrantyEndDate).getTime() + effectiveDays * 24 * 60 * 60 * 1000)
    : null;

  async function submit() {
    if (!effectiveDays || effectiveDays < 1) { toast.error('Enter valid number of days'); return; }
    setSaving(true);
    try {
      await api.put(`/admin/warranty/${warranty._id}/extend`, { days: effectiveDays });
      toast.success(`Warranty extended by ${effectiveDays} days`);
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Failed to extend');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <h3 className="font-bold text-secondary-900">Extend Warranty</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-secondary-50 rounded-xl text-sm">
            <p className="font-medium text-secondary-800">{warranty?.product?.name || warranty?.warrantyId}</p>
            <p className="text-secondary-400 text-xs mt-0.5">
              Current expiry: {warranty?.warrantyEndDate ? formatDate(warranty.warrantyEndDate) : '—'}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-secondary-700 mb-2">Quick select</p>
            <div className="flex gap-2 flex-wrap">
              {[30, 90, 180, 365].map((d) => (
                <button key={d}
                  onClick={() => { setDays(d); setCustom(''); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${!custom && days === d ? 'bg-primary-600 text-white border-primary-600' : 'border-secondary-200 hover:bg-secondary-50'}`}
                >
                  {d === 365 ? '1 Year' : `${d} Days`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">Custom days</label>
            <input
              type="number"
              min="1"
              className="input w-full"
              placeholder="Enter number of days"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </div>

          {newExpiry && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-sm">
              <span className="text-green-700 font-medium">New Expiry Date: </span>
              <span className="text-green-800 font-bold">
                {newExpiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-secondary-200 rounded-xl text-sm font-semibold hover:bg-secondary-50">
              Cancel
            </button>
            <button onClick={submit} disabled={saving || effectiveDays < 1}
              className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              {saving ? 'Extending…' : `Extend ${effectiveDays}d`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminWarranty() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarranties, setSelectedWarranties] = useState([]);
  const [viewingWarranty, setViewingWarranty] = useState(null);
  const [showExtendModal, setShowExtendModal] = useState(null);
  const [rev, setRev] = useState(0);
  const hasSynced = useRef(false);

  const { data: stats, isLoading: statsLoading } = useFetch(
    ['warranty-stats', rev],
    () => api.get('/admin/warranty/stats/enhanced').then((r) => r.data),
  );

  const { data, isLoading } = useFetch(
    ['admin-warranties', page, statusFilter, typeFilter, searchTerm, rev],
    () => api.get('/admin/warranty/all', {
      params: {
        page,
        limit: 20,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        search: searchTerm || undefined,
      },
    }).then((r) => r.data),
  );

  const { mutate: syncWarranties, isLoading: syncing } = useAction(
    () => api.post('/admin/warranty/sync'),
    {
      onSuccess: (res) => {
        const { created, skipped, failed } = res.data || {};
        toast.success(`Sync done — ${created} created, ${skipped} skipped${failed ? `, ${failed} failed` : ''}`);
        setRev((r) => r + 1);
      },
      onError: () => toast.error('Sync failed'),
    },
  );

  const { mutate: bulkAction, isLoading: bulkLoading } = useAction(
    ({ action, warrantyIds, data: d }) => api.post('/admin/warranty/bulk-action', { action, warrantyIds, data: d }),
    {
      onSuccess: (_, { action }) => {
        setSelectedWarranties([]);
        toast.success(action === 'void' ? 'Warranties voided' : action === 'send_reminder' ? 'Reminders logged' : 'Done');
        setRev((r) => r + 1);
      },
      onError: () => toast.error('Bulk action failed'),
    },
  );

  // Auto-sync once if no warranties exist
  useEffect(() => {
    if (stats?.total === 0 && !hasSynced.current && !statsLoading) {
      hasSynced.current = true;
      syncWarranties();
    }
  }, [stats, statsLoading]);

  function refresh() { setRev((r) => r + 1); }

  const warranties = data?.data || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const total = stats?.total || 0;
  const typeDist = stats?.typeDistribution || {};
  const hasFilters = statusFilter || typeFilter || searchTerm;

  function toggleSelect(id) {
    setSelectedWarranties((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }
  function toggleAll() {
    setSelectedWarranties((s) => s.length === warranties.length ? [] : warranties.map((w) => w._id));
  }

  function handleExport() {
    window.open('/api/admin/warranty/export', '_blank');
  }

  const typeKeys = ['manufacturer', 'extended', 'seller'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Warranty Management</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Track and manage product warranties, claims, and extensions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => syncWarranties()}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Warranty Overview dark card */}
      <div className="rounded-2xl bg-[#1a1f2e] text-white p-6">
        <div className="flex items-center gap-3 mb-5">
          <ShieldCheck size={22} className="text-blue-400" />
          <div>
            <h2 className="font-bold text-lg">Warranty Overview</h2>
            <p className="text-xs text-gray-400">Summary of all product warranties</p>
          </div>
        </div>

        {/* Type distribution tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {typeKeys.map((type) => (
            <div key={type} className="bg-white/10 rounded-xl px-4 py-3">
              <p className="text-2xl font-black">{typeDist[type] || 0}</p>
              <p className="text-xs text-gray-300 mt-0.5 capitalize">{type} Warranty</p>
            </div>
          ))}
          {(() => {
            const known = typeKeys.reduce((s, k) => s + (typeDist[k] || 0), 0);
            const other = total - known;
            return other > 0 ? (
              <div className="bg-white/10 rounded-xl px-4 py-3">
                <p className="text-2xl font-black">{other}</p>
                <p className="text-xs text-gray-300 mt-0.5">Other</p>
              </div>
            ) : null;
          })()}
        </div>

        {/* Progress bars */}
        <div className="space-y-3">
          <ProgressBar label="Active" count={stats?.active || 0} total={total} color="bg-green-400" />
          <ProgressBar label="Expiring Soon" count={stats?.expiringSoon || 0} total={total} color="bg-yellow-400" />
          <ProgressBar label="Expired" count={stats?.expired || 0} total={total} color="bg-red-400" />
        </div>
      </div>

      {/* 6 Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats?.total ?? 0, icon: Package, color: 'text-blue-600 bg-blue-50' },
          { label: 'Active', value: stats?.active ?? 0, icon: ShieldCheck, color: 'text-green-600 bg-green-50', valueColor: 'text-green-600' },
          { label: 'Expiring Soon', value: stats?.expiringSoon ?? 0, icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50', valueColor: 'text-yellow-600' },
          { label: 'Expired', value: stats?.expired ?? 0, icon: XCircle, color: 'text-red-500 bg-red-50', valueColor: 'text-red-500' },
          { label: 'Pending Claims', value: stats?.pendingClaims ?? 0, icon: ClipboardList, color: 'text-purple-600 bg-purple-50', valueColor: 'text-purple-600' },
          { label: 'Avg Period', value: stats?.avgWarrantyDays ? `${stats.avgWarrantyDays}d` : '—', icon: TrendingUp, color: 'text-indigo-600 bg-indigo-50', valueColor: 'text-indigo-600' },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color} mb-3`}>
              <s.icon size={17} />
            </div>
            <p className={`text-2xl font-black ${s.valueColor || 'text-secondary-900'}`}>{s.value}</p>
            <p className="text-xs text-secondary-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-8 text-sm w-full"
            placeholder="Search by warranty ID, product, customer..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-40 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="expiring_soon">Expiring Soon</option>
          <option value="expired">Expired</option>
          <option value="claimed">Claimed</option>
          <option value="void">Void</option>
          <option value="no_warranty">No Warranty</option>
        </select>
        <select className="input w-40 text-sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="manufacturer">Manufacturer</option>
          <option value="extended">Extended</option>
          <option value="seller">Seller</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setStatusFilter(''); setTypeFilter(''); setSearchTerm(''); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-secondary-200 rounded-lg hover:bg-secondary-50 text-secondary-600"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedWarranties.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-semibold text-blue-700">{selectedWarranties.length} selected</span>
          <div className="h-4 w-px bg-blue-200" />
          <button
            onClick={() => bulkAction({ action: 'send_reminder', warrantyIds: selectedWarranties })}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            <Bell size={12} /> Send Reminders
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Void ${selectedWarranties.length} warranties?`)) {
                bulkAction({ action: 'void', warrantyIds: selectedWarranties });
              }
            }}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-secondary-500 hover:bg-secondary-600 text-white rounded-lg disabled:opacity-50"
          >
            <ShieldX size={12} /> Void Selected
          </button>
          <button onClick={() => setSelectedWarranties([])} className="ml-auto text-xs text-secondary-500 hover:text-secondary-700">
            Clear Selection
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary-900 text-white">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="rounded border-secondary-600 bg-transparent"
                      checked={warranties.length > 0 && selectedWarranties.length === warranties.length}
                      onChange={toggleAll} />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Warranty ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Purchase Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Expiry Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Remaining</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {!warranties.length ? (
                  <tr>
                    <td colSpan={10} className="text-center py-16">
                      <ShieldCheck size={40} className="mx-auto text-secondary-200 mb-3" />
                      <p className="text-secondary-400 font-medium">No warranty records found</p>
                      <p className="text-xs text-secondary-300 mt-1">Click Sync to generate from delivered orders</p>
                    </td>
                  </tr>
                ) : warranties.map((w) => {
                  const statusCfg = STATUS_CONFIG[w.status] || STATUS_CONFIG.active;
                  const typeCfg = TYPE_CONFIG[w.warrantyType];
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={w._id} className={`hover:bg-secondary-50 transition-colors ${selectedWarranties.includes(w._id) ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" className="rounded border-secondary-300"
                          checked={selectedWarranties.includes(w._id)}
                          onChange={() => toggleSelect(w._id)} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-blue-600">{w.warrantyId}</p>
                        <p className="text-[11px] text-secondary-400">{w.purchaseId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-secondary-900 max-w-[140px] line-clamp-1">{w.product?.name || '—'}</p>
                        <p className="text-[11px] text-secondary-400">{w.product?.model || ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-secondary-900">{w.customerName || '—'}</p>
                        <p className="text-[11px] text-secondary-400">{w.customerEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        {typeCfg ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeCfg.badge}`}>{typeCfg.label}</span>
                        ) : (
                          <span className="text-xs text-secondary-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-secondary-500">{w.purchaseDate ? formatDate(w.purchaseDate) : '—'}</td>
                      <td className="px-4 py-3 text-xs text-secondary-500">{w.warrantyEndDate ? formatDate(w.warrantyEndDate) : '—'}</td>
                      <td className="px-4 py-3"><DaysRemaining days={w.daysRemaining} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon size={13} className={statusCfg.iconColor} />
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.badge}`}>{statusCfg.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setViewingWarranty(w)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-500 hover:bg-blue-50" title="View">
                            <Eye size={14} />
                          </button>
                          {w.status !== 'void' && w.status !== 'expired' && (
                            <button onClick={() => setShowExtendModal(w)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-green-500 hover:bg-green-50" title="Extend">
                              <Plus size={14} />
                            </button>
                          )}
                          {w.status !== 'void' && w.status !== 'expired' && (
                            <button
                              onClick={async () => {
                                try {
                                  await api.post(`/admin/warranty/${w._id}/send-reminder`);
                                  toast.success('Reminder logged');
                                } catch { toast.error('Failed'); }
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50" title="Send Reminder">
                              <Bell size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
              <span className="text-xs text-secondary-500">
                Page {page} of {totalPages} · {pagination?.total} records
              </span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40">
                  ← Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i + 1
                    : page <= 4 ? i + 1
                    : page >= totalPages - 3 ? totalPages - 6 + i
                    : page - 3 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100'}`}>
                      {p}
                    </button>
                  );
                })}
                <button disabled={page === totalPages} onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40">
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {viewingWarranty && (
        <ViewWarrantyModal
          warranty={viewingWarranty}
          onClose={() => setViewingWarranty(null)}
          onExtend={(w) => setShowExtendModal(w)}
          onRefresh={refresh}
        />
      )}
      {showExtendModal && (
        <ExtendModal
          warranty={showExtendModal}
          onClose={() => setShowExtendModal(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
