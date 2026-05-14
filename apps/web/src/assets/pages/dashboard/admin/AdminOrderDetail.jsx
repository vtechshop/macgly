import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, Truck, FileText, RotateCcw } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }

const STATUS_OPTIONS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700', shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
  returned: 'bg-secondary-100 text-secondary-500',
};

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [rev, setRev] = useState(0);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [trackingForm, setTrackingForm] = useState(false);
  const [tracking, setTracking] = useState({ carrier: '', trackingId: '', url: '' });

  const { data, isLoading } = useFetch(
    ['admin-order', id, rev],
    () => api.get(`/admin/orders/${id}`).then((r) => r.data)
  );

  const order = data?.order;

  async function updateStatus(newStatus) {
    if (!confirm(`Change status to "${newStatus}"?`)) return;
    setStatusUpdating(true);
    try {
      await api.patch(`/admin/orders/${id}/status`, { status: newStatus });
      toast.success('Status updated');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally { setStatusUpdating(false); }
  }

  async function saveTracking(e) {
    e.preventDefault();
    try {
      await api.patch(`/admin/orders/${id}/tracking`, tracking);
      toast.success('Tracking saved');
      setTrackingForm(false);
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!order) return (
    <div className="text-center py-20 text-secondary-400">
      <p className="font-medium">Order not found</p>
      <Link to="/dashboard/admin/orders" className="btn-primary mt-4 inline-block">Back to Orders</Link>
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/dashboard/admin/orders" className="text-secondary-500 hover:text-secondary-800"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Order {order.orderId}</h1>
          <p className="text-sm text-secondary-400">Placed {fmtDate(order.createdAt)}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${STATUS_COLORS[order.status] || ''}`}>{order.status}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer */}
        <div className="card p-4">
          <p className="text-xs font-bold uppercase text-secondary-400 mb-2">Customer</p>
          <p className="font-semibold">{order.user?.name || '—'}</p>
          <p className="text-sm text-secondary-500">{order.user?.email}</p>
          <p className="text-sm text-secondary-500">{order.user?.phone}</p>
        </div>
        {/* Shipping */}
        <div className="card p-4">
          <p className="text-xs font-bold uppercase text-secondary-400 mb-2">Ship To</p>
          {order.shippingAddress ? (
            <>
              <p className="font-semibold">{order.shippingAddress.name}</p>
              <p className="text-sm text-secondary-500">{order.shippingAddress.line1}</p>
              <p className="text-sm text-secondary-500">{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}</p>
              <p className="text-sm text-secondary-500">{order.shippingAddress.phone}</p>
            </>
          ) : <p className="text-sm text-secondary-400">—</p>}
        </div>
        {/* Payment */}
        <div className="card p-4">
          <p className="text-xs font-bold uppercase text-secondary-400 mb-2">Payment</p>
          <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
          <p className="text-sm text-secondary-500 capitalize">{order.paymentMethod || '—'}</p>
          <p className={`text-sm font-medium mt-1 capitalize ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>{order.paymentStatus}</p>
          {order.discount > 0 && <p className="text-sm text-green-600 mt-0.5">Discount: {formatCurrency(order.discount)}</p>}
        </div>
      </div>

      {/* Status control */}
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-bold">Update Status</h2>
          {statusUpdating && <Spinner size="sm" />}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button key={s} onClick={() => updateStatus(s)} disabled={order.status === s || statusUpdating}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${order.status === s ? 'bg-secondary-800 text-white cursor-default' : 'border border-secondary-200 hover:bg-secondary-50'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Tracking */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2"><Truck size={16} /> Tracking</h2>
          <button onClick={() => { setTracking({ carrier: order.tracking?.carrier || '', trackingId: order.tracking?.trackingId || '', url: order.tracking?.url || '' }); setTrackingForm((o) => !o); }}
            className="text-sm text-primary-600 hover:underline">
            {trackingForm ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {trackingForm ? (
          <form onSubmit={saveTracking} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium mb-1">Carrier</label><input className="input w-full" placeholder="Delhivery, FedEx…" value={tracking.carrier} onChange={(e) => setTracking((t) => ({ ...t, carrier: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium mb-1">AWB / Tracking ID</label><input className="input w-full" value={tracking.trackingId} onChange={(e) => setTracking((t) => ({ ...t, trackingId: e.target.value }))} /></div>
              <div><label className="block text-xs font-medium mb-1">Tracking URL</label><input className="input w-full" placeholder="https://…" value={tracking.url} onChange={(e) => setTracking((t) => ({ ...t, url: e.target.value }))} /></div>
            </div>
            <button type="submit" className="btn-primary">Save Tracking</button>
          </form>
        ) : order.tracking?.trackingId ? (
          <div className="text-sm space-y-1">
            <p><span className="font-medium">Carrier:</span> {order.tracking.carrier || '—'}</p>
            <p><span className="font-medium">AWB:</span> {order.tracking.trackingId}</p>
            {order.tracking.url && <a href={order.tracking.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Track on carrier →</a>}
          </div>
        ) : <p className="text-sm text-secondary-400">No tracking info added yet.</p>}
      </div>

      {/* Items */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-secondary-100 font-semibold">Order Items</div>
        <div className="divide-y divide-secondary-100">
          {order.items?.map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <div className="w-12 h-12 rounded border border-secondary-100 bg-secondary-50 overflow-hidden shrink-0 flex items-center justify-center">
                {item.image ? <img src={normalizeImageUrl(item.image)} alt="" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} /> : <Package size={18} className="text-secondary-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                <p className="text-xs text-secondary-400">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                {item.vendor && <p className="text-xs text-secondary-400">Vendor: {item.vendor.name || item.vendor}</p>}
              </div>
              <p className="font-semibold text-sm shrink-0">{formatCurrency(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-secondary-50 border-t border-secondary-100 flex justify-between font-bold">
          <span>Total</span>
          <span>{formatCurrency(order.totalAmount)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <a href={`${import.meta.env.VITE_API_URL}/api/invoices/${order._id}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-medium border border-secondary-300 hover:bg-secondary-50 px-4 py-2 rounded-lg">
          <FileText size={14} /> Invoice
        </a>
        {order.status === 'delivered' && (
          <button onClick={() => toast('Refund via Payments page', { icon: 'ℹ️' })}
            className="flex items-center gap-2 text-sm font-medium text-orange-600 border border-orange-200 hover:bg-orange-50 px-4 py-2 rounded-lg">
            <RotateCcw size={14} /> Initiate Refund
          </button>
        )}
      </div>
    </div>
  );
}
