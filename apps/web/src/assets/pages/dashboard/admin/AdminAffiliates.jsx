import { useState } from 'react';
import { UserCheck, IndianRupee, Users, Search, Edit2, Check, X, ShieldCheck, ShieldX, Clock, Eye, ExternalLink } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function KycBadge({ status }) {
  if (!status || status === 'not_submitted') return <span className="text-xs text-secondary-400 italic">Not submitted</span>;
  if (status === 'pending') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"><Clock size={10} /> Pending</span>;
  if (status === 'verified') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><ShieldCheck size={10} /> Verified</span>;
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><ShieldX size={10} /> Rejected</span>;
  return null;
}

function AffiliateDetailModal({ affiliate: a, onClose, onApprove, onReject, onToggle }) {
  const kyc = a.affiliateProfile?.kycData || {};
  const kycStatus = a.affiliateProfile?.kycStatus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-secondary-100">
          <div>
            <h2 className="text-lg font-bold text-secondary-900">{a.name}</h2>
            <p className="text-sm text-secondary-500">{a.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <KycBadge status={kycStatus} />
            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${a.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {a.isActive ? 'Active' : 'Inactive'}
            </span>
            {a.affiliateProfile?.referralCode && (
              <span className="font-mono text-xs bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded font-bold tracking-widest">
                {a.affiliateProfile.referralCode}
              </span>
            )}
          </div>

          {/* Earnings & Commission */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary-50 rounded-lg p-3">
              <p className="text-xs text-secondary-500 mb-0.5">Commission Rate</p>
              <p className="font-bold text-secondary-900">{a.affiliateProfile?.commissionRate ?? 5}%</p>
            </div>
            <div className="bg-secondary-50 rounded-lg p-3">
              <p className="text-xs text-secondary-500 mb-0.5">Total Earnings</p>
              <p className="font-bold text-green-700">{formatCurrency(a.affiliateProfile?.totalEarnings || 0)}</p>
            </div>
            <div className="bg-secondary-50 rounded-lg p-3">
              <p className="text-xs text-secondary-500 mb-0.5">Joined</p>
              <p className="font-bold text-secondary-900">{new Date(a.createdAt).toLocaleDateString('en-IN')}</p>
            </div>
          </div>

          {/* KYC Details */}
          {kyc && Object.keys(kyc).length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">KYC Information</p>
              <div className="grid grid-cols-2 gap-3">
                {kyc.fullName && (
                  <div>
                    <p className="text-xs text-secondary-500">Full Name</p>
                    <p className="text-sm font-semibold text-secondary-800">{kyc.fullName}</p>
                  </div>
                )}
                {kyc.phone && (
                  <div>
                    <p className="text-xs text-secondary-500">Phone</p>
                    <p className="text-sm font-semibold text-secondary-800">{kyc.phone}</p>
                  </div>
                )}
                {kyc.panNumber && (
                  <div>
                    <p className="text-xs text-secondary-500">PAN Number</p>
                    <p className="text-sm font-semibold font-mono text-secondary-800">{kyc.panNumber}</p>
                  </div>
                )}
                {kyc.aadhaarNumber && (
                  <div>
                    <p className="text-xs text-secondary-500">Aadhaar Number</p>
                    <p className="text-sm font-semibold font-mono text-secondary-800">{kyc.aadhaarNumber}</p>
                  </div>
                )}
                {kyc.address && (
                  <div className="col-span-2">
                    <p className="text-xs text-secondary-500">Address</p>
                    <p className="text-sm font-semibold text-secondary-800">{kyc.address}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bank Details */}
          {(kyc.bankAccount || kyc.ifsc || kyc.bankName) && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">Bank Details</p>
              <div className="grid grid-cols-2 gap-3">
                {kyc.bankName && (
                  <div>
                    <p className="text-xs text-secondary-500">Bank Name</p>
                    <p className="text-sm font-semibold text-secondary-800">{kyc.bankName}</p>
                  </div>
                )}
                {kyc.bankAccount && (
                  <div>
                    <p className="text-xs text-secondary-500">Account Number</p>
                    <p className="text-sm font-semibold font-mono text-secondary-800">{kyc.bankAccount}</p>
                  </div>
                )}
                {kyc.ifsc && (
                  <div>
                    <p className="text-xs text-secondary-500">IFSC Code</p>
                    <p className="text-sm font-semibold font-mono text-secondary-800">{kyc.ifsc}</p>
                  </div>
                )}
                {kyc.accountHolder && (
                  <div>
                    <p className="text-xs text-secondary-500">Account Holder</p>
                    <p className="text-sm font-semibold text-secondary-800">{kyc.accountHolder}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* KYC Documents */}
          {(kyc.panDoc || kyc.aadhaarDoc) && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">KYC Documents</p>
              <div className="flex flex-wrap gap-2">
                {kyc.panDoc && (
                  <a href={kyc.panDoc} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-secondary-200 text-secondary-700 hover:border-primary-400 hover:text-primary-600 transition-colors">
                    <ExternalLink size={12} /> PAN Document
                  </a>
                )}
                {kyc.aadhaarDoc && (
                  <a href={kyc.aadhaarDoc} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-secondary-200 text-secondary-700 hover:border-primary-400 hover:text-primary-600 transition-colors">
                    <ExternalLink size={12} /> Aadhaar Document
                  </a>
                )}
              </div>
            </div>
          )}

          {kyc.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-0.5">Rejection Reason</p>
              <p className="text-sm text-red-600">{kyc.rejectionReason}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 p-5 border-t border-secondary-100 bg-secondary-50 rounded-b-2xl">
          <div className="flex gap-2">
            {kycStatus === 'pending' && (
              <>
                <button onClick={onApprove} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 font-semibold transition-colors">
                  <ShieldCheck size={14} /> Approve KYC
                </button>
                <button onClick={onReject} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 font-semibold transition-colors">
                  <ShieldX size={14} /> Reject KYC
                </button>
              </>
            )}
            {kycStatus === 'verified' && (
              <button onClick={onReject} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 font-semibold transition-colors">
                <ShieldX size={14} /> Revoke KYC
              </button>
            )}
          </div>
          <button onClick={onToggle}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-semibold border transition-colors ${a.isActive ? 'border-secondary-300 text-secondary-600 hover:bg-secondary-100' : 'border-green-300 text-green-700 hover:bg-green-50'}`}>
            {a.isActive ? 'Disable Account' : 'Enable Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommissionEditor({ affiliateId, current, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current);
  const [saving, setSaving] = useState(false);

  async function save() {
    const rate = parseFloat(val);
    if (isNaN(rate) || rate < 0 || rate > 100) { toast.error('Enter a valid rate (0–100)'); return; }
    setSaving(true);
    try {
      await api.put(`/admin/users/${affiliateId}`, { affiliateProfile: { commissionRate: rate } });
      toast.success('Commission rate updated');
      setEditing(false);
      onSaved(rate);
    } catch { toast.error('Could not update'); }
    finally { setSaving(false); }
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm font-semibold hover:text-primary-600 group">
        {current}% <Edit2 size={12} className="opacity-0 group-hover:opacity-100 text-secondary-400" />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min={0} max={100} step={0.5}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-16 text-sm border border-secondary-300 rounded px-2 py-0.5 focus:outline-none focus:border-primary-500"
        autoFocus
      />
      <span className="text-sm text-secondary-500">%</span>
      <button onClick={save} disabled={saving} className="p-1 text-green-600 hover:text-green-700"><Check size={14} /></button>
      <button onClick={() => { setEditing(false); setVal(current); }} className="p-1 text-red-500 hover:text-red-600"><X size={14} /></button>
    </div>
  );
}

export default function AdminAffiliates() {
  const [search, setSearch] = useState('');
  const [rates, setRates] = useState({});
  const [rev, setRev] = useState(0);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);

  const { data, isLoading } = useFetch(
    ['admin-affiliates', rev],
    () => api.get('/admin/users?role=affiliate&limit=100').then((r) => r.data)
  );

  const allAffiliates = data?.users || [];
  const affiliates = allAffiliates.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalEarnings = allAffiliates.reduce((s, a) => s + (a.affiliateProfile?.totalEarnings || 0), 0);

  async function toggleActive(a) {
    try {
      await api.put(`/admin/users/${a._id}`, { isActive: !a.isActive });
      toast.success(a.isActive ? 'Affiliate deactivated' : 'Affiliate activated');
      setSelectedAffiliate(null);
      setRev((r) => r + 1);
    } catch { toast.error('Could not update'); }
  }

  async function approveKYC(id) {
    try {
      await api.put(`/admin/kyc/affiliate/${id}/approve`);
      toast.success('KYC approved!');
      setSelectedAffiliate(null);
      setRev((r) => r + 1);
    } catch { toast.error('Could not approve KYC'); }
  }

  async function rejectKYC(id) {
    const reason = window.prompt('Rejection reason (optional):') ?? '';
    try {
      await api.put(`/admin/kyc/affiliate/${id}/reject`, { reason });
      toast.success('KYC rejected');
      setSelectedAffiliate(null);
      setRev((r) => r + 1);
    } catch { toast.error('Could not reject KYC'); }
  }

  return (
    <div className="space-y-5">
      {selectedAffiliate && (
        <AffiliateDetailModal
          affiliate={selectedAffiliate}
          onClose={() => setSelectedAffiliate(null)}
          onApprove={() => approveKYC(selectedAffiliate._id)}
          onReject={() => rejectKYC(selectedAffiliate._id)}
          onToggle={() => toggleActive(selectedAffiliate)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Affiliates</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Manage affiliate accounts and commission rates</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-pink-500 rounded-lg flex items-center justify-center">
            <UserCheck size={18} className="text-white" />
          </div>
          <div>
            <p className="text-2xl font-black">{allAffiliates.length}</p>
            <p className="text-xs text-secondary-500">Total Affiliates</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
            <IndianRupee size={18} className="text-white" />
          </div>
          <div>
            <p className="text-2xl font-black text-green-600">{formatCurrency(totalEarnings)}</p>
            <p className="text-xs text-secondary-500">Total Paid Out</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <p className="text-2xl font-black text-blue-600">{allAffiliates.filter((a) => a.isActive).length}</p>
            <p className="text-xs text-secondary-500">Active Affiliates</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          className="input pl-9 text-sm w-full"
          placeholder="Search affiliates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : affiliates.length === 0 ? (
          <div className="py-10 text-center text-secondary-400">No affiliates found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Affiliate</th>
                  <th className="px-5 py-3 text-left">Referral Code</th>
                  <th className="px-5 py-3 text-left">Commission Rate</th>
                  <th className="px-5 py-3 text-left">Total Earnings</th>
                  <th className="px-5 py-3 text-left">KYC</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Joined</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {affiliates.map((a) => (
                  <tr key={a._id} className="hover:bg-secondary-50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-secondary-900">{a.name}</p>
                      <p className="text-xs text-secondary-400">{a.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      {a.affiliateProfile?.referralCode ? (
                        <span className="font-mono text-xs bg-secondary-100 text-secondary-700 px-2 py-1 rounded font-bold tracking-widest">
                          {a.affiliateProfile.referralCode}
                        </span>
                      ) : (
                        <span className="text-xs text-secondary-400 italic">No code yet</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <CommissionEditor
                        affiliateId={a._id}
                        current={rates[a._id] ?? a.affiliateProfile?.commissionRate ?? 5}
                        onSaved={(r) => setRates((p) => ({ ...p, [a._id]: r }))}
                      />
                    </td>
                    <td className="px-5 py-3 font-semibold text-green-700">
                      {formatCurrency(a.affiliateProfile?.totalEarnings || 0)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1.5">
                        <KycBadge status={a.affiliateProfile?.kycStatus} />
                        {a.affiliateProfile?.kycStatus === 'pending' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => approveKYC(a._id)}
                              className="flex items-center gap-0.5 text-xs px-2 py-0.5 rounded bg-green-500 text-white hover:bg-green-600 font-semibold transition-colors"
                            >
                              <Check size={10} /> Approve
                            </button>
                            <button
                              onClick={() => rejectKYC(a._id)}
                              className="flex items-center gap-0.5 text-xs px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 font-semibold transition-colors"
                            >
                              <X size={10} /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {a.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-secondary-500">
                      {new Date(a.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setSelectedAffiliate(a)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded font-semibold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          onClick={() => toggleActive(a)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-secondary-100 text-secondary-600 hover:bg-secondary-200 transition-colors"
                        >
                          {a.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-4 bg-blue-50 border border-blue-200">
        <p className="text-sm font-semibold text-blue-800">How to promote a user to affiliate?</p>
        <p className="text-xs text-blue-600 mt-1">Go to <strong>Users</strong> page → find the user → change their role to <strong>Affiliate</strong>. They can then generate their referral code from their dashboard.</p>
      </div>
    </div>
  );
}
