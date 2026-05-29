import { Link } from 'react-router-dom';
import {
  Package, ShoppingBag, Users, TrendingUp, TrendingDown, AlertTriangle,
  Clock, Tag, Image, ArrowRight, CheckCircle, Store, UserCheck,
  IndianRupee, ShoppingCart, Star, Bell, MessageSquare, Zap,
  BarChart3, RefreshCw, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';

const STATUS_COLORS = {
  pending:    { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  confirmed:  { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-primary-400'    },
  processing: { bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-400'  },
  shipped:    { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-400'  },
  delivered:  { bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-400'   },
  cancelled:  { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-400'     },
  returned:   { bg: 'bg-gray-50',    text: 'text-gray-600',    dot: 'bg-gray-400'    },
};

function trend(current, previous) {
  if (!previous || previous === 0) return { pct: null, up: null };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct, up: pct >= 0 };
}

function TrendBadge({ current, previous }) {
  const { pct, up } = trend(current, previous);
  if (pct === null) return null;
  if (pct === 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-secondary-400 font-medium">
      <Minus size={11} /> 0%
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(pct)}%
    </span>
  );
}

function KpiCard({ label, value, previous, icon: Icon, color, to, sub }) {
  const inner = (
    <div className={`bg-white rounded-xl border border-secondary-100 p-5 hover:shadow-md transition-all ${to ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={19} className="text-white" />
        </div>
        <TrendBadge current={value} previous={previous} />
      </div>
      <p className="text-2xl font-black text-secondary-900 leading-none tracking-tight">{value}</p>
      <p className="text-xs text-secondary-500 mt-1.5 font-medium">{label}</p>
      {sub && <p className="text-[11px] text-secondary-400 mt-0.5">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function RevenueChart({ data }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex items-end gap-2 h-36 px-1">
      {data.map((d) => {
        const pct = Math.max((d.revenue / max) * 100, d.revenue > 0 ? 6 : 1);
        const dateObj = new Date(d.date + 'T00:00:00');
        const isToday = d.date === new Date().toISOString().slice(0, 10);
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group relative">
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-secondary-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-lg">
              <p className="font-bold">{formatCurrency(d.revenue)}</p>
              <p className="opacity-70">{d.orders} orders</p>
            </div>
            <div
              className={`w-full rounded-t-lg transition-all ${isToday ? 'bg-primary-600' : 'bg-primary-200 group-hover:bg-primary-400'}`}
              style={{ height: `${pct}%` }}
            />
            <span className={`text-[10px] leading-none font-medium ${isToday ? 'text-primary-600' : 'text-secondary-400'}`}>
              {dateObj.toLocaleDateString('en-IN', { weekday: 'short' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatusPipeline({ statusMap, total }) {
  const PIPELINE = [
    { key: 'pending',    label: 'Pending',    color: 'bg-amber-400'  },
    { key: 'confirmed',  label: 'Confirmed',  color: 'bg-primary-400'   },
    { key: 'processing', label: 'Processing', color: 'bg-indigo-400' },
    { key: 'shipped',    label: 'Shipped',    color: 'bg-secondary-600' },
    { key: 'delivered',  label: 'Delivered',  color: 'bg-green-500'  },
    { key: 'cancelled',  label: 'Cancelled',  color: 'bg-red-400'    },
  ];
  return (
    <div className="space-y-2.5">
      {PIPELINE.map(({ key, label, color }) => {
        const count = statusMap[key] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-secondary-600 font-medium">{label}</span>
              <span className="font-bold text-secondary-800 tabular-nums">{count}</span>
            </div>
            <div className="h-2 bg-secondary-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const { data, isLoading, refetch } = useFetch(
    ['admin-stats'],
    () => api.get('/admin/stats').then((r) => r.data).catch(() => ({}))
  );

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-secondary-400">Loading dashboard…</p>
    </div>
  );

  const s = data?.stats || {};
  const recentOrders = data?.recentOrders || [];
  const lowStock = data?.lowStock || [];
  const revenueByDay = data?.revenueByDay || [];
  const topProducts = data?.topProducts || [];
  const orderStatus = s.orderStatus || {};
  const totalOrders = s.orders || 0;

  const pendingCount = (orderStatus.pending || 0) + (orderStatus.confirmed || 0) + (orderStatus.processing || 0);
  const hasAlerts = pendingCount > 0 || (s.pendingVendors || 0) > 0 || (s.pendingTickets || 0) > 0;

  return (
    <div className="space-y-6 pb-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Dashboard</h1>
          <p className="text-xs text-secondary-400 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg border border-secondary-200 text-secondary-500 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} />
          </button>
          <Link to="/dashboard/admin/products" className="btn-primary text-sm flex items-center gap-1.5">
            <Package size={14} /> Add Product
          </Link>
        </div>
      </div>

      {/* ── Alerts / Needs Attention ─────────────────────────── */}
      {hasAlerts && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pendingCount > 0 && (
            <Link to="/dashboard/admin/orders" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors">
              <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center shrink-0">
                <Clock size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-800">{pendingCount} Orders Need Action</p>
                <p className="text-xs text-amber-600">Pending · Confirmed · Processing</p>
              </div>
              <ArrowRight size={13} className="ml-auto text-amber-400 shrink-0" />
            </Link>
          )}
          {(s.pendingVendors || 0) > 0 && (
            <Link to="/dashboard/admin/vendors" className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 hover:bg-blue-100 transition-colors">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center shrink-0">
                <Store size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-800">{s.pendingVendors} Vendor Approvals</p>
                <p className="text-xs text-blue-600">Awaiting review</p>
              </div>
              <ArrowRight size={13} className="ml-auto text-blue-400 shrink-0" />
            </Link>
          )}
          {(s.pendingTickets || 0) > 0 && (
            <Link to="/dashboard/admin/tickets" className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 hover:bg-rose-100 transition-colors">
              <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center shrink-0">
                <MessageSquare size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-800">{s.pendingTickets} Open Tickets</p>
                <p className="text-xs text-rose-600">Customer support</p>
              </div>
              <ArrowRight size={13} className="ml-auto text-rose-400 shrink-0" />
            </Link>
          )}
        </div>
      )}

      {/* ── Revenue KPIs ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Today's Revenue" value={formatCurrency(s.revenueToday || 0)} icon={IndianRupee} color="bg-emerald-500" sub="Paid orders" />
        <KpiCard label="This Week" value={formatCurrency(s.revenueWeek || 0)} previous={s.revenueLastWeek} icon={TrendingUp} color="bg-primary-500" sub="vs last week" />
        <KpiCard label="This Month" value={formatCurrency(s.revenueMonth || 0)} previous={s.revenueLastMonth} icon={BarChart3} color="bg-secondary-600" sub="vs last month" />
        <KpiCard label="Avg Order Value" value={formatCurrency(s.avgOrderValue || 0)} icon={Zap} color="bg-orange-500" sub="All time" />
      </div>

      {/* ── Count KPIs ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Orders" value={s.orders ?? 0} previous={s.ordersLastWeek ? (s.orders - s.ordersThisWeek) : null} icon={ShoppingBag} color="bg-green-500" to="/dashboard/admin/orders" sub={`+${s.ordersThisWeek || 0} this week`} />
        <KpiCard label="Pending" value={orderStatus.pending || 0} icon={Clock} color="bg-amber-500" to="/dashboard/admin/orders" />
        <KpiCard label="Products" value={s.products ?? 0} icon={Package} color="bg-primary-400" to="/dashboard/admin/products" />
        <KpiCard label="Customers" value={s.customers ?? 0} icon={Users} color="bg-secondary-600" to="/dashboard/admin/users" sub={`+${s.newUsersThisWeek || 0} this week`} />
        <KpiCard label="Vendors" value={s.vendorCount ?? 0} icon={Store} color="bg-orange-500" to="/dashboard/admin/vendors" sub={s.pendingVendors ? `${s.pendingVendors} pending` : undefined} />
        <KpiCard label="Affiliates" value={s.affiliateCount ?? 0} icon={UserCheck} color="bg-primary-400" to="/dashboard/admin/affiliates" />
      </div>

      {/* ── Commission Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5 bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><IndianRupee size={15} /></div>
              <span className="text-sm font-semibold opacity-90">Platform Earnings</span>
            </div>
          </div>
          <p className="text-3xl font-black tracking-tight">{formatCurrency(s.adminCommission || 0)}</p>
          <p className="text-xs opacity-60 mt-1">From settled orders</p>
        </div>
        <div className="rounded-xl p-5 bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Store size={15} /></div>
            <span className="text-sm font-semibold opacity-90">Vendor Payouts</span>
          </div>
          <p className="text-3xl font-black tracking-tight">{formatCurrency((s.vendorCommissionPaid || 0) + (s.vendorCommissionPending || 0))}</p>
          <div className="flex gap-4 mt-1.5 text-xs opacity-80">
            <span>Paid: <strong>{formatCurrency(s.vendorCommissionPaid || 0)}</strong></span>
            <span>Pending: <strong>{formatCurrency(s.vendorCommissionPending || 0)}</strong></span>
          </div>
        </div>
        <div className="rounded-xl p-5 bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><UserCheck size={15} /></div>
            <span className="text-sm font-semibold opacity-90">Affiliate Payouts</span>
          </div>
          <p className="text-3xl font-black tracking-tight">{formatCurrency((s.affiliateCommissionPaid || 0) + (s.affiliateCommissionPending || 0))}</p>
          <div className="flex gap-4 mt-1.5 text-xs opacity-80">
            <span>Paid: <strong>{formatCurrency(s.affiliateCommissionPaid || 0)}</strong></span>
            <span>Pending: <strong>{formatCurrency(s.affiliateCommissionPending || 0)}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Chart + Pipeline ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-secondary-100 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-secondary-900">Revenue — Last 7 Days</h2>
              <p className="text-xs text-secondary-400 mt-0.5">Paid orders only · hover for details</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-secondary-900">{formatCurrency(s.revenueWeek || 0)}</p>
              <TrendBadge current={s.revenueWeek || 0} previous={s.revenueLastWeek} />
            </div>
          </div>
          {revenueByDay.length > 0
            ? <RevenueChart data={revenueByDay} />
            : <div className="h-36 flex items-center justify-center text-secondary-300 text-sm">No revenue data yet</div>
          }
        </div>

        <div className="bg-white rounded-xl border border-secondary-100 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-secondary-900">Order Pipeline</h2>
            <Link to="/dashboard/admin/orders" className="text-xs text-primary-600 hover:underline font-medium flex items-center gap-1">
              Manage <ArrowRight size={11} />
            </Link>
          </div>
          <StatusPipeline statusMap={orderStatus} total={totalOrders} />
          <div className="mt-4 pt-3 border-t border-secondary-100 flex justify-between text-xs text-secondary-500">
            <span>Total orders</span>
            <strong className="text-secondary-800">{totalOrders}</strong>
          </div>
        </div>
      </div>

      {/* ── Recent Orders ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-secondary-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
          <h2 className="font-bold text-secondary-900 flex items-center gap-2">
            <ShoppingCart size={15} className="text-primary-500" /> Recent Orders
          </h2>
          <Link to="/dashboard/admin/orders" className="text-xs text-primary-600 hover:underline font-medium flex items-center gap-1">
            View all <ArrowRight size={11} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 border-b border-secondary-100">
              <tr>
                {['Order ID', 'Customer', 'Items', 'Amount', 'Payment', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-50">
              {!recentOrders.length ? (
                <tr><td colSpan={7} className="text-center py-12 text-secondary-400">No orders yet</td></tr>
              ) : recentOrders.map((o) => {
                const sc = STATUS_COLORS[o.status] || STATUS_COLORS.pending;
                return (
                  <tr key={o._id} className="hover:bg-secondary-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-primary-600">{o.orderId}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-secondary-900 text-xs">{o.user?.name || '—'}</p>
                      <p className="text-[11px] text-secondary-400">{o.user?.email}</p>
                    </td>
                    <td className="px-5 py-3.5 text-secondary-500 text-xs">{o.items?.length} item{o.items?.length !== 1 ? 's' : ''}</td>
                    <td className="px-5 py-3.5 font-bold text-secondary-900">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-secondary-400 text-xs">{formatDate(o.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Low stock */}
        <div className="bg-white rounded-xl border border-secondary-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
            <h2 className="font-bold flex items-center gap-2 text-orange-600 text-sm">
              <AlertTriangle size={14} /> Low Stock Alert
            </h2>
            <Link to="/dashboard/admin/products" className="text-xs text-primary-600 hover:underline font-medium">Restock</Link>
          </div>
          <div className="divide-y divide-secondary-50">
            {!lowStock.length ? (
              <div className="flex items-center gap-2 px-5 py-5 text-green-600 text-sm">
                <CheckCircle size={16} /> All products well stocked
              </div>
            ) : lowStock.map((p) => (
              <div key={p._id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-secondary-800 truncate">{p.title}</p>
                  <p className="text-[11px] text-secondary-400 font-mono">{p.sku}</p>
                </div>
                <span className={`ml-3 text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                  {p.stock === 0 ? 'Out' : `${p.stock} left`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="bg-white rounded-xl border border-secondary-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
            <h2 className="font-bold flex items-center gap-2 text-secondary-900 text-sm">
              <Star size={14} className="text-yellow-500" /> Top Sellers
            </h2>
            <Link to="/dashboard/admin/products" className="text-xs text-primary-600 hover:underline font-medium">All products</Link>
          </div>
          <div className="divide-y divide-secondary-50">
            {!topProducts.length ? (
              <p className="text-center py-8 text-secondary-400 text-sm">No sales data yet</p>
            ) : topProducts.map((p, i) => (
              <div key={p._id} className="flex items-center gap-3 px-5 py-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-secondary-100 text-secondary-600' : 'bg-orange-50 text-orange-500'}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-secondary-800 truncate">{p.title}</p>
                  <p className="text-[11px] text-secondary-400">{p.totalQty} units sold</p>
                </div>
                <span className="text-sm font-bold text-green-600 shrink-0">{formatCurrency(p.totalRevenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-secondary-100 p-5">
          <h2 className="font-bold text-secondary-900 text-sm mb-4 flex items-center gap-2">
            <Zap size={14} className="text-primary-500" /> Quick Actions
          </h2>
          <div className="space-y-1">
            {[
              { label: 'Add New Product',     to: '/dashboard/admin/products',   icon: Package,     color: 'text-blue-600 bg-blue-50'    },
              { label: 'Manage Orders',        to: '/dashboard/admin/orders',     icon: ShoppingBag, color: 'text-green-600 bg-green-50'  },
              { label: 'Manage Categories',    to: '/dashboard/admin/categories', icon: Tag,         color: 'text-orange-600 bg-orange-50'},
              { label: 'Edit Banners',         to: '/dashboard/admin/banners',    icon: Image,       color: 'text-pink-600 bg-pink-50'    },
              { label: 'Review Vendors',       to: '/dashboard/admin/vendors',    icon: Store,       color: 'text-violet-600 bg-violet-50'},
              { label: 'Manage Affiliates',    to: '/dashboard/admin/affiliates', icon: UserCheck,   color: 'text-pink-600 bg-pink-50'    },
              { label: 'Support Tickets',      to: '/dashboard/admin/tickets',    icon: MessageSquare, color: 'text-rose-600 bg-rose-50'  },
            ].map((a) => (
              <Link key={a.to} to={a.to} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary-50 transition-colors group">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${a.color} shrink-0`}>
                  <a.icon size={13} />
                </div>
                <span className="text-sm text-secondary-700 group-hover:text-secondary-900 font-medium">{a.label}</span>
                <ArrowRight size={11} className="ml-auto text-secondary-300 group-hover:text-secondary-500 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
