import { useState } from 'react';
import {
  Users, IndianRupee, ShoppingCart, TrendingUp,
  Search, Crown, Heart, Star, AlertTriangle, UserX,
  Eye, Mail, Tag, X, Download,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtCurrency(v) {
  return `₹${(v || 0).toLocaleString('en-IN')}`;
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso)) / 86400000);
}

function getClvTier(spent) {
  if (spent >= 50000) return { label: 'Platinum', icon: '💎', class: 'bg-purple-100 text-purple-700' };
  if (spent >= 20000) return { label: 'Gold',     icon: '🥇', class: 'bg-yellow-100 text-yellow-700' };
  if (spent >= 5000)  return { label: 'Silver',   icon: '🥈', class: 'bg-slate-100 text-slate-600' };
  return                      { label: 'Bronze',  icon: '🥉', class: 'bg-orange-100 text-orange-700' };
}

function getRiskStatus(lastOrderDate, orderCount) {
  if (!orderCount) return { label: 'New',     class: 'text-blue-600' };
  const d = daysSince(lastOrderDate);
  if (d > 90)  return { label: 'Lost',     class: 'text-red-600' };
  if (d > 60)  return { label: 'At Risk',  class: 'text-orange-500' };
  if (d > 30)  return { label: 'Cooling',  class: 'text-yellow-600' };
  return              { label: 'Active',   class: 'text-green-600' };
}

const SEGMENT_CONFIG = {
  vip:      { label: 'VIP',      icon: Crown,         class: 'bg-purple-100 text-purple-700' },
  loyal:    { label: 'Loyal',    icon: Heart,         class: 'bg-pink-100 text-pink-700' },
  new:      { label: 'New',      icon: Star,          class: 'bg-blue-100 text-blue-700' },
  'at-risk':{ label: 'At Risk',  icon: AlertTriangle, class: 'bg-orange-100 text-orange-700' },
  inactive: { label: 'Inactive', icon: UserX,         class: 'bg-secondary-100 text-secondary-500' },
  regular:  { label: 'Regular',  icon: Users,         class: 'bg-green-100 text-green-700' },
};

