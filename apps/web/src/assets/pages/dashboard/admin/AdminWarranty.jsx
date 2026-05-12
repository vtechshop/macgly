import { useState } from 'react';
import { ShieldCheck, RefreshCw, Download, AlertTriangle, XCircle, Package, TrendingUp, Search, X, ClipboardList } from 'lucide-react';
import api from '../../../../utils/api';
import { formatDate } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';

const STATUS_STYLES = {
  active:        { badge: 'bg-green-100 text-green-700',  label: 'Active' },
  expiring_soon: { badge: 'bg-yellow-100 text-yellow-700', label: 'Expiring Soon' },
  expired:       { badge: 'bg-red-100 text-red-700',      label: 'Expired' },
};

function ProgressBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-300 w-40 shrink-0">{label} ({count})</span>
      <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-gray-400 w-10 text-right shrink-0">{pct}%</span>
    </div>
  );
}

export default function AdminWarranty() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-warranty', page, statusFilter, search, rev],
    () => api.get('/admin/warranty', {
      params: { page, limit: 20, status: statusFilter || undefined, search: search || undefined },
    }).then((r) => r.data)
  );

  const warranties = data?.warranties || [];
  const stats = data?.stats || {};
  const warrantyTypes = data?.warrantyTypes || [];
  const pagination = data?.pagination;
  const totalPages = Math.ceil((pagination?.total || 0) / (pagination?.limit || 20));
  const total = stats.total || 0;

  function exportCSV() {
    if (!warranties.length) return;
    const rows = [['Order ID', 'Customer', 'Product', 'Delivered', 'Expires', 'Days Left', 'Status']];
    warranties.forEach((w) => rows.push([
      w.orderId, w.customer?.name || '', w.product?.title || '',
      w.deliveredAt ? new Date(w.deliveredAt).toLocaleDateString() : '',
      new Date(w.expiresAt).toLocaleDateString(),
      w.daysLeft, STATUS_STYLES[w.status]?.label || w.status,
    ]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `warranty-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const statCards = [
    { label: 'Total', value: stats.total ?? 0, icon: Package, color: 'text-blue-600 bg-blue-50', valueColor: '' },
    { label: 'Active', value: stats.active ?? 0, icon: ShieldCheck, color: 'text-green-600 bg-green-50', valueColor: 'text-green-600' },
    { label: 'Expiring Soon', value: stats.expiringSoon ?? 0, icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50', valueColor: 'text-yellow-600' },
    { label: 'Expired', value: stats.expired ?? 0, icon: XCircle, color: 'text-red-500 bg-red-50', valueColor: 'text-red-500' },
    { label: 'Pending Claims', value: stats.pendingClaims ?? 0, icon: ClipboardList, color: 'text-purple-600 bg-purple-50', valueColor: 'text-purple-600' },
    { label: 'Avg Period', value: stats.avgPeriod ? `${stats.avgPeriod}d` : '—', icon: TrendingUp, color: 'text-indigo-600 bg-indigo-50', valueColor: 'text-indigo-600' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Warranty Management</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Track and manage product warranties, claims, and extensions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRev((r) => r + 1)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
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

        {/* Warranty type tiles */}
        {warrantyTypes.length > 0 ? (
          <div className="flex flex-wrap gap-3 mb-6">
            {warrantyTypes.map((t) => (
              <div key={t.type} className="bg-white/10 rounded-xl px-5 py-3 min-w-[140px]">
                <p className="text-2xl font-black">{t.total}</p>
                <p className="text-xs text-gray-300 mt-0.5">{t.type}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-6 text-sm text-gray-400">No warranty data yet — add warranty info to products and deliver orders.</div>
        )}

        {/* Progress bars */}
        <div className="space-y-3">
          <ProgressBar label="Active" count={stats.active || 0} total={total} color="bg-green-400" />
          <ProgressBar label="Expiring Soon" count={stats.expiringSoon || 0} total={total} color="bg-yellow-400" />
          <ProgressBar label="Expired" count={stats.expired || 0} total={total} color="bg-red-400" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
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
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-8 text-sm w-full"
            placeholder="Search by product, customer, order..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-40 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="expiring_soon">Expiring Soon</option>
          <option value="expired">Expired</option>
        </select>
        {(statusFilter || search) && (
          <button onClick={() => { setStatusFilter(''); setSearch(''); setPage(1); }} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-secondary-200 rounded-lg hover:bg-secondary-50 text-secondary-600">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary-50 border-b border-secondary-100">
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Order</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Delivered</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Expires</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Days Left</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Warranty</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {!warranties.length ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16">
                      <ShieldCheck size={40} className="mx-auto text-secondary-200 mb-3" />
                      <p className="text-secondary-400 font-medium">No warranty records found</p>
                      <p className="text-xs text-secondary-300 mt-1">Products with warranty info will appear here after orders are delivered</p>
                    </td>
                  </tr>
                ) : warranties.map((w) => {
                  const ws = STATUS_STYLES[w.status] || STATUS_STYLES.active;
                  const warranty = w.product?.warranty;
                  return (
                    <tr key={w._id} className="hover:bg-secondary-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {w.product?.image && (
                            <img src={w.product.image} alt="" className="w-9 h-9 rounded-lg object-cover bg-secondary-100 shrink-0" onError={(e) => e.target.style.display='none'} />
                          )}
                          <div>
                            <p className="font-medium text-secondary-900 text-xs line-clamp-2 max-w-[150px]">{w.product?.title}</p>
                            <p className="text-[11px] text-secondary-400">{w.product?.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-secondary-900 text-xs">{w.customer?.name || '—'}</p>
                        <p className="text-[11px] text-secondary-400">{w.customer?.email}</p>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-blue-600">{w.orderId}</td>
                      <td className="px-5 py-3 text-secondary-500 text-xs">{w.deliveredAt ? formatDate(w.deliveredAt) : '—'}</td>
                      <td className="px-5 py-3 text-secondary-500 text-xs">{formatDate(w.expiresAt)}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-bold ${w.daysLeft > 30 ? 'text-green-600' : w.daysLeft > 0 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {w.daysLeft > 0 ? `${w.daysLeft}d` : 'Expired'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-secondary-500">
                        {warranty ? `${warranty.duration} ${warranty.durationType}` : '—'}
                        {warranty?.description && <p className="text-[11px] text-secondary-400">{warranty.description}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ws.badge}`}>{ws.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
              <span className="text-xs text-secondary-500">Page {page} of {totalPages} · {pagination?.total} records</span>
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
    </div>
  );
}
