import { useState, useCallback } from 'react';
import {
  Store, Users, Clock, CheckCircle, XCircle, AlertCircle,
  Trash2, ExternalLink, Search, ChevronDown, Plus, X,
  Download, RefreshCw, Mail, Send, IndianRupee, Package, Percent,
  ShieldCheck, TrendingUp, Check, Star,
} from 'lucide-react';
import { useEffect } from 'react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate } from '../../../../utils/format';
import toast from 'react-hot-toast';

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '',          label: 'All Vendors' },
  { value: 'active',    label: 'Active' },
  { value: 'pending',   label: 'Pending Approval' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected',  label: 'Rejected' },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function performanceTier(earnings = 0) {
  if (earnings >= 1000000) return { label: '💎 Platinum', cls: 'bg-purple-100 text-purple-700' };
  if (earnings >= 500000)  return { label: '🥇 Gold',     cls: 'bg-yellow-100 text-yellow-700' };
  if (earnings >= 100000)  return { label: '🥈 Silver',   cls: 'bg-gray-100 text-gray-600' };
  return                          { label: '🥉 Bronze',   cls: 'bg-amber-100 text-amber-700' };
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
      {status === 'active'    && <CheckCircle size={10} />}
      {status === 'pending'   && <Clock size={10} />}
      {status === 'suspended' && <XCircle size={10} />}
      {labels[status] || status}
    </span>
  );
}

function KYCBadge({ kycStatus }) {
  const map = {
    approved:      { cls: 'bg-green-100 text-green-700',   label: 'Approved',     icon: ShieldCheck },
    pending:       { cls: 'bg-blue-100 text-blue-700',     label: 'In Review',    icon: Clock },
    rejected:      { cls: 'bg-red-100 text-red-700',       label: 'Rejected',     icon: XCircle },
    not_submitted: { cls: 'bg-yellow-100 text-yellow-700', label: 'Not Submitted',icon: Clock },
  };
  const cfg = map[kycStatus] || map.not_submitted;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

function AvatarCircle({ name, size = 'md' }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-base' : 'w-8 h-8 text-xs';
  const colors = ['bg-blue-500','bg-purple-500','bg-pink-500','bg-orange-500','bg-teal-500','bg-indigo-500'];
  const color  = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`${sz} ${color} rounded-xl flex items-center justify-center font-bold text-white shrink-0 select-none`}>
      {(name?.[0] || '?').toUpperCase()}
    </div>
  );
}

// ── Category commission rules ─────────────────────────────────────────────────

