import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, CreditCard, Heart, MapPin,
  Package, Settings, Truck, ChevronRight,
  Store, Users, RefreshCw,
} from 'lucide-react';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import { useFetch, invalidateCache } from '../../../../hooks';
import api from '../../../../utils/api';
import Spinner from '../../../components/common/Spinner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtMemberSince(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STATUS_CLS = {
  delivered:       'bg-green-100 text-green-700',
  cancelled:       'bg-red-100 text-red-700',
  returned:        'bg-red-100 text-red-600',
  shipped:         'bg-orange-100 text-orange-600',
  out_for_delivery:'bg-orange-100 text-orange-600',
  paid:            'bg-blue-100 text-blue-700',
  placed:          'bg-blue-100 text-blue-700',
  confirmed:       'bg-blue-100 text-blue-700',
  processing:      'bg-blue-100 text-blue-700',
  packed:          'bg-blue-100 text-blue-700',
  pending_payment: 'bg-yellow-100 text-yellow-700',
  pending:         'bg-yellow-100 text-yellow-700',
};

function StatusBadge({ status }) {
  const label = (status || '').replace(/_/g, ' ');
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_CLS[status] || 'bg-secondary-100 text-secondary-600'}`}>
      {label}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsCard({ icon: Icon, iconBg, iconColor, label, value, sub, to }) {
  const inner = (
    <div className="card p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-secondary-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-secondary-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-secondary-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={22} className={iconColor} />
      </div>
    </div>
  );
  return to
    ? <Link to={to} className="block hover:shadow-md transition-shadow rounded-xl">{inner}</Link>
    : inner;
}

function QuickActionCard({ icon: Icon, iconBg, iconColor, label, sub, to }) {
  return (
    <Link to={to} className="card p-4 flex items-center gap-3 hover:border-primary-300 hover:shadow-sm transition-all group">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{label}</p>
        <p className="text-xs text-secondary-400 truncate">{sub}</p>
      </div>
      <ChevronRight size={15} className="text-secondary-300 shrink-0 group-hover:text-primary-400 transition-colors" />
    </Link>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CustomerDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [rev, setRev] = useState(0);

  const { data: stats, isLoading: statsLoading } = useFetch(
    ['customer-stats', rev],
    () => api.get('/users/stats').then((r) => r.data)
  );

  const { data: ordersData, isLoading: ordersLoading } = useFetch(
    ['customer-recent-orders', rev],
    () => api.get('/orders', { params: { limit: 5 } }).then((r) => r.data)
  );

  function refresh() {
    invalidateCache('customer-stats');
    invalidateCache('customer-recent-orders');
    setRev((r) => r + 1);
  }

  const orders     = ordersData?.orders || [];
  const firstName  = (user?.name || '').split(' ')[0];
  const memberDate = fmtMemberSince(stats?.memberSince || user?.createdAt);
  const isCustomer = user?.role === 'customer';

  return (
    <div className="space-y-5">

      {/* 1 — Welcome header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-primary-600 via-primary-500 to-blue-700 text-white p-6 overflow-hidden">
        <div className="absolute -right-6 -top-6 w-36 h-36 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute right-16 -bottom-8 w-24 h-24 bg-white/10 rounded-full pointer-events-none" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{greeting()}, {firstName}!</h1>
            <p className="text-blue-100 text-sm mt-1">Welcome to your dashboard. Here's your account overview.</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs text-blue-100 bg-white/15 px-3 py-1.5 rounded-full">
                🕐 Member since {memberDate}
              </span>
              {stats?.totalSavings > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-blue-100 bg-white/15 px-3 py-1.5 rounded-full">
                  💰 Total Saved: {formatCurrency(stats.totalSavings)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={refresh}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors shrink-0"
            aria-label="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* 2 — Stats */}
      {statsLoading && !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 h-24 animate-pulse bg-secondary-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard
            icon={ShoppingBag} iconBg="bg-blue-100" iconColor="text-blue-600"
            label="Total Orders" value={stats?.totalOrders ?? 0}
            sub={stats?.recentOrders > 0 ? `${stats.recentOrders} this month` : undefined}
            to="/dashboard/customer/orders"
          />
          <StatsCard
            icon={CreditCard} iconBg="bg-green-100" iconColor="text-green-600"
            label="Total Spent" value={formatCurrency(stats?.totalSpent ?? 0)}
          />
          <StatsCard
            icon={Heart} iconBg="bg-pink-100" iconColor="text-pink-600"
            label="Wishlist Items" value={stats?.wishlistCount ?? 0}
            to="/dashboard/customer/wishlist"
          />
          <StatsCard
            icon={MapPin} iconBg="bg-purple-100" iconColor="text-purple-600"
            label="Saved Addresses" value={stats?.addressCount ?? 0}
            to="/dashboard/customer/addresses"
          />
        </div>
      )}

      {/* 3 — Order status summary */}
      {!statsLoading && (stats?.pendingOrders > 0 || stats?.deliveredOrders > 0) && (
        <div className="flex gap-3 flex-wrap">
          {stats.pendingOrders > 0 && (
            <Link
              to="/dashboard/customer/orders?status=shipped"
              className="flex items-center gap-3 flex-1 min-w-48 bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 hover:bg-orange-100 transition-colors"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                <Truck size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600 leading-none">{stats.pendingOrders}</p>
                <p className="text-sm font-medium text-orange-600">In Transit</p>
              </div>
              <ChevronRight size={16} className="ml-auto text-orange-400" />
            </Link>
          )}
          {stats.deliveredOrders > 0 && (
            <Link
              to="/dashboard/customer/orders?status=delivered"
              className="flex items-center gap-3 flex-1 min-w-48 bg-green-50 border border-green-200 rounded-xl px-5 py-4 hover:bg-green-100 transition-colors"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                <Package size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 leading-none">{stats.deliveredOrders}</p>
                <p className="text-sm font-medium text-green-600">Delivered</p>
              </div>
              <ChevronRight size={16} className="ml-auto text-green-400" />
            </Link>
          )}
        </div>
      )}

      {/* 4 — Quick Actions */}
      <div>
        <p className="text-sm font-semibold mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickActionCard icon={Package}  iconBg="bg-blue-100"   iconColor="text-blue-600"   label="Track Orders"      sub="View order status"    to="/dashboard/customer/orders" />
          <QuickActionCard icon={MapPin}   iconBg="bg-purple-100" iconColor="text-purple-600" label="Manage Addresses"  sub="Add or edit addresses" to="/dashboard/customer/addresses" />
          <QuickActionCard icon={Heart}    iconBg="bg-pink-100"   iconColor="text-pink-600"   label="My Wishlist"       sub="Saved items"          to="/dashboard/customer/wishlist" />
          <QuickActionCard icon={Settings} iconBg="bg-secondary-100" iconColor="text-secondary-500" label="Account Settings" sub="Update profile"  to="/dashboard/customer/settings" />
        </div>
      </div>

      {/* 5 — Grow With Us (only for pure customers) */}
      {isCustomer && (
        <div>
          <p className="text-sm font-semibold mb-3">Grow With Us</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to="/dashboard/become-vendor" className="group relative rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white p-5 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
              <div className="absolute right-4 -bottom-8 w-20 h-20 bg-white/10 rounded-full" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
                    <Store size={18} />
                  </div>
                  <div>
                    <p className="font-bold">Become a Vendor</p>
                    <p className="text-blue-200 text-xs">Start selling today</p>
                  </div>
                </div>
                <p className="text-blue-100 text-sm">List your products and reach thousands of customers on our platform.</p>
                <span className="inline-flex items-center gap-1 mt-3 text-sm font-semibold group-hover:gap-2 transition-all">
                  Apply Now <ChevronRight size={14} />
                </span>
              </div>
            </Link>

            <Link to="/dashboard/become-affiliate" className="group relative rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 text-white p-5 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
              <div className="absolute right-4 -bottom-8 w-20 h-20 bg-white/10 rounded-full" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="font-bold">Become an Affiliate</p>
                    <p className="text-green-200 text-xs">Earn commissions</p>
                  </div>
                </div>
                <p className="text-green-100 text-sm">Promote products and earn up to 10% commission on every sale.</p>
                <span className="inline-flex items-center gap-1 mt-3 text-sm font-semibold group-hover:gap-2 transition-all">
                  Join Program <ChevronRight size={14} />
                </span>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* 6 — Recent Orders */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
          <p className="font-bold">Recent Orders</p>
          <Link to="/dashboard/customer/orders" className="text-sm text-primary-600 font-medium hover:underline flex items-center gap-0.5">
            View All <ChevronRight size={13} />
          </Link>
        </div>

        {ordersLoading && !orders.length ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : orders.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <ShoppingBag size={36} className="mx-auto text-secondary-200" />
            <p className="text-secondary-500 font-medium">No orders yet</p>
            <Link to="/products" className="btn-primary inline-flex mx-auto">Start Shopping</Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Order ID</th>
                    <th className="text-left px-5 py-3 font-semibold">Date</th>
                    <th className="text-left px-5 py-3 font-semibold">Items</th>
                    <th className="text-left px-5 py-3 font-semibold">Status</th>
                    <th className="text-right px-5 py-3 font-semibold">Total</th>
                    <th className="text-right px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-50">
                  {orders.map((order) => (
                    <tr key={order._id} className="hover:bg-secondary-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-secondary-600">{order.orderId}</td>
                      <td className="px-5 py-3 text-secondary-600">{fmtDate(order.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          {order.items?.slice(0, 3).map((item, i) => (
                            <div key={i} className="w-8 h-8 rounded border border-secondary-100 bg-secondary-50 overflow-hidden flex items-center justify-center shrink-0">
                              {item.image
                                ? <img src={normalizeImageUrl(item.image)} alt="" className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                                : <Package size={12} className="text-secondary-300" />
                              }
                            </div>
                          ))}
                          {order.items?.length > 3 && (
                            <span className="text-xs text-secondary-400 ml-1">+{order.items.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-5 py-3 text-right font-semibold">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link to={`/dashboard/customer/orders/${order._id}`} className="text-primary-600 hover:underline font-medium text-xs">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards (top 3) */}
            <div className="md:hidden divide-y divide-secondary-50">
              {orders.slice(0, 3).map((order) => (
                <Link key={order._id} to={`/dashboard/customer/orders/${order._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary-50 transition-colors">
                  <div className="flex gap-1 shrink-0">
                    {order.items?.slice(0, 2).map((item, i) => (
                      <div key={i} className="w-10 h-10 rounded border border-secondary-100 bg-secondary-50 overflow-hidden flex items-center justify-center">
                        {item.image
                          ? <img src={normalizeImageUrl(item.image)} alt="" className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                          : <Package size={14} className="text-secondary-300" />
                        }
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-secondary-500">{order.orderId}</p>
                    <p className="text-sm font-semibold truncate">{order.items?.length} item(s)</p>
                    <p className="text-xs text-secondary-400">{fmtDate(order.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(order.totalAmount)}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
