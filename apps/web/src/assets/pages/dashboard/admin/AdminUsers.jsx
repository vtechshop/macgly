import { useState } from 'react';
import {
  Search, RefreshCw, Download, Eye, Trash2,
  Users, ShoppingBag, Store, UserCheck, ShieldCheck, X,
  Lock, Unlock, KeyRound,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatDate } from '../../../../utils/format';
import { useFetch, useAction } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const ROLE_COLORS = {
  admin:     'bg-red-100 text-red-700',
  vendor:    'bg-purple-100 text-purple-700',
  customer:  'bg-green-100 text-green-700',
  affiliate: 'bg-orange-100 text-orange-700',
};

function timeAgo(date) {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

function Avatar({ name }) {
  const initial = (name || '?')[0].toUpperCase();
  const colors = ['bg-primary-500', 'bg-secondary-600', 'bg-green-500', 'bg-orange-500', 'bg-primary-400', 'bg-primary-500'];
  const color = colors[initial.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
      {initial}
    </div>
  );
}

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rev, setRev] = useState(0);
  const [selected, setSelected] = useState([]);
  const [viewUser, setViewUser] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const { data, isLoading } = useFetch(
    ['admin-users', page, roleFilter, search, rev],
    () => api.get('/admin/users', { params: { page, limit: 20, role: roleFilter || undefined, search: search || undefined } }).then((r) => r.data)
  );

  const { mutate: deleteUser } = useAction(
    (id) => api.delete(`/admin/users/${id}`),
    {
      onSuccess: () => { toast.success('User deleted'); setRev((r) => r + 1); },
      onError: () => toast.error('Failed to delete'),
    }
  );

  const { mutate: toggleSuspend } = useAction(
    ({ id, isActive }) => api.put(`/admin/users/${id}`, { isActive }),
    {
      onSuccess: () => { setRev((r) => r + 1); },
      onError: () => toast.error('Failed to update user'),
    }
  );

  const { mutate: doReset, isPending: resetting } = useAction(
    ({ id, password }) => api.post(`/admin/users/${id}/reset-password`, { password }),
    {
      onSuccess: () => { toast.success('Password reset successfully'); setResetTarget(null); setNewPass(''); setConfirmPass(''); },
      onError: () => toast.error('Failed to reset password'),
    }
  );

  const users = data?.users || [];
  const pagination = data?.pagination;
  const totalPages = Math.ceil((pagination?.total || 0) / (pagination?.limit || 20));
  const counts = data?.counts || {};

  function toggleSelect(id) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }
  function toggleAll() {
    setSelected((s) => s.length === users.length ? [] : users.map((u) => u._id));
  }

  function handleDelete(u) {
    if (!window.confirm(`Delete "${u.name}"? This cannot be undone.`)) return;
    deleteUser(u._id);
  }

  function exportCSV() {
    if (!users.length) return;
    const rows = [['Name', 'Email', 'Role', 'Status', 'Last Login', 'Joined']];
    users.forEach((u) => rows.push([u.name, u.email, u.role, u.isActive ? 'Active' : 'Inactive', u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never', new Date(u.createdAt).toLocaleDateString()]));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const statCards = [
    { label: 'Total Users',  value: counts.total || 0,     icon: Users,      color: 'text-blue-600   bg-blue-50   border-blue-100' },
    { label: 'Customers',    value: counts.customer || 0,  icon: ShoppingBag, color: 'text-green-600  bg-green-50  border-green-100' },
    { label: 'Vendors',      value: counts.vendor || 0,    icon: Store,       color: 'text-purple-600 bg-purple-50 border-purple-100' },
    { label: 'Affiliates',   value: counts.affiliate || 0, icon: UserCheck,   color: 'text-orange-600 bg-orange-50 border-orange-100' },
    { label: 'Admins',       value: counts.admin || 0,     icon: ShieldCheck, color: 'text-red-600    bg-red-50    border-red-100' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-secondary-900">User Management</h1>
        <div className="flex gap-2">
          <button onClick={() => setRev((r) => r + 1)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 flex items-center gap-3 ${s.color}`}>
            <s.icon size={22} className="shrink-0" />
            <div>
              <p className="text-2xl font-black leading-none">{s.value}</p>
              <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-8 text-sm w-full"
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-44 text-sm"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="vendor">Vendor</option>
          <option value="customer">Customer</option>
          <option value="affiliate">Affiliate</option>
        </select>
        {(search || roleFilter) && (
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 text-secondary-600 transition-colors"
          >
            <X size={13} /> Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50 border-b border-blue-100">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-secondary-300"
                      checked={users.length > 0 && selected.length === users.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Last Login</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Joined</th>
                  <th className="text-right px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {!users.length ? (
                  <tr><td colSpan={8} className="text-center py-12 text-secondary-400">No users found</td></tr>
                ) : users.map((u) => (
                  <tr key={u._id} className={`hover:bg-secondary-50 transition-colors ${selected.includes(u._id) ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-secondary-300"
                        checked={selected.includes(u._id)}
                        onChange={() => toggleSelect(u._id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div>
                          <p className="font-semibold text-secondary-900">{u.name}</p>
                          <p className="text-[11px] text-secondary-400 font-mono">ID: {u._id.slice(-8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-secondary-600 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${ROLE_COLORS[u.role] || 'bg-secondary-100 text-secondary-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary-500 text-xs">
                      {timeAgo(u.lastLogin) ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-secondary-400">◷</span>
                          {timeAgo(u.lastLogin)}
                        </span>
                      ) : (
                        <span className="text-secondary-300">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondary-500 text-xs">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewUser(u)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => { toggleSuspend({ id: u._id, isActive: !u.isActive }); toast.success(u.isActive ? 'User suspended' : 'User activated'); }}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${u.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}`}
                          title={u.isActive ? 'Suspend user' : 'Activate user'}
                        >
                          {u.isActive ? <Lock size={15} /> : <Unlock size={15} />}
                        </button>
                        <button
                          onClick={() => { setResetTarget(u); setNewPass(''); setConfirmPass(''); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-orange-400 hover:bg-orange-50 transition-colors"
                          title="Reset password"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100 text-sm text-secondary-500">
              <span className="text-xs">Page {page} of {totalPages} · {pagination?.total} users</span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40">← Prev</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                  return <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-xs font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100'}`}>{p}</button>;
                })}
                <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setResetTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
              <h3 className="font-bold text-secondary-900">Reset Password</h3>
              <button onClick={() => setResetTarget(null)} className="p-1.5 hover:bg-secondary-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <KeyRound size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Reset password for:</p>
                  <p className="text-sm font-bold text-amber-700">{resetTarget.name}</p>
                  <p className="text-xs text-amber-600">{resetTarget.email}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1.5">New Password</label>
                <input
                  type="password"
                  className="input w-full"
                  placeholder="Enter new password (min 8 characters)"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  className="input w-full"
                  placeholder="Confirm new password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                />
                {confirmPass && newPass !== confirmPass && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setResetTarget(null)} className="flex-1 px-4 py-2.5 border border-secondary-200 rounded-xl text-sm font-semibold text-secondary-700 hover:bg-secondary-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => doReset({ id: resetTarget._id, password: newPass })}
                  disabled={resetting || newPass.length < 8 || newPass !== confirmPass}
                  className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  {resetting ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setViewUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
              <h3 className="font-bold text-secondary-900">User Details</h3>
              <button onClick={() => setViewUser(null)} className="p-1.5 hover:bg-secondary-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <Avatar name={viewUser.name} />
                <div>
                  <p className="font-bold text-lg">{viewUser.name}</p>
                  <p className="text-sm text-secondary-500">{viewUser.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Role',           value: viewUser.role },
                  { label: 'Status',         value: viewUser.isActive ? 'Active' : 'Inactive' },
                  { label: 'Last Login',     value: timeAgo(viewUser.lastLogin) || 'Never' },
                  { label: 'Joined',         value: formatDate(viewUser.createdAt) },
                  { label: 'Phone',          value: viewUser.phone || '—' },
                  { label: 'Email Verified', value: viewUser.emailVerified ? 'Yes' : 'No' },
                ].map((r) => (
                  <div key={r.label} className="bg-secondary-50 rounded-lg p-3">
                    <p className="text-xs text-secondary-400">{r.label}</p>
                    <p className="font-semibold text-secondary-800 capitalize mt-0.5">{r.value}</p>
                  </div>
                ))}
              </div>
              {viewUser.role === 'vendor' && viewUser.vendorProfile?.businessName && (
                <div className="bg-purple-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-purple-400 mb-1">Vendor Info</p>
                  <p className="font-semibold">{viewUser.vendorProfile.businessName}</p>
                  {viewUser.vendorProfile.gstin && <p className="text-xs text-secondary-500 mt-0.5">GSTIN: {viewUser.vendorProfile.gstin}</p>}
                </div>
              )}
              {viewUser.role === 'affiliate' && viewUser.affiliateProfile?.referralCode && (
                <div className="bg-orange-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-orange-400 mb-1">Affiliate Info</p>
                  <p className="font-mono font-bold">{viewUser.affiliateProfile.referralCode}</p>
                  <p className="text-xs text-secondary-500 mt-0.5">Earnings: ₹{viewUser.affiliateProfile.totalEarnings || 0}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
