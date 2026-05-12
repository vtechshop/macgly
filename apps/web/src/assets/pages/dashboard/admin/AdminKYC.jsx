import { useState } from 'react';
import {
  ShieldCheck, RefreshCw, Download, Clock, Store, UserCheck,
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatDate } from '../../../../utils/format';
import { useFetch, useAction } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const KYC_STATUS = {
  pending:  'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  not_submitted: 'bg-secondary-100 text-secondary-500',
};

function daysSince(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function ExpandableCard({ title, badge, badgeColor, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-secondary-100 hover:bg-secondary-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-secondary-800">{title}</span>
          {badge !== undefined && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor || 'bg-secondary-100 text-secondary-600'}`}>
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-secondary-400" /> : <ChevronDown size={16} className="text-secondary-400" />}
      </button>
      {open && children}
    </div>
  );
}

function RejectModal({ target, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-bold text-secondary-900">Reject — {target?.name}</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-secondary-500">Provide a reason so the user knows what to fix:</p>
          <textarea
            className="input w-full h-28 resize-none text-sm"
            placeholder="e.g. PAN card details don't match bank account name..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-secondary-200 rounded-xl text-sm font-semibold hover:bg-secondary-50">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(reason)}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminKYC() {
  const [rev, setRev] = useState(0);
  const [tab, setTab] = useState('all');
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data, isLoading } = useFetch(
    ['admin-kyc', rev],
    () => api.get('/admin/kyc').then((r) => r.data)
  );

  const { mutate: approveVendor } = useAction(
    (id) => api.put(`/admin/kyc/vendor/${id}/approve`),
    { onSuccess: () => { toast.success('Vendor approved'); setRev((r) => r + 1); }, onError: () => toast.error('Failed') }
  );
  const { mutate: rejectVendor } = useAction(
    ({ id, reason }) => api.put(`/admin/kyc/vendor/${id}/reject`, { reason }),
    { onSuccess: () => { toast.success('Vendor rejected'); setRev((r) => r + 1); setRejectTarget(null); }, onError: () => toast.error('Failed') }
  );
  const { mutate: approveAffiliate } = useAction(
    (id) => api.put(`/admin/kyc/affiliate/${id}/approve`),
    { onSuccess: () => { toast.success('KYC verified'); setRev((r) => r + 1); }, onError: () => toast.error('Failed') }
  );
  const { mutate: rejectAffiliate } = useAction(
    ({ id, reason }) => api.put(`/admin/kyc/affiliate/${id}/reject`, { reason }),
    { onSuccess: () => { toast.success('KYC rejected'); setRev((r) => r + 1); setRejectTarget(null); }, onError: () => toast.error('Failed') }
  );

  const vendors = data?.vendors || [];
  const affiliates = data?.affiliates || [];
  const counts = data?.counts || {};

  const pendingVendors = vendors.filter((v) => !v.vendorProfile?.approved);
  const approvedVendors = vendors.filter((v) => v.vendorProfile?.approved);
  const pendingAffiliates = affiliates.filter((a) => a.affiliateProfile?.kycStatus === 'pending');
  const verifiedAffiliates = affiliates.filter((a) => a.affiliateProfile?.kycStatus === 'verified');
  const rejectedAffiliates = affiliates.filter((a) => a.affiliateProfile?.kycStatus === 'rejected');

  function exportCSV() {
    const rows = [['Type', 'Name', 'Email', 'Status', 'Submitted']];
    vendors.forEach((v) => rows.push(['Vendor', v.name, v.email, v.vendorProfile?.approved ? 'Approved' : 'Pending', formatDate(v.createdAt)]));
    affiliates.forEach((a) => rows.push(['Affiliate', a.name, a.email, a.affiliateProfile?.kycStatus, formatDate(a.createdAt)]));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `kyc-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const statCards = [
    { label: 'Total Pending', value: counts.total ?? 0, icon: Clock, color: 'bg-yellow-100 text-yellow-600 border-yellow-100' },
    { label: 'Vendors', value: counts.pendingVendors ?? 0, icon: Store, color: 'bg-blue-100 text-blue-600 border-blue-100' },
    { label: 'Affiliates', value: counts.pendingAffiliates ?? 0, icon: UserCheck, color: 'bg-green-100 text-green-600 border-green-100' },
    { label: 'Urgent (7+ days)', value: counts.urgent ?? 0, icon: AlertTriangle, color: 'bg-red-100 text-red-600 border-red-100' },
    { label: 'GST Verified', value: counts.gstVerified ?? 0, icon: ShieldCheck, color: 'bg-purple-100 text-purple-600 border-purple-100' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck size={26} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">KYC Review</h1>
            <p className="text-sm text-secondary-500">Review and approve vendor & affiliate verifications</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRev((r) => r + 1)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 flex items-center gap-3 ${s.color}`}>
            <s.icon size={20} className="shrink-0" />
            <div>
              <p className="text-2xl font-black leading-none">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all', label: `All (${(counts.total ?? 0)})` },
          { key: 'vendors', label: `Vendors (${counts.pendingVendors ?? 0})` },
          { key: 'affiliates', label: `Affiliates (${counts.pendingAffiliates ?? 0})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t.key ? 'bg-secondary-900 text-white' : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'}`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-secondary-400">
          {affiliates.filter((a) => a.affiliateProfile?.kycData?.panCard).length + vendors.filter((v) => v.vendorProfile?.gstin).length} with documents uploaded
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : counts.total === 0 && pendingAffiliates.length === 0 && pendingVendors.length === 0 ? (
        // Show all submissions if nothing pending
        null
      ) : null}

      {/* Pending Vendors */}
      {(tab === 'all' || tab === 'vendors') && pendingVendors.length > 0 && (
        <ExpandableCard title="Pending Vendor Approvals" badge={pendingVendors.length} badgeColor="bg-yellow-100 text-yellow-700" defaultOpen>
          <div className="divide-y divide-secondary-50">
            {pendingVendors.map((v) => {
              const vp = v.vendorProfile || {};
              const days = daysSince(v.createdAt);
              return (
                <div key={v._id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-secondary-900">{v.name}</p>
                        {days >= 7 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Urgent</span>}
                        <span className="text-xs text-secondary-400">Applied {days} day{days !== 1 ? 's' : ''} ago</span>
                      </div>
                      <p className="text-xs text-secondary-500 mt-0.5">{v.email}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 mt-3 text-xs">
                        {vp.businessName && <span><span className="text-secondary-400">Business: </span><strong>{vp.businessName}</strong></span>}
                        {vp.gstin && <span><span className="text-secondary-400">GSTIN: </span><strong>{vp.gstin}</strong></span>}
                        {vp.businessPhone && <span><span className="text-secondary-400">Phone: </span><strong>{vp.businessPhone}</strong></span>}
                        {vp.bankAccount && <span><span className="text-secondary-400">Bank A/C: </span><strong>{vp.bankAccount}</strong></span>}
                        {vp.ifsc && <span><span className="text-secondary-400">IFSC: </span><strong>{vp.ifsc}</strong></span>}
                        {vp.panCard && <span><span className="text-secondary-400">PAN: </span><strong>{vp.panCard}</strong></span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => approveVendor(v._id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <CheckCircle2 size={13} /> Approve
                      </button>
                      <button
                        onClick={() => setRejectTarget({ ...v, type: 'vendor' })}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg border border-red-200 transition-colors"
                      >
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ExpandableCard>
      )}

      {/* Pending Affiliate KYC */}
      {(tab === 'all' || tab === 'affiliates') && pendingAffiliates.length > 0 && (
        <ExpandableCard title="Pending Affiliate KYC" badge={pendingAffiliates.length} badgeColor="bg-yellow-100 text-yellow-700" defaultOpen>
          <div className="divide-y divide-secondary-50">
            {pendingAffiliates.map((a) => {
              const kd = a.affiliateProfile?.kycData || {};
              const days = daysSince(a.createdAt);
              return (
                <div key={a._id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-secondary-900">{a.name}</p>
                        {days >= 7 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Urgent</span>}
                        <span className="text-xs text-secondary-400">Submitted {days} day{days !== 1 ? 's' : ''} ago</span>
                      </div>
                      <p className="text-xs text-secondary-500 mt-0.5">{a.email}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 mt-3 text-xs">
                        {kd.panCard && <span><span className="text-secondary-400">PAN: </span><strong>{kd.panCard}</strong></span>}
                        {kd.accountHolderName && <span><span className="text-secondary-400">Account Holder: </span><strong>{kd.accountHolderName}</strong></span>}
                        {kd.bankAccount && <span><span className="text-secondary-400">Bank A/C: </span><strong>{kd.bankAccount}</strong></span>}
                        {kd.ifsc && <span><span className="text-secondary-400">IFSC: </span><strong>{kd.ifsc}</strong></span>}
                        {kd.aadhaar && <span><span className="text-secondary-400">Aadhaar: </span><strong>{kd.aadhaar}</strong></span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => approveAffiliate(a._id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <CheckCircle2 size={13} /> Verify
                      </button>
                      <button
                        onClick={() => setRejectTarget({ ...a, type: 'affiliate' })}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg border border-red-200 transition-colors"
                      >
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ExpandableCard>
      )}

      {/* Approved Vendors */}
      {(tab === 'all' || tab === 'vendors') && approvedVendors.length > 0 && (
        <ExpandableCard title="Approved Vendors" badge={approvedVendors.length} badgeColor="bg-green-100 text-green-700">
          <div className="divide-y divide-secondary-50">
            {approvedVendors.map((v) => (
              <div key={v._id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-secondary-900 text-sm">{v.name}</p>
                  <p className="text-xs text-secondary-400">{v.email} · {v.vendorProfile?.businessName}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Approved</span>
              </div>
            ))}
          </div>
        </ExpandableCard>
      )}

      {/* Verified Affiliates */}
      {(tab === 'all' || tab === 'affiliates') && verifiedAffiliates.length > 0 && (
        <ExpandableCard title="Verified Affiliates" badge={verifiedAffiliates.length} badgeColor="bg-green-100 text-green-700">
          <div className="divide-y divide-secondary-50">
            {verifiedAffiliates.map((a) => (
              <div key={a._id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-secondary-900 text-sm">{a.name}</p>
                  <p className="text-xs text-secondary-400">{a.email}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">Verified</span>
              </div>
            ))}
          </div>
        </ExpandableCard>
      )}

      {/* Rejected Affiliates */}
      {(tab === 'all' || tab === 'affiliates') && rejectedAffiliates.length > 0 && (
        <ExpandableCard title="Rejected Affiliates" badge={rejectedAffiliates.length} badgeColor="bg-red-100 text-red-700">
          <div className="divide-y divide-secondary-50">
            {rejectedAffiliates.map((a) => (
              <div key={a._id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-secondary-900 text-sm">{a.name}</p>
                  <p className="text-xs text-secondary-400">{a.email}</p>
                  {a.affiliateProfile?.kycData?.rejectionReason && (
                    <p className="text-xs text-red-500 mt-0.5">Reason: {a.affiliateProfile.kycData.rejectionReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">Rejected</span>
                  <button onClick={() => approveAffiliate(a._id)} className="text-xs text-green-600 hover:underline font-medium">Re-verify</button>
                </div>
              </div>
            ))}
          </div>
        </ExpandableCard>
      )}

      {/* Empty state */}
      {!isLoading && vendors.length === 0 && affiliates.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <ShieldCheck size={48} className="text-secondary-200 mb-3" />
          <p className="font-semibold text-secondary-500">No pending KYC submissions</p>
          <p className="text-sm text-secondary-400 mt-1">All verifications have been processed</p>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          target={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            if (rejectTarget.type === 'vendor') rejectVendor({ id: rejectTarget._id, reason });
            else rejectAffiliate({ id: rejectTarget._id, reason });
          }}
        />
      )}
    </div>
  );
}