function SegmentBadge({ segment }) {
  const cfg = SEGMENT_CONFIG[segment] || SEGMENT_CONFIG.regular;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.class}`}>
      {cfg.label}
    </span>
  );
}

// ─── Customer Details Modal ───────────────────────────────────────────────────

function CustomerModal({ customer, onClose }) {
  const [tab, setTab] = useState('overview');

  const { data: ordersData, isLoading: ordersLoading } = useFetch(
    ['admin-crm-orders', customer._id],
    () => api.get(`/admin/crm/customers/${customer._id}/orders`).then((r) => r.data)
  );

  const orders = ordersData?.orders || [];
  const clv = getClvTier(customer.totalSpent);
  const risk = getRiskStatus(customer.lastOrderDate, customer.orderCount);
  const days = daysSince(customer.lastOrderDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                {customer.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="text-xl font-bold">{customer.name}</h2>
                <p className="text-blue-100 text-sm">{customer.email}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 ${clv.class.replace('bg-', 'text-').replace('text-', '')}`}>
                    {clv.icon} {clv.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-white/20`}>
                    {risk.label}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
              <X size={18} />
            </button>
          </div>
          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Orders',      value: customer.orderCount },
              { label: 'Lifetime',    value: fmtCurrency(customer.totalSpent) },
              { label: 'Avg Order',   value: fmtCurrency(customer.avgOrderValue) },
              { label: 'Days Since',  value: days != null ? `${days}d` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center">
                <p className="text-xs text-blue-200">{label}</p>
                <p className="font-bold text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-secondary-100">
          {['overview', 'orders', 'activity'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-secondary-500 hover:text-secondary-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Email',    value: customer.email },
                  { label: 'Phone',    value: customer.phone || '—' },
                  { label: 'Location', value: customer.location || '—' },
                  { label: 'Joined',   value: fmtDate(customer.createdAt) },
                  { label: 'Segment',  value: <SegmentBadge segment={customer.segment} /> },
                  { label: 'Last Login', value: fmtDate(customer.lastLogin) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-secondary-50 rounded-xl p-3">
                    <p className="text-xs text-secondary-400 mb-1">{label}</p>
                    <p className="font-medium text-secondary-800">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'orders' && (
            ordersLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : orders.length === 0 ? (
              <div className="text-center py-10 text-secondary-400">No orders yet</div>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <div key={o._id} className="flex items-center justify-between p-3 rounded-xl border border-secondary-100 hover:bg-secondary-50">
                    <div>
                      <p className="font-mono text-xs text-secondary-400">{o.orderNumber}</p>
                      <p className="text-sm font-medium mt-0.5">{fmtDate(o.createdAt)}</p>
                      <p className="text-xs text-secondary-400">{o.itemCount} item{o.itemCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{fmtCurrency(o.total)}</p>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-600 capitalize">
                        {o.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'activity' && (
            <div className="text-center py-10 text-secondary-400">
              <TrendingUp size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Activity timeline coming soon</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-secondary-100">
          <button onClick={onClose} className="btn text-sm">Close</button>
          <button className="btn-primary text-sm flex items-center gap-2" onClick={() => toast('Email feature coming soon')}>
            <Mail size={14} /> Send Email
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminCRM() {
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [page, setPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const { data: statsData } = useFetch(
    ['admin-crm-stats'],
    () => api.get('/admin/crm/stats').then((r) => r.data)
  );

  const { data, isLoading } = useFetch(
    ['admin-crm-customers', search, segment, page],
    () => api.get('/admin/crm/customers', {
      params: { search: search || undefined, segment: segment || undefined, page, limit: 20 },
    }).then((r) => r.data)
  );

  const stats = statsData || {};
  const customers = data?.customers || [];
  const pagination = data?.pagination || {};

  const SEGMENT_PILLS = [
    { value: '',        label: 'All',      count: stats.totalCustomers },
    { value: 'vip',     label: 'VIP',      count: stats.vipCount,      icon: Crown },
    { value: 'loyal',   label: 'Loyal',    count: stats.loyalCount,    icon: Heart },
    { value: 'new',     label: 'New',      count: stats.newCount,      icon: Star },
    { value: 'at-risk', label: 'At Risk',  count: stats.atRiskCount,   icon: AlertTriangle },
    { value: 'inactive',label: 'Inactive', count: stats.inactiveCount, icon: UserX },
  ];

  function exportCSV() {
    const header = 'Name,Email,Phone,Segment,CLV Tier,Orders,Total Spent,Avg Order,Last Order,Joined';
    const rows = customers.map((c) => [
      c.name, c.email, c.phone || '',
      c.segment, getClvTier(c.totalSpent).label,
      c.orderCount, c.totalSpent, c.avgOrderValue,
      c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('en-IN') : '',
      new Date(c.createdAt).toLocaleDateString('en-IN'),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'crm-customers.csv';
    a.click();
  }

  return (
    <div className="space-y-5">
      {/* Title + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={22} className="text-blue-600" /> CRM — Customers
          </h1>
          <p className="text-secondary-500 text-sm mt-0.5">Manage customer relationships and analytics</p>
        </div>
        <button onClick={exportCSV} className="btn flex items-center gap-2 text-sm">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Customers',
            value: (stats.totalCustomers || 0).toLocaleString(),
            sub: stats.newThisMonth > 0 ? `+${stats.newThisMonth} this month` : null,
            icon: Users, color: 'blue',
          },
          {
            label: 'Total Revenue',
            value: fmtCurrency(stats.totalRevenue),
            sub: 'Lifetime value',
            icon: IndianRupee, color: 'green',
          },
          {
            label: 'Avg Order Value',
            value: fmtCurrency(stats.avgOrderValue),
            sub: 'Per transaction',
            icon: ShoppingCart, color: 'purple',
          },
          {
            label: 'Active This Month',
            value: (stats.activeThisMonth || 0).toLocaleString(),
            sub: stats.totalCustomers ? `${Math.round((stats.activeThisMonth / stats.totalCustomers) * 100)}% of total` : '0% of total',
            icon: TrendingUp, color: 'amber',
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-start gap-3">
            <div className={`p-2.5 rounded-xl bg-${color}-50 shrink-0`}>
              <Icon size={18} className={`text-${color}-600`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-secondary-500 font-medium">{label}</p>
              <p className="text-xl font-bold mt-0.5">{value}</p>
              {sub && <p className="text-xs text-secondary-400 mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Segment pills */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">Customer Segments</span>
          <span className="text-xs text-secondary-400">Click to filter</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SEGMENT_PILLS.map(({ value, label, count, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setSegment(value); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                segment === value
                  ? 'bg-secondary-900 text-white border-secondary-900'
                  : 'bg-white border-secondary-200 text-secondary-600 hover:border-secondary-400'
              }`}
            >
              {Icon && <Icon size={13} />}
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${segment === value ? 'bg-white/20' : 'bg-secondary-100'}`}>
                {count ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          className="input pl-8 pr-3 py-2 text-sm w-full"
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : customers.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No customers found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-900 text-white text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Segment</th>
                <th className="px-4 py-3 text-left">CLV Tier</th>
                <th className="px-4 py-3 text-center">Orders</th>
                <th className="px-4 py-3 text-right">Total Spent</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last Order</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {customers.map((c) => {
                const clv = getClvTier(c.totalSpent);
                const risk = getRiskStatus(c.lastOrderDate, c.orderCount);
                const d = daysSince(c.lastOrderDate);
                const lastOrderColor = d == null ? '' : d > 60 ? 'text-red-500' : d > 30 ? 'text-yellow-600' : 'text-secondary-500';
                return (
                  <tr key={c._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-secondary-400">{c.email}</p>
                    </td>
                    <td className="px-4 py-3"><SegmentBadge segment={c.segment} /></td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${clv.class}`}>
                        {clv.icon} {clv.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{c.orderCount}</td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium">{fmtCurrency(c.totalSpent)}</p>
                      <p className="text-xs text-secondary-400">Avg {fmtCurrency(c.avgOrderValue)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${risk.class}`}>{risk.label}</span>
                    </td>
                    <td className={`px-4 py-3 text-xs ${lastOrderColor}`}>{fmtDate(c.lastOrderDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          className="p-1.5 rounded-lg hover:bg-secondary-100 text-secondary-500 hover:text-blue-600 transition-colors"
                          title="View details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => toast('Email feature coming soon')}
                          className="p-1.5 rounded-lg hover:bg-secondary-100 text-secondary-500 hover:text-green-600 transition-colors"
                          title="Send email"
                        >
                          <Mail size={14} />
                        </button>
                        <button
                          onClick={() => toast('Tagging coming soon')}
                          className="p-1.5 rounded-lg hover:bg-secondary-100 text-secondary-500 hover:text-purple-600 transition-colors"
                          title="Tag customer"
                        >
                          <Tag size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex items-center justify-between text-sm text-secondary-500">
              <span>Page {pagination.page} of {pagination.pages} · {pagination.total} customers</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedCustomer && (
        <CustomerModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}
