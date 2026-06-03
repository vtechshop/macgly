import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Package, MapPin, Truck, Clock, CheckCircle,
  XCircle, Shield, CreditCard, User, ExternalLink,
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
};

const CARRIERS = ['Delhivery', 'Shiprocket', 'BlueDart', 'DTDC', 'FedEx', 'DHL', 'India Post', 'Other'];

// Status flow — forward only
const STATUS_FLOW = ['placed', 'paid', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
function nextStatuses(current) {
  const idx = STATUS_FLOW.indexOf(current);
  const forward = idx >= 0 ? STATUS_FLOW.slice(idx + 1) : ['packed'];
  // Always allow cancel unless already terminal
  const terminal = ['delivered', 'cancelled', 'returned', 'refunded'];
  if (!terminal.includes(current)) forward.push('cancelled');
  return forward;
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'bg-secondary-100 text-secondary-600' };
  return <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function VendorOrderDetail() {
  const { id } = useParams();
  const [rev,          setRev]          = useState(0);
  const [newStatus,    setNewStatus]    = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [carrier,      setCarrier]      = useState('');
  const [trackingId,   setTrackingId]   = useState('');
  const [trackingUrl,  setTrackingUrl]  = useState('');
  const [assigning,    setAssigning]    = useState(false);

  const { data, isLoading } = useFetch(
    ['vendor-order-detail', id, rev],
    () => api.get(`/vendors/orders/${id}`).then((r) => r.data),
  );

  const order = data?.order;

  async function handleStatusUpdate() {
    if (!newStatus) return toast.error('Select a status');
    setUpdatingStatus(true);
    try {
      await api.put(`/vendors/orders/${id}/status`, { status: newStatus });
      toast.success(`Order status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      setNewStatus('');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update status');
    } finally { setUpdatingStatus(false); }
  }

  async function handleAssignCarrier(e) {
    e.preventDefault();
    if (!carrier) return toast.error('Select a carrier');
    if (!trackingId.trim()) return toast.error('Enter a tracking ID / AWB');
    setAssigning(true);
    try {
      await api.patch(`/vendors/orders/${id}/ship`, {
        carrier, trackingId: trackingId.trim(), trackingUrl: trackingUrl.trim() || undefined,
      });
      toast.success('Carrier assigned — order marked as shipped');
      setCarrier(''); setTrackingId(''); setTrackingUrl('');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to assign carrier');
    } finally { setAssigning(false); }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!order)   return (
    <div className="text-center py-16">
      <p className="text-secondary-400">Order not found</p>
      <Link to="/dashboard/vendor/orders" className="mt-3 inline-block text-sm text-primary-600 hover:underline">
        ← Back to Orders
      </Link>
    </div>
  );

  const addr       = order.shippingAddress;
  const tracking   = order.tracking || {};
  const hasCarrier = !!(tracking.carrier && tracking.trackingId);
  const terminal   = ['delivered', 'cancelled', 'returned', 'refunded'].includes(order.status);
  const allowedNext = nextStatuses(order.status);

  // Vendor's items only
  const items     = order.items || [];
  const itemsTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="space-y-5">

      {/* Back + header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/dashboard/vendor/orders"
          className="flex items-center gap-1.5 text-sm font-medium text-secondary-500 hover:text-secondary-800 transition-colors">
          <ArrowLeft size={15} /> Back to Orders
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-secondary-900">Order {order.orderId}</h1>
        <StatusBadge status={order.status} />
        <span className="text-sm text-secondary-400">{fmtDateTime(order.createdAt)}</span>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: Items + Shipping + Carrier ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Order items */}
          <div className="bg-white border border-secondary-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-secondary-100">
              <p className="font-semibold text-secondary-900 text-sm">Order Items ({items.length})</p>
            </div>
            <div className="divide-y divide-secondary-100">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  {item.image ? (
                    <img src={normalizeImageUrl(item.image)} alt={item.title}
                      className="w-12 h-12 rounded-xl object-cover bg-secondary-100 shrink-0 border border-secondary-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-secondary-100 flex items-center justify-center shrink-0">
                      <Package size={16} className="text-secondary-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-secondary-900 text-sm">{item.title}</p>
                    {item.sku && <p className="text-xs text-secondary-400 mt-0.5 font-mono">{item.sku}</p>}
                    <p className="text-xs text-secondary-500 mt-0.5">{item.quantity} × {formatCurrency(item.price)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-secondary-900">{formatCurrency(item.quantity * item.price)}</p>
                    {item.vendorEarning > 0 && (
                      <p className="text-xs text-green-600 mt-0.5">Earning: {formatCurrency(item.vendorEarning)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping address */}
          {addr && (
            <div className="bg-white border border-secondary-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={15} className="text-secondary-400" />
                <p className="font-semibold text-secondary-900 text-sm">Shipping Address</p>
              </div>
              <div className="text-sm text-secondary-600 space-y-0.5">
                <p className="font-semibold text-secondary-800">{addr.name}</p>
                <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                <p>{addr.city}, {addr.state} — {addr.pincode}</p>
                {addr.phone && <p className="text-secondary-500 mt-1">📞 {addr.phone}</p>}
              </div>
            </div>
          )}

          {/* Carrier assignment — shown if no AWB and order not terminal */}
          {!hasCarrier && !terminal && (
            <div className="bg-white border border-secondary-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Truck size={15} className="text-secondary-400" />
                <p className="font-semibold text-secondary-900 text-sm">Assign Courier</p>
              </div>
              <form onSubmit={handleAssignCarrier} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-secondary-600 mb-1">Carrier *</label>
                    <select value={carrier} onChange={(ev) => setCarrier(ev.target.value)}
                      className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                      <option value="">Select carrier…</option>
                      {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary-600 mb-1">AWB / Tracking ID *</label>
                    <input value={trackingId} onChange={(ev) => setTrackingId(ev.target.value)}
                      placeholder="Enter AWB number"
                      className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary-600 mb-1">Tracking URL <span className="font-normal text-secondary-400">(optional)</span></label>
                  <input value={trackingUrl} onChange={(ev) => setTrackingUrl(ev.target.value)}
                    placeholder="https://track.carrier.com/…"
                    className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                </div>
                <button type="submit" disabled={assigning}
                  className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  {assigning ? 'Assigning…' : 'Assign Carrier & Mark as Shipped'}
                </button>
              </form>
            </div>
          )}

          {/* Carrier assigned — shown if AWB exists */}
          {hasCarrier && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={15} className="text-green-600" />
                <p className="font-semibold text-green-800 text-sm">Carrier Assigned</p>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-secondary-500 w-24">Carrier:</span>
                  <span className="font-medium text-secondary-800">{tracking.carrier}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-secondary-500 w-24">AWB:</span>
                  <span className="font-mono font-medium text-secondary-800">{tracking.trackingId}</span>
                </div>
                {tracking.url && (
                  <div className="flex items-center gap-2">
                    <span className="text-secondary-500 w-24">Track:</span>
                    <a href={tracking.url} target="_blank" rel="noopener noreferrer"
                      className="text-primary-600 hover:underline flex items-center gap-1">
                      Track Package <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tracking history / timeline */}
          {tracking.history?.length > 0 && (
            <div className="bg-white border border-secondary-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={15} className="text-secondary-400" />
                <p className="font-semibold text-secondary-900 text-sm">Order Timeline</p>
              </div>
              <div className="space-y-3">
                {[...tracking.history].reverse().map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      i === 0 ? 'bg-primary-500' : 'bg-secondary-300'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-secondary-800 capitalize">
                        {STATUS_CONFIG[entry.status]?.label || entry.status}
                      </p>
                      {entry.description && (
                        <p className="text-xs text-secondary-400">{entry.description}</p>
                      )}
                      <p className="text-xs text-secondary-300 mt-0.5">{fmtDateTime(entry.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">

          {/* Update Status */}
          {!terminal && (
            <div className="bg-white border border-secondary-200 rounded-xl p-5">
              <p className="font-semibold text-secondary-900 text-sm mb-3">Update Status</p>
              <select value={newStatus} onChange={(ev) => setNewStatus(ev.target.value)}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 mb-3">
                <option value="">Select new status…</option>
                {allowedNext.map((s) => (
                  <option key={s} value={s} disabled={s === 'shipped' && !hasCarrier}>
                    {STATUS_CONFIG[s]?.label || s}
                    {s === 'shipped' && !hasCarrier ? ' (assign carrier first)' : ''}
                  </option>
                ))}
              </select>
              <button onClick={handleStatusUpdate} disabled={!newStatus || updatingStatus}
                className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {updatingStatus ? 'Updating…' : 'Update Status'}
              </button>
              {newStatus === 'cancelled' && (
                <p className="text-xs text-red-600 mt-2 text-center">This action cannot be undone</p>
              )}
            </div>
          )}

          {/* Order Summary */}
          <div className="bg-white border border-secondary-200 rounded-xl p-5">
            <p className="font-semibold text-secondary-900 text-sm mb-3">Order Summary</p>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Subtotal',         value: formatCurrency(order.subtotal ?? itemsTotal) },
                order.discount > 0 && { label: 'Discount', value: `−${formatCurrency(order.discount)}`, cls: 'text-green-600' },
                { label: 'Shipping',         value: order.shippingCharge > 0 ? formatCurrency(order.shippingCharge) : 'Free' },
                order.gstAmount > 0 && { label: 'GST',     value: formatCurrency(order.gstAmount) },
              ].filter(Boolean).map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-secondary-500">{label}</span>
                  <span className={`font-medium ${cls || 'text-secondary-800'}`}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-secondary-100">
                <span className="font-semibold text-secondary-900">Total</span>
                <span className="font-bold text-secondary-900">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white border border-secondary-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard size={14} className="text-secondary-400" />
              <p className="font-semibold text-secondary-900 text-sm">Payment</p>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary-500">Method</span>
                <span className="font-medium text-secondary-800 capitalize">{order.paymentMethod?.replace('_', ' ') || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-500">Status</span>
                <span className={`font-semibold ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                  {order.paymentStatus}
                </span>
              </div>
              {order.razorpayPaymentId && (
                <div className="flex justify-between">
                  <span className="text-secondary-500">Txn ID</span>
                  <span className="text-xs font-mono text-secondary-600 truncate max-w-[130px]">{order.razorpayPaymentId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-white border border-secondary-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <User size={14} className="text-secondary-400" />
              <p className="font-semibold text-secondary-900 text-sm">Customer</p>
            </div>
            <div className="space-y-1.5 text-sm">
              <p className="font-medium text-secondary-800">
                {order.user?.name || order.customerName || 'Guest Customer'}
              </p>
              {order.user?.email && <p className="text-secondary-400 text-xs">{order.user.email}</p>}
              {order.user?.phone && <p className="text-secondary-400 text-xs">{order.user.phone}</p>}
              {!order.user && <p className="text-xs text-secondary-400 italic">Guest order</p>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
