import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, Truck, CheckCircle, Clock, XCircle, AlertCircle, FileText, RotateCcw } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  pending:    { label: 'Order Placed',  color: 'text-yellow-700',    bg: 'bg-yellow-50 border-yellow-200',    icon: Clock },
  confirmed:  { label: 'Confirmed',     color: 'text-blue-700',      bg: 'bg-blue-50 border-blue-200',        icon: CheckCircle },
  processing: { label: 'Processing',    color: 'text-indigo-700',    bg: 'bg-indigo-50 border-indigo-200',    icon: Package },
  shipped:    { label: 'Shipped',       color: 'text-purple-700',    bg: 'bg-purple-50 border-purple-200',    icon: Truck },
  delivered:  { label: 'Delivered',     color: 'text-green-700',     bg: 'bg-green-50 border-green-200',      icon: CheckCircle },
  cancelled:  { label: 'Cancelled',     color: 'text-red-700',       bg: 'bg-red-50 border-red-200',          icon: XCircle },
  returned:   { label: 'Returned',      color: 'text-secondary-600', bg: 'bg-secondary-50 border-secondary-200', icon: AlertCircle },
};

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

const RETURN_REASONS = ['Defective product', 'Wrong item delivered', 'Item not as described', 'Damaged in transit', 'Changed my mind', 'Other'];

function ReturnModal({ orderId, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!reason) return toast.error('Please select a reason');
    setLoading(true);
    try {
      await api.post('/returns', { orderId, reason, description });
      toast.success('Return request submitted');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to submit return');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-bold text-lg">Request Return / Refund</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <select className="input w-full" value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="">Select reasonâ€¦</option>
              {RETURN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description <span className="text-secondary-400 font-normal">(optional)</span></label>
            <textarea className="input w-full" rows={3} placeholder="Describe the issueâ€¦" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Submittingâ€¦' : 'Submit Request'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomerOrderDetail() {
  const { id } = useParams();
  const [showReturn, setShowReturn] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['order-detail', id, rev],
    () => api.get(`/orders/${id}`).then((r) => r.data)
  );

  const order = data?.order;

  async function handleCancel() {
    if (!confirm('Cancel this order?')) return;
    setCancelling(true);
    try {
      await api.post(`/orders/${order._id}/cancel`);
      toast.success('Order cancelled');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not cancel order');
    } finally { setCancelling(false); }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!order) return (
    <div className="text-center py-20 text-secondary-400">
      <p className="font-medium">Order not found</p>
      <Link to="/dashboard/customer/orders" className="btn-primary mt-4 inline-block">Back to Orders</Link>
    </div>
  );

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;
  const stepIdx = STATUS_STEPS.indexOf(order.status);
  const isActive = !['delivered', 'cancelled', 'returned'].includes(order.status);
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const canReturn = order.status === 'delivered';

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-3">
        <Link to="/dashboard/customer/orders" className="text-secondary-500 hover:text-secondary-800">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Order {order.orderId}</h1>
          <p className="text-sm text-secondary-400">Placed {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Status card */}
      <div className="card p-5">
        <div className={`inline-flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full border mb-4 ${cfg.bg} ${cfg.color}`}>
          <StatusIcon size={14} />
          {cfg.label}
        </div>

        {isActive && (
          <div className="mb-4 space-y-1">
            <div className="flex gap-0.5">
              {STATUS_STEPS.map((s, i) => (
                <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= stepIdx ? 'bg-primary-500' : 'bg-secondary-200'}`} />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-secondary-400 font-bold uppercase">
              {STATUS_STEPS.map((s) => <span key={s}>{s}</span>)}
            </div>
          </div>
        )}

        {order.tracking?.trackingId && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm flex items-center gap-2 flex-wrap">
            <Truck size={14} className="text-blue-600" />
            <span className="font-semibold text-blue-700">{order.tracking.carrier || 'Courier'}:</span>
            {order.tracking.url
              ? <a href={order.tracking.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono">{order.tracking.trackingId}</a>
              : <span className="font-mono text-blue-700">{order.tracking.trackingId}</span>
            }
          </div>
        )}
      </div>

      {/* Tracking history */}
      {order.tracking?.history?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-bold text-secondary-800 mb-4">Shipment History</h2>
          <div className="space-y-3">
            {[...order.tracking.history].reverse().map((h, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-500 mt-1 shrink-0" />
                  {i < order.tracking.history.length - 1 && <div className="w-px flex-1 bg-secondary-200 mt-1" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-semibold text-secondary-800 capitalize">{h.status}</p>
                  {h.description && <p className="text-xs text-secondary-500">{h.description}</p>}
                  <p className="text-xs text-secondary-400">{new Date(h.timestamp).toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-secondary-100 font-semibold">Items</div>
        <div className="divide-y divide-secondary-100">
          {order.items?.map((item, i) => (
            <div key={i} className="flex gap-4 px-5 py-4">
              <div className="w-16 h-16 rounded border border-secondary-100 bg-secondary-50 overflow-hidden shrink-0 flex items-center justify-center">
                {item.image ? (
                  <img src={normalizeImageUrl(item.image)} alt={item.title} className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                ) : <Package size={20} className="text-secondary-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-2">{item.title}</p>
                <p className="text-xs text-secondary-400 mt-0.5">Qty: {item.quantity}</p>
              </div>
              <p className="font-bold text-sm shrink-0">{formatCurrency(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        {/* Pricing summary */}
        <div className="px-5 py-4 bg-secondary-50 border-t border-secondary-100 space-y-1.5 text-sm">
          <div className="flex justify-between text-secondary-500">
            <span>Subtotal</span>
            <span>{formatCurrency((order.totalAmount || 0) + (order.discount || 0))}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>âˆ’{formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-secondary-900 pt-1 border-t border-secondary-200">
            <span>Total</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Shipping address */}
      {order.shippingAddress && (
        <div className="card p-5">
          <h2 className="font-bold text-secondary-800 mb-2">Shipping Address</h2>
          <p className="text-sm text-secondary-700">{order.shippingAddress.name}</p>
          <p className="text-sm text-secondary-500">{order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}</p>
          <p className="text-sm text-secondary-500">{order.shippingAddress.city}, {order.shippingAddress.state} â€” {order.shippingAddress.pincode}</p>
          <p className="text-sm text-secondary-500">{order.shippingAddress.phone}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <a href={`${import.meta.env.VITE_API_URL}/api/invoices/${order._id}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-medium border border-secondary-300 hover:bg-secondary-50 px-4 py-2 rounded-lg transition-colors">
          <FileText size={15} /> Download Invoice
        </a>
        {canReturn && (
          <button onClick={() => setShowReturn(true)}
            className="flex items-center gap-2 text-sm font-medium text-orange-600 border border-orange-200 hover:bg-orange-50 px-4 py-2 rounded-lg transition-colors">
            <RotateCcw size={15} /> Request Return
          </button>
        )}
        {canCancel && (
          <button onClick={handleCancel} disabled={cancelling}
            className="flex items-center gap-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
            <XCircle size={15} /> {cancelling ? 'Cancellingâ€¦' : 'Cancel Order'}
          </button>
        )}
      </div>

      {showReturn && <ReturnModal orderId={order._id} onClose={() => setShowReturn(false)} onSuccess={() => setRev((r) => r + 1)} />}
    </div>
  );
}
