import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  Plus, Pencil, Ban, Send, FileDown, ChevronDown, ChevronUp,
  RefreshCw, Search, ShoppingBag, Package, Phone, Store,
  AlertTriangle, X, Trash2, Shield, CreditCard, CheckCircle,
} from 'lucide-react';
import { useFetch } from '../../../../hooks';
import api from '../../../../utils/api';
import { formatCurrency, formatDate, normalizeImageUrl } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCES = [
  { value: 'in-store', label: 'In-Store' },
  { value: 'phone',    label: 'Phone Order' },
];

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'card',          label: 'Card' },
  { value: 'upi',           label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const INPUT_CLS = 'w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300';

// ── CancelVendorManualOrderDialog ─────────────────────────────────────────────

function CancelVendorManualOrderDialog({ order, onClose, onCancelled }) {
  const [reason, setReason] = useState('');
  const [busy,   setBusy]   = useState(false);

  async function submit() {
    if (!reason.trim()) return toast.error('Cancellation reason is required');
    setBusy(true);
    try {
      const { data } = await api.put(`/vendors/manual-orders/${order._id}/cancel`, { reason: reason.trim() });
      toast.success(`Order cancelled${data.voidedWarranties > 0 ? ` · ${data.voidedWarranties} warranty voided` : ''}`);
      onCancelled();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to cancel');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-secondary-900">Cancel Order</h3>
            <p className="text-sm text-secondary-500 mt-0.5">#{order.orderId}</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700 space-y-1">
          <p className="font-semibold">This will:</p>
          <p>• Set order status to cancelled</p>
          <p>• Mark payment as refunded</p>
          <p>• Void all active warranties for this order</p>
        </div>
        <div className="mb-5">
          <label className="block text-sm font-medium text-secondary-700 mb-1">Reason *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus
            placeholder="Why is this order being cancelled?"
            className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none" />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50">Cancel</button>
          <button onClick={submit} disabled={busy || !reason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
            {busy ? 'Cancelling…' : 'Confirm Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditVendorManualOrderModal ─────────────────────────────────────────────────

function EditVendorManualOrderModal({ order, onClose, onSaved }) {
  const [form,   setForm]   = useState({
    customerName:  order.customerName || order.shippingAddress?.name || '',
    customerPhone: order.customerPhone || order.shippingAddress?.phone || '',
    customerEmail: order.guestEmail || '',
    source:        order.source || 'in-store',
    paymentMethod: order.paymentMethod || 'cash',
    notes:         order.notes || '',
  });
  const [saving, setSaving] = useState(false);

  function e(field) { return (ev) => setForm((f) => ({ ...f, [field]: ev.target.value })); }

  async function submit(ev) {
    ev.preventDefault();
    setSaving(true);
    try {
      await api.put(`/vendors/manual-orders/${order._id}`, form);
      toast.success('Order updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100 shrink-0">
          <h2 className="font-bold text-secondary-900">Edit Order — #{order.orderId}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Customer Name *</label>
              <input value={form.customerName} onChange={e('customerName')} required className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Phone *</label>
              <input value={form.customerPhone} onChange={e('customerPhone')} required className={INPUT_CLS} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Email <span className="text-secondary-400 font-normal">(optional)</span></label>
            <input value={form.customerEmail} onChange={e('customerEmail')} type="email" className={INPUT_CLS} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Source</label>
              <select value={form.source} onChange={e('source')} className={INPUT_CLS + ' bg-white'}>
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Payment</label>
              <select value={form.paymentMethod} onChange={e('paymentMethod')} className={INPUT_CLS + ' bg-white'}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e('notes')} rows={3} className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
          </div>
          {/* Read-only items */}
          <div>
            <p className="text-sm font-medium text-secondary-700 mb-2">Items <span className="text-secondary-400 font-normal">(read-only — cannot change after creation)</span></p>
            <div className="bg-secondary-50 rounded-xl divide-y divide-secondary-100 overflow-hidden">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  {item.image ? (
                    <img src={normalizeImageUrl(item.image)} alt={item.title} className="w-8 h-8 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-secondary-200 flex items-center justify-center shrink-0"><Package size={12} className="text-secondary-400" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-secondary-800 line-clamp-1">{item.title}</p>
                    <p className="text-xs text-secondary-400">{item.quantity} × {formatCurrency(item.price)}</p>
                  </div>
                  <p className="text-sm font-semibold text-secondary-800 shrink-0">{formatCurrency(item.quantity * item.price)}</p>
                </div>
              ))}
            </div>
          </div>
        </form>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-secondary-100 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-secondary-200 rounded-lg text-sm font-medium text-secondary-700 hover:bg-secondary-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CreateVendorManualOrderModal ──────────────────────────────────────────────

function CreateVendorManualOrderModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    source: 'in-store', paymentMethod: 'cash', notes: '', discount: '',
  });
  const [items,          setItems]          = useState([]);
  const [productSearch,  setProductSearch]  = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searching,      setSearching]      = useState(false);
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [saving,         setSaving]         = useState(false);
  const searchRef = useRef(null);

  // Debounced product search
  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); setShowDropdown(false); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get('/vendors/products', { params: { search: productSearch, limit: 10, page: 1 } });
        setProductResults(data.products || []);
        setShowDropdown(true);
      } catch {} finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  function e(field) { return (ev) => setForm((f) => ({ ...f, [field]: ev.target.value })); }

  function addProduct(product) {
    if (items.find((i) => i.product._id === product._id)) {
      toast.error('Product already added');
      return;
    }
    setItems((prev) => [...prev, { product, qty: 1, price: product.price, serialNumber: '' }]);
    setProductSearch('');
    setShowDropdown(false);
    setProductResults([]);
  }

  function updateItem(idx, field, val) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  function removeItem(idx) { setItems((prev) => prev.filter((_, i) => i !== idx)); }

  const subtotal  = items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 1), 0);
  const discount  = parseFloat(form.discount) || 0;
  const total     = Math.max(0, subtotal - discount);

  async function submit(ev) {
    ev.preventDefault();
    if (!form.customerName.trim()) return toast.error('Customer name required');
    if (!form.customerPhone.trim()) return toast.error('Phone number required');
    if (!items.length) return toast.error('Add at least one product');
    setSaving(true);
    try {
      const payload = {
        ...form,
        discount: parseFloat(form.discount) || 0,
        amountPaid: total,
        items: items.map((it) => ({
          productId: it.product._id,
          qty: parseInt(it.qty) || 1,
          price: parseFloat(it.price) || it.product.price,
          serialNumber: it.serialNumber?.trim() || undefined,
        })),
      };
      const { data } = await api.post('/vendors/manual-orders', payload);
      toast.success(`Order ${data.data.orderId} created${data.data.warrantyCount > 0 ? ` · ${data.data.warrantyCount} warranty registered` : ''}`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create order');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100 shrink-0">
          <h2 className="font-bold text-secondary-900 text-lg">Create Manual Order</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="flex flex-col">
          <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">

            {/* Customer info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-secondary-700 mb-1">Customer Name *</label>
                <input value={form.customerName} onChange={e('customerName')} required className={INPUT_CLS} placeholder="Full name" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-secondary-700 mb-1">Phone *</label>
                <input value={form.customerPhone} onChange={e('customerPhone')} required className={INPUT_CLS} placeholder="10-digit mobile" />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Email <span className="text-secondary-400 font-normal">(optional)</span></label>
                <input value={form.customerEmail} onChange={e('customerEmail')} type="email" className={INPUT_CLS} placeholder="For warranty emails" />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Source</label>
                <select value={form.source} onChange={e('source')} className={INPUT_CLS + ' bg-white'}>
                  {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Payment Method</label>
                <select value={form.paymentMethod} onChange={e('paymentMethod')} className={INPUT_CLS + ' bg-white'}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Discount (₹)</label>
                <input type="number" min="0" step="0.01" value={form.discount} onChange={e('discount')} className={INPUT_CLS} placeholder="0" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-secondary-700 mb-1">Notes <span className="text-secondary-400 font-normal">(internal)</span></label>
                <textarea value={form.notes} onChange={e('notes')} rows={2} className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
              </div>
            </div>

            {/* Product search */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Add Products</label>
              <div className="relative" ref={searchRef}>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                <input
                  value={productSearch}
                  onChange={(ev) => setProductSearch(ev.target.value)}
                  onFocus={() => productResults.length > 0 && setShowDropdown(true)}
                  placeholder="Search by name or SKU (type 2+ chars)…"
                  className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                {searching && <Spinner size="sm" className="absolute right-3 top-2" />}
                {showDropdown && productResults.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 bg-white border border-secondary-200 rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
                    {productResults.map((p) => (
                      <button key={p._id} type="button" onClick={() => addProduct(p)}
                        className="flex items-center gap-3 w-full px-4 py-3 hover:bg-secondary-50 transition-colors text-left border-b border-secondary-100 last:border-0">
                        {p.images?.[0] ? (
                          <img src={normalizeImageUrl(p.images[0])} alt={p.title} className="w-8 h-8 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-secondary-100 flex items-center justify-center shrink-0"><Package size={12} className="text-secondary-300" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary-900 line-clamp-1">{p.title}</p>
                          <p className="text-xs text-secondary-400">{p.sku || '—'} · {formatCurrency(p.price)}</p>
                        </div>
                        {p.hasWarranty && <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">Warranty</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items table */}
            {items.length > 0 && (
              <div className="border border-secondary-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-secondary-500 uppercase">Product</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-secondary-500 uppercase text-center w-20">Qty</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-secondary-500 uppercase text-right w-28">Price (₹)</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-secondary-500 uppercase text-right w-24">Subtotal</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100">
                    {items.map((it, i) => (
                      <>
                        <tr key={it.product._id} className="hover:bg-secondary-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {it.product.images?.[0] ? (
                                <img src={normalizeImageUrl(it.product.images[0])} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded bg-secondary-100 flex items-center justify-center shrink-0"><Package size={10} className="text-secondary-300" /></div>
                              )}
                              <span className="font-medium text-secondary-800 line-clamp-1">{it.product.title}</span>
                              {it.product.hasWarranty && <span className="text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full shrink-0">W</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" min="1" value={it.qty}
                              onChange={(ev) => updateItem(i, 'qty', ev.target.value)}
                              className="w-16 text-center border border-secondary-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" min="0" step="0.01" value={it.price}
                              onChange={(ev) => updateItem(i, 'price', ev.target.value)}
                              className="w-24 text-right border border-secondary-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-secondary-800">
                            {formatCurrency((parseFloat(it.price) || 0) * (parseInt(it.qty) || 1))}
                          </td>
                          <td className="px-3 py-3">
                            <button type="button" onClick={() => removeItem(i)}
                              className="p-1 text-secondary-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                        {it.product.hasWarranty && (
                          <tr key={`${it.product._id}-serial`} className="bg-green-50/50">
                            <td colSpan={5} className="px-4 py-2">
                              <div className="flex items-center gap-3">
                                <Shield size={12} className="text-green-600 shrink-0" />
                                <span className="text-xs text-green-700 font-medium">Serial / Warranty Code:</span>
                                <input value={it.serialNumber} onChange={(ev) => updateItem(i, 'serialNumber', ev.target.value)}
                                  placeholder="Enter serial number or leave blank"
                                  className="flex-1 text-xs border border-green-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-green-300" />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
                {/* Footer */}
                <div className="bg-secondary-50 px-4 py-3 border-t border-secondary-200 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary-500">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary-500">Discount</span>
                      <span className="text-green-600 font-medium">−{formatCurrency(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-secondary-200 pt-1.5 mt-1.5">
                    <span className="text-secondary-900">Total</span>
                    <span className="text-primary-700 text-base">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-secondary-100 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-secondary-200 rounded-lg text-sm font-medium text-secondary-700 hover:bg-secondary-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors min-w-[140px]">
              {saving ? 'Creating…' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function VendorManualOrders() {
  const { user } = useSelector((s) => s.auth);
  const [rev,              setRev]             = useState(0);
  const [showModal,        setShowModal]       = useState(false);
  const [editingOrder,     setEditingOrder]    = useState(null);
  const [cancellingOrder,  setCancellingOrder] = useState(null);
  const [search,           setSearch]          = useState('');
  const [sourceFilter,     setSourceFilter]    = useState('all');
  const [page,             setPage]            = useState(1);
  const [expandedOrder,    setExpandedOrder]   = useState(null);

  const { data, isLoading } = useFetch(
    ['vendor-manual-orders', user?._id, page, search, sourceFilter, rev],
    () => api.get('/vendors/manual-orders', {
      params: { page, limit: 20, search: search || undefined, source: sourceFilter !== 'all' ? sourceFilter : undefined },
    }).then((r) => r.data),
  );

  const orders     = data?.data || [];
  const pagination = data?.pagination || {};
  const refresh    = () => setRev((r) => r + 1);

  // Stats computed from current page
  const stats = {
    total:       pagination.total || 0,
    inStore:     orders.filter((o) => o.source === 'in-store').length,
    phone:       orders.filter((o) => o.source === 'phone').length,
    withWarranty:orders.filter((o) => o.warrantyCount > 0).length,
    revenue:     orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
  };

  function sendWhatsApp(order) {
    const phone = order.customerPhone || order.shippingAddress?.phone || '';
    if (!phone) return toast.error('No phone number for this order');
    const itemLines = order.items.map((i) => `• ${i.title} ×${i.quantity} = ${formatCurrency(i.price * i.quantity)}`).join('\n');
    const msg = encodeURIComponent(
      `*Receipt – Order #${order.orderId}*\n\nHi ${order.customerName || order.shippingAddress?.name || 'Customer'},\n\n${itemLines}\n\n*Total: ${formatCurrency(order.totalAmount)}*\nPayment: ${order.paymentMethod?.replace('_', ' ') || 'cash'}\n\nFor warranty support: macgly.com/warranty-check`
    );
    window.open(`https://wa.me/91${phone.replace(/\D/g, '')}?text=${msg}`, '_blank');
  }

  async function downloadInvoice(orderId) {
    try {
      const res = await api.get(`/vendors/orders/${orderId}/invoice`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `invoice-${orderId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Invoice not available'); }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Manual Orders</h1>
          <p className="text-sm text-secondary-400 mt-0.5">In-store and phone sales with warranty tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors">
            <Plus size={15} /> Create Manual Order
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Orders',  value: stats.total,               icon: ShoppingBag, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'In-Store',      value: stats.inStore,             icon: Store,       color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Phone Orders',  value: stats.phone,               icon: Phone,       color: 'text-cyan-600',   bg: 'bg-cyan-50' },
          { label: 'With Warranty', value: stats.withWarranty,        icon: Shield,      color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Revenue',       value: formatCurrency(stats.revenue), icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50', valCls: 'text-amber-700 text-sm font-black' },
        ].map(({ label, value, icon: Icon, color, bg, valCls }) => (
          <div key={label} className="bg-white border border-secondary-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={17} className={color} />
            </div>
            <div className="min-w-0">
              <p className={`text-xl font-black leading-tight truncate ${valCls || 'text-secondary-900'}`}>{value}</p>
              <p className="text-xs text-secondary-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input value={search} onChange={(ev) => { setSearch(ev.target.value); setPage(1); }}
            placeholder="Search order ID, phone, or name…"
            className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <select value={sourceFilter} onChange={(ev) => { setSourceFilter(ev.target.value); setPage(1); }}
          className="border border-secondary-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
          <option value="all">All Sources</option>
          {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
          {orders.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag size={36} className="mx-auto text-secondary-300 mb-3" />
              <p className="text-secondary-500 font-medium">No manual orders yet</p>
              <p className="text-secondary-400 text-sm mt-1">Click "Create Manual Order" to add one</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary-50 border-b border-secondary-200">
                      {['ORDER ID', 'CUSTOMER', 'ITEMS', 'TOTAL', 'SOURCE', 'PAYMENT', 'WARRANTY', 'DATE', 'ACTIONS'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100">
                    {orders.map((o) => {
                      const cancelled   = o.status === 'cancelled';
                      const isExpanded  = expandedOrder === o._id;
                      const itemsTotal  = o.items.reduce((s, i) => s + i.price * i.quantity, 0);
                      return (
                        <>
                          <tr key={o._id} className={`transition-colors ${cancelled ? 'bg-red-50/50 opacity-60' : 'hover:bg-secondary-50'}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-secondary-700">#{o.orderId}</span>
                                {cancelled && <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">CANCELLED</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-secondary-900 text-sm">{o.customerName || o.shippingAddress?.name || '—'}</p>
                              <p className="text-xs text-secondary-400">{o.customerPhone || o.shippingAddress?.phone}</p>
                            </td>
                            <td className="px-4 py-3 text-secondary-600">{o.items.length} item{o.items.length !== 1 ? 's' : ''}</td>
                            <td className="px-4 py-3 font-semibold text-secondary-900">{formatCurrency(o.totalAmount || itemsTotal)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${o.source === 'phone' ? 'bg-cyan-100 text-cyan-700' : 'bg-purple-100 text-purple-700'}`}>
                                {o.source === 'phone' ? 'Phone' : 'In-Store'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-secondary-500 capitalize">{o.paymentMethod?.replace('_', ' ') || '—'}</td>
                            <td className="px-4 py-3">
                              {o.warrantyCount > 0
                                ? <span className="flex items-center gap-1 text-xs font-semibold text-green-700"><Shield size={11} /> Yes ({o.warrantyCount})</span>
                                : <span className="text-xs text-secondary-400">No</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-xs text-secondary-400">{formatDate(o.createdAt)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-0.5">
                                {!cancelled && (
                                  <>
                                    <button onClick={() => setEditingOrder(o)} title="Edit" className="p-1.5 text-secondary-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={13} /></button>
                                    <button onClick={() => setCancellingOrder(o)} title="Cancel" className="p-1.5 text-secondary-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Ban size={13} /></button>
                                  </>
                                )}
                                <button onClick={() => sendWhatsApp(o)} title="WhatsApp receipt" className="p-1.5 text-secondary-300 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Send size={13} /></button>
                                <button onClick={() => downloadInvoice(o._id)} title="Invoice" className="p-1.5 text-secondary-300 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><FileDown size={13} /></button>
                                <button onClick={() => setExpandedOrder(isExpanded ? null : o._id)} className="p-1.5 text-secondary-300 hover:text-secondary-600 rounded-lg transition-colors">
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${o._id}-expand`}>
                              <td colSpan={9} className="px-4 pb-4 bg-secondary-50 border-b border-secondary-100">
                                <div className="mt-3 space-y-2">
                                  {o.items.map((item, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                      {item.image ? (
                                        <img src={normalizeImageUrl(item.image)} alt={item.title} className="w-9 h-9 rounded-lg object-cover bg-white border border-secondary-200 shrink-0" />
                                      ) : (
                                        <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0"><Package size={12} className="text-secondary-300" /></div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-secondary-800">{item.title}</p>
                                        <p className="text-xs text-secondary-400">{item.quantity} × {formatCurrency(item.price)}</p>
                                      </div>
                                      <p className="text-sm font-semibold text-secondary-800">{formatCurrency(item.quantity * item.price)}</p>
                                    </div>
                                  ))}
                                  {cancelled && o.cancellation?.reason && (
                                    <div className="mt-2 pt-2 border-t border-red-200 text-xs text-red-600">
                                      <span className="font-semibold">Cancellation reason:</span> {o.cancellation.reason}
                                      {o.cancellation.cancelledAt && <span className="text-secondary-400 ml-2">· {formatDate(o.cancellation.cancelledAt)}</span>}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="block lg:hidden divide-y divide-secondary-100">
                {orders.map((o) => {
                  const cancelled  = o.status === 'cancelled';
                  const isExpanded = expandedOrder === o._id;
                  return (
                    <div key={o._id} className={`p-4 ${cancelled ? 'bg-red-50/30 opacity-70' : ''}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-secondary-700">#{o.orderId}</span>
                            {cancelled && <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">CANCELLED</span>}
                          </div>
                          <p className="text-sm font-medium text-secondary-900 mt-0.5">{o.customerName || '—'}</p>
                          <p className="text-xs text-secondary-400">{o.customerPhone}</p>
                        </div>
                        <p className="font-bold text-secondary-900">{formatCurrency(o.totalAmount)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-secondary-500 mb-3">
                        <span className={`font-semibold px-2 py-0.5 rounded-full ${o.source === 'phone' ? 'bg-cyan-100 text-cyan-700' : 'bg-purple-100 text-purple-700'}`}>
                          {o.source === 'phone' ? 'Phone' : 'In-Store'}
                        </span>
                        <span>{o.items.length} items</span>
                        {o.warrantyCount > 0 && <span className="text-green-600 font-semibold flex items-center gap-0.5"><Shield size={10} /> {o.warrantyCount} warranty</span>}
                        <span>{formatDate(o.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {!cancelled && (
                          <>
                            <button onClick={() => setEditingOrder(o)} className="p-1.5 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Pencil size={13} /></button>
                            <button onClick={() => setCancellingOrder(o)} className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Ban size={13} /></button>
                          </>
                        )}
                        <button onClick={() => sendWhatsApp(o)} className="p-1.5 text-secondary-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><Send size={13} /></button>
                        <button onClick={() => downloadInvoice(o._id)} className="p-1.5 text-secondary-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"><FileDown size={13} /></button>
                        <button onClick={() => setExpandedOrder(isExpanded ? null : o._id)} className="p-1.5 text-secondary-400 rounded-lg ml-auto">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-secondary-100 space-y-2">
                          {o.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-2">
                              {item.image ? <img src={normalizeImageUrl(item.image)} alt="" className="w-8 h-8 rounded object-cover shrink-0" /> : null}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-secondary-800 line-clamp-1">{item.title}</p>
                                <p className="text-xs text-secondary-400">{item.quantity} × {formatCurrency(item.price)}</p>
                              </div>
                            </div>
                          ))}
                          {cancelled && o.cancellation?.reason && (
                            <p className="text-xs text-red-600 mt-1"><span className="font-semibold">Reason:</span> {o.cancellation.reason}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
                  <p className="text-xs text-secondary-500">{pagination.total} total orders</p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 border border-secondary-200 rounded-lg text-sm disabled:opacity-40 hover:bg-secondary-50 transition-colors">Prev</button>
                    {Array.from({ length: Math.min(pagination.totalPages, 6) }, (_, i) => i + 1).map((p) => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100 text-secondary-600'}`}>
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                      className="px-3 py-1.5 border border-secondary-200 rounded-lg text-sm disabled:opacity-40 hover:bg-secondary-50 transition-colors">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showModal && <CreateVendorManualOrderModal onClose={() => setShowModal(false)} onCreated={refresh} />}
      {editingOrder && <EditVendorManualOrderModal order={editingOrder} onClose={() => setEditingOrder(null)} onSaved={refresh} />}
      {cancellingOrder && <CancelVendorManualOrderDialog order={cancellingOrder} onClose={() => setCancellingOrder(null)} onCancelled={refresh} />}
    </div>
  );
}
