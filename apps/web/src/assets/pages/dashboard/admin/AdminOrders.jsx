import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Clock, CreditCard, Box, Truck,
  Navigation, CheckCircle, XCircle, RotateCcw,
  Wallet, Search, RefreshCw, Eye,
  ChevronDown, ChevronUp, Settings, ListChecks, X, Download,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import { formatCurrency, formatRelativeTime, normalizeImageUrl } from '../../../../utils/format';
import toast from 'react-hot-toast';

// ── status meta ───────────────────────────────────────────────────────────────

const STATUS_META = {
  pending:          { label: 'Pending',           bg: 'bg-secondary-100',  text: 'text-secondary-600' },
  pending_payment:  { label: 'Awaiting Payment',  bg: 'bg-yellow-100',     text: 'text-yellow-700' },
  placed:           { label: 'Placed',            bg: 'bg-blue-50',        text: 'text-blue-600' },
  paid:             { label: 'Paid',              bg: 'bg-blue-100',       text: 'text-blue-700' },
  confirmed:        { label: 'Confirmed',         bg: 'bg-blue-100',       text: 'text-blue-700' },
  processing:       { label: 'Processing',        bg: 'bg-indigo-100',     text: 'text-indigo-700' },
  packed:           { label: 'Packed',            bg: 'bg-indigo-100',     text: 'text-indigo-700' },
  shipped:          { label: 'Shipped',           bg: 'bg-purple-100',     text: 'text-purple-700' },
  out_for_delivery: { label: 'Out for Delivery',  bg: 'bg-orange-100',     text: 'text-orange-700' },
  delivered:        { label: 'Delivered',         bg: 'bg-green-100',      text: 'text-green-700' },
  cancelled:        { label: 'Cancelled',         bg: 'bg-red-100',        text: 'text-red-700' },
  returned:         { label: 'Returned',          bg: 'bg-secondary-100',  text: 'text-secondary-500' },
};

const TABS = [
  { value: '',                label: 'All Orders',       Icon: Package,     countKey: 'total',             activeClass: 'bg-primary-600 text-white' },
  { value: 'pending',         label: 'Pending',          Icon: Clock,       countKey: 'pending',           activeClass: 'bg-secondary-700 text-white' },
  { value: 'pending_payment', label: 'Awaiting Payment', Icon: Wallet,      countKey: 'pending_payment',   activeClass: 'bg-yellow-500 text-white' },
  { value: 'paid',            label: 'Paid',             Icon: CreditCard,  countKey: 'paid',              activeClass: 'bg-blue-600 text-white' },
  { value: 'packed',          label: 'Packed',           Icon: Box,         countKey: 'packed',            activeClass: 'bg-indigo-600 text-white' },
  { value: 'shipped',         label: 'Shipped',          Icon: Truck,       countKey: 'shipped',           activeClass: 'bg-purple-600 text-white' },
  { value: 'out_for_delivery',label: 'Out for Delivery', Icon: Navigation,  countKey: 'out_for_delivery',  activeClass: 'bg-orange-500 text-white' },
  { value: 'delivered',       label: 'Delivered',        Icon: CheckCircle, countKey: 'delivered',         activeClass: 'bg-green-600 text-white' },
  { value: 'cancelled',       label: 'Cancelled',        Icon: XCircle,     countKey: 'cancelled',         activeClass: 'bg-red-600 text-white' },
  { value: 'returned',        label: 'Refunded',         Icon: RotateCcw,   countKey: 'returned',          activeClass: 'bg-secondary-600 text-white' },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function playNewOrder() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* silent */ }
}

function isNew(createdAt) {
  return Date.now() - new Date(createdAt).getTime() < 5 * 60 * 1000;
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, bg: 'bg-secondary-100', text: 'text-secondary-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  );
}

