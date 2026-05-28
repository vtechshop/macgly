import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Package, Truck, FileText,
  RotateCcw, Edit2, Check, X, ChevronDown,
  Clock, CheckCircle,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import toast from 'react-hot-toast';

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'pending',          label: 'Pending' },
  { value: 'pending_payment',  label: 'Pending Payment' },
  { value: 'paid',             label: 'Paid' },
  { value: 'packed',           label: 'Packed' },
  { value: 'shipped',          label: 'Shipped' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered',        label: 'Delivered' },
  { value: 'cancelled',        label: 'Cancelled' },
  { value: 'returned',         label: 'Returned' },
];

const CARRIERS = [
  { value: 'Shiprocket',  label: 'Shiprocket' },
  { value: 'Delhivery',  label: 'Delhivery' },
  { value: 'BlueDart',   label: 'BlueDart' },
  { value: 'DTDC',       label: 'DTDC' },
  { value: 'Ekart',      label: 'Ekart' },
  { value: 'Other',      label: 'Other' },
];

const STATUS_META = {
  pending:          { label: 'Pending',           color: 'text-secondary-600',  dot: 'bg-secondary-400' },
  pending_payment:  { label: 'Pending Payment',   color: 'text-yellow-700',     dot: 'bg-yellow-500' },
  placed:           { label: 'Placed',            color: 'text-blue-600',       dot: 'bg-blue-500' },
  paid:             { label: 'Paid',              color: 'text-blue-700',       dot: 'bg-blue-600' },
  confirmed:        { label: 'Confirmed',         color: 'text-blue-700',       dot: 'bg-blue-600' },
  processing:       { label: 'Processing',        color: 'text-indigo-700',     dot: 'bg-indigo-500' },
  packed:           { label: 'Packed',            color: 'text-indigo-700',     dot: 'bg-indigo-500' },
  shipped:          { label: 'Shipped',           color: 'text-purple-700',     dot: 'bg-purple-500' },
  out_for_delivery: { label: 'Out for Delivery',  color: 'text-orange-700',     dot: 'bg-orange-500' },
  delivered:        { label: 'Delivered',         color: 'text-green-700',      dot: 'bg-green-500' },
  cancelled:        { label: 'Cancelled',         color: 'text-red-700',        dot: 'bg-red-500' },
  returned:         { label: 'Returned',          color: 'text-secondary-600',  dot: 'bg-secondary-400' },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  return iso
    ? new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—';
}

// ── sub-components ────────────────────────────────────────────────────────────

function InfoCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-secondary-200 p-4">
      <p className="text-xs font-bold text-secondary-500 uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  );
}

function StatusCard({ title, value, subtext, colorClass = 'text-secondary-900' }) {
  return (
    <div className="bg-white rounded-xl border border-secondary-200 p-4">
      <p className="text-xs text-secondary-500 mb-1">{title}</p>
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
      {subtext && <p className="text-xs text-secondary-400 mt-0.5">{subtext}</p>}
    </div>
  );
}

// ── address edit ──────────────────────────────────────────────────────────────

