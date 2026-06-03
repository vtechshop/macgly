import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Eye, FileDown, ChevronDown, ChevronUp, RefreshCw, Search,
  ShoppingBag, Package, MapPin,
} from 'lucide-react';
import { useFetch } from '../../../../hooks';
import api from '../../../../utils/api';
import { formatCurrency, formatDate, normalizeImageUrl } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:          { label: 'Pending',          cls: 'bg-gray-100 text-gray-600' },
  pending_payment:  { label: 'Awaiting Payment', cls: 'bg-yellow-100 text-yellow-700' },
  placed:           { label: 'Placed',           cls: 'bg-blue-50 text-blue-600' },
  paid:             { label: 'Payment Received', cls: 'bg-blue-100 text-blue-700' },
  confirmed:        { label: 'Confirmed',        cls: 'bg-blue-100 text-blue-700' },
  processing:       { label: 'Processing',       cls: 'bg-blue-100 text-blue-700' },
  packed:           { label: 'Packed',           cls: 'bg-indigo-100 text-indigo-700' },
  shipped:          { label: 'Shipped',          cls: 'bg-purple-100 text-purple-700' },
  out_for_delivery: { label: 'Out for Delivery', cls: 'bg-orange-100 text-orange-700' },
  delivered:        { label: 'Delivered',        cls: 'bg-green-100 text-green-700' },
  cancelled:        { label: 'Cancelled',        cls: 'bg-red-100 text-red-700' },
  returned:         { label: 'Returned',         cls: 'bg-gray-100 text-gray-600' },
  refunded:         { label: 'Refunded',         cls: 'bg-gray-100 text-gray-600' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'bg-secondary-100 text-secondary-600' };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function paymentLabel(method) {
  if (method === 'cod') return 'COD';
  return 'Prepaid';
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function VendorOrders() {
  const { user } = useSelector((s) => s.auth);
  const navigate  = useNavigate();

  const [page,          setPage]          = useState(() => parseInt(sessionStorage.getItem('vendor-orders-page') || '1'));
  const [statusFilter,  setStatusFilter]  = useState(() => sessionStorage.getItem('vendor-orders-filter') || '');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [rev,           setRev]           = useState(0);

  // Persist page + filter
  useEffect(() => { sessionStorage.setItem('vendor-orders-page', String(page)); }, [page]);
  useEffect(() => { sessionStorage.setItem('vendor-orders-filter', statusFilter); setPage(1); }, [statusFilter]);

  // Counts (auto-refresh every 30s)
  const prevPaidRef = useRef(null);
  const { data: countsRaw, refetch: refetchCounts } = useFetch(
    ['vendor-order-counts', user?._id],
    () => api.get('/vendors/orders/counts').then((r) => r.data),
  );
  const counts = countsRaw?.data || {};

  // New order sound when paid count increases
  useEffect(() => {
    if (!counts.paid) return;
    if (prevPaidRef.current !== null && counts.paid > prevPaidRef.current) {
      try { new Audio('/sounds/new-order.mp3').play().catch(() => {}); } catch {}
    }
    prevPaidRef.current = counts.paid;
  }, [counts.paid]);

  // Auto-refresh counts
  useEffect(() => {
    const interval = setInterval(() => { refetchCounts(); }, 30000);
    return () => clearInterval(interval);
  }, [refetchCounts]);

  // Orders list
  const { data, isLoading } = useFetch(
    ['vendor-orders', user?._id, page, statusFilter, searchTerm, rev],
    () => api.get('/vendors/orders', {
      params: { page, limit: 15, status: statusFilter || undefined, search: searchTerm || undefined },
    }).then((r) => r.data),
  );

  const orders     = data?.orders || [];
  const pagination = data?.pagination || {};

  const TABS = [
    { status: '',                 label: 'All Orders',      countKey: 'total' },
    { status: 'paid',             label: 'Pending',         countKey: 'paid' },
    { status: 'packed',           label: 'Packed',          countKey: 'packed' },
    { status: 'shipped',          label: 'Shipped',         countKey: 'shipped' },
    { status: 'out_for_delivery', label: 'Out for Delivery',countKey: 'out_for_delivery' },
    { status: 'delivered',        label: 'Delivered',       countKey: 'delivered' },
  ];

  function refresh() { setRev((r) => r + 1); refetchCounts(); }

  async function downloadInvoice(orderId, e) {
    e.stopPropagation();
    try {
      const res = await api.get(`/vendors/orders/${orderId}/invoice`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `invoice-${orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Invoice not available');
    }
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Manage Orders</h1>
          <p className="text-sm text-secondary-400 mt-0.5">View and fulfill your customer orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
            <input
              value={searchTerm}
              onChange={(ev) => { setSearchTerm(ev.target.value); setPage(1); }}
              placeholder="Search order ID…"
              className="pl-8 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 w-44"
            />
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-secondary-200 -mb-px pb-0">
        {TABS.map((tab) => {
          const cnt = counts[tab.countKey] ?? 0;
          const active = statusFilter === tab.status;
          return (
            <button
              key={tab.status}
              onClick={() => setStatusFilter(tab.status)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:text-secondary-700'
              }`}>
              {tab.label}
              {cnt > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  active ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-500'
                }`}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-secondary-200 rounded-xl p-14 text-center">
          <ShoppingBag size={36} className="mx-auto text-secondary-300 mb-3" />
          <p className="text-secondary-500 font-medium">No orders found</p>
          {statusFilter && <p className="text-secondary-400 text-sm mt-1">Try clearing the status filter</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
          <div className="divide-y divide-secondary-100">
            {orders.map((o) => {
              const isExpanded = expandedOrder === o._id;
              const customer   = o.user?.name || o.customerName || 'Guest';
              const thumbs     = o.items.slice(0, 3).map((i) => i.image).filter(Boolean);
              const overflow   = o.items.length - 3;

              return (
                <div key={o._id}>
                  {/* Row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-secondary-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedOrder(isExpanded ? null : o._id)}>

                    {/* Order ID + badge */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-secondary-900">#{o.orderId || o._id.slice(-8).toUpperCase()}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-secondary-400 flex-wrap">
                        <span>{formatDate(o.createdAt)}</span>
                        <span className="flex items-center gap-0.5">
                          <Package size={10} /> {o.items.length} item{o.items.length !== 1 ? 's' : ''}
                        </span>
                        <span>{customer}</span>
                      </div>
                    </div>

                    {/* Thumbnails */}
                    <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                      {thumbs.map((src, i) => (
                        <img key={i} src={normalizeImageUrl(src)} alt=""
                          className="w-9 h-9 rounded-lg object-cover border border-white shadow-sm -ml-1 first:ml-0 bg-secondary-100"
                          onError={(e) => { e.target.style.display = 'none'; }} />
                      ))}
                      {overflow > 0 && (
                        <div className="w-9 h-9 rounded-lg bg-secondary-100 border border-white shadow-sm -ml-1 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-secondary-500">+{overflow}</span>
                        </div>
                      )}
                    </div>

                    {/* Amount + payment method */}
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-secondary-900 text-sm">{formatCurrency(o.totalAmount)}</p>
                      <p className="text-[11px] text-secondary-400">{paymentLabel(o.paymentMethod)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Link
                        to={`/dashboard/vendor/orders/${o._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-secondary-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View details">
                        <Eye size={15} />
                      </Link>
                      <button
                        onClick={(e) => downloadInvoice(o._id, e)}
                        className="p-1.5 text-secondary-300 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Download invoice">
                        <FileDown size={15} />
                      </button>
                      <button className="p-1.5 text-secondary-300 hover:text-secondary-600 rounded-lg transition-colors">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Accordion expand */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-secondary-50 border-t border-secondary-100">
                      {/* Items */}
                      <div className="mt-3 space-y-2">
                        {o.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            {item.image ? (
                              <img src={normalizeImageUrl(item.image)} alt={item.title}
                                className="w-10 h-10 rounded-lg object-cover bg-white border border-secondary-200 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0">
                                <Package size={13} className="text-secondary-300" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-secondary-900 line-clamp-1">{item.title}</p>
                              <p className="text-xs text-secondary-400">{item.quantity} × {formatCurrency(item.price)}</p>
                            </div>
                            <p className="text-sm font-semibold text-secondary-900 shrink-0">
                              {formatCurrency(item.quantity * item.price)}
                            </p>
                          </div>
                        ))}
                      </div>
                      {/* Shipping address */}
                      {o.shippingAddress && (
                        <div className="flex items-start gap-2 mt-3 pt-3 border-t border-secondary-200">
                          <MapPin size={13} className="text-secondary-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-secondary-500">
                            {o.shippingAddress.name}, {o.shippingAddress.line1}
                            {o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ''},{' '}
                            {o.shippingAddress.city}, {o.shippingAddress.state} — {o.shippingAddress.phone}
                          </p>
                        </div>
                      )}
                      {/* View full details link */}
                      <div className="mt-3 pt-2 border-t border-secondary-200">
                        <Link to={`/dashboard/vendor/orders/${o._id}`}
                          className="text-xs font-semibold text-primary-600 hover:underline">
                          View Full Details & Update Status →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
              <p className="text-xs text-secondary-500">{pagination.total} total orders</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 border border-secondary-200 rounded-lg text-sm text-secondary-600 hover:bg-secondary-50 disabled:opacity-40 transition-colors">
                  Previous
                </button>
                {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100 text-secondary-600'
                    }`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                  className="px-3 py-1.5 border border-secondary-200 rounded-lg text-sm text-secondary-600 hover:bg-secondary-50 disabled:opacity-40 transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
