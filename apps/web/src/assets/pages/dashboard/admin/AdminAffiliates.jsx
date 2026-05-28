import { useState, useEffect, useCallback } from 'react';
import {
  UserCheck, Users, Clock, CheckCircle, XCircle, AlertCircle,
  Trash2, Search, ChevronDown, X, Download, RefreshCw,
  Mail, Send, ShieldCheck, TrendingUp, Star, IndianRupee,
  Percent, Plus, Check, MousePointerClick, RotateCcw,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate } from '../../../../utils/format';
import toast from 'react-hot-toast';

// ── helpers ───────────────────────────────────────────────────────────────────

function performanceTier(conversions = 0) {
  if (conversions >= 100) return { label: '💎 Platinum', cls: 'bg-purple-100 text-purple-700' };
  if (conversions >= 50)  return { label: '🥇 Gold',     cls: 'bg-yellow-100 text-yellow-700' };
  if (conversions >= 20)  return { label: '🥈 Silver',   cls: 'bg-gray-100 text-gray-600' };
  return                         { label: '🥉 Bronze',   cls: 'bg-amber-100 text-amber-700' };
}

function convRateColor(rate) {
  if (rate >= 5)  return 'text-green-600';
  if (rate >= 2)  return 'text-yellow-600';
  return 'text-secondary-400';
}

