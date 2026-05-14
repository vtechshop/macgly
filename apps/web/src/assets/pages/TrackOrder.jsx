import { useState } from 'react';
import { Search, Package, MapPin, Clock } from 'lucide-react';
import api from '../utils/api';
import Spinner from './components/common/Spinner';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export default function TrackOrder() {
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    setOrder(null);
    setLoading(true);
    try {
      const res = await api.get('/orders/track', { params: { orderId: orderId.trim(), phone: phone.trim() } });
      setOrder(res.data.order);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Order not found. Check the order ID and phone number.');
    } finally { setLoading(false); }
  }

  const currentStep = order ? STATUS_STEPS.indexOf(order.status) : -1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <Package size={48} className="mx-auto mb-4 text-primary-600" />
        <h1 className="text-3xl font-bold text-secondary-900">Track Your Order</h1>
        <p className="text-secondary-500 mt-2">Enter your order ID and phone number to track your shipment</p>
      </div>

      <form onSubmit={handleSearch} className="card p-6 space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Order ID</label>
          <input className="input w-full" placeholder="e.g. ORD-1234567890" value={orderId} onChange={(e) => setOrderId(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone Number</label>
          <input className="input w-full" placeholder="Mobile number used at checkout" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Spinner size="sm" /> : <Search size={15} />} {loading ? 'Searching…' : 'Track Order'}
        </button>
      </form>

      {order && (
        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-mono text-sm text-secondary-400">{order.orderId}</p>
                <p className="font-bold text-lg capitalize">{order.status}</p>
                <p className="text-sm text-secondary-500">Placed {fmtDate(order.createdAt)}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {order.status}
              </span>
            </div>

            {/* Progress bar */}
            {!['cancelled', 'returned'].includes(order.status) && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  {STATUS_STEPS.map((step, i) => (
                    <div key={step} className="flex flex-col items-center flex-1">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i <= currentStep ? 'bg-primary-600 text-white' : 'bg-secondary-200 text-secondary-400'}`}>
                        {i < currentStep ? '✓' : i + 1}
                      </div>
                      <p className={`text-[10px] mt-1 capitalize text-center ${i <= currentStep ? 'text-primary-600 font-semibold' : 'text-secondary-400'}`}>{step}</p>
                    </div>
                  ))}
                </div>
                <div className="flex h-1 mt-1">
                  {STATUS_STEPS.slice(0, -1).map((_, i) => (
                    <div key={i} className={`flex-1 ${i < currentStep ? 'bg-primary-500' : 'bg-secondary-200'} ${i === 0 ? 'rounded-l-full' : ''} ${i === STATUS_STEPS.length - 2 ? 'rounded-r-full' : ''}`} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tracking info */}
          {order.tracking?.trackingId && (
            <div className="card p-4">
              <p className="text-xs font-bold uppercase text-secondary-400 mb-2">Tracking Details</p>
              <p className="text-sm"><span className="font-medium">Carrier:</span> {order.tracking.carrier || '—'}</p>
              <p className="text-sm"><span className="font-medium">AWB:</span> {order.tracking.trackingId}</p>
              {order.tracking.url && <a href={order.tracking.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Track on carrier →</a>}
            </div>
          )}

          {/* History */}
          {order.tracking?.history?.length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-bold uppercase text-secondary-400 mb-3">Shipment History</p>
              <div className="space-y-3">
                {[...order.tracking.history].reverse().map((h, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium capitalize">{h.status}</p>
                      {h.description && <p className="text-xs text-secondary-400">{h.description}</p>}
                      <p className="text-xs text-secondary-400">{fmtDate(h.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-secondary-100 text-sm font-semibold">Items</div>
            <div className="divide-y divide-secondary-100">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  {item.image && <img src={item.image} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                    <p className="text-xs text-secondary-400">×{item.quantity}</p>
                  </div>
                  <p className="font-medium text-sm shrink-0">₹{(item.price * item.quantity).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
