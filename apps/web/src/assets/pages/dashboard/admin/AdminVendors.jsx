import { useState } from 'react';
import { Store, CheckCircle, XCircle, Clock, Search } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

export default function AdminVendors() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | pending | approved

  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-vendors', rev],
    () => api.get('/admin/users?role=vendor&limit=100').then((r) => r.data)
  );

  const allVendors = data?.users || [];

  const vendors = allVendors.filter((v) => {
    const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'pending' && !v.vendorProfile?.approved) || (filter === 'approved' && v.vendorProfile?.approved);
    return matchSearch && matchFilter;
  });

  const totalApproved = allVendors.filter((v) => v.vendorProfile?.approved).length;
  const totalPending = allVendors.filter((v) => !v.vendorProfile?.approved).length;

  async function toggleApproval(vendor) {
    const newVal = !vendor.vendorProfile?.approved;
    try {
      await api.put(`/admin/users/${vendor._id}`, { vendorProfile: { ...vendor.vendorProfile, approved: newVal } });
      toast.success(newVal ? `${vendor.name} approved as vendor` : `${vendor.name} approval revoked`);
      setRev((r) => r + 1);
    } catch {
      toast.error('Could not update vendor');
    }
  }

  async function toggleActive(vendor) {
    try {
      await api.put(`/admin/users/${vendor._id}`, { isActive: !vendor.isActive });
      toast.success(vendor.isActive ? 'Vendor deactivated' : 'Vendor activated');
      setRev((r) => r + 1);
    } catch {
      toast.error('Could not update vendor');
    }
  }

  async function changeRole(vendor, role) {
    try {
      await api.put(`/admin/users/${vendor._id}`, { role });
      toast.success(`Role changed to ${role}`);
      setRev((r) => r + 1);
    } catch {
      toast.error('Could not change role');
    }
  }

  async function updateCommissionRate(vendor, rate) {
    const num = parseFloat(rate);
    if (isNaN(num) || num < 0 || num > 100) return toast.error('Rate must be 0–100');
    try {
      await api.put(`/admin/users/${vendor._id}`, { vendorProfile: { ...vendor.vendorProfile, commissionRate: num } });
      toast.success(`Commission rate set to ${num}%`);
      setRev((r) => r + 1);
    } catch {
      toast.error('Could not update commission rate');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendors</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Manage vendor accounts and approvals</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
            <Store size={18} className="text-white" />
          </div>
          <div>
            <p className="text-2xl font-black">{allVendors.length}</p>
            <p className="text-xs text-secondary-500">Total Vendors</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
            <CheckCircle size={18} className="text-white" />
          </div>
          <div>
            <p className="text-2xl font-black text-green-600">{totalApproved}</p>
            <p className="text-xs text-secondary-500">Approved</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
            <Clock size={18} className="text-white" />
          </div>
          <div>
            <p className="text-2xl font-black text-yellow-600">{totalPending}</p>
            <p className="text-xs text-secondary-500">Pending Approval</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-9 text-sm w-full"
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-secondary-100 rounded-lg p-1">
          {[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === val ? 'bg-white shadow text-secondary-900' : 'text-secondary-500 hover:text-secondary-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : vendors.length === 0 ? (
          <div className="py-10 text-center text-secondary-400">No vendors found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Vendor</th>
                  <th className="px-5 py-3 text-left">Business</th>
                  <th className="px-5 py-3 text-left">GSTIN</th>
                  <th className="px-5 py-3 text-left">Commission %</th>
                  <th className="px-5 py-3 text-left">Approval</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {vendors.map((v) => (
                  <tr key={v._id} className="hover:bg-secondary-50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-secondary-900">{v.name}</p>
                      <p className="text-xs text-secondary-400">{v.email}</p>
                    </td>
                    <td className="px-5 py-3 text-secondary-600">{v.vendorProfile?.businessName || <span className="text-secondary-300 italic">Not set</span>}</td>
                    <td className="px-5 py-3 font-mono text-xs text-secondary-600">{v.vendorProfile?.gstin || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          defaultValue={v.vendorProfile?.commissionRate ?? 10}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (val !== (v.vendorProfile?.commissionRate ?? 10)) updateCommissionRate(v, val);
                          }}
                          className="w-16 input py-1 text-xs text-center"
                        />
                        <span className="text-xs text-secondary-400">%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {v.vendorProfile?.approved ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full w-fit">
                          <CheckCircle size={11} /> Approved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full w-fit">
                          <Clock size={11} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {v.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleApproval(v)}
                          className={`text-xs px-2.5 py-1 rounded font-semibold transition-colors ${v.vendorProfile?.approved ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                        >
                          {v.vendorProfile?.approved ? 'Revoke' : 'Approve'}
                        </button>
                        <button
                          onClick={() => toggleActive(v)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-secondary-100 text-secondary-600 hover:bg-secondary-200 transition-colors"
                        >
                          {v.isActive ? 'Disable' : 'Enable'}
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
    </div>
  );
}
