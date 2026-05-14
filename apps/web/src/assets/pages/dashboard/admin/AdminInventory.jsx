import { useState } from 'react';
import { Search, AlertTriangle, Package } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

export default function AdminInventory() {
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-inventory', search, lowStock, page, rev],
    () => api.get('/admin/inventory', { params: { search: search || undefined, lowStock: lowStock || undefined, page, limit: 30 } }).then((r) => r.data)
  );

  const products = data?.products || [];
  const pagination = data?.pagination || {};

  async function saveStock(id, value) {
    setSaving((s) => ({ ...s, [id]: true }));
    try {
      await api.patch(`/admin/inventory/${id}/stock`, { stock: parseInt(value) });
      toast.success('Stock updated');
      setEditing((e) => { const n = { ...e }; delete n[id]; return n; });
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update stock');
    } finally {
      setSaving((s) => { const n = { ...s }; delete n[id]; return n; });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Manage product stock levels</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
            <input
              className="input pl-8 pr-3 py-2 text-sm w-52"
              placeholder="Search title or SKU…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button
            onClick={() => { setLowStock((v) => !v); setPage(1); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${lowStock ? 'bg-red-100 border-red-200 text-red-700' : 'border-secondary-200 text-secondary-600 hover:bg-secondary-50'}`}
          >
            <AlertTriangle size={14} />
            Low Stock {lowStock ? '(on)' : ''}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : products.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-center">Stock</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {products.map((p) => {
                const isEditing = id => editing[id] !== undefined;
                const stockVal = editing[p._id] !== undefined ? editing[p._id] : p.stock;
                const isLow = p.stock <= 10;
                return (
                  <tr key={p._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded bg-secondary-100 flex items-center justify-center shrink-0">
                            <Package size={14} className="text-secondary-400" />
                          </div>
                        )}
                        <span className="font-medium line-clamp-1">{p.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-secondary-500">{p.sku || '—'}</td>
                    <td className="px-4 py-3 text-secondary-600 capitalize">{p.category || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{(p.price || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      {editing[p._id] !== undefined ? (
                        <input
                          type="number"
                          min="0"
                          className="input w-20 text-center py-1 text-sm"
                          value={editing[p._id]}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [p._id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && saveStock(p._id, editing[p._id])}
                          autoFocus
                        />
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-xs cursor-pointer ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
                          title="Click to edit"
                          onClick={() => setEditing((prev) => ({ ...prev, [p._id]: String(p.stock) }))}
                        >
                          {p.stock}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editing[p._id] !== undefined ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => saveStock(p._id, editing[p._id])}
                            disabled={saving[p._id]}
                            className="btn-primary py-1 px-3 text-xs"
                          >
                            {saving[p._id] ? <Spinner size="xs" /> : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditing((e) => { const n = { ...e }; delete n[p._id]; return n; })}
                            className="px-3 py-1 text-xs rounded border border-secondary-200 hover:bg-secondary-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditing((prev) => ({ ...prev, [p._id]: String(p.stock) }))}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex items-center justify-between text-sm text-secondary-500">
              <span>Page {pagination.page} of {pagination.pages} · {pagination.total} products</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
