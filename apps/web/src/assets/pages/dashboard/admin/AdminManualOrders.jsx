import { useState, useEffect, useRef } from 'react';
import {
  Plus, RefreshCw, Search, Edit2, X, Check,
  AlertCircle, ShoppingBag, Phone, Store,
  ShieldCheck, IndianRupee, MessageCircle,
  FileText, Trash2, Package, ChevronDown,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate, normalizeImageUrl } from '../../../../utils/format';
import toast from 'react-hot-toast';

// ── constants ─────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'upi',           label: 'UPI' },
  { value: 'card',          label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other',         label: 'Other' },
];

const SOURCES = [
  { value: 'in-store', label: 'In-Store' },
  { value: 'phone',    label: 'Phone' },
];

const BLANK_FORM = {
  customerName: '', customerPhone: '', customerEmail: '',
  source: 'in-store', paymentMethod: 'cash',
  discount: '', notes: '',
};

// ── helpers ───────────────────────────────────────────────────────────────────

function SourceBadge({ source }) {
  if (source === 'in-store') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      <Store size={10} /> In-Store
    </span>
  );
  if (source === 'phone') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
      <Phone size={10} /> Phone
    </span>
  );
  return null;
}

function StatusBadge({ status }) {
  const map = {
    delivered:  'bg-green-100 text-green-700',
    cancelled:  'bg-red-100 text-red-700',
    pending:    'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] || 'bg-secondary-100 text-secondary-600'}`}>
      {status}
    </span>
  );
}

// ── product search (used in create modal) ─────────────────────────────────────

