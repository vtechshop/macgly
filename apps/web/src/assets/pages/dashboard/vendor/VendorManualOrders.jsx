import { useState } from 'react';
import { Plus, Trash2, ShoppingBag } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const EMPTY_ADDR = { name: '', phone: '', line1: '', city: '', state: '', pincode: '', country: 'India' };

export default function VendorManualOrders() {
  const [customerEmail, setCustomerEmail] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);
  const [address, setAddress] = useState({ ...EMPTY_ADDR });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  const { data: products } = useFetch(['vendor-products-manual'], () =>
    api.get('/vendors/products', { params: { limit: 100 } }).then((r) => r.data)
  );
  const productList = products?.products || [];

  function setAddrField(k) { return (e) => setAddress((a) => ({ ...a, [k]: e.target.value })); }
  function setItem(i, k, v) { setItems((items) => items.map((it, idx) => idx === i ? { ...it, [k]: v } : it)); }
  function addItem() { setItems((items) => [...items, { productId: '', quantity: 1 }]); }
  function removeItem(i) { setItems((items) => items.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (items.some((it) => !it.productId)) return toast.error('Select a product for each item');
    setSaving(true);
    try {
      const res = await api.post('/vendors/manual-orders', {
        customerEmail,
        items: items.map((it) => ({ productId: it.productId, quantity: parseInt(it.quantity) || 1 })),
        shippingAddress: address, note,
      });
      toast.success('Order created!');
      setLastOrder(res.data.order);
      setCustomerEmail(''); setItems([{ productId: '', quantity: 1 }]); setNote('');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Manual Orders</h1><p className="text-secondary-500 text-sm mt-0.5">Create an order on behalf of a customer</p></div>

      {lastOrder && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <ShoppingBag size={18} className="text-green-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Order created: <span className="font-mono">{lastOrder.orderId}</span></p>
            <p className="text-sm text-green-700 mt-0.5">Total: ₹{(lastOrder.totalAmount || 0).toLocaleString()}</p>
            <button onClick={() => setLastOrder(null)} className="text-xs text-green-600 hover:underline mt-1">Dismiss</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold">Customer</h2>
            <div>
              <label className="block text-sm font-medium mb-1">Customer Email *</label>
              <input className="input w-full" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required />
            </div>
          </div>
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Items</h2>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Plus size={13} /> Add item</button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <select className="input flex-1 text-sm" value={item.productId} onChange={(e) => setItem(i, 'productId', e.target.value)} required>
                  <option value="">Select product…</option>
                  {productList.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
                </select>
                <input className="input w-20 text-sm text-center" type="number" min="1" value={item.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="p-1.5 hover:bg-secondary-100 rounded-lg"><Trash2 size={14} className="text-red-500" /></button>}
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium mb-1">Note</label>
              <textarea className="input w-full resize-none text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">Shipping Address</h2>
          {[
            { k: 'name', label: 'Full Name', required: true },
            { k: 'phone', label: 'Phone', required: true },
            { k: 'line1', label: 'Address', required: true },
            { k: 'city', label: 'City', required: true },
            { k: 'state', label: 'State', required: true },
            { k: 'pincode', label: 'Pincode', required: true },
            { k: 'country', label: 'Country' },
          ].map(({ k, label, required }) => (
            <div key={k}>
              <label className="block text-sm font-medium mb-1">{label}{required ? ' *' : ''}</label>
              <input className="input w-full" value={address[k]} onChange={setAddrField(k)} required={required} />
            </div>
          ))}
          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
            {saving ? <Spinner size="sm" /> : <ShoppingBag size={15} />} {saving ? 'Creating…' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