function AddressEditForm({ addr, onSave, onCancel }) {
  const [form, setForm] = useState({
    name:    addr?.name    || '',
    phone:   addr?.phone   || '',
    line1:   addr?.line1   || '',
    line2:   addr?.line2   || '',
    city:    addr?.city    || '',
    state:   addr?.state   || '',
    pincode: addr?.pincode || '',
    country: addr?.country || 'India',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-secondary-600 mb-1 block">Full Name</label>
          <input value={form.name} onChange={set('name')} className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <div>
          <label className="text-xs font-medium text-secondary-600 mb-1 block">Phone</label>
          <input value={form.phone} onChange={set('phone')} className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-secondary-600 mb-1 block">Address Line 1</label>
        <input value={form.line1} onChange={set('line1')} className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
      </div>
      <div>
        <label className="text-xs font-medium text-secondary-600 mb-1 block">Address Line 2 (optional)</label>
        <input value={form.line2} onChange={set('line2')} className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-secondary-600 mb-1 block">City</label>
          <input value={form.city} onChange={set('city')} className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <div>
          <label className="text-xs font-medium text-secondary-600 mb-1 block">State</label>
          <input value={form.state} onChange={set('state')} className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <div>
          <label className="text-xs font-medium text-secondary-600 mb-1 block">Pincode</label>
          <input value={form.pincode} onChange={set('pincode')} className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Check size={14} /> Save Address
        </button>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [rev, setRev] = useState(0);

  // Assign Carrier
  const [carrierTab, setCarrierTab]   = useState('manual');
  const [carrier, setCarrier]         = useState('Shiprocket');
  const [awb, setAwb]                 = useState('');
  const [assigningCarrier, setAssigningCarrier] = useState(false);

  // Status update
  const [newStatus, setNewStatus]     = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Address edit
  const [editingAddress, setEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress]   = useState(false);

  const { data, isLoading } = useFetch(
    ['admin-order-detail', id, rev],
    () => api.get(`/admin/orders/${id}`).then((r) => r.data),
  );

  const order = data?.order;

  // ── actions ──────────────────────────────────────────────────────────────

  async function handleAssignCarrier() {
    if (!awb.trim()) return toast.error('AWB / Tracking Number is required');
    setAssigningCarrier(true);
    try {
      await api.patch(`/admin/orders/${id}/tracking`, {
        carrier,
        trackingId: awb.trim(),
        url: '',
      });
      // Also update status to shipped if not already
      if (!['shipped', 'out_for_delivery', 'delivered'].includes(order.status)) {
        await api.put(`/admin/orders/${id}/status`, {
          status: 'shipped',
          description: `Shipped via ${carrier} · AWB: ${awb.trim()}`,
        });
      }
      toast.success(`Carrier assigned · AWB: ${awb}`);
      setAwb('');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to assign carrier');
    } finally {
      setAssigningCarrier(false);
    }
  }

  async function handleUpdateStatus() {
    if (!newStatus) return toast.error('Select a status');
    if (newStatus === order.status) return toast.error('Order is already in this status');
    setUpdatingStatus(true);
    try {
      await api.put(`/admin/orders/${id}/status`, { status: newStatus });
      toast.success(`Status updated to "${newStatus}"`);
      setNewStatus('');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleSaveAddress(form) {
    setSavingAddress(true);
    try {
      await api.put(`/admin/orders/${id}/address`, form);
      toast.success('Address updated');
      setEditingAddress(false);
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update address');
    } finally {
      setSavingAddress(false);
    }
  }

  // ── loading / error ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary-400 gap-2">
        <div className="w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
        Loading order…
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 text-secondary-400">
        <Package size={40} className="mx-auto mb-3 opacity-25" />
        <p className="font-medium">Order not found</p>
        <Link to="/dashboard/admin/orders" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
          <ArrowLeft size={14} /> Back to Orders
        </Link>
      </div>
    );
  }

  const statusMeta = STATUS_META[order.status] || { label: order.status, color: 'text-secondary-900', dot: 'bg-secondary-400' };
  const paymentMeta = order.paymentStatus === 'paid'
    ? { label: 'Paid', color: 'text-green-700' }
    : { label: order.paymentStatus?.charAt(0).toUpperCase() + order.paymentStatus?.slice(1) || 'Pending', color: 'text-yellow-700' };

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link to="/dashboard/admin/orders" className="p-1.5 text-secondary-400 hover:text-secondary-700 hover:bg-secondary-100 rounded-lg transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-xl font-bold text-secondary-900">Order #{order.orderId}</h1>
          </div>
          <p className="text-sm text-secondary-500 pl-9">Placed on {fmtDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`${import.meta.env.VITE_API_URL}/api/invoices/${order._id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors"
          >
            <FileText size={14} /> Download Invoice
          </a>
          <Link
            to="/dashboard/admin/orders"
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors"
          >
            Back to Orders
          </Link>
        </div>
      </div>

      {/* ─── Status Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatusCard
          title="Order Status"
          value={statusMeta.label}
          colorClass={statusMeta.color}
        />
        <StatusCard
          title="Total Amount"
          value={formatCurrency(order.totalAmount ?? 0)}
          subtext={order.gstAmount ? `incl. tax ${formatCurrency(order.gstAmount)}` : undefined}
          colorClass="text-secondary-900"
        />
        <StatusCard
          title="Payment Status"
          value={paymentMeta.label}
          subtext={order.paymentMethod ? order.paymentMethod.toUpperCase() : undefined}
          colorClass={paymentMeta.color}
        />
      </div>

      {/* ─── Items + Customer/Shipping ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Order Items */}
        <InfoCard title="Order Items">
          <div className="space-y-3">
            {order.items?.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-secondary-100 bg-secondary-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {item.image ? (
                    <img
                      src={normalizeImageUrl(item.image)}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <Package size={18} className="text-secondary-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-secondary-800 line-clamp-1">{item.title}</p>
                  <p className="text-xs text-secondary-500">
                    Quantity: {item.quantity}
                  </p>
                  <p className="text-xs font-medium text-primary-600">{formatCurrency(item.price ?? 0)}</p>
                </div>
                <p className="text-sm font-bold text-secondary-800 flex-shrink-0">
                  {formatCurrency((item.price ?? 0) * (item.quantity ?? 1))}
                </p>
              </div>
            ))}
          </div>
        </InfoCard>

        {/* Customer + Shipping */}
        <div className="space-y-4">
          <InfoCard title="Customer Information">
            <p className="font-semibold text-secondary-800">{order.user?.name || 'Guest'}</p>
            {order.user?.email && (
              <p className="text-sm text-secondary-500 mt-0.5">Email: {order.user.email}</p>
            )}
            {order.user?.phone && (
              <p className="text-sm text-secondary-500">Phone: {order.user.phone}</p>
            )}
          </InfoCard>

          <div className="bg-white rounded-xl border border-secondary-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-secondary-500 uppercase tracking-wide">Shipping Address</p>
              {!editingAddress && (
                <button
                  onClick={() => setEditingAddress(true)}
                  className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                >
                  <Edit2 size={11} /> Edit
                </button>
              )}
            </div>
            {editingAddress ? (
              <AddressEditForm
                addr={order.shippingAddress}
                onSave={handleSaveAddress}
                onCancel={() => setEditingAddress(false)}
              />
            ) : order.shippingAddress ? (
              <address className="text-sm not-italic space-y-0.5 leading-relaxed">
                <p className="font-semibold text-secondary-800">{order.shippingAddress.name}</p>
                <p className="text-secondary-500">
                  {[order.shippingAddress.line1, order.shippingAddress.line2].filter(Boolean).join(', ')}
                </p>
                <p className="text-secondary-500">
                  {order.shippingAddress.city}, {order.shippingAddress.state}
                </p>
                <p className="text-secondary-500">{order.shippingAddress.country} — {order.shippingAddress.pincode}</p>
                {order.shippingAddress.phone && (
                  <p className="text-secondary-500">Phone: {order.shippingAddress.phone}</p>
                )}
              </address>
            ) : (
              <p className="text-sm text-secondary-400">No address on file</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Assign Delivery Carrier ──────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h2 className="font-bold text-secondary-900 mb-4 flex items-center gap-2">
          <Truck size={16} className="text-blue-600" /> Assign Delivery Carrier
        </h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setCarrierTab('manual')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              carrierTab === 'manual'
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-secondary-200 text-secondary-700 hover:bg-secondary-50'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setCarrierTab('api')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              carrierTab === 'api'
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-secondary-200 text-secondary-700 hover:bg-secondary-50'
            }`}
          >
            Auto (API)
          </button>
        </div>

        {carrierTab === 'manual' ? (
          <div className="space-y-3">
            <p className="text-sm text-secondary-600">Enter the courier name and tracking number manually.</p>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Delivery Carrier <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white appearance-none"
                >
                  {CARRIERS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                AWB / Tracking Number <span className="text-red-500">*</span>
              </label>
              <input
                value={awb}
                onChange={(e) => setAwb(e.target.value)}
                placeholder="Enter tracking number"
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            <button
              onClick={handleAssignCarrier}
              disabled={assigningCarrier}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {assigningCarrier ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Assigning…</>
              ) : (
                <><Truck size={15} /> Assign Carrier</>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-secondary-600">
              Push this order to Shiprocket automatically and get an AWB number.
            </p>
            <button
              onClick={async () => {
                try {
                  const { data: res } = await api.post(`/admin/orders/${id}/ship`, { carrier: 'shiprocket' });
                  toast.success(`Shipped via ${res.shipment.carrier}${res.shipment.trackingId ? ' · AWB: ' + res.shipment.trackingId : ''}`);
                  setRev((r) => r + 1);
                } catch (err) {
                  toast.error(err?.response?.data?.message || 'Shipment creation failed');
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              <Truck size={15} /> Create Shipment via Shiprocket
            </button>
          </div>
        )}

        {/* Existing tracking info */}
        {order.tracking?.trackingId && (
          <div className="mt-4 p-3 bg-white rounded-xl border border-blue-100">
            <p className="text-xs font-bold text-secondary-500 uppercase mb-1.5">Current Tracking</p>
            <div className="text-sm space-y-0.5">
              <p><span className="font-medium text-secondary-700">Carrier:</span> {order.tracking.carrier || '—'}</p>
              <p><span className="font-medium text-secondary-700">AWB:</span> {order.tracking.trackingId}</p>
              {order.tracking.url && (
                <a href={order.tracking.url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-xs mt-0.5 block">
                  Track shipment →
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Update Order Status ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-secondary-200 p-5">
        <h2 className="font-bold text-secondary-900 mb-4 flex items-center gap-2">
          <Clock size={16} className="text-secondary-500" /> Update Order Status
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full border border-secondary-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white appearance-none"
            >
              <option value="">Select new status…</option>
              {STATUS_OPTIONS.filter((s) => s.value !== order.status).map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
          </div>
          <button
            onClick={handleUpdateStatus}
            disabled={updatingStatus || !newStatus}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            {updatingStatus ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating…</>
            ) : (
              <><CheckCircle size={14} /> Update Status</>
            )}
          </button>
        </div>

        {/* Current status pill */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-secondary-500">Current:</span>
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${statusMeta.color}`}>
            <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </span>
        </div>
      </div>

      {/* ─── Order Timeline ────────────────────────────────────────────────── */}
      {order.tracking?.history?.length > 0 && (
        <div className="bg-white rounded-xl border border-secondary-200 p-5">
          <h2 className="font-bold text-secondary-900 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-secondary-500" /> Order Timeline
          </h2>
          <div className="relative pl-5">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-secondary-100" />
            <div className="space-y-4">
              {[...order.tracking.history].reverse().map((h, i) => (
                <div key={i} className="relative flex items-start gap-3">
                  <div className={`absolute -left-5 mt-0.5 w-3 h-3 rounded-full border-2 border-white ${i === 0 ? 'bg-primary-600' : 'bg-secondary-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-secondary-800 capitalize">
                        {h.status?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-secondary-400">
                        {new Date(h.timestamp).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {h.description && (
                      <p className="text-xs text-secondary-500 mt-0.5">{h.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Actions ─────────────────────────────────────────────────────────*/}
      <div className="flex gap-3 flex-wrap">
        {order.status === 'delivered' && (
          <button
            onClick={() => toast('Use the Payments page to initiate a refund', { icon: 'ℹ️' })}
            className="flex items-center gap-2 text-sm font-medium text-orange-600 border border-orange-200 hover:bg-orange-50 px-4 py-2 rounded-lg transition-colors"
          >
            <RotateCcw size={14} /> Initiate Refund
          </button>
        )}
      </div>

    </div>
  );
}
