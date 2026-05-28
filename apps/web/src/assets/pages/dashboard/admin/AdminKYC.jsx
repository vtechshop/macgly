import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, RefreshCw, Download, Clock, Store, UserCheck,
  CheckCircle, XCircle, AlertCircle, AlertTriangle, X,
  ChevronDown, FileText, ExternalLink,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatDate } from '../../../../utils/format';
import toast from 'react-hot-toast';

// ── constants ─────────────────────────────────────────────────────────────────

const REJECTION_REASONS = [
  { value: 'invalid_documents',     label: 'Invalid or unclear documents' },
  { value: 'incomplete_info',       label: 'Incomplete information provided' },
  { value: 'gst_mismatch',          label: 'GST details do not match business name' },
  { value: 'fake_documents',        label: 'Documents appear to be fraudulent' },
  { value: 'address_mismatch',      label: 'Address does not match documents' },
  { value: 'id_expired',            label: 'ID document has expired' },
  { value: 'business_not_verified', label: 'Business could not be verified' },
  { value: 'other',                 label: 'Other (specify below)' },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function daysSince(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function priority(days) {
  if (days >= 7) return { label: 'Urgent',  cls: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    };
  if (days >= 3) return { label: 'High',    cls: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' };
  if (days >= 1) return { label: 'Normal',  cls: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' };
  return               { label: 'New',     cls: 'bg-green-100 text-green-700',   dot: 'bg-green-500'  };
}

function docCount(item) {
  if (item.type === 'vendor') {
    const vp = item.vendorProfile || {};
    return [vp.panCard, vp.gstin, vp.bankAccount, vp.accountHolderName, vp.ifsc].filter(Boolean).length;
  }
  const kd = item.affiliateProfile?.kycData || {};
  return [kd.panCard, kd.bankAccount, kd.ifsc, kd.aadhaar].filter(Boolean).length;
}

function buildChecklist(item) {
  if (item.type === 'vendor') {
    const vp = item.vendorProfile || {};
    return [
      { label: 'Business Name',   ok: !!vp.businessName,                  critical: false },
      { label: 'Phone Provided',  ok: !!vp.businessPhone,                 critical: false },
      { label: 'GST Number',      ok: !!vp.gstin,                         critical: true  },
      { label: 'PAN Number',      ok: !!vp.panCard,                       critical: false },
      { label: 'Bank Account',    ok: !!(vp.bankAccount && vp.ifsc),      critical: false },
      { label: 'KYC Data',        ok: !!(vp.panCard || vp.gstin),         critical: true  },
    ];
  }
  const ap = item.affiliateProfile || {};
  const kd = ap.kycData || {};
  return [
    { label: 'PAN Number',    ok: !!kd.panCard,                   critical: true  },
    { label: 'Bank Account',  ok: !!kd.bankAccount,               critical: false },
    { label: 'IFSC Code',     ok: !!kd.ifsc,                      critical: false },
    { label: 'KYC Data',      ok: !!(kd.panCard || kd.aadhaar),  critical: true  },
  ];
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ item, onClose, onConfirm }) {
  const [selected, setSelected] = useState('');
  const [custom,   setCustom]   = useState('');
  const [busy,     setBusy]     = useState(false);

  const finalReason = selected === 'other'
    ? custom.trim()
    : REJECTION_REASONS.find((r) => r.value === selected)?.label || '';

  const canConfirm = selected && (selected !== 'other' || custom.trim());

  async function submit() {
    setBusy(true);
    try {
      await onConfirm(finalReason);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-secondary-100">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-secondary-900">Reject KYC — {item.name}</h3>
            <p className="text-xs text-secondary-400 mt-0.5 capitalize">{item.type} application</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
            <div className="relative">
              <select value={selected} onChange={(e) => setSelected(e.target.value)}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2.5 text-sm bg-white pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="">Select a reason…</option>
                {REJECTION_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
            </div>
          </div>

          {selected === 'other' && (
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Specify reason</label>
              <textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={3}
                placeholder="Describe the issue clearly…"
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
            </div>
          )}

          {finalReason && (
            <div className="bg-secondary-50 rounded-xl px-4 py-3 text-sm text-secondary-600">
              <span className="font-medium">Applicant will see: </span>
              <em>"{finalReason}"</em>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50">Cancel</button>
          <button onClick={submit} disabled={!canConfirm || busy}
            className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {busy ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────────

function ReviewModal({ item, onClose, onApprove, onReject }) {
  const [approving, setApproving] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const isVendor   = item.type === 'vendor';
  const vp         = item.vendorProfile   || {};
  const ap         = item.affiliateProfile|| {};
  const kd         = ap.kycData           || {};
  const days       = daysSince(item.createdAt);
  const pri        = priority(days);
  const checklist  = buildChecklist(item);
  const gstOk      = isVendor ? !!vp.gstin : null;
  const canApprove = !isVendor || gstOk;

  async function handleApprove() {
    setApproving(true);
    try { await onApprove(); onClose(); }
    catch (err) { toast.error(err?.response?.data?.error?.message || 'Approval failed'); }
    finally { setApproving(false); }
  }

  async function handleRejectConfirm(reason) {
    await onReject(reason);
    onClose();
  }

  const infoRows = isVendor ? [
    { label: 'Business Name',  value: vp.businessName  || '—' },
    { label: 'Business Type',  value: vp.businessType  || '—' },
    { label: 'GST Number',     value: vp.gstin         || '—' },
    { label: 'PAN Card',       value: vp.panCard       || '—' },
    { label: 'Phone',          value: vp.businessPhone || '—' },
    { label: 'Bank Account',   value: vp.bankAccount   || '—' },
    { label: 'IFSC',           value: vp.ifsc          || '—' },
    { label: 'Account Holder', value: vp.accountHolderName || '—' },
  ] : [
    { label: 'PAN Card',      value: kd.panCard           || '—' },
    { label: 'Aadhaar',       value: kd.aadhaar           || '—' },
    { label: 'Bank Account',  value: kd.bankAccount       || '—' },
    { label: 'IFSC',          value: kd.ifsc              || '—' },
    { label: 'Account Holder',value: kd.accountHolderName || '—' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isVendor ? 'bg-blue-100' : 'bg-purple-100'}`}>
                {isVendor ? <Store size={18} className="text-blue-600" /> : <UserCheck size={18} className="text-purple-600" />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-secondary-900">{item.name}</h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${isVendor ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {item.type}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pri.cls}`}>{pri.label}</span>
                </div>
                <p className="text-xs text-secondary-400 mt-0.5">{item.email} · Submitted {formatDate(item.createdAt)}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400"><X size={18} /></button>
          </div>

          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">

            {/* Verification Checklist */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-3">Verification Checklist</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {checklist.map(({ label, ok, critical }) => (
                  <div key={label} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${
                    ok ? 'bg-green-50 text-green-700' : critical ? 'bg-red-50 text-red-700' : 'bg-secondary-50 text-secondary-500'
                  }`}>
                    {ok ? <CheckCircle size={14} className="shrink-0" /> : <XCircle size={14} className="shrink-0" />}
                    <span className="font-medium text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GST Section — vendors only */}
            {isVendor && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">GST Verification</p>
                {gstOk ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="text-sm font-semibold text-green-700">GST Number Provided</span>
                    </div>
                    <p className="font-mono text-sm text-green-800">{vp.gstin}</p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">
                      <strong>GST NOT provided</strong> — Vendor KYC requires a GST number before approval can proceed.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* KYC Information */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">
                {isVendor ? 'Business Information' : 'Personal Information'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {infoRows.map(({ label, value }) => (
                  <div key={label} className="bg-secondary-50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-secondary-400">{label}</p>
                    <p className="text-sm font-semibold text-secondary-800 mt-0.5 font-mono truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* KYC Documents (proxy: fields as documents) */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">Submitted KYC Data</p>
              {docCount(item) > 0 ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <FileText size={16} className="text-green-600" />
                  <p className="text-sm text-green-700 font-medium">{docCount(item)} field{docCount(item) !== 1 ? 's' : ''} submitted</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle size={16} className="text-red-600" />
                  <p className="text-sm text-red-700 font-medium">No KYC data submitted yet</p>
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-secondary-100">
            <p className="text-xs text-secondary-400">Submitted {days} day{days !== 1 ? 's' : ''} ago</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowReject(true)}
                className="px-4 py-2 border border-red-200 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">
                Reject
              </button>
              <button onClick={handleApprove} disabled={!canApprove || approving}
                title={!canApprove ? 'GST number required before approval' : undefined}
                className="flex items-center gap-1.5 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                <CheckCircle size={14} />
                {approving ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showReject && (
        <RejectModal
          item={item}
          onClose={() => setShowReject(false)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminKYC() {
  const [submissions,  setSubmissions]  = useState([]);
  const [meta,         setMeta]         = useState({ total: 0, totalVendors: 0, totalAffiliates: 0, urgent: 0, gstVerified: 0 });
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('all');
  const [reviewing,    setReviewing]    = useState(null);
  const [selected,     setSelected]     = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/kyc/pending');
      setSubmissions(data.data || []);
      setMeta(data.meta || {});
    } catch { toast.error('Failed to load KYC submissions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = submissions.filter((s) =>
    filter === 'all' ? true : s.type === (filter === 'vendors' ? 'vendor' : 'affiliate')
  );

  const docsCount = submissions.filter((s) => docCount(s) > 0).length;

  function toggleSelect(id) {
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }
  function toggleAll() {
    setSelected((p) => p.length === visible.length ? [] : visible.map((s) => s._id));
  }

  async function handleApprove(item) {
    const endpoint = item.type === 'vendor'
      ? `/admin/kyc/vendors/${item._id}/approve`
      : `/admin/kyc/affiliates/${item._id}/approve`;
    await api.put(endpoint);
    toast.success(`${item.name} approved`);
    load();
  }

  async function handleReject(item, reason) {
    const endpoint = item.type === 'vendor'
      ? `/admin/kyc/vendors/${item._id}/reject`
      : `/admin/kyc/affiliates/${item._id}/reject`;
    await api.put(endpoint, { reason });
    toast.success(`${item.name} rejected`);
    load();
  }

  function exportCSV() {
    const headers = ['Type','Name','Email','Phone','GST Status','Documents','Submitted','Waiting Days'];
    const rows = submissions.map((s) => {
      const vp = s.vendorProfile || {};
      const kd = s.affiliateProfile?.kycData || {};
      return [
        s.type, s.name, s.email,
        s.type === 'vendor' ? (vp.businessPhone || s.phone || '') : (kd.aadhaar || s.phone || ''),
        s.type === 'vendor' ? (vp.gstin ? 'Verified' : 'Not verified') : 'N/A',
        docCount(s),
        formatDate(s.createdAt),
        daysSince(s.createdAt),
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `kyc-review-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <ShieldCheck size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-secondary-900">KYC Review</h1>
            <p className="text-sm text-secondary-500 mt-0.5">Review and approve vendor &amp; affiliate verifications</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Pending',   value: meta.total,           Icon: Clock,         cls: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: 'Vendors',         value: meta.totalVendors,    Icon: Store,         cls: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'Affiliates',      value: meta.totalAffiliates, Icon: UserCheck,     cls: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Urgent (7+ days)',value: meta.urgent,          Icon: AlertTriangle, cls: meta.urgent > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-secondary-50 border-secondary-200 text-secondary-500' },
          { label: 'GST Verified',    value: meta.gstVerified,     Icon: ShieldCheck,   cls: 'bg-purple-50 border-purple-200 text-purple-700' },
        ].map(({ label, value, Icon, cls }) => (
          <div key={label} className={`rounded-xl border p-4 flex items-center gap-3 ${cls}`}>
            <div className="w-9 h-9 bg-white/60 rounded-xl flex items-center justify-center shrink-0">
              <Icon size={17} />
            </div>
            <div>
              <p className="text-xl font-black leading-none">{value}</p>
              <p className="text-xs mt-0.5 opacity-70">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {[
            { key: 'all',       label: `All (${meta.total})` },
            { key: 'vendors',   label: `Vendors (${meta.totalVendors})` },
            { key: 'affiliates',label: `Affiliates (${meta.totalAffiliates})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === key ? 'bg-secondary-900 text-white' : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-secondary-400">{docsCount} with documents uploaded</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary-900 text-white">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={visible.length > 0 && selected.length === visible.length}
                    onChange={toggleAll}
                    className="w-4 h-4 cursor-pointer" />
                </th>
                {['Type','Applicant','Contact','Waiting','Docs','GST','Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-secondary-400 text-sm">Loading submissions…</p>
                </td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <ShieldCheck size={44} className="text-secondary-200 mb-3" />
                    <p className="font-semibold text-secondary-500">No pending KYC submissions</p>
                    <p className="text-sm text-secondary-400 mt-1">All verifications have been processed</p>
                  </div>
                </td></tr>
              ) : visible.map((s) => {
                const days = daysSince(s.createdAt);
                const pri  = priority(days);
                const isVendor = s.type === 'vendor';
                const vp = s.vendorProfile || {};
                const kd = s.affiliateProfile?.kycData || {};
                const gstOk = isVendor ? !!vp.gstin : null;
                const docs  = docCount(s);

                return (
                  <tr key={s._id}
                    className={`hover:bg-secondary-50 transition-colors ${days >= 7 ? 'bg-red-50/20' : ''} ${selected.includes(s._id) ? 'bg-primary-50' : ''}`}>
                    <td className="px-4 py-3 w-10">
                      <input type="checkbox" checked={selected.includes(s._id)} onChange={() => toggleSelect(s._id)}
                        className="w-4 h-4 cursor-pointer" />
                    </td>
                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isVendor ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {isVendor ? <Store size={10} /> : <UserCheck size={10} />}
                        {isVendor ? 'Vendor' : 'Affiliate'}
                      </span>
                    </td>
                    {/* Applicant */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-secondary-900 text-sm">{s.name}</p>
                      <p className="text-xs text-secondary-400">{isVendor ? (vp.businessName || '—') : (kd.panCard ? `PAN: ${kd.panCard}` : '—')}</p>
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3">
                      <p className="text-xs text-secondary-700">{s.email}</p>
                      <p className="text-xs text-secondary-400">{isVendor ? (vp.businessPhone || '—') : (s.phone || '—')}</p>
                    </td>
                    {/* Waiting */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${pri.cls}`}>{pri.label}</span>
                      <p className="text-[10px] text-secondary-400 mt-0.5">{days}d ago</p>
                    </td>
                    {/* Docs */}
                    <td className="px-4 py-3">
                      {docs > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                          <CheckCircle size={12} /> {docs}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-secondary-400">
                          <XCircle size={12} /> None
                        </span>
                      )}
                    </td>
                    {/* GST */}
                    <td className="px-4 py-3">
                      {!isVendor ? (
                        <span className="text-xs text-secondary-400">N/A</span>
                      ) : gstOk ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><CheckCircle size={12} /> Yes</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600"><XCircle size={12} /> No</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setReviewing(s)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors whitespace-nowrap">
                          Review
                        </button>
                        <button
                          onClick={() => handleApprove(s)}
                          disabled={isVendor && !gstOk}
                          title={isVendor && !gstOk ? 'GST required' : 'Quick approve'}
                          className="p-1.5 text-secondary-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <CheckCircle size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {reviewing && (
        <ReviewModal
          item={reviewing}
          onClose={() => setReviewing(null)}
          onApprove={() => handleApprove(reviewing)}
          onReject={(reason) => handleReject(reviewing, reason)}
        />
      )}
    </div>
  );
}
