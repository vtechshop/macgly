import { useState } from 'react';
import {
  Star, RefreshCw, Download, MessageSquare, CheckCircle2, ShieldCheck,
  TrendingUp, Search, X, Trash2, Check, Ban, Eye, Send, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatDate } from '../../../../utils/format';
import { useFetch, useAction } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size}
          className={i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-secondary-200 fill-secondary-200'} />
      ))}
    </div>
  );
}

function RatingBar({ star, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const color = star >= 4 ? 'bg-green-400' : star === 3 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-8 shrink-0">{star} star</span>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-4 text-right shrink-0">{count}</span>
    </div>
  );
}

const STATUS_STYLES = {
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
};

const RESPONSE_TEMPLATES = [
  { id: 'thanks', label: 'Thank You', text: 'Thank you for taking the time to leave a review! We really appreciate your feedback and are glad you had a positive experience with us.' },
  { id: 'sorry', label: 'Apology', text: 'We sincerely apologize for the experience you had. This does not reflect our standard of service and we would love the opportunity to make it right.' },
  { id: 'contact', label: 'Contact Us', text: 'Thank you for your feedback. Please contact our support team at support@vtechkitchen.com so we can resolve this for you as quickly as possible.' },
  { id: 'resolved', label: 'Issue Resolved', text: 'We appreciate your patience while we addressed your concern. The issue has been resolved and we hope to serve you better going forward.' },
];

// ─── Review Detail Modal ───────────────────────────────────────────────────────