function ProductSearchInput({ onAdd }) {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const ref                   = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/admin/products', { params: { search: q, limit: 10 } });
        setResults(data.products || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  function pick(product) {
    onAdd(product);
    setQ('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products by name or SKU…"
          className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-secondary-200 shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => pick(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary-50 text-left transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-secondary-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {p.images?.[0] ? (
                  <img src={normalizeImageUrl(p.images[0])} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Package size={12} className="text-secondary-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-secondary-800 truncate">{p.title}</p>
                <p className="text-xs text-secondary-400">SKU: {p.sku || '—'} · {formatCurrency(p.price)}</p>
              </div>
              {p.hasWarranty && (
                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full flex-shrink-0">
                  Warranty
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── create / edit modal ───────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }) {
  const [form, setForm]     = useState(BLANK_FORM);
  const [items, setItems]   = useState([]);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (parseInt(i.qty) || 1), 0);
  const discount = parseFloat(form.discount) || 0;
  const total    = Math.max(0, subtotal - discount);

  function addProduct(product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product._id);
      if (existing) return prev.map((i) => i.productId === product._id ? { ...i, qty: (i.qty || 1) + 1 } : i);
      return [...prev, {
        productId:    product._id,
        name:         product.title,
        price:        product.price || 0,
        qty:          1,
        image:        product.images?.[0] || '',
        hasWarranty:  product.hasWarranty || false,
        serialNumber: '',
        sku:          product.sku || '',
      }];
    });
  }

  function updateItem(idx, key, val) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customerName.trim()) return toast.error('Customer name is required');
    if (!form.customerPhone.trim()) return toast.error('Customer phone is required');
    if (!items.length) return toast.error('Add at least one product');
    setSaving(true);
    try {
      const payload = {
        customerName:  form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        source:        form.source,
        paymentMethod: form.paymentMethod,
        discount:      discount || 0,
        notes:         form.notes.trim() || undefined,
        items: items.map((i) => ({
          productId:    i.productId,
          qty:          parseInt(i.qty) || 1,
          price:        parseFloat(i.price) || 0,
          serialNumber: i.serialNumber?.trim() || undefined,
        })),
      };
      const { data } = await api.post('/admin/manual-orders', payload);
      toast.success(`Order created: ${data.order.orderId}`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create order');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200">
          <h2 className="font-bold text-secondary-900 text-lg">Create Manual Order</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
              <input value={form.customerName} onChange={set('customerName')} placeholder="Full name"
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Phone <span className="text-red-500">*</span></label>
              <input value={form.customerPhone} onChange={set('customerPhone')} placeholder="e.g. 9944556683"
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Email (optional)</label>
              <input value={form.customerEmail} onChange={set('customerEmail')} placeholder="customer@email.com"
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Source</label>
              <div className="relative">
                <select value={form.source} onChange={set('source')}
                  className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white appearance-none">
                  {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Payment Method</label>
              <div className="relative">
                <select value={form.paymentMethod} onChange={set('paymentMethod')}
                  className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white appearance-none">
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Add Products */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Add Products <span className="text-red-500">*</span></label>
            <ProductSearchInput onAdd={addProduct} />
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-secondary-100 bg-secondary-50">
                  <div className="w-9 h-9 rounded-lg bg-white border border-secondary-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.image ? (
                      <img src={normalizeImageUrl(item.image)} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Package size={14} className="text-secondary-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-medium text-secondary-800 truncate">{item.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-secondary-500">Qty</span>
                        <input
                          type="number" min="1" value={item.qty}
                          onChange={(e) => updateItem(idx, 'qty', e.target.value)}
                          className="w-14 border border-secondary-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-secondary-500">₹</span>
                        <input
                          type="number" min="0" value={item.price}
                          onChange={(e) => updateItem(idx, 'price', e.target.value)}
                          className="w-24 border border-secondary-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                      </div>
                      {item.hasWarranty && (
                        <input
                          value={item.serialNumber}
                          onChange={(e) => updateItem(idx, 'serialNumber', e.target.value)}
                          placeholder="Serial # (for warranty)"
                          className="flex-1 min-w-32 border border-green-200 bg-green-50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
                        />
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 pt-0.5">
                    <p className="text-sm font-semibold text-secondary-800">
                      {formatCurrency((parseFloat(item.price) || 0) * (parseInt(item.qty) || 1))}
                    </p>
                    {item.hasWarranty && (
                      <span className="text-xs text-green-600 flex items-center gap-0.5 justify-end mt-0.5">
                        <ShieldCheck size={10} /> Warranty
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={() => removeItem(idx)}
                    className="p-1 hover:bg-red-50 rounded-lg text-secondary-400 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Discount */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Discount (₹)</label>
            <input
              type="number" min="0" value={form.discount} onChange={set('discount')}
              placeholder="0"
              className="w-32 border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes} onChange={set('notes')} rows={2}
              placeholder="Internal notes about this order…"
              className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-secondary-200 bg-secondary-50 rounded-b-2xl">
          <p className="text-sm text-secondary-600">
            <span className="font-medium">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            {discount > 0 && <span className="text-green-600 ml-1">· −{formatCurrency(discount)}</span>}
            <span className="text-secondary-900 font-bold ml-2">Total: {formatCurrency(total)}</span>
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating…</>
              ) : (
                <><Check size={15} /> Create Order</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── edit modal ────────────────────────────────────────────────────────────────

function EditModal({ order, onClose, onSaved }) {
  const [form, setForm]     = useState({
    customerName:  order.customerName  || order.shippingAddress?.name || '',
    customerPhone: order.customerPhone || order.shippingAddress?.phone || '',
    source:        order.source        || 'in-store',
    paymentMethod: order.paymentMethod || 'cash',
    notes:         order.notes         || '',
    internalNotes: order.internalNotes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/admin/manual-orders/${order._id}`, form);
      toast.success('Order updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200">
          <h2 className="font-bold text-secondary-900">Edit Order — {order.orderId}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-secondary-600 mb-1">Customer Name</label>
              <input value={form.customerName} onChange={set('customerName')}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 mb-1">Phone</label>
              <input value={form.customerPhone} onChange={set('customerPhone')}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-secondary-600 mb-1">Source</label>
              <select value={form.source} onChange={set('source')}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 mb-1">Payment Method</label>
              <select value={form.paymentMethod} onChange={set('paymentMethod')}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-600 mb-1">Customer Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} resize="none"
              className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary-600 mb-1">Internal Notes</label>
            <textarea value={form.internalNotes} onChange={set('internalNotes')} rows={2}
              className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-secondary-200">
          <button onClick={onClose}
            className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving…' : <><Check size={14} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── cancel dialog ─────────────────────────────────────────────────────────────

function CancelDialog({ order, onClose, onCancelled }) {
  const [reason, setReason]   = useState('');
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    if (!reason.trim()) return toast.error('Reason is required');
    setCancelling(true);
    try {
      const { data } = await api.put(`/admin/manual-orders/${order._id}/cancel`, { reason });
      toast.success(`Order cancelled · ${data.warrantiesVoided} warrant${data.warrantiesVoided !== 1 ? 'ies' : 'y'} voided`);
      onCancelled();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to cancel');
    } finally { setCancelling(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-secondary-900">Cancel Order?</h3>
            <p className="text-sm text-secondary-500 mt-0.5">Order: {order.orderId}</p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-sm text-yellow-800">
          ⚠️ Cancelling this order will <strong>void all associated warranties</strong>.
        </div>
        <div className="mb-5">
          <label className="block text-sm font-medium text-secondary-700 mb-1">Cancellation Reason <span className="text-red-500">*</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason for cancellation…"
            className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose}
            className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50">
            Keep Order
          </button>
          <button onClick={handleCancel} disabled={cancelling}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {cancelling ? 'Cancelling…' : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function AdminManualOrders() {
  const [orders, setOrders]       = useState([]);
  const [stats, setStats]         = useState({ total: 0, inStore: 0, phone: 0, withWarranty: 0, revenue: 0 });
  const [pagination, setPagination] = useState({});
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  const [showCreate, setShowCreate] = useState(false);
  const [editOrder, setEditOrder]   = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);

  async function loadOrders() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/manual-orders', {
        params: { page, limit: 20, source: sourceFilter, search: search || undefined },
      });
      setOrders(data.orders || []);
      setPagination(data.pagination || {});
      if (data.stats) setStats(data.stats);
    } catch { toast.error('Failed to load orders'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadOrders(); }, [page, sourceFilter, search]);

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function openWhatsApp(order) {
    const phone = order.customerPhone || order.shippingAddress?.phone;
    if (!phone) return toast.error('No phone number on this order');
    const lines = (order.items || []).map(
      (i) => `• ${i.title} ×${i.quantity} — ₹${((i.price ?? 0) * (i.quantity ?? 1)).toLocaleString('en-IN')}`,
    );
    const msg = [
      `🧾 *Purchase Receipt - Macgly Tools & Machinery*`,
      `Order ID: ${order.orderId}`,
      `Date: ${formatDate(order.createdAt)}`,
      ``,
      `*Items:*`,
      ...lines,
      ``,
      `Subtotal: ₹${(order.subtotal ?? order.totalAmount ?? 0).toLocaleString('en-IN')}`,
      order.discount ? `Discount: ₹${order.discount.toLocaleString('en-IN')}` : null,
      `*Total: ₹${(order.totalAmount ?? 0).toLocaleString('en-IN')}*`,
      `Payment: ${(order.paymentMethod || '').toUpperCase()}`,
      ``,
      `Thank you for shopping with Macgly Tools & Machinery! 🙏`,
    ].filter((l) => l !== null).join('\n');
    window.open(`https://wa.me/91${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`);
  }

  const STAT_CARDS = [
    { label: 'Total Orders',   value: stats.total,        Icon: ShoppingBag,   color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'In-Store',       value: stats.inStore,       Icon: Store,         color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Phone Orders',   value: stats.phone,         Icon: Phone,         color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'With Warranty',  value: stats.withWarranty,  Icon: ShieldCheck,   color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Revenue',        value: formatCurrency(stats.revenue), Icon: IndianRupee, color: 'text-primary-600', bg: 'bg-primary-50', isText: true },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Manual Orders</h1>
          <p className="text-sm text-secondary-500 mt-0.5">In-store and phone sales with warranty tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadOrders}
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            <Plus size={15} /> Create Manual Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_CARDS.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-secondary-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="font-bold text-secondary-900 text-lg leading-tight">{value}</p>
              <p className="text-xs text-secondary-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by order ID, name, phone…"
            className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </form>
        <div className="relative">
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white pr-8 appearance-none"
          >
            <option value="all">All Sources</option>
            <option value="in-store">In-Store</option>
            <option value="phone">Phone</option>
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-secondary-200 bg-secondary-50">
                {['ORDER ID', 'CUSTOMER', 'ITEMS', 'TOTAL', 'SOURCE', 'PAYMENT', 'WARRANTY', 'DATE', 'ACTIONS'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-secondary-400">
                    <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
                    Loading orders…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-secondary-400">
                    <ShoppingBag size={36} className="mx-auto mb-2 opacity-25" />
                    No manual orders yet. Click "Create Manual Order" to add one.
                  </td>
                </tr>
              ) : orders.map((order) => (
                <tr key={order._id} className={`hover:bg-secondary-50 transition-colors ${order.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-semibold text-secondary-800">{order.orderId}</span>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-secondary-800 text-sm">
                      {order.customerName || order.user?.name || order.shippingAddress?.name || 'Guest'}
                    </p>
                    <p className="text-xs text-secondary-400">
                      {order.customerPhone || order.shippingAddress?.phone || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-secondary-600">
                    {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-3 font-semibold text-secondary-900">
                    {formatCurrency(order.totalAmount ?? 0)}
                    {order.discount > 0 && (
                      <p className="text-xs text-green-600 font-normal">−{formatCurrency(order.discount)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3"><SourceBadge source={order.source} /></td>
                  <td className="px-4 py-3 text-secondary-600 capitalize text-xs">{order.paymentMethod}</td>
                  <td className="px-4 py-3">
                    {order.warrantyCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                        <ShieldCheck size={12} /> {order.warrantyCount}
                      </span>
                    ) : (
                      <span className="text-xs text-secondary-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-secondary-500 text-xs whitespace-nowrap">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      {order.status !== 'cancelled' && (
                        <>
                          <button
                            onClick={() => setEditOrder(order)}
                            title="Edit"
                            className="p-1.5 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setCancelOrder(order)}
                            title="Cancel"
                            className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openWhatsApp(order)}
                        title="WhatsApp receipt"
                        className="p-1.5 text-secondary-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <MessageCircle size={13} />
                      </button>
                      <a
                        href={`${import.meta.env.VITE_API_URL}/api/invoices/${order._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Invoice"
                        className="p-1.5 text-secondary-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                      >
                        <FileText size={13} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
            <p className="text-xs text-secondary-500">
              {pagination.total} total orders
            </p>
            <div className="flex gap-1">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100 text-secondary-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={loadOrders}
        />
      )}
      {editOrder && (
        <EditModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={loadOrders}
        />
      )}
      {cancelOrder && (
        <CancelDialog
          order={cancelOrder}
          onClose={() => setCancelOrder(null)}
          onCancelled={loadOrders}
        />
      )}

    </div>
  );
}
