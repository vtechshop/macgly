import { useState, useMemo } from 'react';
import {
  Search, AlertTriangle, Package, RefreshCw, RotateCcw,
  CheckCircle, TrendingDown, Boxes, IndianRupee, LayoutList,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { useFetch } from '../../../../hooks';
import api from '../../../../utils/api';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function stockStatus(stock, threshold = 10) {
  if (stock === 0)           return 'out';
  if (stock <= threshold)    return 'low';
  return 'in';
}

function StatusBadge({ stock, threshold }) {
  const s = stockStatus(stock, threshold);
  if (s === 'out') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
      <AlertTriangle size={10} /> Out of Stock
    </span>
  );
  if (s === 'low') return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
      <TrendingDown size={10} /> Low Stock
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
      <CheckCircle size={10} /> In Stock
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function VendorInventory() {
  const { user } = useSelector((s) => s.auth);
  const [rev,          setRev]          = useState(0);
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState('all');   // 'all' | 'low' | 'out'
  const [editingStock, setEditingStock] = useState({});      // { [id]: number }
  const [saving,       setSaving]       = useState({});      // { [id]: bool }

  const { data, isLoading } = useFetch(
    ['vendor-inventory', user?._id, rev],
    () => api.get('/vendors/inventory', { params: { page: 1, limit: 50 } }).then((r) => r.data),
  );

  const allProducts = data?.products || [];

  // Stats computed client-side
  const stats = useMemo(() => {
    const outOfStock     = allProducts.filter((p) => p.stock === 0).length;
    const lowStock       = allProducts.filter((p) => p.stock > 0 && p.stock <= (p.lowStockThreshold || 10)).length;
    const totalUnits     = allProducts.reduce((s, p) => s + (p.stock || 0), 0);
    const inventoryValue = allProducts.reduce((s, p) => s + ((p.price || 0) * (p.stock || 0)), 0);
    return { total: allProducts.length, outOfStock, lowStock, totalUnits, inventoryValue };
  }, [allProducts]);

  // Client-side filter
  const filtered = useMemo(() => {
    let list = allProducts;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.title.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'out') list = list.filter((p) => p.stock === 0);
    if (filter === 'low') list = list.filter((p) => p.stock > 0 && p.stock <= (p.lowStockThreshold || 10));
    return list;
  }, [allProducts, search, filter]);

  // Stock editing
  function getStock(p) {
    return editingStock[p._id] !== undefined ? editingStock[p._id] : p.stock;
  }
  function setStock(id, val) {
    const num = Math.max(0, parseInt(val) || 0);
    setEditingStock((e) => ({ ...e, [id]: num }));
  }
  function adjustStock(p, delta) {
    const current = getStock(p);
    setStock(p._id, current + delta);
  }
  function resetStock(id) {
    setEditingStock((e) => { const n = { ...e }; delete n[id]; return n; });
  }
  function isDirty(p) {
    return editingStock[p._id] !== undefined && editingStock[p._id] !== p.stock;
  }

  async function saveStock(p) {
    const newStock = editingStock[p._id];
    if (newStock === undefined) return;
    setSaving((s) => ({ ...s, [p._id]: true }));
    try {
      await api.put(`/vendors/inventory/${p._id}`, { stock: newStock });
      toast.success(`Stock updated to ${newStock}`);
      setEditingStock((e) => { const n = { ...e }; delete n[p._id]; return n; });
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update');
    } finally {
      setSaving((s) => { const n = { ...s }; delete n[p._id]; return n; });
    }
  }

  const needsAttention = stats.outOfStock + stats.lowStock;
  const hasDirty = Object.keys(editingStock).length > 0;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-secondary-900">Inventory Management</h1>
        <button onClick={() => setRev((r) => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'Total Products', value: stats.total,
            icon: LayoutList, color: 'text-blue-600', bg: 'bg-blue-50',
            onClick: () => setFilter('all'),
          },
          {
            label: 'Out of Stock', value: stats.outOfStock,
            icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50',
            onClick: () => setFilter('out'), urgent: stats.outOfStock > 0,
          },
          {
            label: 'Low Stock', value: stats.lowStock,
            icon: TrendingDown, color: 'text-orange-500', bg: 'bg-orange-50',
            onClick: () => setFilter('low'), urgent: stats.lowStock > 0,
          },
          {
            label: 'Total Units', value: stats.totalUnits.toLocaleString('en-IN'),
            icon: Boxes, color: 'text-purple-600', bg: 'bg-purple-50',
          },
          {
            label: 'Inventory Value', value: formatCurrency(stats.inventoryValue),
            icon: IndianRupee, color: 'text-green-600', bg: 'bg-green-50',
            valueClass: 'text-green-700 text-sm font-black',
          },
        ].map(({ label, value, icon: Icon, color, bg, onClick, urgent, valueClass }) => (
          <div key={label}
            onClick={onClick}
            className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${
              onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''
            } ${urgent ? 'border-red-200' : 'border-secondary-200'}`}>
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div className="min-w-0">
              <p className={`text-xl font-black leading-tight truncate ${valueClass || 'text-secondary-900'}`}>{value}</p>
              <p className="text-xs text-secondary-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alert banner */}
      {needsAttention > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              <strong>{needsAttention} product{needsAttention !== 1 ? 's' : ''} need attention:</strong>{' '}
              {stats.outOfStock > 0 && `${stats.outOfStock} out of stock`}
              {stats.outOfStock > 0 && stats.lowStock > 0 && ', '}
              {stats.lowStock > 0 && `${stats.lowStock} low stock`}
            </p>
          </div>
          <button onClick={() => setFilter('out')}
            className="text-xs font-bold text-amber-700 hover:text-amber-900 px-3 py-1 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors whitespace-nowrap">
            View Items →
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            placeholder="Search by product name or SKU…"
            className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
        <div className="flex items-center bg-secondary-100 rounded-xl p-1 gap-0.5">
          {[
            { id: 'all', label: 'All' },
            { id: 'low', label: 'Low Stock' },
            { id: 'out', label: 'Out of Stock' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white shadow text-secondary-900'
                  : 'text-secondary-500 hover:text-secondary-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Showing count */}
      {!isLoading && (
        <p className="text-sm text-secondary-500">
          Showing {filtered.length} of {allProducts.length} products
          {hasDirty && <span className="ml-2 text-amber-600 font-medium">· {Object.keys(editingStock).length} unsaved change(s)</span>}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-secondary-200 rounded-xl p-14 text-center">
          <Package size={40} className="mx-auto text-secondary-300 mb-3" />
          <p className="text-secondary-500 font-medium">No products found</p>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="hidden lg:block bg-white rounded-xl border border-secondary-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary-50 border-b border-secondary-200">
                  {['Product', 'SKU', 'Status', 'Low Stock Alert', 'Current Stock', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {filtered.map((p) => {
                  const dirty   = isDirty(p);
                  const current = getStock(p);
                  const isSaving = saving[p._id];

                  return (
                    <tr key={p._id} className={`transition-colors ${dirty ? 'bg-blue-50' : 'hover:bg-secondary-50'}`}>
                      {/* Product */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.images?.[0] ? (
                            <img src={normalizeImageUrl(p.images[0])} alt={p.title}
                              className="w-9 h-9 rounded-lg object-cover bg-secondary-100 shrink-0"
                              onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0">
                              <Package size={13} className="text-secondary-300" />
                            </div>
                          )}
                          <p className="font-medium text-secondary-900 line-clamp-1 max-w-xs">{p.title}</p>
                        </div>
                      </td>
                      {/* SKU */}
                      <td className="px-4 py-3 font-mono text-xs text-secondary-400">{p.sku || '—'}</td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge stock={current} threshold={p.lowStockThreshold} />
                      </td>
                      {/* Low stock alert */}
                      <td className="px-4 py-3 text-sm text-secondary-500">
                        {p.lowStockThreshold || 10} units
                      </td>
                      {/* Stock controls */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => adjustStock(p, -10)}
                            className="text-xs text-secondary-400 hover:text-red-500 px-1.5 py-1 hover:bg-red-50 rounded transition-colors font-mono">
                            -10
                          </button>
                          <button onClick={() => adjustStock(p, -1)}
                            className="w-7 h-7 flex items-center justify-center bg-secondary-100 hover:bg-red-100 text-secondary-600 hover:text-red-600 rounded-lg text-sm font-bold transition-colors">
                            −
                          </button>
                          <input
                            type="number" min="0"
                            value={current}
                            onChange={(ev) => setStock(p._id, ev.target.value)}
                            onKeyDown={(ev) => ev.key === 'Enter' && dirty && saveStock(p)}
                            className={`w-16 text-center border rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-300 ${
                              dirty ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-secondary-200'
                            }`}
                          />
                          <button onClick={() => adjustStock(p, 1)}
                            className="w-7 h-7 flex items-center justify-center bg-secondary-100 hover:bg-green-100 text-secondary-600 hover:text-green-600 rounded-lg text-sm font-bold transition-colors">
                            +
                          </button>
                          <button onClick={() => adjustStock(p, 10)}
                            className="text-xs text-secondary-400 hover:text-green-600 px-1.5 py-1 hover:bg-green-50 rounded transition-colors font-mono">
                            +10
                          </button>
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {dirty ? (
                            <>
                              <button onClick={() => saveStock(p)} disabled={isSaving}
                                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                                {isSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button onClick={() => resetStock(p._id)} disabled={isSaving}
                                className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-lg transition-colors" title="Reset">
                                <RotateCcw size={13} />
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-secondary-300">No changes</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="block lg:hidden space-y-3">
            {filtered.map((p) => {
              const dirty   = isDirty(p);
              const current = getStock(p);
              const isSaving = saving[p._id];

              return (
                <div key={p._id}
                  className={`bg-white border rounded-xl p-4 transition-colors ${dirty ? 'border-blue-300 bg-blue-50/30' : 'border-secondary-200'}`}>
                  {/* Product info */}
                  <div className="flex items-center gap-3 mb-3">
                    {p.images?.[0] ? (
                      <img src={normalizeImageUrl(p.images[0])} alt={p.title}
                        className="w-11 h-11 rounded-lg object-cover bg-secondary-100 shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0">
                        <Package size={15} className="text-secondary-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-secondary-900 line-clamp-1">{p.title}</p>
                      <p className="text-xs font-mono text-secondary-400 mt-0.5">{p.sku || '—'}</p>
                    </div>
                    <StatusBadge stock={current} threshold={p.lowStockThreshold} />
                  </div>

                  {/* Stock controls */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => adjustStock(p, -1)}
                      className="w-9 h-9 flex items-center justify-center bg-secondary-100 hover:bg-red-100 text-secondary-600 hover:text-red-600 rounded-xl text-lg font-bold transition-colors">
                      −
                    </button>
                    <input
                      type="number" min="0"
                      value={current}
                      onChange={(ev) => setStock(p._id, ev.target.value)}
                      className={`flex-1 text-center border rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-300 ${
                        dirty ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-secondary-200'
                      }`}
                    />
                    <button onClick={() => adjustStock(p, 1)}
                      className="w-9 h-9 flex items-center justify-center bg-secondary-100 hover:bg-green-100 text-secondary-600 hover:text-green-600 rounded-xl text-lg font-bold transition-colors">
                      +
                    </button>
                    {dirty && (
                      <>
                        <button onClick={() => saveStock(p)} disabled={isSaving}
                          className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                          {isSaving ? '…' : 'Save'}
                        </button>
                        <button onClick={() => resetStock(p._id)} disabled={isSaving}
                          className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-xl transition-colors">
                          <RotateCcw size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-secondary-400 mt-1.5">Alert threshold: {p.lowStockThreshold || 10} units</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