function ThumbnailStack({ items = [] }) {
  const imgs = items.slice(0, 3).map((i) => i.image).filter(Boolean);
  const rest = Math.max(0, items.length - 3);
  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1">
        {imgs.map((img, i) => (
          <div key={i} className="w-9 h-9 rounded-lg border-2 border-white bg-secondary-100 overflow-hidden shadow-sm flex-shrink-0">
            <img
              src={normalizeImageUrl(img)}
              alt=""
              className="w-full h-full object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        ))}
        {imgs.length === 0 && (
          <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center">
            <Package size={14} className="text-secondary-400" />
          </div>
        )}
      </div>
      {rest > 0 && <span className="text-xs text-secondary-400 ml-1">+{rest}</span>}
      <span className="text-xs text-secondary-500 ml-1.5">
        {items.length} item{items.length !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

function ExpandedPanel({ order, onManage }) {
  return (
    <div className="bg-secondary-50/80 border-t border-secondary-200 px-5 py-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Order Items */}
        <div>
          <p className="text-xs font-bold text-secondary-500 uppercase tracking-wide mb-3">Order Items</p>
          <div className="space-y-2">
            {order.items?.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg border border-secondary-200 bg-white overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {item.image ? (
                    <img
                      src={normalizeImageUrl(item.image)}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <Package size={13} className="text-secondary-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary-800 truncate">{item.title}</p>
                  <p className="text-xs text-secondary-400">
                    {item.quantity} × {formatCurrency(item.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Address */}
        <div>
          <p className="text-xs font-bold text-secondary-500 uppercase tracking-wide mb-3">Shipping Address</p>
          {order.shippingAddress ? (
            <address className="text-sm not-italic space-y-0.5 leading-relaxed">
              <p className="font-semibold text-secondary-800">{order.shippingAddress.name}</p>
              <p className="text-secondary-500">
                {[order.shippingAddress.line1, order.shippingAddress.line2].filter(Boolean).join(', ')}
              </p>
              <p className="text-secondary-500">
                {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}
              </p>
              {order.shippingAddress.phone && (
                <p className="text-secondary-500">📞 {order.shippingAddress.phone}</p>
              )}
            </address>
          ) : (
            <p className="text-sm text-secondary-400">—</p>
          )}
        </div>

        {/* Order Summary */}
        <div>
          <p className="text-xs font-bold text-secondary-500 uppercase tracking-wide mb-3">Order Summary</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-secondary-600">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal ?? order.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-secondary-600">
              <span>Shipping</span>
              <span>{formatCurrency(order.shippingCharge ?? 0)}</span>
            </div>
            <div className="flex justify-between text-secondary-600">
              <span>Tax</span>
              <span>{formatCurrency(order.gstAmount ?? 0)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>−{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-secondary-900 border-t border-secondary-200 pt-1.5 mt-1">
              <span>Total</span>
              <span>{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
          <button
            onClick={() => onManage(order._id)}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            <Settings size={14} /> Manage Order
          </button>
        </div>

      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

const BULK_STATUSES = [
  { value: 'confirmed',   label: 'Confirmed' },
  { value: 'processing',  label: 'Processing' },
  { value: 'packed',      label: 'Packed' },
  { value: 'shipped',     label: 'Shipped' },
  { value: 'delivered',   label: 'Delivered' },
  { value: 'cancelled',   label: 'Cancelled' },
];

export default function AdminOrders() {
  const navigate   = useNavigate();
  const [page, setPage]               = useState(1);
  const [rev, setRev]                 = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expandedId, setExpandedId]   = useState(null);
  const [countsRev, setCountsRev]     = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus]   = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const prevPaidRef = useRef(null);

  // Auto-refresh counts every 30 s
  useEffect(() => {
    const id = setInterval(() => setCountsRev((r) => r + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Fetch counts
  const { data: counts } = useFetch(
    ['admin-orders-counts', countsRev],
    () => api.get('/admin/orders/counts').then((r) => r.data),
  );

  // New-order sound when paid count increases
  useEffect(() => {
    if (!counts) return;
    const paid = counts.paid ?? 0;
    if (prevPaidRef.current !== null && paid > prevPaidRef.current) {
      playNewOrder();
    }
    prevPaidRef.current = paid;
  }, [counts]);

  // Fetch orders list
  const { data, isLoading } = useFetch(
    ['admin-orders', page, rev, statusFilter, search],
    () =>
      api.get('/admin/orders', {
        params: {
          page,
          limit: 20,
          status: statusFilter || undefined,
          search: search || undefined,
        },
      }).then((r) => r.data),
    { keepPrevious: true },
  );

  const orders = data?.orders || [];
  const pagination = data?.pagination;

  // Search
  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
    setPage(1);
  }

  function refresh() {
    setRev((r) => r + 1);
    setCountsRev((r) => r + 1);
    toast.success('Refreshed');
  }

  function switchTab(value) {
    setStatusFilter(value);
    setPage(1);
    setExpandedId(null);
    setSelectedIds(new Set());
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o._id)));
    }
  }

  async function exportCSV() {
    try {
      const { data } = await api.get('/admin/orders/export', {
        responseType: 'blob',
        params: { status: statusFilter || undefined, search: search || undefined },
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  }

  async function applyBulkStatus() {
    if (!bulkStatus || !selectedIds.size) return;
    if (!confirm(`Change ${selectedIds.size} order(s) to "${bulkStatus}"?`)) return;
    setBulkLoading(true);
    try {
      const { data } = await api.post('/admin/orders/bulk-status', {
        ids: [...selectedIds],
        status: bulkStatus,
      });
      toast.success(`Updated ${data.updated} order(s) to ${bulkStatus}`);
      setSelectedIds(new Set());
      setBulkStatus('');
      setRev((r) => r + 1);
      setCountsRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  }

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const getCount = useCallback((key) => {
    if (!counts || !key) return counts?.total ?? '…';
    return counts[key] ?? 0;
  }, [counts]);

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Order Management</h1>
          <p className="text-sm text-secondary-500 mt-0.5">View and manage all customer orders</p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-secondary-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search order ID, email…"
              className="pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 w-56"
            />
            {searchInput && (
              <button type="button" onClick={clearSearch}
                className="absolute right-2 text-secondary-400 hover:text-secondary-600">
                ×
              </button>
            )}
          </form>
          <button
            onClick={exportCSV}
            title="Export to CSV"
            className="flex items-center gap-1.5 px-3 py-2 border border-secondary-200 rounded-lg text-secondary-600 hover:bg-secondary-50 text-sm font-medium transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={refresh}
            title="Refresh"
            className="p-2 border border-secondary-200 rounded-lg text-secondary-500 hover:bg-secondary-50 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="flex border-b border-secondary-200 min-w-max">
            {TABS.map(({ value, label, Icon, countKey, activeClass }) => {
              const count = getCount(countKey || value || 'total');
              const isActive = statusFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => switchTab(value)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-primary-600 text-primary-700 bg-primary-50/50'
                      : 'border-transparent text-secondary-500 hover:text-secondary-800 hover:bg-secondary-50'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-primary-600' : ''} />
                  {label}
                  {count !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold leading-none ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'bg-secondary-100 text-secondary-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 bg-primary-50 border-b border-primary-100">
            <ListChecks size={16} className="text-primary-600 shrink-0" />
            <span className="text-sm font-semibold text-primary-700">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              <select
                className="input text-sm py-1.5 pr-8"
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
              >
                <option value="">Change status to…</option>
                {BULK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={applyBulkStatus}
                disabled={!bulkStatus || bulkLoading}
                className="px-4 py-1.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {bulkLoading ? 'Updating…' : 'Apply'}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 text-secondary-400 hover:text-secondary-600 rounded-lg"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Orders List */}
        {isLoading && !orders.length ? (
          <div className="flex items-center justify-center py-14 text-secondary-400 gap-2">
            <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
            Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-14 text-secondary-400">
            <Package size={36} className="mx-auto mb-2 opacity-25" />
            {search ? 'No orders matching your search' : 'No orders found'}
          </div>
        ) : (
          <div className="divide-y divide-secondary-100">
            {/* Select-all header */}
            <div className="flex items-center gap-3 px-5 py-2 bg-secondary-50/50 border-b border-secondary-100">
              <input
                type="checkbox"
                className="rounded border-secondary-300 text-primary-600"
                checked={orders.length > 0 && selectedIds.size === orders.length}
                onChange={toggleSelectAll}
              />
              <span className="text-xs text-secondary-400 font-medium">Select all on this page</span>
            </div>
            {orders.map((order) => (
              <div key={order._id}>
                {/* Order row */}
                <div className={`flex items-center gap-3 px-5 py-3.5 hover:bg-secondary-50/60 transition-colors ${isNew(order.createdAt) ? 'bg-green-50/50' : ''} ${selectedIds.has(order._id) ? 'bg-primary-50/40' : ''}`}>
                  <input
                    type="checkbox"
                    className="rounded border-secondary-300 text-primary-600 shrink-0"
                    checked={selectedIds.has(order._id)}
                    onChange={() => toggleSelect(order._id)}
                  />

                  {/* Left: ID + status + customer */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-secondary-900 text-sm">
                        #{order.orderId}
                      </span>
                      <StatusBadge status={order.status} />
                      {order.paymentMethod === 'cod' && (
                        <span className="text-xs px-2 py-0.5 bg-secondary-800 text-white rounded-full font-medium">
                          COD
                        </span>
                      )}
                      {isNew(order.createdAt) && (
                        <span className="text-xs px-2 py-0.5 bg-green-500 text-white rounded-full font-bold animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-secondary-500 flex-wrap">
                      <span>🕐 {formatRelativeTime(order.createdAt)}</span>
                      <span>👤 {order.user?.name || 'Guest'}</span>
                      <span className="text-secondary-400">{order.user?.email || order.guestEmail || ''}</span>
                    </div>
                  </div>

                  {/* Center: thumbnails */}
                  <div className="hidden sm:block flex-shrink-0">
                    <ThumbnailStack items={order.items || []} />
                  </div>

                  {/* Right: amount + actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-secondary-900 text-sm">
                        {formatCurrency(order.totalAmount)}
                      </p>
                      <p className="text-xs text-secondary-400">
                        Tax: {formatCurrency(order.gstAmount ?? 0)}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/dashboard/admin/orders/${order._id}`)}
                      title="View order detail"
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => toggleExpand(order._id)}
                      title="Expand"
                      className="p-1.5 text-secondary-400 hover:bg-secondary-100 rounded-lg transition-colors"
                    >
                      {expandedId === order._id
                        ? <ChevronUp size={16} />
                        : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {expandedId === order._id && (
                  <ExpandedPanel
                    order={order}
                    onManage={(id) => navigate(`/dashboard/admin/orders/${id}`)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination?.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
            <p className="text-xs text-secondary-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total} orders
            </p>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => {
                // Show first, last, and pages around current
                const totalPages = pagination.pages;
                let p;
                if (totalPages <= 7) {
                  p = i + 1;
                } else if (i === 0) {
                  p = 1;
                } else if (i === 6) {
                  p = totalPages;
                } else {
                  p = Math.max(2, Math.min(page - 1, totalPages - 5)) + (i - 1);
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      p === page
                        ? 'bg-primary-600 text-white'
                        : 'hover:bg-secondary-100 text-secondary-600'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