function CategoryCommissionRules({ vendorId, initialRules, onSaved }) {
  const [rules,   setRules]   = useState(initialRules || []);
  const [adding,  setAdding]  = useState(false);
  const [newCat,  setNewCat]  = useState('');
  const [newPct,  setNewPct]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  function addRule() {
    if (!newCat.trim()) return toast.error('Category name is required');
    const pct = parseFloat(newPct);
    if (isNaN(pct) || pct < 0 || pct > 100) return toast.error('Percentage must be 0–100');
    setRules((r) => [...r, { category: newCat.trim(), percentage: pct }]);
    setNewCat(''); setNewPct(''); setAdding(false); setDirty(true);
  }

  function removeRule(idx) { setRules((r) => r.filter((_, i) => i !== idx)); setDirty(true); }

  async function saveRules() {
    setSaving(true);
    try {
      await api.put(`/admin/vendors/${vendorId}/commission-rules`, { commissionRules: rules });
      toast.success('Commission rules saved');
      setDirty(false);
      if (onSaved) onSaved(rules);
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-secondary-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-secondary-800 flex items-center gap-2">
          <Percent size={14} /> Category-Based Commission Rules
        </h4>
        <button onClick={() => setAdding(true)}
          className="text-xs px-2.5 py-1 bg-white border border-secondary-200 rounded-lg hover:bg-secondary-50 flex items-center gap-1 font-medium text-secondary-700 transition-colors">
          <Plus size={11} /> Add Rule
        </button>
      </div>

      {rules.length === 0 && !adding ? (
        <div className="text-center py-5">
          <Percent size={24} className="mx-auto text-secondary-300 mb-1" />
          <p className="text-xs text-secondary-400">No category-based rules set</p>
          <p className="text-xs text-secondary-300 mt-0.5">Click "Add Rule" to set commission rates by category</p>
        </div>
      ) : (
        <div className="space-y-1.5 mb-2">
          {rules.map((rule, idx) => (
            <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-secondary-100">
              <span className="text-sm text-secondary-700">{rule.category}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary-700">{rule.percentage}%</span>
                <button onClick={() => removeRule(idx)} className="p-1 text-secondary-300 hover:text-red-500 rounded transition-colors"><X size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="flex items-center gap-2 mt-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category name…" autoFocus
            className="flex-1 border border-secondary-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            onKeyDown={(e) => e.key === 'Enter' && addRule()} />
          <div className="flex items-center gap-1 w-24 border border-secondary-200 rounded-lg px-2 py-1.5 bg-white">
            <Percent size={11} className="text-secondary-400" />
            <input type="number" min="0" max="100" value={newPct} onChange={(e) => setNewPct(e.target.value)}
              placeholder="15" className="w-full text-sm focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && addRule()} />
          </div>
          <button onClick={addRule} className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"><Check size={13} /></button>
          <button onClick={() => { setAdding(false); setNewCat(''); setNewPct(''); }}
            className="p-1.5 border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors"><X size={13} /></button>
        </div>
      )}

      {rules.length > 0 && (
        <p className="text-xs text-secondary-400 mt-2">
          How it works: When a product in one of these categories is sold, the commission percentage for that category will be used. If no rule matches, the default commission rate will apply.
        </p>
      )}

      {dirty && (
        <button onClick={saveRules} disabled={saving}
          className="mt-3 w-full py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save Rules'}
        </button>
      )}
    </div>
  );
}

// ── KYC Review Section (embedded in vendor modal) ─────────────────────────────

const KYC_REJECT_REASONS = [
  'Invalid or unclear documents',
  'Incomplete information provided',
  'GST details do not match business name',
  'Documents appear to be fraudulent',
  'Address does not match documents',
  'ID document has expired',
  'Business could not be verified',
];

function KYCReviewSection({ vp, vendorId, onAction, onRefresh }) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [busy, setBusy] = useState(false);

  const docs = vp.kycDocuments || [];
  const checks = [
    { label: 'Business Name',    ok: !!vp.businessName?.trim() },
    { label: 'Business Type',    ok: !!vp.businessType },
    { label: 'Business Address', ok: !!vp.businessAddress?.trim() },
    { label: 'Phone Number',     ok: !!vp.businessPhone?.trim() },
    { label: `GST Verified${vp.gstin ? ` (${vp.gstin})` : ''}`, ok: !!vp.gstVerified },
    { label: 'ID Proof uploaded',      ok: docs.some((d) => d.type === 'id_proof') },
    { label: 'Address Proof uploaded', ok: docs.some((d) => d.type === 'address_proof') },
  ];
  const allPassed = checks.every((c) => c.ok);

  async function approveKYC() {
    setBusy(true);
    try {
      await api.put(`/admin/kyc/vendors/${vendorId}/approve`, { force: true });
      toast.success('KYC approved — vendor now has full access');
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'KYC approval failed');
    } finally { setBusy(false); }
  }

  async function rejectKYC() {
    const reason = customReason.trim() || rejectReason;
    if (!reason) { toast.error('Select or enter a rejection reason'); return; }
    setBusy(true);
    try {
      await api.put(`/admin/kyc/vendors/${vendorId}/reject`, { reason });
      toast.success('KYC rejected');
      setRejecting(false);
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Failed to reject');
    } finally { setBusy(false); }
  }

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} className="text-blue-600" />
        <p className="text-sm font-bold text-blue-800">KYC Review — Pending Admin Approval</p>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5 text-xs">
            {c.ok
              ? <CheckCircle size={13} className="text-green-500 shrink-0" />
              : <XCircle size={13} className="text-red-400 shrink-0" />}
            <span className={c.ok ? 'text-secondary-700' : 'text-red-600'}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Documents */}
      {docs.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Documents</p>
          {docs.map((d) => (
            <a key={d._id} href={d.url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
              <ExternalLink size={11} />
              <span className="capitalize">{d.type?.replace(/_/g, ' ')}</span>
              <span className="text-secondary-400">— {d.filename}</span>
            </a>
          ))}
        </div>
      )}

      {/* Reject reason UI */}
      {rejecting && (
        <div className="space-y-2 mb-3">
          <select className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            value={rejectReason} onChange={(e) => { setRejectReason(e.target.value); setCustomReason(''); }}>
            <option value="">Select a reason…</option>
            {KYC_REJECT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            placeholder="Or type a custom reason…"
            value={customReason} onChange={(e) => { setCustomReason(e.target.value); setRejectReason(''); }} />
          <div className="flex gap-2">
            <button onClick={rejectKYC} disabled={busy}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
              {busy ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button onClick={() => setRejecting(false)}
              className="px-3 py-1.5 border border-secondary-200 rounded-lg text-xs hover:bg-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!rejecting && (
        <div className="flex gap-2">
          <button onClick={approveKYC} disabled={busy || !allPassed}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
            <CheckCircle size={12} /> Approve KYC
          </button>
          <button onClick={() => setRejecting(true)} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors">
            <XCircle size={12} /> Reject KYC
          </button>
          {!allPassed && (
            <span className="text-xs text-secondary-400 self-center ml-1">
              Approve disabled — {checks.filter((c) => !c.ok).length} requirement(s) missing
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vendor details modal ──────────────────────────────────────────────────────

function VendorDetailsModal({ vendor: initialVendor, onClose, onAction }) {
  const [vendor,    setVendor]    = useState(initialVendor);
  const [editingC,  setEditingC]  = useState(false);
  const [commVal,   setCommVal]   = useState('');
  const [savingC,   setSavingC]   = useState(false);
  const [detailLoading, setDL]    = useState(false);

  const vp     = vendor.vendorProfile || {};
  const status = vendor.vendorStatus  || 'incomplete';
  const tier   = performanceTier(vp.totalEarnings);

  function refreshVendor() {
    api.get(`/admin/vendors/${vendor._id}`)
      .then(({ data }) => setVendor({ ...data.vendor, vendorStatus: data.vendor.vendorStatus }))
      .catch(() => {});
  }

  useEffect(() => {
    setDL(true);
    api.get(`/admin/vendors/${vendor._id}`)
      .then(({ data }) => setVendor(data.vendor))
      .catch(() => {})
      .finally(() => setDL(false));
  }, [vendor._id]);

  async function saveCommission() {
    const rate = parseFloat(commVal);
    if (isNaN(rate) || rate < 0 || rate > 100) return toast.error('Must be 0–100');
    setSavingC(true);
    try {
      const { data } = await api.put(`/admin/vendors/${vendor._id}/commission`, { defaultCommissionPercentage: rate });
      setVendor((v) => ({ ...v, vendorProfile: { ...v.vendorProfile, commissionRate: rate } }));
      setEditingC(false);
      toast.success(data.message || `Commission set to ${rate}%`);
      onAction();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed');
    } finally { setSavingC(false); }
  }

  function maskAccount(acc) {
    if (!acc || acc.length <= 4) return acc || 'N/A';
    return '****' + acc.slice(-4);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <div className="flex items-center gap-3">
            <AvatarCircle name={vp.businessName || vendor.name} size="lg" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-secondary-900">{vp.businessName || vendor.name}</h2>
                <StatusBadge status={status} />
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.cls}`}>{tier.label}</span>
              </div>
              <p className="text-xs text-secondary-400 mt-0.5">{vendor.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400"><X size={18} /></button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 divide-x divide-secondary-100 border-b border-secondary-100">
          {[
            { label: 'Products',    value: detailLoading ? '…' : (vendor.productCount ?? 0) },
            { label: 'Total Sales', value: formatCurrency(vp.totalEarnings ?? 0) },
            { label: 'Orders',      value: detailLoading ? '…' : (vendor.orderCount ?? 0) },
            { label: 'Avg Rating',  value: '—' },
          ].map(({ label, value }) => (
            <div key={label} className="py-3 px-4 text-center">
              <p className="text-sm font-bold text-secondary-900">{value}</p>
              <p className="text-xs text-secondary-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[55vh]">

          {/* 2-col info panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">Vendor Information</p>
              <div className="space-y-0">
                {[
                  { label: 'Store Name', value: vp.businessName || '—' },
                  { label: 'Owner',      value: vendor.name },
                  { label: 'Email',      value: vendor.email },
                  { label: 'Phone',      value: vp.businessPhone || vendor.phone || 'N/A' },
                  { label: 'Joined',     value: formatDate(vendor.createdAt) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm py-1.5 border-b border-secondary-50 last:border-0">
                    <span className="text-secondary-400 shrink-0">{label}</span>
                    <span className="font-medium text-secondary-800 text-right ml-3 truncate max-w-[55%]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">Business &amp; KYC</p>
              <div className="space-y-0">
                {[
                  { label: 'Business Name',  value: vp.businessName || '—' },
                  { label: 'Business Type',  value: vp.businessType || '—' },
                  { label: 'Tax ID / PAN',   value: vp.panCard || vp.gstin || '—' },
                  { label: 'KYC Status', value: { approved: 'Approved', pending: 'In Review', rejected: 'Rejected', not_submitted: 'Not Submitted' }[vp.kycStatus] || 'Not Submitted', cls: vp.kycStatus === 'approved' ? 'text-green-600 font-semibold' : vp.kycStatus === 'rejected' ? 'text-red-600 font-semibold' : 'text-yellow-600 font-semibold' },
                  { label: 'Verified On',    value: vp.kycVerifiedAt ? formatDate(vp.kycVerifiedAt) : '—' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex justify-between text-sm py-1.5 border-b border-secondary-50 last:border-0">
                    <span className="text-secondary-400 shrink-0">{label}</span>
                    <span className={`text-right ml-3 truncate max-w-[55%] ${cls || 'font-medium text-secondary-800'}`}>{value}</span>
                  </div>
                ))}
                {vp.kycStatus === 'rejected' && vp.kycRejectionReason && (
                  <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <span className="font-semibold">Rejection reason: </span>{vp.kycRejectionReason}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bank Details */}
          {(vp.accountHolderName || vp.bankAccount) && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">Bank Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Account Holder', value: vp.accountHolderName || 'N/A' },
                  { label: 'Bank Name',      value: vp.bankName || 'N/A' },
                  { label: 'Account Number', value: maskAccount(vp.bankAccount) },
                  { label: 'IFSC Code',      value: vp.ifsc || 'N/A' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-secondary-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-secondary-400">{label}</p>
                    <p className="text-sm font-semibold text-secondary-800 mt-0.5 font-mono truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commission Settings */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">Commission Settings</p>
            <div className="bg-secondary-50 rounded-xl p-4">
              <p className="text-xs font-medium text-secondary-600 mb-2">Platform Commission Rate</p>
              {editingC ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 border border-secondary-300 rounded-lg px-3 py-2 bg-white w-28">
                    <Percent size={13} className="text-secondary-400" />
                    <input type="number" min="0" max="100" step="0.5" value={commVal}
                      onChange={(e) => setCommVal(e.target.value)} autoFocus
                      className="w-full text-sm font-bold text-primary-700 focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && saveCommission()} />
                  </div>
                  <button onClick={saveCommission} disabled={savingC}
                    className="px-3 py-2 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                    {savingC ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingC(false)}
                    className="px-3 py-2 border border-secondary-200 rounded-lg text-xs font-medium text-secondary-700 hover:bg-white transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 border border-secondary-200 rounded-lg px-3 py-2 bg-white">
                    <Percent size={13} className="text-secondary-400" />
                    <span className="text-sm font-bold text-primary-700">{vp.commissionRate ?? 10}%</span>
                  </div>
                  <button onClick={() => { setCommVal(String(vp.commissionRate ?? 10)); setEditingC(true); }}
                    className="px-3 py-2 border border-secondary-200 rounded-lg text-xs font-medium text-secondary-700 hover:bg-white transition-colors">
                    Change
                  </button>
                </div>
              )}
              <p className="text-xs text-secondary-400 mt-1.5">
                Vendor receives {100 - (vp.commissionRate ?? 10)}% of each sale
              </p>
            </div>
          </div>

          {/* Category commission rules */}
          <CategoryCommissionRules
            vendorId={vendor._id}
            initialRules={vp.commissionRules || []}
            onSaved={onAction}
          />

          {/* KYC Review — shown when vendor submitted KYC but it's awaiting admin review */}
          {vp.kycStatus === 'pending' && (
            <KYCReviewSection vp={vp} vendorId={vendor._id} onAction={onAction} onRefresh={() => { refreshVendor(); onAction(); }} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-secondary-100">
          <button onClick={() => onAction('delete', vendor)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={14} /> Delete
          </button>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {status === 'pending' && (
              <>
                <button onClick={() => { onAction('reject', vendor); onClose(); }}
                  className="px-4 py-2 border border-secondary-200 rounded-lg text-sm font-medium text-secondary-700 hover:bg-secondary-50 transition-colors">
                  Reject
                </button>
                <button onClick={() => { onAction('approve', vendor); onClose(); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">
                  <CheckCircle size={14} /> Approve Vendor
                </button>
              </>
            )}
            {/* Quick KYC approval — only when not submitted yet (pending state shows review section above) */}
            {status === 'active' && vp.kycStatus === 'not_submitted' && (
              <button onClick={() => onAction('approveKYC', vendor)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                <ShieldCheck size={14} /> Override KYC
              </button>
            )}
            {status === 'active' && (
              <button onClick={() => { onAction('suspend', vendor); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">
                <XCircle size={14} /> Suspend
              </button>
            )}
            {status === 'suspended' && (
              <button onClick={() => { onAction('unsuspend', vendor); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-semibold hover:bg-green-100 transition-colors">
                <CheckCircle size={14} /> Reinstate
              </button>
            )}
            <button onClick={onClose}
              className="px-4 py-2 bg-secondary-100 text-secondary-700 rounded-lg text-sm font-medium hover:bg-secondary-200 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reject reason dialog ──────────────────────────────────────────────────────

function RejectDialog({ vendor, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [busy,   setBusy]   = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.put(`/admin/vendors/${vendor._id}/reject`, { reason });
      toast.success(`${vendor.vendorProfile?.businessName || vendor.name} rejected`);
      onConfirm(); onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-secondary-900">Reject Vendor</h3>
            <p className="text-sm text-secondary-500 mt-0.5">{vendor.vendorProfile?.businessName || vendor.name}</p>
          </div>
        </div>
        <div className="mb-5">
          <label className="block text-sm font-medium text-secondary-700 mb-1">Reason (optional)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="Let the vendor know why their application was rejected…"
            className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {busy ? 'Rejecting…' : 'Reject Vendor'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────

function DeleteDialog({ vendor, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.delete(`/admin/vendors/${vendor._id}`);
      toast.success(`${vendor.vendorProfile?.businessName || vendor.name} deleted`);
      onConfirm(); onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-secondary-900">Delete Vendor</h3>
            <p className="text-sm text-secondary-500 mt-0.5">This will remove all their products.</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-sm text-red-700">
          ⚠️ All products belonging to <strong>{vendor.vendorProfile?.businessName || vendor.name}</strong> will be permanently deleted. The user account is preserved.
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {busy ? 'Deleting…' : 'Delete Vendor'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message modal ─────────────────────────────────────────────────────────────

function MessageModal({ vendor, onClose }) {
  const [subject, setSubject] = useState('Message from Macgly Admin');
  const [body,    setBody]    = useState(`Hi ${vendor?.vendorProfile?.businessName || vendor?.name},\n\n\n\nThank you,\nMacgly Admin Team`);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!body.trim()) return toast.error('Message cannot be empty');
    setSending(true);
    try {
      await api.post(`/admin/users/${vendor._id}/message`, { subject: subject.trim() || undefined, message: body.trim() });
      toast.success(`Message sent to ${vendor.vendorProfile?.businessName || vendor.name}`);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to send');
    } finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
              <Mail size={16} className="text-primary-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-secondary-900">Send Message</h3>
              <p className="text-xs text-secondary-400">To: <span className="font-semibold text-secondary-600">{vendor.vendorProfile?.businessName || vendor.name}</span> · {vendor.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Message</label>
            <textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} autoFocus
              className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
          </div>
          <p className="text-xs text-secondary-400">Vendor receives this as an in-app 🔔 notification + email.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-secondary-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-secondary-600 hover:bg-secondary-100 rounded-lg">Cancel</button>
          <button onClick={send} disabled={sending || !body.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-60">
            {sending ? 'Sending…' : <><Send size={14} /> Send Message</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminVendors() {
  const [vendors,       setVendors]      = useState([]);
  const [stats,         setStats]        = useState({ total: 0, active: 0, pending: 0, suspended: 0, topPerformer: null });
  const [pagination,    setPagination]   = useState({});
  const [loading,       setLoading]      = useState(true);
  const [page,          setPage]         = useState(1);
  const [searchInput,   setSearchInput]  = useState('');
  const [search,        setSearch]       = useState('');
  const [statusFilter,  setStatusFilter] = useState('');

  const [viewingVendor,   setViewingVendor]   = useState(null);
  const [rejectingVendor, setRejectingVendor] = useState(null);
  const [deletingVendor,  setDeletingVendor]  = useState(null);
  const [messagingVendor, setMessagingVendor] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, sRes] = await Promise.all([
        api.get('/admin/vendors', { params: { page, limit: 20, status: statusFilter || undefined, search: search || undefined } }),
        api.get('/admin/vendors/stats'),
      ]);
      setVendors(vRes.data.vendors || []);
      setPagination(vRes.data.pagination || {});
      setStats(sRes.data);
    } catch { toast.error('Failed to load vendors'); }
    finally { setLoading(false); }
  }, [page, statusFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  async function handleApprove(vendor) {
    try {
      const { data } = await api.put(`/admin/vendors/${vendor._id}/approve`);
      if (data.kycAutoApproved) {
        toast.success(`✅ Vendor approved + KYC auto-approved! Full access granted.`);
      } else {
        toast.success(`Vendor approved. Vendor must complete KYC for full access.`);
      }
      loadData();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
  }

  async function handleApproveKYC(vendor) {
    try {
      await api.put(`/admin/kyc/vendors/${vendor._id}/approve`, { force: true });
      toast.success(`KYC approved for ${vendor.vendorProfile?.businessName || vendor.name}`);
      setViewingVendor(null);
      loadData();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'KYC approval failed'); }
  }

  async function handleSuspend(vendor) {
    try {
      await api.put(`/admin/vendors/${vendor._id}/suspend`);
      toast.success(`${vendor.vendorProfile?.businessName || vendor.name} suspended — products unpublished`);
      loadData();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
  }

  async function handleUnsuspend(vendor) {
    try {
      await api.put(`/admin/vendors/${vendor._id}/unsuspend`);
      toast.success(`${vendor.vendorProfile?.businessName || vendor.name} reinstated`);
      loadData();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
  }

  function handleAction(type, vendor) {
    if (type === 'approve')      handleApprove(vendor);
    else if (type === 'approveKYC')  handleApproveKYC(vendor);
    else if (type === 'reject')      setRejectingVendor(vendor);
    else if (type === 'suspend')     handleSuspend(vendor);
    else if (type === 'unsuspend')   handleUnsuspend(vendor);
    else if (type === 'delete')      setDeletingVendor(vendor);
  }

  function exportCSV() {
    const headers = ['Store Name','Owner','Email','Phone','Status','KYC','Commission %','Products','Total Earnings','Joined'];
    const rows = vendors.map((v) => {
      const vp = v.vendorProfile || {};
      return [
        vp.businessName || v.name, v.name, v.email,
        vp.businessPhone || v.phone || '',
        v.vendorStatus || '', vp.approved ? 'Approved' : 'Pending',
        vp.commissionRate ?? 10, v.productCount ?? 0,
        vp.totalEarnings ?? 0, formatDate(v.createdAt),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `vendors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Vendor Management</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Manage all marketplace vendors and their performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Vendors', value: stats.total,     Icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Active',        value: stats.active,    Icon: CheckCircle, color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Pending',       value: stats.pending,   Icon: Clock,       color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Suspended',     value: stats.suspended, Icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-50' },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-secondary-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="font-bold text-secondary-900 text-xl leading-tight">{value}</p>
              <p className="text-xs text-secondary-500">{label}</p>
            </div>
          </div>
        ))}
        {/* Top Performer */}
        <div className="bg-primary-600 rounded-xl p-4 text-white col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1 mb-1 opacity-80">
            <TrendingUp size={11} />
            <p className="text-[10px] font-bold uppercase tracking-wider">Top Performer</p>
          </div>
          <p className="font-bold text-sm truncate">{stats.topPerformer?.name || '—'}</p>
          <p className="text-xs opacity-75 mt-0.5">
            {stats.topPerformer ? formatCurrency(stats.topPerformer.totalSales) : 'No sales yet'}
          </p>
        </div>
      </div>

      {/* Pending banner */}
      {stats.pending > 0 && statusFilter !== 'pending' && (
        <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-600" />
            <p className="text-sm font-medium text-yellow-800">
              {stats.pending} vendor{stats.pending !== 1 ? 's' : ''} awaiting approval
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
            placeholder="Search by store name, owner, or email…"
            className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </form>
        <div className="relative">
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white pr-8 appearance-none min-w-36">
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
        <p className="text-sm text-secondary-500">Showing {vendors.length} of {pagination.total} vendors</p>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary-900 text-white">
                {['Vendor','Contact','Products','Total Sales','Rating','Status','KYC','Commission','Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-secondary-400 text-sm">Loading vendors…</p>
                  </td>
                </tr>
              ) : vendors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-secondary-400">
                    <Store size={36} className="mx-auto mb-2 opacity-25" />
                    No vendors found
                  </td>
                </tr>
              ) : vendors.map((v) => {
                const vp   = v.vendorProfile || {};
                const tier = performanceTier(vp.totalEarnings);
                return (
                  <tr key={v._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <AvatarCircle name={vp.businessName || v.name} />
                        <div>
                          <p className="font-semibold text-secondary-900 text-sm leading-tight">{vp.businessName || v.name}</p>
                          <p className="text-xs text-secondary-400">{v.name}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tier.cls}`}>{tier.label}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-secondary-700">{v.email}</p>
                      <p className="text-xs text-secondary-400">{vp.businessPhone || v.phone || 'No phone'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-secondary-700 text-xs">
                        <Store size={11} className="text-secondary-400" /> {v.productCount ?? 0}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-secondary-900 text-xs">{formatCurrency(vp.totalEarnings ?? 0)}</p>
                      <p className="text-[10px] text-secondary-400">earnings</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Star size={11} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-secondary-400">—</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={v.vendorStatus} /></td>
                    <td className="px-4 py-3"><KYCBadge kycStatus={vp.kycStatus} /></td>
                    <td className="px-4 py-3 font-semibold text-secondary-800 text-xs">{vp.commissionRate ?? 10}%</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setViewingVendor(v)}
                          className="px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap">
                          Details
                        </button>
                        {v.vendorStatus === 'active' && (
                          <a href={`/store/${(vp.businessName || '').toLowerCase().replace(/\s+/g, '-')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-secondary-400 hover:text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors">
                            <ExternalLink size={13} />
                          </a>
                        )}
                        {v.vendorStatus === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(v)} title="Approve"
                              className="p-1.5 text-secondary-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                              <CheckCircle size={13} />
                            </button>
                            <button onClick={() => setRejectingVendor(v)} title="Reject"
                              className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <XCircle size={13} />
                            </button>
                          </>
                        )}
                        {v.vendorStatus === 'active' && (
                          <button onClick={() => handleSuspend(v)} title="Suspend"
                            className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <XCircle size={13} />
                          </button>
                        )}
                        {v.vendorStatus === 'suspended' && (
                          <button onClick={() => handleUnsuspend(v)} title="Reinstate"
                            className="p-1.5 text-secondary-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <CheckCircle size={13} />
                          </button>
                        )}
                        <button onClick={() => setMessagingVendor(v)} title="Message"
                          className="p-1.5 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <Mail size={13} />
                        </button>
                        <button onClick={() => setDeletingVendor(v)} title="Delete"
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
            <p className="text-xs text-secondary-500">{pagination.total} total vendors</p>
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
      {viewingVendor && (
        <VendorDetailsModal
          vendor={viewingVendor}
          onClose={() => setViewingVendor(null)}
          onAction={(type, v) => {
            handleAction(type, v || viewingVendor);
            if (type !== 'reject' && type !== 'delete') loadData();
          }}
        />
      )}
      {rejectingVendor && (
        <RejectDialog vendor={rejectingVendor} onClose={() => setRejectingVendor(null)} onConfirm={loadData} />
      )}
      {deletingVendor && (
        <DeleteDialog
          vendor={deletingVendor}
          onClose={() => setDeletingVendor(null)}
          onConfirm={() => { setDeletingVendor(null); setViewingVendor(null); loadData(); }}
        />
      )}
      {messagingVendor && (
        <MessageModal vendor={messagingVendor} onClose={() => setMessagingVendor(null)} />
      )}
    </div>
  );
}
