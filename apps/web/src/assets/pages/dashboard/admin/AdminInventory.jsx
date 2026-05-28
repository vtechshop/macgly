import { useState, useRef } from 'react';
import {
  RefreshCw, Download, Search, AlertTriangle, Package, X,
  Check, Pencil, Mail, TrendingUp, AlertCircle, CheckCircle2,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ── Stock status helpers ──────────────────────────────────────────────────────
function getStatusInfo(stock, threshold = 10) {
  if (stock === 0)             return { label: 'Out of Stock',  color: 'text-red-600',    bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500'    };
  if (stock <= threshold)      return { label: 'Low Stock',     color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' };
  if (stock > threshold * 5)   return { label: 'Overstocked',   color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' };
  return                              { label: 'Healthy',        color: 'text-green-600',  bg: 'bg-green-50 border-green-200',  dot: 'bg-green-500'  };
}

function DaysSupply({ days }) {
  if (days === 0)   return <span className="text-red-500 font-semibold">0 days</span>;
  if (days === 999) return <span className="text-secondary-400">999 days</span>;
  if (days <= 7)    return <span className="text-red-500 font-semibold">{days} days</span>;
  if (days <= 30)   return <span className="text-orange-500 font-medium">{days} days</span>;
  return <span className="text-secondary-600">{days} days</span>;
}

export default function AdminInventory() {
  const [rev,            setRev]            = useState(0);
  const [page,           setPage]           = useState(1);
  const [search,         setSearch]         = useState('');
  const [stockFilter,    setStockFilter]    = useState('');
  const [vendorFilter,   setVendorFilter]   = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Inline stock edit
  const [editingId,  setEditingId]  = useState(null);
  const [editValue,  setEditValue]  = useState('');
  const [savingId,   setSavingId]   = useState(null);
  const [exporting,  setExporting]  = useState(false);
  const inputRef = useRef(null);


  const params = {
    page,
    limit: 20,
    search: search || undefined,
    stockStatus: stockFilter || undefined,
    vendorId: vendorFilter || undefined,
    categoryId: categoryFilter || undefined,
  };

  const { data: statsData, refetch: refetchStats } = useFetch(
    ['admin-inventory-stats', rev],
    () => api.get('/admin/inventory/stats').then((r) => r.data),
  );

  const { data: inventoryData, isLoading, refetch: refetchList } = useFetch(
    ['admin-inventory', page, rev, search, stockFilter, vendorFilter, categoryFilter],
    () => api.get('/admin/inventory', { params }).then((r) => r.data),
  );

  const { data: vendorsData } = useFetch(
    ['admin-vendors-list'],
    () => api.get('/admin/users', { params: { role: 'vendor', limit: 100 } }).then((r) => r.data),
  );

  const { data: catsData } = useFetch(
    ['categories'],
    () => api.get('/catalog/categories').then((r) => r.data),
  );

  const products = inventoryData?.data    || [];
  const alerts   = inventoryData?.alerts  || [];
  const meta     = inventoryData?.meta    || {};
  const vendors  = vendorsData?.users     || [];
  const cats     = catsData?.categories   || [];
  const stats    = statsData || {};

  function refresh() {
    setRev((r) => r + 1);
    refetchStats?.();
    refetchList?.();
  }

  // ── Inline stock save ─────────────────────────────────────────────────────
  async function saveStock(id) {
    const v = parseInt(editValue);
    if (isNaN(v) || v < 0) { toast.error('Enter a valid stock number'); return; }
    setSavingId(id);
    try {
      await api.put(`/admin/inventory/${id}/stock`, { stock: v });
      toast.success('Stock updated');
      setEditingId(null);
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update stock');
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(p) {
    setEditingId(p._id);
    setEditValue(String(p.stock ?? 0));
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
  }

  // ── Restock reminder ──────────────────────────────────────────────────────
  const [sendingId, setSendingId] = useState(null);

  async function sendReminder(p) {
    setSendingId(p._id);
    try {
      await api.post(`/admin/inventory/${p._id}/restock-reminder`);
      toast.success('Restock reminder sent to vendor');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to send reminder');
    } finally {
      setSendingId(null);
    }
  }

  // ── CSV Export ────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true);
    try {
      const res = await api.get('/admin/inventory/export', {
        params: {
          search: search || undefined,
          stockStatus: stockFilter || undefined,
          vendorId: vendorFilter || undefined,
          categoryId: categoryFilter || undefined,
        },
        responseType: 'blob',
      });
      const url  = URL.createObjectURL(res.data);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  // ── Stat card click sets filter ───────────────────────────────────────────
  function handleStatClick(key) {
    const map = { outOfStock: 'out', lowStock: 'low', overstocked: 'overstocked', healthyStock: 'healthy' };
    const val = map[key] || '';
    setStockFilter((prev) => prev === val ? '' : val);
    setPage(1);
  }

  // ── Stat cards config ─────────────────────────────────────────────────────
  const statCards = [
    {
      key: 'totalSKUs',
      label: 'Total SKUs',
      value: stats.totalSKUs ?? '—',
      icon: <Package size={22} className="text-blue-500" />,
      ring: 'ring-blue-200',
      bg: 'bg-blue-50',
      active: false,
    },
    {
      key: 'outOfStock',
      label: 'Out of Stock',
      value: stats.outOfStock ?? '—',
      icon: <AlertCircle size={22} className="text-red-500" />,
      ring: 'ring-red-200',
      bg: 'bg-red-50',
      active: stockFilter === 'out',
    },
    {
      key: 'lowStock',
      label: 'Low Stock',
      value: stats.lowStock ?? '—',
      icon: <AlertTriangle size={22} className="text-orange-500" />,
      ring: 'ring-orange-200',
      bg: 'bg-orange-50',
      active: stockFilter === 'low',
    },
    {
      key: 'overstocked',
      label: 'Overstocked',
      value: stats.overstocked ?? '—',
      icon: <TrendingUp size={22} className="text-purple-500" />,
      ring: 'ring-purple-200',
      bg: 'bg-purple-50',
      active: stockFilter === 'overstocked',
    },
    {
      key: 'healthyStock',
      label: 'Healthy Stock',
      value: stats.healthyStock ?? '—',
      icon: <CheckCircle2 size={22} className="text-green-500" />,
      ring: 'ring-green-200',
      bg: 'bg-green-50',
      active: stockFilter === 'healthy',
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Inventory Management</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Monitor stock levels across all vendors</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors text-secondary-600"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-60"
          >
            <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* ── Stats cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map(({ key, label, value, icon, ring, bg, active }) => (
          <button
            key={key}
            onClick={() => key !== 'totalSKUs' && handleStatClick(key)}
            className={`
              flex items-center justify-between p-4 rounded-xl border transition-all text-left
              ${active
                ? `${bg} ${ring} ring-2 shadow-sm`
                : 'bg-white border-secondary-200 hover:border-secondary-300 hover:shadow-sm'
              }
              ${key === 'totalSKUs' ? 'cursor-default' : 'cursor-pointer'}
            `}
          >
            <div>
              <p className="text-xs text-secondary-500 font-medium mb-0.5">{label}</p>
              <p className="text-2xl font-bold text-secondary-900">{value}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              {icon}
            </div>
          </button>
        ))}
      </div>

      {/* ── Alert banner ────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle size={16} className="text-amber-500 shrink-0" />
            <span>
              <strong>{alerts[0].message}</strong>
              {alerts[1] && <span className="text-amber-600 ml-1">· {alerts[1].message}</span>}
            </span>
          </div>
          <button
            onClick={() => { setStockFilter('out'); setPage(1); }}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap flex items-center gap-1"
          >
            View Items &rsaquo;
          </button>
        </div>
      )}

      {/* ── Search + Filters ────────────────────────────────────────────── */}
      <div className="bg-white border border-secondary-200 rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-9 text-sm w-full"
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Stock status */}
          <select
            className="input text-sm"
            value={stockFilter}
            onChange={(e) => { setStockFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Status</option>
            <option value="out">Out of Stock</option>
            <option value="low">Low Stock</option>
            <option value="healthy">Healthy</option>
            <option value="overstocked">Overstocked</option>
          </select>
          {/* Vendor */}
          <select
            className="input text-sm"
            value={vendorFilter}
            onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Vendors</option>
            {vendors.map((v) => (
              <option key={v._id} value={v._id}>{v.name || v.storeName || v.email}</option>
            ))}
          </select>
          {/* Category */}
          <select
            className="input text-sm"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Categories</option>
            {cats.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
        {meta.total != null && (
          <p className="text-xs text-secondary-400">
            Showing {products.length} of {meta.total} product{meta.total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-secondary-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-secondary-400">
            <Package size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No products found</p>
            <p className="text-sm mt-1">Try changing your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-600 text-white text-left">
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Vendor</th>
                  <th className="px-4 py-3 font-semibold text-center">Current Stock</th>
                  <th className="px-4 py-3 font-semibold text-center">Reserved</th>
                  <th className="px-4 py-3 font-semibold text-center">Available</th>
                  <th className="px-4 py-3 font-semibold text-center">Threshold</th>
                  <th className="px-4 py-3 font-semibold text-center">Days Supply</th>
                  <th className="px-4 py-3 font-semibold text-center">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {products.map((p) => {
                  const threshold = p.lowStockThreshold ?? 10;
                  const si        = getStatusInfo(p.stock, threshold);
                  const isEditing = editingId === p._id;
                  const isSaving  = savingId  === p._id;
                  const hasVendor = !!p.vendorId;
                  const isUrgent  = p.stock <= threshold;

                  return (
                    <tr key={p._id} className="hover:bg-secondary-50 transition-colors">
                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {p.images?.[0] ? (
                            <img
                              src={normalizeImageUrl(p.images[0])}
                              alt={p.title}
                              className="w-10 h-10 rounded-lg object-cover border border-secondary-100 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0">
                              <Package size={16} className="text-secondary-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-secondary-900 truncate max-w-[200px]">{p.title}</p>
                            {p.sku && <p className="text-xs text-secondary-400 font-mono">{p.sku}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Vendor */}
                      <td className="px-4 py-3 text-secondary-600">
                        {p.vendorId?.name || p.vendorId?.storeName || <span className="text-secondary-300">—</span>}
                      </td>

                      {/* Current Stock — inline edit */}
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              ref={inputRef}
                              type="number"
                              min="0"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveStock(p._id); if (e.key === 'Escape') cancelEdit(); }}
                              className="w-20 text-center border border-primary-400 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                            />
                            <button
                              onClick={() => saveStock(p._id)}
                              disabled={isSaving}
                              className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors disabled:opacity-60"
                            >
                              {isSaving ? <Spinner size="sm" /> : <Check size={13} />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="w-7 h-7 rounded-lg bg-secondary-100 hover:bg-secondary-200 text-secondary-600 flex items-center justify-center transition-colors"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <span className={`font-semibold ${si.color}`}>{p.stock}</span>
                        )}
                      </td>

                      {/* Reserved */}
                      <td className="px-4 py-3 text-center text-secondary-500">{p.reserved ?? 0}</td>

                      {/* Available */}
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${si.color}`}>{p.available ?? p.stock}</span>
                      </td>

                      {/* Threshold */}
                      <td className="px-4 py-3 text-center text-secondary-500">{threshold}</td>

                      {/* Days Supply */}
                      <td className="px-4 py-3 text-center">
                        <DaysSupply days={p.daysOfSupply ?? (p.stock === 0 ? 0 : 999)} />
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${si.bg} ${si.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${si.dot}`} />
                          {si.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit stock */}
                          <button
                            onClick={() => startEdit(p)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-500 hover:bg-primary-50 transition-colors"
                            title="Edit stock"
                          >
                            <Pencil size={14} />
                          </button>
                          {/* Restock reminder — all vendor products */}
                          {hasVendor && (
                            <button
                              onClick={() => sendReminder(p)}
                              disabled={sendingId === p._id}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                                isUrgent
                                  ? 'text-red-500 hover:bg-red-50'
                                  : 'text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600'
                              }`}
                              title={isUrgent ? 'Send urgent restock reminder' : 'Send restock reminder to vendor'}
                            >
                              {sendingId === p._id ? <Spinner size="sm" /> : <Mail size={14} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-secondary-500">
            Page {meta.page} of {meta.totalPages} · {meta.total} total
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.page <= 1}
              className="px-3 py-1.5 rounded-lg border border-secondary-200 disabled:opacity-40 hover:bg-secondary-50 transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
              const pg = meta.totalPages <= 5 ? i + 1 : Math.max(1, meta.page - 2) + i;
              if (pg > meta.totalPages) return null;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 rounded-lg border text-sm font-medium transition-colors ${
                    pg === meta.page
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-secondary-200 hover:bg-secondary-50 text-secondary-700'
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={meta.page >= meta.totalPages}
              className="px-3 py-1.5 rounded-lg border border-secondary-200 disabled:opacity-40 hover:bg-secondary-50 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}


    </div>
  );
}