function StatusBadge({ status }) {
  const map = {
    active:     'bg-green-100 text-green-700',
    pending:    'bg-yellow-100 text-yellow-700',
    suspended:  'bg-red-100 text-red-700',
    rejected:   'bg-secondary-100 text-secondary-500',
    incomplete: 'bg-secondary-100 text-secondary-400',
  };
  const labels = { active: 'Active', pending: 'Pending', suspended: 'Suspended', rejected: 'Rejected', incomplete: 'Incomplete' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || map.incomplete}`}>
      {status === 'active'  && <CheckCircle size={10} />}
      {status === 'pending' && <Clock size={10} />}
      {labels[status] || status}
    </span>
  );
}

function KYCBadge({ status }) {
  if (status === 'verified')  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700"><ShieldCheck size={10} /> Approved</span>;
  if (status === 'pending')   return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"><Clock size={10} /> Pending</span>;
  if (status === 'rejected')  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><XCircle size={10} /> Rejected</span>;
  return <span className="text-xs text-secondary-300">Not submitted</span>;
}

function AvatarCircle({ name }) {
  const colors = ['bg-blue-500','bg-purple-500','bg-pink-500','bg-orange-500','bg-teal-500','bg-indigo-500'];
  const color  = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`w-8 h-8 ${color} rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0 select-none`}>
      {(name?.[0] || '?').toUpperCase()}
    </div>
  );
}

// ── Category commission rules (reused pattern) ────────────────────────────────

function CategoryCommissionRules({ affiliateId, initialRules, onSaved }) {
  const [rules,  setRules]  = useState(initialRules || []);
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newPct, setNewPct] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty,  setDirty]  = useState(false);

  function addRule() {
    if (!newCat.trim()) return toast.error('Category required');
    const pct = parseFloat(newPct);
    if (isNaN(pct) || pct < 0 || pct > 100) return toast.error('Percentage must be 0–100');
    setRules((r) => [...r, { category: newCat.trim(), percentage: pct }]);
    setNewCat(''); setNewPct(''); setAdding(false); setDirty(true);
  }

  async function saveRules() {
    setSaving(true);
    try {
      await api.put(`/admin/affiliates/${affiliateId}/commission-rules`, { commissionRules: rules });
      toast.success('Commission rules saved');
      setDirty(false);
      if (onSaved) onSaved(rules);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-secondary-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-secondary-800 flex items-center gap-2">
          <Percent size={14} /> Category Commission Rules
        </h4>
        <button onClick={() => setAdding(true)}
          className="text-xs px-2.5 py-1 bg-white border border-secondary-200 rounded-lg hover:bg-secondary-50 flex items-center gap-1 font-medium transition-colors">
          <Plus size={11} /> Add Rule
        </button>
      </div>
      {rules.length === 0 && !adding ? (
        <p className="text-xs text-secondary-400 text-center py-4">No category rules set</p>
      ) : (
        <div className="space-y-1.5 mb-2">
          {rules.map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-secondary-100">
              <span className="text-sm text-secondary-700">{r.category}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary-700">{r.percentage}%</span>
                <button onClick={() => { setRules(rules.filter((_, j) => j !== i)); setDirty(true); }}
                  className="p-1 text-secondary-300 hover:text-red-500 transition-colors"><X size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <div className="flex items-center gap-2 mt-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category…" autoFocus
            className="flex-1 border border-secondary-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            onKeyDown={(e) => e.key === 'Enter' && addRule()} />
          <div className="flex items-center gap-1 w-20 border border-secondary-200 rounded-lg px-2 py-1.5 bg-white">
            <Percent size={11} className="text-secondary-400" />
            <input type="number" min="0" max="100" value={newPct} onChange={(e) => setNewPct(e.target.value)}
              placeholder="5" className="w-full text-sm focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && addRule()} />
          </div>
          <button onClick={addRule} className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Check size={13} /></button>
          <button onClick={() => { setAdding(false); setNewCat(''); setNewPct(''); }}
            className="p-1.5 border border-secondary-200 rounded-lg hover:bg-secondary-50"><X size={13} /></button>
        </div>
      )}
      {dirty && (
        <button onClick={saveRules} disabled={saving}
          className="mt-3 w-full py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Rules'}
        </button>
      )}
    </div>
  );
}

// ── Affiliate details modal ───────────────────────────────────────────────────

function AffiliateDetailsModal({ affiliate: initAffiliate, onClose, onAction }) {
  const [affiliate, setAffiliate] = useState(initAffiliate);
  const [detailLoading, setDL]   = useState(false);

  const ap     = affiliate.affiliateProfile || {};
  const status = affiliate.affiliateStatus  || 'incomplete';
  const tier   = performanceTier(affiliate.conversionCount || ap.totalConversions || 0);
  const clicks = ap.totalClicks || 0;
  const convs  = affiliate.conversionCount || ap.totalConversions || 0;
  const rate   = clicks ? ((convs / clicks) * 100).toFixed(1) : '0.0';

  useEffect(() => {
    setDL(true);
    api.get(`/admin/affiliates/${affiliate._id}`)
      .then(({ data }) => setAffiliate(data.affiliate))
      .catch(() => {})
      .finally(() => setDL(false));
  }, [affiliate._id]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <div className="flex items-center gap-3">
            <AvatarCircle name={affiliate.name} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-secondary-900">{affiliate.name}</h2>
                <StatusBadge status={status} />
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.cls}`}>{tier.label}</span>
              </div>
              <p className="text-xs text-secondary-400">{affiliate.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400"><X size={18} /></button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 divide-x divide-secondary-100 border-b border-secondary-100">
          {[
            { label: 'Clicks',      value: detailLoading ? '…' : clicks },
            { label: 'Conversions', value: detailLoading ? '…' : convs  },
            { label: 'Conv. Rate',  value: `${rate}%`                    },
            { label: 'Total Earned',value: formatCurrency(ap.totalEarnings ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} className="py-3 px-4 text-center">
              <p className="text-sm font-bold text-secondary-900">{value}</p>
              <p className="text-xs text-secondary-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[55vh]">

          {/* Affiliate Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">Affiliate Information</p>
              <div className="space-y-0">
                {[
                  { label: 'Name',            value: affiliate.name },
                  { label: 'Email',           value: affiliate.email },
                  { label: 'Affiliate Code',  value: ap.referralCode || '—', mono: true },
                  { label: 'Commission Rate', value: `${ap.commissionRate ?? 5}%` },
                  { label: 'Applied Date',    value: formatDate(affiliate.createdAt) },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between text-sm py-1.5 border-b border-secondary-50 last:border-0">
                    <span className="text-secondary-400 shrink-0">{label}</span>
                    <span className={`text-right ml-3 truncate max-w-[55%] font-medium ${mono ? 'font-mono bg-secondary-100 px-1.5 py-0.5 rounded text-xs' : 'text-secondary-800'}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">Earnings Breakdown</p>
              <div className="space-y-0">
                {[
                  { label: 'Total Earned', value: formatCurrency(ap.totalEarnings ?? 0),   cls: 'text-secondary-900 font-bold' },
                  { label: 'Pending',      value: formatCurrency(ap.pendingEarnings ?? 0), cls: 'text-yellow-600 font-semibold' },
                  { label: 'Paid Out',     value: formatCurrency(ap.paidEarnings ?? 0),    cls: 'text-green-600 font-semibold' },
                  { label: 'Avg / Click',  value: clicks ? formatCurrency((ap.totalEarnings || 0) / clicks) : '—' },
                  { label: 'Avg / Conv.',  value: convs  ? formatCurrency((ap.totalEarnings || 0) / convs)  : '—' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex justify-between text-sm py-1.5 border-b border-secondary-50 last:border-0">
                    <span className="text-secondary-400 shrink-0">{label}</span>
                    <span className={`text-right ml-3 ${cls || 'font-medium text-secondary-800'}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bank Details */}
          {ap.kycData?.bankAccount && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">Bank / Payment Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Account Holder', value: ap.kycData.accountHolderName || 'N/A' },
                  { label: 'Bank Name',      value: ap.kycData.bankName || 'N/A' },
                  { label: 'Account No.',    value: ap.kycData.bankAccount },
                  { label: 'IFSC',           value: ap.kycData.ifsc || 'N/A' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-secondary-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-secondary-400">{label}</p>
                    <p className="text-sm font-semibold text-secondary-800 mt-0.5 font-mono truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejection reason */}
          {status === 'rejected' && ap.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <p className="font-semibold mb-0.5">Rejection Reason</p>
              <p>{ap.rejectionReason}</p>
            </div>
          )}

          {/* KYC Info */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">KYC Status</p>
            <div className="flex items-center gap-3">
              <KYCBadge status={ap.kycStatus} />
              {ap.kycData?.panCard && (
                <span className="text-xs text-secondary-500">PAN: <span className="font-mono font-semibold">{ap.kycData.panCard}</span></span>
              )}
            </div>
          </div>

          {/* Category commission rules */}
          <CategoryCommissionRules
            affiliateId={affiliate._id}
            initialRules={ap.commissionRules || []}
            onSaved={onAction}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-secondary-100">
          <button onClick={() => onAction('delete', affiliate)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={14} /> Delete
          </button>
          <div className="flex items-center gap-2">
            {status === 'pending' && (
              <>
                <button onClick={() => { onAction('reject', affiliate); onClose(); }}
                  className="px-4 py-2 border border-secondary-200 rounded-lg text-sm font-medium text-secondary-700 hover:bg-secondary-50">Reject</button>
                <button onClick={() => { onAction('approve', affiliate); onClose(); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
                  <CheckCircle size={14} /> Approve
                </button>
              </>
            )}
            {status === 'active' && (
              <button onClick={() => { onAction('suspend', affiliate); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100">
                <XCircle size={14} /> Suspend
              </button>
            )}
            {status === 'suspended' && (
              <button onClick={() => { onAction('unsuspend', affiliate); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-semibold hover:bg-green-100">
                <CheckCircle size={14} /> Reinstate
              </button>
            )}
            <button onClick={onClose}
              className="px-4 py-2 bg-secondary-100 text-secondary-700 rounded-lg text-sm font-medium hover:bg-secondary-200">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reject dialog ─────────────────────────────────────────────────────────────

function RejectDialog({ affiliate, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [busy,   setBusy]   = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.put(`/admin/affiliates/${affiliate._id}/reject`, { reason });
      toast.success(`${affiliate.name} rejected`);
      onConfirm(); onClose();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><AlertCircle size={20} className="text-red-600" /></div>
          <div><h3 className="font-bold text-secondary-900">Reject Affiliate</h3><p className="text-sm text-secondary-500 mt-0.5">{affiliate.name}</p></div>
        </div>
        <div className="mb-5">
          <label className="block text-sm font-medium text-secondary-700 mb-1">Reason (optional)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="Let the affiliate know why their application was rejected…"
            className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {busy ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteDialog({ affiliate, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.delete(`/admin/affiliates/${affiliate._id}`);
      toast.success(`${affiliate.name} deleted`);
      onConfirm(); onClose();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><Trash2 size={20} className="text-red-600" /></div>
          <div><h3 className="font-bold text-secondary-900">Delete Affiliate</h3><p className="text-sm text-secondary-500 mt-0.5">All commissions will be deleted. Account preserved.</p></div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-sm text-red-700">
          ⚠️ <strong>{affiliate.name}</strong>'s affiliate commissions will be permanently deleted.
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '',          label: 'All Affiliates' },
  { value: 'active',    label: 'Active' },
  { value: 'pending',   label: 'Pending Approval' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected',  label: 'Rejected' },
];

const EMPTY_STATS = { total: 0, active: 0, pending: 0, totalClicks: 0, totalConversions: 0, totalEarnings: 0, pendingEarnings: 0, conversionRate: 0, topPerformer: null };

export default function AdminAffiliates() {
  const [affiliates,    setAffiliates]    = useState([]);
  const [stats,         setStats]         = useState(EMPTY_STATS);
  const [pagination,    setPagination]    = useState({});
  const [loading,       setLoading]       = useState(true);

  const [page,          setPage]          = useState(1);
  const [searchInput,   setSearchInput]   = useState('');
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');

  const [viewingAffiliate,  setViewingAffiliate]  = useState(null);
  const [rejectingAffiliate,setRejectingAffiliate]= useState(null);
  const [deletingAffiliate, setDeletingAffiliate] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/affiliates/stats');
      setStats(data);
    } catch {}
  }, []);

  const loadAffiliates = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/affiliates', {
        params: { page, limit: 20, status: statusFilter || undefined, search: search || undefined },
      });
      setAffiliates(data.affiliates || []);
      setPagination(data.pagination || {});
    } catch { toast.error('Failed to load affiliates'); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { loadStats(); },      [loadStats]);
  useEffect(() => { loadAffiliates(); }, [loadAffiliates]);

  function refresh() { loadStats(); loadAffiliates(); }

  function handleSearch(e) { e.preventDefault(); setSearch(searchInput); setPage(1); }

  async function handleApprove(affiliate) {
    try {
      await api.put(`/admin/affiliates/${affiliate._id}/approve`);
      toast.success(`${affiliate.name} approved`);
      refresh();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
  }

  async function handleSuspend(affiliate) {
    try {
      await api.put(`/admin/affiliates/${affiliate._id}/suspend`);
      toast.success(`${affiliate.name} suspended`);
      refresh();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
  }

  async function handleUnsuspend(affiliate) {
    try {
      await api.put(`/admin/affiliates/${affiliate._id}/unsuspend`);
      toast.success(`${affiliate.name} reinstated`);
      refresh();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
  }

  function handleAction(type, affiliate) {
    if (type === 'approve')   handleApprove(affiliate);
    else if (type === 'reject')    setRejectingAffiliate(affiliate);
    else if (type === 'suspend')   handleSuspend(affiliate);
    else if (type === 'unsuspend') handleUnsuspend(affiliate);
    else if (type === 'delete')    setDeletingAffiliate(affiliate);
  }

  function exportCSV() {
    if (!affiliates.length) return;
    const headers = ['Name','Email','Code','Status','KYC','Clicks','Conversions','Conv. Rate','Earnings','Pending','Joined'];
    const rows = affiliates.map((a) => {
      const ap = a.affiliateProfile || {};
      const clicks = ap.totalClicks || 0;
      const convs  = a.conversionCount || ap.totalConversions || 0;
      return [
        a.name, a.email, ap.referralCode || '',
        a.affiliateStatus, ap.kycStatus,
        clicks, convs,
        clicks ? `${((convs / clicks) * 100).toFixed(1)}%` : '0%',
        ap.totalEarnings ?? 0, ap.pendingEarnings ?? 0,
        formatDate(a.createdAt),
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `affiliates-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Affiliate Management</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Manage affiliate partners and their performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Affiliates', value: stats.total,            Icon: Users,            color: 'text-blue-600',   bg: 'bg-blue-50',   sub: 'Registered partners' },
          { label: 'Active',           value: stats.active,           Icon: CheckCircle,      color: 'text-green-600',  bg: 'bg-green-50',  sub: 'Currently earning' },
          { label: 'Pending',          value: stats.pending,          Icon: Clock,            color: 'text-yellow-600', bg: 'bg-yellow-50', sub: 'Awaiting approval' },
          { label: 'Total Clicks',     value: stats.totalClicks,      Icon: MousePointerClick,color: 'text-purple-600', bg: 'bg-purple-50', sub: 'All-time referrals' },
          { label: 'Conversions',      value: stats.totalConversions, Icon: RotateCcw,        color: 'text-indigo-600', bg: 'bg-indigo-50', sub: `${stats.conversionRate}% rate` },
        ].map(({ label, value, Icon, color, bg, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-secondary-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-secondary-500">{label}</p>
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={15} className={color} />
              </div>
            </div>
            <p className="text-xl font-black text-secondary-900">{value}</p>
            <p className="text-xs text-secondary-400 mt-0.5">{sub}</p>
          </div>
        ))}

        {/* Total Earnings — green gradient */}
        <div className="bg-green-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs opacity-75">Total Earnings</p>
            <IndianRupee size={15} className="opacity-75" />
          </div>
          <p className="text-xl font-black">{formatCurrency(stats.totalEarnings)}</p>
          <p className="text-xs opacity-60 mt-0.5">{formatCurrency(stats.pendingEarnings)} pending</p>
        </div>
      </div>

      {/* Top Performer — purple gradient */}
      {stats.topPerformer && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold opacity-75 uppercase tracking-wider">Top Performer</span>
            <Star size={14} className="opacity-75" />
          </div>
          <p className="text-xl font-black">{stats.topPerformer.name}</p>
          <p className="text-xs opacity-75 font-mono mt-0.5">{stats.topPerformer.code}</p>
          <div className="flex items-center gap-6 mt-3">
            <div><p className="text-xs opacity-60">Conversions</p><p className="font-bold">{stats.topPerformer.conversions}</p></div>
            <div><p className="text-xs opacity-60">Earnings</p><p className="font-bold">{formatCurrency(stats.topPerformer.totalAmount)}</p></div>
          </div>
        </div>
      )}

      {/* Pending banner */}
      {stats.pending > 0 && statusFilter !== 'pending' && (
        <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-600" />
            <p className="text-sm font-medium text-yellow-800">
              {stats.pending} affiliate{stats.pending !== 1 ? 's' : ''} awaiting approval
            </p>
          </div>
          <button onClick={() => { setStatusFilter('pending'); setPage(1); }}
            className="text-xs font-bold text-yellow-700 hover:text-yellow-900 px-3 py-1 bg-yellow-100 rounded-lg transition-colors">
            View Pending
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, or code…"
            className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </form>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-secondary-200 rounded-lg px-3 py-2 text-sm bg-white pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-primary-300 min-w-36">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
        </div>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setSearchInput(''); setStatusFilter(''); setPage(1); }}
            className="text-sm text-secondary-500 hover:text-secondary-700 px-3 py-2 border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors">
            Clear Filters
          </button>
        )}
      </div>

      {pagination.total !== undefined && (
        <p className="text-sm text-secondary-500">Showing {affiliates.length} of {pagination.total} affiliates</p>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary-900 text-white">
                {['Affiliate','Code','Clicks','Conversions','Conv. Rate','Earnings','Status','KYC','Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12">
                  <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-secondary-400 text-sm">Loading affiliates…</p>
                </td></tr>
              ) : affiliates.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-secondary-400">
                  <UserCheck size={36} className="mx-auto mb-2 opacity-25" />No affiliates found
                </td></tr>
              ) : affiliates.map((a) => {
                const ap     = a.affiliateProfile || {};
                const clicks = ap.totalClicks || 0;
                const convs  = a.conversionCount || ap.totalConversions || 0;
                const rate   = clicks ? ((convs / clicks) * 100).toFixed(1) : '0.0';
                const tier   = performanceTier(convs);
                return (
                  <tr key={a._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <AvatarCircle name={a.name} />
                        <div>
                          <p className="font-semibold text-secondary-900 text-sm leading-tight">{a.name}</p>
                          <p className="text-xs text-secondary-400">{a.email}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tier.cls}`}>{tier.label}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-secondary-100 text-secondary-700 px-2 py-1 rounded">{ap.referralCode || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-secondary-700 text-xs">{clicks}</td>
                    <td className="px-4 py-3 text-secondary-700 text-xs">{convs}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${convRateColor(parseFloat(rate))}`}>{rate}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-secondary-900 text-xs">{formatCurrency(ap.totalEarnings ?? 0)}</p>
                      {(ap.pendingEarnings ?? 0) > 0 && (
                        <p className="text-[10px] text-yellow-600">{formatCurrency(ap.pendingEarnings)} pending</p>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.affiliateStatus} /></td>
                    <td className="px-4 py-3"><KYCBadge status={ap.kycStatus} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setViewingAffiliate(a)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap">
                          Details
                        </button>
                        {a.affiliateStatus === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(a)} title="Approve"
                              className="p-1.5 text-secondary-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                              <CheckCircle size={13} />
                            </button>
                            <button onClick={() => setRejectingAffiliate(a)} title="Reject"
                              className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <XCircle size={13} />
                            </button>
                          </>
                        )}
                        {a.affiliateStatus === 'active' && (
                          <button onClick={() => handleSuspend(a)} title="Suspend"
                            className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <XCircle size={13} />
                          </button>
                        )}
                        {a.affiliateStatus === 'suspended' && (
                          <button onClick={() => handleUnsuspend(a)} title="Reinstate"
                            className="p-1.5 text-secondary-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <CheckCircle size={13} />
                          </button>
                        )}
                        <button onClick={() => setDeletingAffiliate(a)} title="Delete"
                          className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
            <p className="text-xs text-secondary-500">{pagination.total} total affiliates</p>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(pagination.pages, 10) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100 text-secondary-600'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {viewingAffiliate && (
        <AffiliateDetailsModal
          affiliate={viewingAffiliate}
          onClose={() => setViewingAffiliate(null)}
          onAction={(type, a) => { handleAction(type, a || viewingAffiliate); if (type !== 'reject' && type !== 'delete') refresh(); }}
        />
      )}
      {rejectingAffiliate && (
        <RejectDialog affiliate={rejectingAffiliate} onClose={() => setRejectingAffiliate(null)} onConfirm={refresh} />
      )}
      {deletingAffiliate && (
        <DeleteDialog
          affiliate={deletingAffiliate}
          onClose={() => setDeletingAffiliate(null)}
          onConfirm={() => { setDeletingAffiliate(null); setViewingAffiliate(null); refresh(); }}
        />
      )}
    </div>
  );
}