function ReviewModal({ review: initialReview, onClose, onRefresh }) {
  const [review, setReview] = useState(initialReview);
  const [responseText, setResponseText] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function updateStatus(status, reason) {
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/reviews/${review._id}/status`, {
        status,
        ...(reason ? { rejectionReason: reason } : {}),
      });
      setReview(data.review);
      toast.success(status === 'approved' ? 'Review approved' : 'Review rejected');
      setRejecting(false);
      onRefresh();
    } catch {
      toast.error('Failed to update status');
    } finally { setSaving(false); }
  }

  async function submitResponse() {
    if (responseText.trim().length < 10) {
      toast.error('Response must be at least 10 characters');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/reviews/${review._id}/respond`, { text: responseText });
      setReview(data.review);
      setResponseText('');
      toast.success('Response submitted');
      onRefresh();
    } catch {
      toast.error('Failed to submit response');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this review permanently?')) return;
    setSaving(true);
    try {
      await api.delete(`/admin/reviews/${review._id}`);
      toast.success('Review deleted');
      onRefresh();
      onClose();
    } catch {
      toast.error('Failed to delete review');
    } finally { setSaving(false); }
  }

  const shortId = review._id?.slice(-8) || '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100 shrink-0">
          <h3 className="font-bold text-secondary-900">Review Details <span className="text-secondary-400 font-mono text-sm">#{shortId}</span></h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Status + rating */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[review.status] || 'bg-secondary-100 text-secondary-600'}`}>
              {review.status}
            </span>
            {review.verified && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                <ShieldCheck size={11} /> Verified Purchase
              </span>
            )}
            <div className="ml-auto">
              <Stars rating={review.rating} size={20} />
            </div>
          </div>

          {/* Product */}
          {review.product && (
            <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-xl border border-secondary-100">
              {review.product.images?.[0] && (
                <img src={review.product.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              )}
              <div>
                <p className="font-semibold text-sm text-secondary-900">{review.product.title}</p>
                {review.product.slug && <p className="text-xs text-secondary-400">{review.product.slug}</p>}
              </div>
            </div>
          )}

          {/* Customer */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-secondary-900">{review.user?.name || '—'}</p>
              <p className="text-xs text-secondary-400">{review.user?.email}</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-secondary-500">
              <span className="flex items-center gap-1"><ThumbsUp size={13} className="text-green-500" /> {review.helpfulCount || 0}</span>
              <span className="flex items-center gap-1"><ThumbsDown size={13} className="text-red-400" /> {review.unhelpfulCount || 0}</span>
            </div>
          </div>

          {/* Review title */}
          {review.title && (
            <p className="font-semibold text-secondary-800">"{review.title}"</p>
          )}

          {/* Comment */}
          {(review.body || review.comment) && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm text-secondary-700 whitespace-pre-wrap">{review.body || review.comment}</p>
            </div>
          )}

          {/* Customer images */}
          {review.images?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">Customer Photos</p>
              <div className="flex gap-2 flex-wrap">
                {review.images.map((img, i) => (
                  <a key={i} href={img} target="_blank" rel="noreferrer">
                    <img src={img} alt="" className="w-16 h-16 rounded-lg object-cover border border-secondary-200 hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Rejection reason */}
          {review.status === 'rejected' && review.rejectionReason && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-xs font-semibold text-red-600 mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{review.rejectionReason}</p>
            </div>
          )}

          {/* Inline rejection reason input */}
          {rejecting && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <p className="text-sm font-semibold text-amber-800">Provide a rejection reason (optional)</p>
              <textarea
                className="input w-full h-20 resize-none text-sm"
                placeholder="Why is this review being rejected?"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => updateStatus('rejected', rejectionReason)}
                  disabled={saving}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => { setRejecting(false); setRejectionReason(''); }}
                  className="px-4 py-2 border border-secondary-200 rounded-lg text-sm font-medium hover:bg-secondary-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Admin response */}
          {review.vendorResponse?.text ? (
            <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
              <p className="text-xs font-semibold text-green-700 mb-1">
                Admin Response · {review.vendorResponse.respondedAt ? formatDate(review.vendorResponse.respondedAt) : ''}
              </p>
              <p className="text-sm text-green-800 whitespace-pre-wrap">{review.vendorResponse.text}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Add Public Response</p>
              <div className="flex gap-2 flex-wrap">
                {RESPONSE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setResponseText(t.text)}
                    className="px-3 py-1.5 text-xs font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                className="input w-full h-24 resize-none text-sm"
                placeholder="Write a public response to this review… (min 10 characters)"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
              />
              <button
                onClick={submitResponse}
                disabled={saving || responseText.trim().length < 10}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                <Send size={13} /> Submit Response
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-secondary-100 shrink-0">
          {review.status === 'pending' && (
            <>
              <button
                onClick={() => updateStatus('approved')}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                <Check size={14} /> Approve
              </button>
              <button
                onClick={() => setRejecting(true)}
                disabled={saving || rejecting}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                <Ban size={14} /> Reject
              </button>
            </>
          )}
          <div className="flex-1" />
          <button
            onClick={handleDelete}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminReviews() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [rev, setRev] = useState(0);
  const [viewingReview, setViewingReview] = useState(null);

  const { data: statsData } = useFetch(
    ['admin-reviews-stats', rev],
    () => api.get('/admin/reviews/stats').then((r) => r.data),
  );

  const { data, isLoading } = useFetch(
    ['admin-reviews', page, statusFilter, ratingFilter, verifiedFilter, search, rev],
    () => api.get('/admin/reviews', {
      params: {
        page,
        limit: 20,
        status: statusFilter || undefined,
        rating: ratingFilter || undefined,
        verified: verifiedFilter || undefined,
        search: search || undefined,
      },
    }).then((r) => r.data),
  );

  const { mutate: updateStatus } = useAction(
    ({ id, status }) => api.put(`/admin/reviews/${id}/status`, { status }),
    {
      onSuccess: (_, { status }) => {
        toast.success(status === 'approved' ? 'Approved' : 'Rejected');
        refresh();
      },
      onError: () => toast.error('Failed'),
    },
  );

  const { mutate: deleteReview } = useAction(
    (id) => api.delete(`/admin/reviews/${id}`),
    {
      onSuccess: (_, id) => {
        toast.success('Review deleted');
        setSelected((s) => s.filter((x) => x !== id));
        refresh();
      },
      onError: () => toast.error('Failed to delete'),
    },
  );

  const { mutate: bulkUpdate, isLoading: bulkLoading } = useAction(
    ({ ids, status }) => api.post('/admin/reviews/bulk-update', { ids, status }),
    {
      onSuccess: (_, { status }) => {
        setSelected([]);
        toast.success(status === 'delete' ? 'Reviews deleted' : `Reviews ${status}`);
        refresh();
      },
      onError: () => toast.error('Bulk action failed'),
    },
  );

  function refresh() { setRev((r) => r + 1); }

  const stats = statsData || {};
  const reviews = data?.reviews || [];
  const pagination = data?.pagination;
  const totalPages = Math.ceil((pagination?.total || 0) / (pagination?.limit || 20));
  const maxDist = Math.max(...[5, 4, 3, 2, 1].map((s) => stats.ratingDist?.[s] || 0), 1);
  const hasFilters = statusFilter || ratingFilter || verifiedFilter || search;

  function toggleSelect(id) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }
  function toggleAll() {
    setSelected((s) => s.length === reviews.length ? [] : reviews.map((r) => r._id));
  }

  function exportCSV() {
    if (!reviews.length) return;
    const rows = [['Date', 'Product', 'Customer', 'Rating', 'Comment', 'Status', 'Verified', 'Helpful']];
    reviews.forEach((r) => rows.push([
      new Date(r.createdAt).toLocaleDateString(),
      r.product?.title || '',
      r.user?.name || '',
      r.rating,
      (r.body || r.comment || '').slice(0, 100),
      r.status,
      r.verified ? 'Yes' : 'No',
      r.helpfulCount || 0,
    ]));
    const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
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
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats row */}
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
              { label: 'Response Rate', value: `${stats.responseRate ?? 0}%`, color: 'text-green-600' },
              { label: 'Helpful Votes', value: stats.totalHelpful ?? 0, color: 'text-secondary-800' },
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
        <select className="input w-32 text-sm" value={ratingFilter} onChange={(e) => { setRatingFilter(e.target.value); setPage(1); }}>
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} Stars</option>)}
        </select>
        <select className="input w-36 text-sm" value={verifiedFilter} onChange={(e) => { setVerifiedFilter(e.target.value); setPage(1); }}>
          <option value="">All Reviews</option>
          <option value="true">Verified Only</option>
          <option value="false">Unverified</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setStatusFilter(''); setRatingFilter(''); setVerifiedFilter(''); setSearch(''); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 text-secondary-600"
          >
            <X size={13} /> Clear Filters
          </button>
        )}
      </div>

      {/* Bulk actions bar */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-semibold text-blue-700">{selected.length} selected</span>
          <div className="h-4 w-px bg-blue-200" />
          <button
            onClick={() => bulkUpdate({ ids: selected, status: 'approved' })}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50"
          >
            <Check size={12} /> Approve All
          </button>
          <button
            onClick={() => bulkUpdate({ ids: selected, status: 'rejected' })}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50"
          >
            <Ban size={12} /> Reject All
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete ${selected.length} reviews permanently?`)) {
                bulkUpdate({ ids: selected, status: 'delete' });
              }
            }}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50"
          >
            <Trash2 size={12} /> Delete All
          </button>
          <button
            onClick={() => setSelected([])}
            className="ml-auto text-xs text-secondary-500 hover:text-secondary-700"
          >
            Clear selection
          </button>
        </div>
      )}

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
                    <input
                      type="checkbox"
                      className="rounded border-secondary-600 bg-transparent"
                      checked={reviews.length > 0 && selected.length === reviews.length}
                      onChange={toggleAll}
                    />
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
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-secondary-400">No reviews found</td>
                  </tr>
                ) : reviews.map((r) => (
                  <tr
                    key={r._id}
                    className={`hover:bg-secondary-50 transition-colors ${selected.includes(r._id) ? 'bg-blue-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-secondary-300"
                        checked={selected.includes(r._id)}
                        onChange={() => toggleSelect(r._id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.product?.images?.[0] && (
                          <img
                            src={r.product.images[0]}
                            alt=""
                            className="w-8 h-8 rounded object-cover bg-secondary-100 shrink-0"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        <p className="text-xs font-medium text-secondary-800 line-clamp-2 max-w-[140px]">
                          {r.product?.title || <span className="text-secondary-400 italic">Deleted product</span>}
                        </p>
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
                      <p className="text-xs text-secondary-500 line-clamp-2">
                        {(r.body || r.comment) || <span className="italic text-secondary-300">No comment</span>}
                      </p>
                      {r.vendorResponse?.text && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                          <MessageSquare size={9} /> Responded
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[r.status] || 'bg-secondary-100 text-secondary-600'}`}>
                        {r.status}
                      </span>
                      {r.verified && (
                        <span className="ml-1 text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold">
                          Verified
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-secondary-400 text-xs">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingReview(r)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        {r.status === 'pending' && (
                          <button
                            onClick={() => updateStatus({ id: r._id, status: 'approved' })}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-green-500 hover:bg-green-50 transition-colors"
                            title="Approve"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        {r.status === 'pending' && (
                          <button
                            onClick={() => setViewingReview(r)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
                            title="Reject"
                          >
                            <Ban size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => { if (window.confirm('Delete this review?')) deleteReview(r._id); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
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
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40"
                >
                  ← Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i + 1
                    : page <= 4 ? i + 1
                    : page >= totalPages - 3 ? totalPages - 6 + i
                    : page - 3 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100'}`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review detail modal */}
      {viewingReview && (
        <ReviewModal
          review={viewingReview}
          onClose={() => setViewingReview(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
