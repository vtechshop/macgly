import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, XCircle, Truck, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate, normalizeImageUrl } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  pending:    { label: 'Order placed',  color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: Clock },
  confirmed:  { label: 'Confirmed',     color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     icon: CheckCircle },
  processing: { label: 'Processing',    color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: Package },
  shipped:    { label: 'Shipped',       color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Truck },
  delivered:  { label: 'Delivered',     color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   icon: CheckCircle },
  cancelled:  { label: 'Cancelled',     color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       icon: XCircle },
  returned:   { label: 'Returned',      color: 'text-secondary-600', bg: 'bg-secondary-50 border-secondary-200', icon: AlertCircle },
};

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

function OrderCard({ order, onCancelled }) {
  const [cancelling, setCancelling] = useState(false);
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const isActive = !['delivered', 'cancelled', 'returned'].includes(order.status);
  const stepIdx = STATUS_STEPS.indexOf(order.status);
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;

  async function handleCancel() {
    if (!confirm('Cancel this order?')) return;
    setCancelling(true);
    try {
      await api.post(`/orders/${order._id}/cancel`);
      toast.success('Order cancelled');
      onCancelled();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not cancel order');
    } finally { setCancelling(false); }
  }

  return (
    <div className="bg-white border border-secondary-200 rounded-lg overflow-hidden">
      {/* Order header bar — Amazon style */}
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 bg-secondary-50 border-b border-secondary-200">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wide font-bold text-secondary-400 mb-0.5">Order Placed</p>
            <p className="font-medium text-secondary-700">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide font-bold text-secondary-400 mb-0.5">Total</p>
            <p className="font-medium text-secondary-700">{formatCurrency(order.totalAmount)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide font-bold text-secondary-400 mb-0.5">Ship To</p>
            <p className="font-medium text-secondary-700">{order.shippingAddress?.name || '—'}</p>
          </div>
        </div>
        <div className="text-right text-xs">
          <p className="text-[10px] uppercase tracking-wide font-bold text-secondary-400 mb-0.5">Order #</p>
          <p className="font-mono font-medium text-secondary-700">{order.orderId}</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Status badge + progress */}
        <div className="space-y-2">
          <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
            <StatusIcon size={12} />
            {cfg.label}
          </div>
          {isActive && (
            <div className="space-y-1">
              <div className="flex gap-0.5">
                {STATUS_STEPS.map((s, i) => (
                  <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= stepIdx ? 'bg-primary-500' : 'bg-secondary-200'}`} />
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-secondary-400 font-semibold uppercase tracking-wide">
                {STATUS_STEPS.map((s) => <span key={s} className="capitalize">{s}</span>)}
              </div>
            </div>
          )}
        </div>

        {/* Product rows */}
        <div className="space-y-3">
          {order.items?.map((item, i) => (
            <div key={i} className="flex gap-4">
              {/* Thumbnail */}
              <div className="shrink-0 w-20 h-20 rounded border border-secondary-100 bg-secondary-50 overflow-hidden flex items-center justify-center">
                {item.image ? (
                  <img
                    src={normalizeImageUrl(item.image)}
                    alt={item.title}
                    className="w-full h-full object-contain"
                    onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.fallback')?.classList.remove('hidden'); }}
                  />
                ) : null}
                <Package size={22} className={`text-secondary-300 fallback ${item.image ? 'hidden' : ''}`} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-800 line-clamp-2 leading-snug">{item.title}</p>
                <p className="text-xs text-secondary-500 mt-0.5">Qty: {item.quantity}</p>
                <p className="text-sm font-bold text-secondary-800 mt-1">{formatCurrency(item.price * item.quantity)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing summary */}
        <div className="border-t border-secondary-100 pt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-secondary-500 space-y-0.5">
            {order.discount > 0 && (
              <p>Discount: <span className="text-green-600 font-medium">−{formatCurrency(order.discount)}</span></p>
            )}
            <p>Order total: <span className="font-bold text-secondary-800">{formatCurrency(order.totalAmount)}</span></p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
              >
                <XCircle size={13} />
                {cancelling ? 'Cancelling…' : 'Cancel order'}
              </button>
            )}
            <Link
              to="/products"
              className="text-xs font-medium text-secondary-700 border border-secondary-300 hover:bg-secondary-50 px-3 py-1.5 rounded transition-colors"
            >
              Buy again
            </Link>
          </div>
        </div>

        {/* Shipping address */}
        {order.shippingAddress && (
          <div className="border-t border-secondary-100 pt-3 text-xs text-secondary-500">
            <p className="font-semibold text-secondary-600 mb-0.5">Shipping address</p>
            <p>{order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerOrders() {
  const [page, setPage] = useState(1);
  const [rev, setRev] = useState(0);
  const { data, isLoading } = useFetch(
    ['my-orders', page, rev],
    () => api.get('/orders', { params: { page, limit: 10 } }).then((r) => r.data)
  );

  const orders = data?.orders || [];
  const pagination = data?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / 10) : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Your Orders</h1>
          {pagination?.total > 0 && <p className="text-sm text-secondary-500 mt-0.5">{pagination.total} order{pagination.total !== 1 ? 's' : ''}</p>}
        </div>
        <Link to="/products" className="text-sm text-primary-600 font-medium hover:underline">Continue shopping →</Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-secondary-200 rounded-lg text-center py-16 space-y-3">
          <Package size={44} className="mx-auto text-secondary-200" />
          <p className="font-semibold text-secondary-500">No orders yet</p>
          <p className="text-sm text-secondary-400">When you place an order, it will appear here.</p>
          <Link to="/products" className="mt-1 inline-block text-sm text-primary-600 font-semibold hover:underline">Start Shopping →</Link>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {orders.map((o) => <OrderCard key={o._id} order={o} onCancelled={() => setRev((r) => r + 1)} />)}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-1 pt-2">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded text-sm font-medium hover:bg-secondary-100 disabled:opacity-40">← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded text-sm font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100'}`}>{p}</button>
              ))}
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded text-sm font-medium hover:bg-secondary-100 disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
