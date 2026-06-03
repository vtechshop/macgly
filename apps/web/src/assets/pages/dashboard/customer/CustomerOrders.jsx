import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Package, Clock, Truck, CheckCircle, XCircle,
  Search, RefreshCw, RotateCcw, Eye, ShoppingBag,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import { useFetch, invalidateCache } from '../../../../hooks';
import { canReorder, reorderItems } from '../../../../utils/reorder';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Config ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: '',          label: 'All Orders', icon: ShoppingBag },
  { key: 'placed',    label: 'Placed',     icon: Clock },
  { key: 'shipped',   label: 'Shipped',    icon: Truck },
  { key: 'delivered', label: 'Delivered',  icon: CheckCircle },
  { key: 'cancelled', label: 'Cancelled',  icon: XCircle },
];

const STATUS_CFG = {
  pending:          { label: 'Pending',          headerBg: 'bg-yellow-50',  badge: 'bg-yellow-100 text-yellow-700' },
  pending_payment:  { label: 'Pending Payment',  headerBg: 'bg-yellow-50',  badge: 'bg-yellow-100 text-yellow-700' },
  placed:           { label: 'Placed',           headerBg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700' },
  paid:             { label: 'Paid',             headerBg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700' },
  confirmed:        { label: 'Confirmed',        headerBg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700' },
  processing:       { label: 'Processing',       headerBg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700' },
  packed:           { label: 'Packed',           headerBg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700' },
  shipped:          { label: 'Shipped',          headerBg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-600' },
  out_for_delivery: { label: 'Out for Delivery', headerBg: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-600' },
  delivered:        { label: 'Delivered',        headerBg: 'bg-green-50',   badge: 'bg-green-100 text-green-700' },
  cancelled:        { label: 'Cancelled',        headerBg: 'bg-red-50',     badge: 'bg-red-100 text-red-700' },
  returned:         { label: 'Returned',         headerBg: 'bg-secondary-50', badge: 'bg-secondary-100 text-secondary-600' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

function OrderCard({ order, onReorder, reordering }) {
  const cfg   = STATUS_CFG[order.status] || STATUS_CFG.placed;
  const items = order.items || [];
  const shown = items.slice(0, 2);
  const extra = items.length - shown.length;
  const hasAwb = !!order.shipment?.awb;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-5 py-3 border-b border-secondary-100 ${cfg.headerBg}`}>
        <div>
          <p className="text-sm font-mono font-semibold text-secondary-800">{order.orderId}</p>
          <p className="text-xs text-secondary-500 mt-0.5">Placed on {fmtDate(order.createdAt)}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      {/* Items */}
      <div className="px-5 py-4 space-y-3">
        {shown.map((item, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg border border-secondary-100 bg-secondary-50 overflow-hidden flex items-center justify-center shrink-0">
              {item.image
                ? <img src={normalizeImageUrl(item.image)} alt={item.title} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                : <Package size={18} className="text-secondary-300" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">{item.title}</p>
              <p className="text-xs text-secondary-400 mt-0.5">Qty: {item.quantity}</p>
              <p className="text-sm font-semibold text-secondary-800 mt-0.5">
                {formatCurrency((item.price || 0) * item.quantity)}
              </p>
            </div>
          </div>
        ))}
        {extra > 0 && (
          <p className="text-xs text-secondary-400 pl-18">+{extra} more item{extra > 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-secondary-50 border-t border-secondary-100 flex-wrap">
        <div>
          <p className="text-xs text-secondary-400">Total Amount</p>
          <p className="text-base font-bold text-secondary-900">{formatCurrency(order.totalAmount)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canReorder(order) && (
            <button
              onClick={() => onReorder(order)}
              disabled={reordering}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-secondary-300 text-secondary-700 hover:bg-white transition-colors disabled:opacity-50"
            >
              {reordering ? <Spinner size="sm" /> : <RotateCcw size={13} />}
              Reorder
            </button>
          )}
          {hasAwb && (
            <Link
              to={`/track-order?orderId=${order.orderId}`}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-secondary-300 text-secondary-700 hover:bg-white transition-colors"
            >
              <Truck size={13} /> Track
            </Link>
          )}
          <Link
            to={`/dashboard/customer/orders/${order._id}`}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
          >
            <Eye size={13} /> View Details
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="px-5 py-3 bg-secondary-50 border-b border-secondary-100 flex justify-between">
        <div className="space-y-1.5"><div className="h-4 w-32 bg-secondary-200 rounded" /><div className="h-3 w-24 bg-secondary-100 rounded" /></div>
        <div className="h-6 w-20 bg-secondary-200 rounded-full" />
      </div>
      <div className="px-5 py-4 flex gap-4">
        <div className="w-14 h-14 bg-secondary-100 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2"><div className="h-4 w-3/4 bg-secondary-100 rounded" /><div className="h-3 w-1/4 bg-secondary-100 rounded" /><div className="h-4 w-1/3 bg-secondary-100 rounded" /></div>
      </div>
      <div className="px-5 py-3 bg-secondary-50 border-t border-secondary-100 flex justify-between">
        <div className="space-y-1"><div className="h-3 w-16 bg-secondary-100 rounded" /><div className="h-5 w-20 bg-secondary-200 rounded" /></div>
        <div className="flex gap-2"><div className="h-8 w-20 bg-secondary-200 rounded-lg" /><div className="h-8 w-24 bg-primary-100 rounded-lg" /></div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerOrders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page         = parseInt(searchParams.get('page') || '1');
  const statusFilter = searchParams.get('status') || '';

  const [searchQuery,       setSearchQuery]       = useState('');
  const [reorderingId,      setReorderingId]      = useState(null);
  const [rev,               setRev]               = useState(0);

  // ── Query ─────────────────────────────────────────────────────────────────

  const { data, isLoading } = useFetch(
    ['customer-orders', page, statusFilter, rev],
    () => api.get('/orders', { params: { page, limit: 10, ...(statusFilter ? { status: statusFilter } : {}) } }).then((r) => r.data),
    { keepPrevious: true }
  );

  const orders     = data?.orders || [];
  const total      = data?.pagination?.total ?? 0;
  const totalPages = Math.ceil(total / 10) || 1;

  // Client-side search filter
  const visible = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter((o) =>
      o.orderId?.toLowerCase().includes(q) ||
      o.items?.some((i) => (i.title || '').toLowerCase().includes(q))
    );
  }, [orders, searchQuery]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function setTab(key) {
    setSearchParams({ ...(key ? { status: key } : {}), page: '1' });
    setSearchQuery('');
  }

  function setPage(p) {
    setSearchParams({ ...(statusFilter ? { status: statusFilter } : {}), page: String(p) });
    window.scrollTo(0, 0);
  }

  function refresh() {
    invalidateCache('customer-orders');
    setRev((r) => r + 1);
  }

  async function handleReorder(order) {
    if (!canReorder(order)) return;
    setReorderingId(order._id);
    try {
      const result = await reorderItems(order);
      if (result.success) {
        toast.success(result.message);
        if (result.results.outOfStock.length || result.results.failed.length) {
          setTimeout(() => toast(`Some items couldn't be added: ${[...result.results.outOfStock, ...result.results.failed].join(', ')}`, { icon: '⚠️' }), 800);
        }
        setTimeout(() => navigate('/cart'), 1500);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Could not add items to cart');
    } finally {
      setReorderingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Orders</h1>
          <p className="text-sm text-secondary-500 mt-0.5">
            Track, manage and reorder your purchases
          </p>
        </div>
        <button onClick={refresh} className="btn-secondary flex items-center gap-1.5 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          className="input w-full pl-10"
          placeholder="Search orders by ID or product name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === key
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-secondary-200 text-secondary-700 hover:border-primary-300'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Order list */}
      {isLoading && !orders.length ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} />)}</div>
      ) : visible.length === 0 ? (
        <div className="card p-14 text-center space-y-3">
          <Package size={40} className="mx-auto text-secondary-200" />
          <p className="font-semibold text-secondary-500">
            {searchQuery ? 'No matching orders' : statusFilter ? `No ${statusFilter} orders` : 'No orders yet'}
          </p>
          <p className="text-sm text-secondary-400">
            {searchQuery || statusFilter
              ? 'Try clearing your search or filter.'
              : 'When you place an order, it will appear here.'}
          </p>
          {(searchQuery || statusFilter) ? (
            <button onClick={() => { setTab(''); setSearchQuery(''); }} className="btn-secondary text-sm mx-auto">
              Clear filters
            </button>
          ) : (
            <Link to="/products" className="btn-primary inline-flex mx-auto">Start Shopping</Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              onReorder={handleReorder}
              reordering={reorderingId === order._id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !searchQuery && (
        <div className="flex justify-center items-center gap-1 pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded text-sm font-medium hover:bg-secondary-100 disabled:opacity-40"
          >
            ← Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded text-sm font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100'}`}
            >
              {p}
            </button>
          ))}
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded text-sm font-medium hover:bg-secondary-100 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
