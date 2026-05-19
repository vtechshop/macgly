import { useState } from 'react';
import { UserCheck, IndianRupee, Users, Search, Edit2, Check, X, ShieldCheck, ShieldX, Clock } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

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
      setRev((r) => r + 1);
    } catch { toast.error('Could not update'); }
  }

  async function makeAffiliate(userId) {
    try {
      await api.put(`/admin/users/${userId}`, { role: 'affiliate' });
      toast.success('User promoted to affiliate');
      setRev((r) => r + 1);
    } catch { toast.error('Could not update role'); }
  }

  async function approveKYC(id) {
    try {
      await api.put(`/admin/kyc/affiliate/${id}/approve`);
      toast.success('KYC approved!');
      setRev((r) => r + 1);
    } catch { toast.error('Could not approve KYC'); }
  }

  async function rejectKYC(id) {
    const reason = window.prompt('Rejection reason (optional):') ?? '';
    try {
      await api.put(`/admin/kyc/affiliate/${id}/reject`, { reason });
      toast.success('KYC rejected');
      setRev((r) => r + 1);
    } catch { toast.error('Could not reject KYC'); }
  }

  function KycBadge({ status }) {
    if (!status || status === 'not_submitted') return <span className="text-xs text-secondary-400 italic">Not submitted</span>;
    if (status === 'pending') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"><Clock size={10} /> Pending</span>;
    if (status === 'verified') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><ShieldCheck size={10} /> Verified</span>;
    if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><ShieldX size={10} /> Rejected</span>;
    return null;
  }

  return (
    <div className="space-y-5">
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
                      <button
                        onClick={() => toggleActive(a)}
                        className="text-xs px-2.5 py-1 rounded font-semibold bg-secondary-100 text-secondary-600 hover:bg-secondary-200 transition-colors"
                      >
                        {a.isActive ? 'Disable' : 'Enable'}
                      </button>
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
