import { useState } from 'react';
import { Store, CheckCircle, XCircle, Clock, Search, X, Phone, Mail, MapPin, Building2, CreditCard, FileText, Eye } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import { formatDate } from '../../../../utils/format';
import toast from 'react-hot-toast';

function VendorDetailModal({ vendor, onClose, onApprove, onRevoke, onToggleActive }) {
  const vp = vendor?.vendorProfile || {};
  const docs = vp.kycDocs || {};

  function DocLink({ label, url }) {
    if (!url) return <span className="text-secondary-400 text-xs">Not uploaded</span>;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline flex items-center gap-1">
        <FileText size={12} /> View {label}
      </a>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-secondary-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Store size={22} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-secondary-900">{vendor.name}</h2>
              <p className="text-sm text-secondary-400">{vendor.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status row */}
          <div className="flex items-center gap-3 flex-wrap">
            {vp.approved ? (
              <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full"><CheckCircle size={12} /> Approved</span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full"><Clock size={12} /> Pending Approval</span>
            )}
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${vendor.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {vendor.isActive ? 'Active' : 'Inactive'}
            </span>
            {vp.kycStatus && (
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                KYC: {vp.kycStatus}
              </span>
            )}
            <span className="text-xs text-secondary-400 ml-auto">Joined {formatDate(vendor.createdAt)}</span>
          </div>

          {/* Business Info */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-3">Business Info</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-secondary-50 rounded-lg p-3">
                <p className="text-xs text-secondary-400 mb-0.5">Business Name</p>
                <p className="font-semibold">{vp.businessName || '—'}</p>
              </div>
              <div className="bg-secondary-50 rounded-lg p-3">
                <p className="text-xs text-secondary-400 mb-0.5">Business Type</p>
                <p className="font-semibold capitalize">{vp.businessType || '—'}</p>
              </div>
              <div className="bg-secondary-50 rounded-lg p-3">
                <p className="text-xs text-secondary-400 mb-0.5">GSTIN</p>
                <p className="font-mono font-semibold">{vp.gstin || vp.gstNumber || '—'}</p>
              </div>
              <div className="bg-secondary-50 rounded-lg p-3">
                <p className="text-xs text-secondary-400 mb-0.5">PAN Card</p>
                <p className="font-mono font-semibold">{vp.panCard || '—'}</p>
              </div>
              <div className="bg-secondary-50 rounded-lg p-3 col-span-2">
                <p className="text-xs text-secondary-400 mb-0.5">Business Address</p>
                <p className="font-semibold">{vp.businessAddress || vp.address || '—'}</p>
              </div>
              {vp.storeDescription && (
                <div className="bg-secondary-50 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-secondary-400 mb-0.5">Store Description</p>
                  <p className="text-sm">{vp.storeDescription}</p>
                </div>
              )}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-3">Contact</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2"><Phone size={14} className="text-secondary-400" /><span>{vp.businessPhone || vendor.phone || '—'}</span></div>
              <div className="flex items-center gap-2"><Mail size={14} className="text-secondary-400" /><span>{vp.businessEmail || vendor.email}</span></div>
              {vp.city && <div className="flex items-center gap-2"><MapPin size={14} className="text-secondary-400" /><span>{vp.city}{vp.state ? `, ${vp.state}` : ''}</span></div>}
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-3">Bank Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-secondary-50 rounded-lg p-3">
                <p className="text-xs text-secondary-400 mb-0.5">Account Holder</p>
                <p className="font-semibold">{vp.bankAccount?.accountHolderName || vp.accountHolderName || '—'}</p>
              </div>
              <div className="bg-secondary-50 rounded-lg p-3">
                <p className="text-xs text-secondary-400 mb-0.5">Bank Name</p>
                <p className="font-semibold">{vp.bankAccount?.bankName || vp.bankName || '—'}</p>
              </div>
              <div className="bg-secondary-50 rounded-lg p-3">
                <p className="text-xs text-secondary-400 mb-0.5">Account Number</p>
                <p className="font-mono font-semibold">{vp.bankAccount?.accountNumber || vp.bankAccount || '—'}</p>
              </div>
              <div className="bg-secondary-50 rounded-lg p-3">
                <p className="text-xs text-secondary-400 mb-0.5">IFSC Code</p>
                <p className="font-mono font-semibold">{vp.bankAccount?.ifsc || vp.ifsc || '—'}</p>
              </div>
            </div>
          </div>

          {/* KYC Documents */}
          {Object.values(docs).some(Boolean) && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-3">KYC Documents</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'gstCertificate', label: 'GST Certificate' },
                  { key: 'panCard', label: 'PAN Card' },
                  { key: 'bankStatement', label: 'Bank Statement' },
                  { key: 'addressProof', label: 'Address Proof' },
                ].map(({ key, label }) => (
                  <div key={key} className="bg-secondary-50 rounded-lg p-3">
                    <p className="text-xs text-secondary-400 mb-1">{label}</p>
                    <DocLink label={label} url={docs[key]} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commission */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary-400 mb-2">Commission Rate</h3>
            <p className="text-2xl font-black text-primary-600">{vp.commissionRate ?? 10}%</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-secondary-100">
          <button
            onClick={() => { vp.approved ? onRevoke(vendor) : onApprove(vendor); onClose(); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${vp.approved ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' : 'bg-green-600 text-white hover:bg-green-700'}`}
          >
            {vp.approved ? 'Revoke Approval' : '✓ Approve Vendor'}
          </button>
          <button
            onClick={() => { onToggleActive(vendor); onClose(); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-secondary-100 text-secondary-700 hover:bg-secondary-200 transition-colors"
          >
            {vendor.isActive ? 'Disable Account' : 'Enable Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminVendors() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [rev, setRev] = useState(0);
  const [selectedVendor, setSelectedVendor] = useState(null);

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
      toast.success(newVal ? `${vendor.name} approved` : `${vendor.name} approval revoked`);
      setRev((r) => r + 1);
    } catch { toast.error('Could not update vendor'); }
  }

  async function toggleActive(vendor) {
    try {
      await api.put(`/admin/users/${vendor._id}`, { isActive: !vendor.isActive });
      toast.success(vendor.isActive ? 'Vendor deactivated' : 'Vendor activated');
      setRev((r) => r + 1);
    } catch { toast.error('Could not update vendor'); }
  }

  async function updateCommissionRate(vendor, rate) {
    const num = parseFloat(rate);
    if (isNaN(num) || num < 0 || num > 100) return toast.error('Rate must be 0–100');
    try {
      await api.put(`/admin/users/${vendor._id}`, { vendorProfile: { ...vendor.vendorProfile, commissionRate: num } });
      toast.success(`Commission rate set to ${num}%`);
      setRev((r) => r + 1);
    } catch { toast.error('Could not update commission rate'); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Vendors</h1>
        <p className="text-sm text-secondary-500 mt-0.5">Manage vendor accounts and approvals</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Vendors', value: allVendors.length, bg: 'bg-orange-500', icon: Store },
          { label: 'Approved', value: totalApproved, bg: 'bg-green-500', icon: CheckCircle },
          { label: 'Pending Approval', value: totalPending, bg: 'bg-yellow-500', icon: Clock },
        ].map(({ label, value, bg, icon: Icon }) => (
          <div key={label} className="card p-4 flex items-center gap-4">
            <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center shrink-0`}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-black">{value}</p>
              <p className="text-xs text-secondary-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input className="input pl-9 text-sm w-full" placeholder="Search vendors…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-secondary-100 rounded-lg p-1">
          {[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === val ? 'bg-white shadow text-secondary-900' : 'text-secondary-500 hover:text-secondary-700'}`}>
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
                    <td className="px-5 py-3 font-mono text-xs text-secondary-600">{v.vendorProfile?.gstin || v.vendorProfile?.gstNumber || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" max="100" step="0.5"
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
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full w-fit"><CheckCircle size={11} /> Approved</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full w-fit"><Clock size={11} /> Pending</span>
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
                          onClick={() => setSelectedVendor(v)}
                          className="text-xs px-2.5 py-1 rounded font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1 transition-colors"
                        >
                          <Eye size={11} /> View
                        </button>
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

      {selectedVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onApprove={toggleApproval}
          onRevoke={toggleApproval}
          onToggleActive={toggleActive}
        />
      )}
    </div>
  );
}
