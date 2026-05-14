import { useState } from 'react';
import { ArrowLeft, Truck } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function VendorOrderDetail({ orderId, onBack }) {
  const [carrier, setCarrier] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [shipping, setShipping] = useState(false);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['vendor-order-detail', orderId, rev],
    () => api.get(`/vendors/orders/${orderId}`).then((r) => r.data)
  );

  const order = data?.order;

  async function handleShip(e) {
    e.preventDefault();
    setShipping(true);
    try {
      await api.patch(`/vendors/orders/${orderId}/ship`, { carrier, trackingId, trackingUrl });
      toast.success('Order marked as shipped');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally {
      setShipping(false);
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!order) return <div className="text-center py-20 text-secondary-400">Order not found</div>;

  const addr = order.shippingAddress;
  const canShip = ['confirmed', 'processing'].includes(order.status);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-secondary-500 hover:text-secondary-800 text-sm font-medium">
        <ArrowLeft size={16} /> Back to Orders
      </button>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Order {order.orderId}</h1>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[order.status] || 'bg-secondary-100 text-secondary-600'}`}>{order.status}</span>
        <span className="text-sm text-secondary-400">{fmtDate(order.createdAt)}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-secondary-100 font-semibold text-sm">Items</div>
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-xs uppercase text-secondary-500">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-center">Qty</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {order.items.map((item) => (
                  <tr key={item._id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.image && <img src={item.image} alt="" className="w-9 h-9 rounded object-cover shrink-0" />}
                        <span className="font-medium">{item.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">₹{item.price.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{(item.price * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canShip && (
            <form onSubmit={handleShip} className="card p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Truck size={16} /> Mark as Shipped</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Carrier</label>
                  <input className="input w-full text-sm" placeholder="e.g. Delhivery" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tracking ID</label>
                  <input className="input w-full text-sm" placeholder="AWB number" value={trackingId} onChange={(e) => setTrackingId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tracking URL</label>
                  <input className="input w-full text-sm" placeholder="https://…" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} />
                </div>
              </div>
              <button type="submit" disabled={shipping} className="btn-primary flex items-center gap-2">
                {shipping ? <Spinner size="sm" /> : <Truck size={14} />} {shipping ? 'Marking…' : 'Mark Shipped'}
              </button>
            </form>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-xs font-bold uppercase text-secondary-400 mb-2">Customer</p>
            <p className="font-semibold">{order.user?.name}</p>
            <p className="text-sm text-secondary-500">{order.user?.email}</p>
            {order.user?.phone && <p className="text-sm text-secondary-500">{order.user.phone}</p>}
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold uppercase text-secondary-400 mb-2">Ship To</p>
            <p className="text-sm text-secondary-700 leading-relaxed">
              {[addr?.name, addr?.line1, addr?.line2, addr?.city, addr?.state, addr?.pincode].filter(Boolean).join(', ')}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold uppercase text-secondary-400 mb-2">Order Total</p>
            <p className="text-2xl font-bold">₹{(order.totalAmount || 0).toLocaleString()}</p>
            <p className="text-sm text-secondary-500 capitalize mt-1">{order.paymentMethod} · {order.paymentStatus}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
