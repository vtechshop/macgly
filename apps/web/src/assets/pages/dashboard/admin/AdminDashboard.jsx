import { Link } from 'react-router-dom';
import {
  Package, ShoppingBag, Users, TrendingUp, AlertTriangle, Clock,
  Tag, Image, Ticket, ArrowRight, CheckCircle, Store, UserCheck,
  IndianRupee, ShoppingCart, BarChart2, Activity, Star, Bell,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';

const STATUS_COLORS = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  shipped:    'bg-purple-100 text-purple-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
  returned:   'bg-gray-100 text-gray-600',
};

function RevenueChart({ data }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex items-end gap-1.5 h-28 px-2">
      {data.map((d) => {
        const pct = Math.max((d.revenue / max) * 100, d.revenue > 0 ? 8 : 2);
        const dateObj = new Date(d.date + 'T00:00:00');
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-secondary-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
              {formatCurrency(d.revenue)}<br />{d.orders} orders
            </div>
            <div
              className="w-full bg-primary-500 hover:bg-primary-600 rounded-t transition-all cursor-default"
              style={{ height: `${pct}%` }}
            />
            <span className="text-[10px] text-secondary-400 leading-none">
              {dateObj.toLocaleDateString('en-IN', { weekday: 'short' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color, to }) {
  const inner = (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color} shrink-0`}>
          <Icon size={18} className="text-white" />
        </div>
        {to && <ArrowRight size={14} className="text-secondary-300 mt-0.5" />}
      </div>
      <p className="text-xl font-black text-secondary-900 mt-3 leading-none">{value}</p>
      <p className="text-xs text-secondary-500 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-primary-600 font-medium mt-0.5">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function AdminDashboard() {
  const { data, isLoading } = useFetch(
    ['admin-stats'],
    () => api.get('/admin/stats').then((r) => r.data).catch(() => ({}))
  );

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const s = data?.stats || {};
  const recentOrders = data?.recentOrders || [];
  const lowStock = data?.lowStock || [];
  const revenueByDay = data?.revenueByDay || [];
  const topProducts = data?.topProducts || [];

  const orderStatus = s.orderStatus || {};
  const totalOrders = s.orders || 0;

  const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  const statusLabels = { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
  const statusBars = statusOrder.map((k) => ({ key: k, count: orderStatus[k] || 0 }));
  const maxStatus = Math.max(...statusBars.map((b) => b.count), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Admin Dashboard</h1>
          <p className="text-sm text-secondary-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/admin/products" className="btn-primary text-sm">+ Add Product</Link>
        </div>
      </div>

      {/* Pending actions banner */}
      {s.pendingActions > 0 && (
        <Link to="/dashboard/admin/orders" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 hover:bg-amber-100 transition-colors">
          <Bell size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            You have <span className="text-amber-600">{s.pendingActions} orders</span> pending action — confirm, process, or ship them now.
          </p>
          <ArrowRight size={14} className="ml-auto text-amber-500 shrink-0" />
        </Link>
      )}

      {/* Revenue row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Revenue Today" value={formatCurrency(s.revenueToday || 0)} icon={IndianRupee} color="bg-emerald-500" sub="Paid orders" />
        <StatCard label="Revenue This Month" value={formatCurrency(s.revenueMonth || 0)} icon={TrendingUp} color="bg-blue-500" sub="Last 30 days" />
        <StatCard label="Revenue This Week" value={formatCurrency(s.revenueWeek || 0)} icon={BarChart2} color="bg-violet-500" sub="Last 7 days" />
        <StatCard label="All-Time Revenue" value={formatCurrency(s.revenue || 0)} icon={Activity} color="bg-primary-600" sub="Since launch" />
      </div>

      {/* Commission cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Admin Commission */}
        <div className="rounded-xl p-5 bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <IndianRupee size={16} />
            </div>
            <span className="text-sm font-semibold opacity-90">Admin Commission</span>
          </div>
          <p className="text-2xl font-black">{formatCurrency(s.adminCommission || 0)}</p>
          <p className="text-xs opacity-70 mt-1">Platform earnings from settled orders</p>
        </div>

        {/* Vendor Commissions */}
        <div className="rounded-xl p-5 bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Store size={16} />
            </div>
            <span className="text-sm font-semibold opacity-90">Vendor Commissions</span>
          </div>
          <p className="text-2xl font-black">{formatCurrency((s.vendorCommissionPaid || 0) + (s.vendorCommissionPending || 0))}</p>
          <div className="flex gap-4 mt-1.5">
            <p className="text-xs opacity-80">Paid: <span className="font-bold">{formatCurrency(s.vendorCommissionPaid || 0)}</span></p>
            <p className="text-xs opacity-80">Pending: <span className="font-bold">{formatCurrency(s.vendorCommissionPending || 0)}</span></p>
          </div>
        </div>

        {/* Affiliate Commissions */}
        <div className="rounded-xl p-5 bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <UserCheck size={16} />
            </div>
            <span className="text-sm font-semibold opacity-90">Affiliate Commissions</span>
          </div>
          <p className="text-2xl font-black">{formatCurrency((s.affiliateCommissionPaid || 0) + (s.affiliateCommissionPending || 0))}</p>
          <div className="flex gap-4 mt-1.5">
            <p className="text-xs opacity-80">Paid: <span className="font-bold">{formatCurrency(s.affiliateCommissionPaid || 0)}</span></p>
            <p className="text-xs opacity-80">Pending: <span className="font-bold">{formatCurrency(s.affiliateCommissionPending || 0)}</span></p>
          </div>
        </div>
      </div>

      {/* Counts row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Orders" value={s.orders ?? 0} icon={ShoppingBag} color="bg-green-500" to="/dashboard/admin/orders" sub={`+${s.ordersThisWeek || 0} this week`} />
        <StatCard label="Pending Orders" value={orderStatus.pending || 0} icon={Clock} color="bg-yellow-500" to="/dashboard/admin/orders" />
        <StatCard label="Products" value={s.products ?? 0} icon={Package} color="bg-cyan-500" to="/dashboard/admin/products" />
        <StatCard label="Customers" value={s.customers ?? 0} icon={Users} color="bg-purple-500" to="/dashboard/admin/users" sub={`+${s.newUsersThisWeek || 0} this week`} />
        <StatCard label="Vendors" value={s.vendorCount ?? 0} icon={Store} color="bg-orange-500" to="/dashboard/admin/vendors" sub={s.pendingVendors ? `${s.pendingVendors} pending` : 'All approved'} />
        <StatCard label="Affiliates" value={s.affiliateCount ?? 0} icon={UserCheck} color="bg-pink-500" to="/dashboard/admin/affiliates" />
      </div>

      {/* Chart + Order status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-secondary-800">Revenue — Last 7 Days</h2>
            <span className="text-xs text-secondary-400 bg-secondary-100 px-2 py-1 rounded">Paid orders only</span>
          </div>
          {revenueByDay.length > 0 ? (
            <RevenueChart data={revenueByDay} />
          ) : (
            <div className="h-28 flex items-center justify-center text-secondary-300 text-sm">No data</div>
          )}
          <div className="flex justify-between mt-3 pt-3 border-t border-secondary-100 text-xs text-secondary-500">
            <span>Total: <strong className="text-secondary-800">{formatCurrency(s.revenueWeek || 0)}</strong></span>
            <span>Orders: <strong className="text-secondary-800">{s.ordersThisWeek || 0}</strong></span>
          </div>
        </div>

        {/* Order status breakdown */}
        <div className="card p-5">
          <h2 className="font-bold text-secondary-800 mb-4">Order Status</h2>
          <div className="space-y-2.5">
            {statusBars.map((b) => (
              <div key={b.key}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-secondary-600 capitalize">{statusLabels[b.key]}</span>
                  <span className="font-bold text-secondary-800">{b.count}</span>
                </div>
                <div className="h-2 bg-secondary-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${STATUS_COLORS[b.key]?.replace('text-', 'bg-').replace('-700', '-500').replace('-100', '').split(' ')[0]}`}
                    style={{ width: `${(b.count / maxStatus) * 100}%`, minWidth: b.count > 0 ? 8 : 0 }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-secondary-100 text-xs text-secondary-500">
            Total orders: <strong className="text-secondary-800">{totalOrders}</strong>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
          <h2 className="font-bold text-secondary-800 flex items-center gap-2">
            <ShoppingCart size={16} className="text-primary-500" /> Recent Orders
          </h2>
          <Link to="/dashboard/admin/orders" className="text-xs text-primary-600 hover:underline font-medium flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Order ID</th>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-5 py-3 text-left hidden md:table-cell">Items</th>
                <th className="px-5 py-3 text-left">Amount</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left hidden lg:table-cell">Date</th>
                <th className="px-5 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-50">
              {!recentOrders.length ? (
                <tr><td colSpan={7} className="text-center py-10 text-secondary-400">No orders yet</td></tr>
              ) : recentOrders.map((o) => (
                <tr key={o._id} className="hover:bg-secondary-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-bold text-primary-600">{o.orderId}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-secondary-900">{o.user?.name || '—'}</p>
                    <p className="text-xs text-secondary-400">{o.user?.email}</p>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell text-secondary-500">{o.items?.length} item{o.items?.length !== 1 ? 's' : ''}</td>
                  <td className="px-5 py-3 font-bold">{formatCurrency(o.totalAmount)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[o.status] || 'bg-secondary-100 text-secondary-600'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell text-secondary-500 text-xs">{formatDate(o.createdAt)}</td>
                  <td className="px-5 py-3">
                    <Link to="/dashboard/admin/orders" className="text-xs text-primary-600 hover:underline">Manage</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom row: Low stock + Top products + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Low stock */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
            <h2 className="font-bold flex items-center gap-2 text-orange-600">
              <AlertTriangle size={15} /> Low Stock
            </h2>
            <Link to="/dashboard/admin/products" className="text-xs text-primary-600 hover:underline font-medium">Fix now</Link>
          </div>
          <div className="divide-y divide-secondary-50">
            {!lowStock.length ? (
              <div className="flex items-center gap-2 px-5 py-4 text-green-600 text-sm">
                <CheckCircle size={16} /> All products well stocked
              </div>
            ) : lowStock.map((p) => (
              <div key={p._id} className="flex items-center justify-between px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-secondary-400">{p.sku}</p>
                </div>
                <span className={`ml-3 text-xs font-bold px-2 py-1 rounded shrink-0 ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                  {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top products */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
            <h2 className="font-bold flex items-center gap-2 text-secondary-800">
              <Star size={15} className="text-yellow-500" /> Top Products
            </h2>
            <Link to="/dashboard/admin/products" className="text-xs text-primary-600 hover:underline font-medium">All products</Link>
          </div>
          <div className="divide-y divide-secondary-50">
            {!topProducts.length ? (
              <p className="text-center py-6 text-secondary-400 text-sm">No sales data yet</p>
            ) : topProducts.map((p, i) => (
              <div key={p._id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-5 text-xs font-bold text-secondary-400 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-secondary-400">{p.totalQty} units sold</p>
                </div>
                <span className="text-sm font-bold text-green-600 shrink-0">{formatCurrency(p.totalRevenue)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <h2 className="font-bold text-secondary-800 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'Add New Product', to: '/dashboard/admin/products', icon: Package, color: 'text-blue-600 bg-blue-50' },
              { label: 'Manage Orders', to: '/dashboard/admin/orders', icon: ShoppingBag, color: 'text-green-600 bg-green-50' },
              { label: 'Manage Categories', to: '/dashboard/admin/categories', icon: Tag, color: 'text-orange-600 bg-orange-50' },
              { label: 'Edit Banners', to: '/dashboard/admin/banners', icon: Image, color: 'text-pink-600 bg-pink-50' },
              { label: 'Create Coupon', to: '/dashboard/admin/coupons', icon: Ticket, color: 'text-yellow-600 bg-yellow-50' },
              { label: 'Review Vendors', to: '/dashboard/admin/vendors', icon: Store, color: 'text-violet-600 bg-violet-50' },
              { label: 'Manage Affiliates', to: '/dashboard/admin/affiliates', icon: UserCheck, color: 'text-pink-600 bg-pink-50' },
              { label: 'View All Users', to: '/dashboard/admin/users', icon: Users, color: 'text-purple-600 bg-purple-50' },
            ].map((a) => (
              <Link key={a.to} to={a.to} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary-50 transition-colors group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.color} shrink-0`}>
                  <a.icon size={15} />
                </div>
                <span className="text-sm font-medium text-secondary-700 group-hover:text-secondary-900">{a.label}</span>
                <ArrowRight size={12} className="ml-auto text-secondary-300 group-hover:text-secondary-500" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
