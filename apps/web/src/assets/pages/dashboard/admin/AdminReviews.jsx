import { useState } from 'react';
import {
  Star, RefreshCw, Download, MessageSquare, CheckCircle2,
  ShieldCheck, TrendingUp, Search, X, Trash2, Check, Ban, PenLine,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatDate } from '../../../../utils/format';
import { useFetch, useAction } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button"
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
        >
          <Star size={22} className={n <= (hover || value) ? 'fill-yellow-400 text-yellow-400' : 'text-secondary-200'} />
        </button>
      ))}
    </div>
  );
}

function WriteReviewModal({ onClose, onSuccess }) {
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function searchProducts(q) {
    if (!q.trim()) { setProducts([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get('/products', { params: { search: q, limit: 8 } });
      setProducts(data.products || []);
    } catch { setProducts([]); }
    finally { setSearching(false); }
  }

  async function selectProduct(p) {
    setSelectedProduct(p);
    setProducts([]);
    setAlreadyReviewed(false);
    try {
      const { data } = await api.get(`/reviews/product/${p._id}`);
      setAlreadyReviewed(!!data.hasReviewed);
    } catch { /* ignore */ }
  }

  async function handleSubmit() {
    if (!selectedProduct) { toast.error('Select a product'); return; }
    if (!rating) { toast.error('Select a rating'); return; }
    setSubmitting(true);
    try {
      await api.post('/reviews', { productId: selectedProduct._id, rating, title, body });
      toast.success('Review submitted');
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to submit';
      toast.error(msg);
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <h3 className="font-bold text-secondary-900">Write a Review (Admin)</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Product search */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">Search Product</label>
            {selectedProduct ? (
              <div>
                <div className="flex items-center gap-3 bg-secondary-50 rounded-xl p-3 border border-secondary-200">
                  {selectedProduct.images?.[0] && <img src={selectedProduct.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{selectedProduct.title}</p>
                    <p className="text-xs text-secondary-400">{selectedProduct.sku}</p>
                  </div>
                  <button onClick={() => { setSelectedProduct(null); setProductSearch(''); setAlreadyReviewed(false); }} className="text-secondary-400 hover:text-secondary-600"><X size={14} /></button>
                </div>
                {alreadyReviewed && (
                  <p className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    You already have a review for this product. Delete the existing one to submit a new one.
                  </p>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                <input
                  className="input pl-8 w-full"
                  placeholder="Type product name..."
                  value={productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); searchProducts(e.target.value); }}
                />
                {products.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-secondary-200 rounded-xl shadow-lg mt-1 z-10 max-h-48 overflow-y-auto">
                    {products.map((p) => (
                      <button key={p._id} onClick={() => selectProduct(p)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary-50 text-left">
                        {p.images?.[0] && <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.title}</p>
                          <p className="text-xs text-secondary-400">₹{p.price}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searching && <p className="text-xs text-secondary-400 mt-1">Searching...</p>}
              </div>
            )}
          </div>

          {!alreadyReviewed && (
            <>
              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1.5">Rating *</label>
                <StarPicker value={rating} onChange={setRating} />
              </div>

              {/* Title + Body */}
              <input className="input w-full" placeholder="Review title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="input w-full h-24 resize-none" placeholder="Write your review..." value={body} onChange={(e) => setBody(e.target.value)} />
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-secondary-200 rounded-xl text-sm font-semibold hover:bg-secondary-50">Cancel</button>
            {!alreadyReviewed && (
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Review'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLES = {
  approved: 'bg-green-100 text-green-700',
  pending:  'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
};

function Stars({ rating, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-secondary-200 fill-secondary-200'} />
      ))}
    </div>
  );
}

function RatingBar({ star, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-8 shrink-0">{star} star</span>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-4 text-right shrink-0">{count}</span>
    </div>
  );
}

export default function AdminReviews() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [rev, setRev] = useState(0);
  const [showWriteModal, setShowWriteModal] = useState(false);

  const { data, isLoading } = useFetch(
    ['admin-reviews', page, statusFilter, ratingFilter, search, rev],
    () => api.get('/admin/reviews', {
      params: { page, limit: 20, status: statusFilter || undefined, rating: ratingFilter || undefined, search: search || undefined },
    }).then((r) => r.data)
  );

  const { mutate: updateReview } = useAction(
    ({ id, ...body }) => api.put(`/admin/reviews/${id}`, body),
    { onSuccess: () => setRev((r) => r + 1), onError: () => toast.error('Failed') }
  );
  const { mutate: deleteReview } = useAction(
    (id) => api.delete(`/admin/reviews/${id}`),
    { onSuccess: () => { toast.success('Review deleted'); setRev((r) => r + 1); setSelected((s) => s.filter((x) => x !== id)); }, onError: () => toast.error('Failed') }
  );

  const reviews = data?.reviews || [];
  const stats = data?.stats || {};
  const pagination = data?.pagination;
  const totalPages = Math.ceil((pagination?.total || 0) / (pagination?.limit || 20));
  const maxDist = Math.max(...[5, 4, 3, 2, 1].map((s) => stats.ratingDist?.[s] || 0), 1);

  function toggleSelect(id) { setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]); }
  function toggleAll() { setSelected((s) => s.length === reviews.length ? [] : reviews.map((r) => r._id)); }

  function exportCSV() {
    if (!reviews.length) return;
    const rows = [['Product', 'Customer', 'Rating', 'Title', 'Comment', 'Status', 'Date']];
    reviews.forEach((r) => rows.push([r.product?.title || '', r.user?.name || '', r.rating, r.title || '', r.body || '', r.status, new Date(r.createdAt).toLocaleDateString()]));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Product Reviews</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Manage and moderate customer reviews</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRev((r) => r + 1)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowWriteModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50">
            <PenLine size={14} /> Write Review
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Top row: Rating Overview + stat cards + insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rating Overview dark card */}
        <div className="rounded-2xl bg-[#0f1117] text-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Rating Overview</h2>
            <TrendingUp size={18} className="text-gray-500" />
          </div>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-4xl font-black">{stats.avgRating || '—'}</span>
            <div>
              <Stars rating={Math.round(stats.avgRating || 0)} size={18} />
              <p className="text-xs text-gray-400 mt-1">{stats.total || 0} total reviews</p>
            </div>
          </div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((s) => (
              <RatingBar key={s} star={s} count={stats.ratingDist?.[s] || 0} max={maxDist} />
            ))}
          </div>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Reviews', value: stats.total ?? 0, icon: MessageSquare, iconBg: 'bg-blue-50 text-blue-500' },
            { label: 'Pending', value: stats.pending ?? 0, icon: RefreshCw, iconBg: 'bg-yellow-50 text-yellow-500', valueColor: stats.pending > 0 ? 'text-yellow-600' : '' },
            { label: 'Approved', value: stats.approved ?? 0, icon: CheckCircle2, iconBg: 'bg-green-50 text-green-500', valueColor: 'text-green-600' },
            { label: 'Verified', value: stats.verified ?? 0, icon: ShieldCheck, iconBg: 'bg-purple-50 text-purple-500', valueColor: 'text-purple-600' },
          ].map((s) => (
            <div key={s.label} className="card p-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-secondary-500 mb-2">{s.label}</p>
                <p className={`text-2xl font-black ${s.valueColor || 'text-secondary-900'}`}>{s.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                <s.icon size={17} />
              </div>
            </div>
          ))}
        </div>

        {/* Review Insights */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-blue-500" />
            <h2 className="font-bold text-secondary-800">Review Insights</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Response Rate', value: '0%', color: 'text-green-600' },
              { label: 'Helpful Votes', value: 0, color: 'text-secondary-800' },
              { label: 'This Week', value: stats.thisWeek ?? 0, color: 'text-blue-600' },
              { label: 'Positive (4-5 stars)', value: `${stats.positiveRate ?? 0}%`, color: 'text-green-600' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <span className="text-secondary-500">{r.label}</span>
                <span className={`font-bold ${r.color}`}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-8 text-sm w-full"
            placeholder="Search by product, customer, or comment..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input w-36 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="input w-36 text-sm" value={ratingFilter} onChange={(e) => { setRatingFilter(e.target.value); setPage(1); }}>
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} Stars</option>)}
        </select>
        {(statusFilter || ratingFilter || search) && (
          <button onClick={() => { setStatusFilter(''); setRatingFilter(''); setSearch(''); setPage(1); }} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 text-secondary-600">
            <X size={13} /> Clear Filters
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
                <tr className="bg-secondary-900 text-white">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="rounded border-secondary-600 bg-transparent" checked={reviews.length > 0 && selected.length === reviews.length} onChange={toggleAll} />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Rating</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Comment</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {!reviews.length ? (
                  <tr><td colSpan={8} className="text-center py-12 text-secondary-400">No reviews found</td></tr>
                ) : reviews.map((r) => (
                  <tr key={r._id} className={`hover:bg-secondary-50 transition-colors ${selected.includes(r._id) ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-secondary-300" checked={selected.includes(r._id)} onChange={() => toggleSelect(r._id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.product?.images?.[0] && (
                          <img src={r.product.images[0]} alt="" className="w-8 h-8 rounded object-cover bg-secondary-100 shrink-0" onError={(e) => e.target.style.display='none'} />
                        )}
                        <p className="text-xs font-medium text-secondary-800 line-clamp-2 max-w-[140px]">{r.product?.title || '—'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-secondary-900 text-xs">{r.user?.name || '—'}</p>
                      <p className="text-[11px] text-secondary-400">{r.user?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Stars rating={r.rating} size={13} />
                      <span className="text-xs text-secondary-400 mt-0.5 block">{r.rating}/5</span>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      {r.title && <p className="text-xs font-semibold text-secondary-800 mb-0.5">{r.title}</p>}
                      <p className="text-xs text-secondary-500 line-clamp-2">{r.body || <span className="italic text-secondary-300">No comment</span>}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[r.status] || 'bg-secondary-100 text-secondary-600'}`}>
                        {r.status}
                      </span>
                      {r.verified && <span className="ml-1 text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold">Verified</span>}
                    </td>
                    <td className="px-4 py-3 text-secondary-400 text-xs">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {r.status !== 'approved' && (
                          <button onClick={() => { updateReview({ id: r._id, status: 'approved' }); toast.success('Approved'); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-green-500 hover:bg-green-50 transition-colors" title="Approve">
                            <Check size={14} />
                          </button>
                        )}
                        {r.status !== 'rejected' && (
                          <button onClick={() => { updateReview({ id: r._id, status: 'rejected' }); toast.success('Rejected'); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 transition-colors" title="Reject">
                            <Ban size={14} />
                          </button>
                        )}
                        <button onClick={() => { if (window.confirm('Delete this review?')) deleteReview(r._id); }} className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
              <span className="text-xs text-secondary-500">Page {page} of {totalPages} · {pagination?.total} reviews</span>
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

      {showWriteModal && (
        <WriteReviewModal
          onClose={() => setShowWriteModal(false)}
          onSuccess={() => setRev((r) => r + 1)}
        />
      )}
    </div>
  );
}
