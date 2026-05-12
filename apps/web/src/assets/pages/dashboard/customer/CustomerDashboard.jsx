import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Truck, ChevronRight, Package } from 'lucide-react';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import api from '../../../../utils/api';
import Spinner from '../../../components/common/Spinner';

export default function CustomerDashboard() {
  const { user } = useSelector((s) => s.auth);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const { data: ordersData, isLoading } = useFetch(
    ['customer-orders-stats'],
    () => api.get('/orders', { params: { limit: 100 } }).then((r) => r.data)
  );
  const { data: profileData } = useFetch(
    ['customer-profile-dash'],
    () => api.get('/users/profile').then((r) => r.data)
  );

  const orders = ordersData?.orders || [];
  const totalOrders = ordersData?.pagination?.total ?? orders.length;
  const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const savedAddresses = profileData?.user?.addresses?.length ?? user?.addresses?.length ?? 0;
  const activeOrders = orders.filter((o) => !['delivered', 'cancelled', 'returned'].includes(o.status));
  const inTransitCount = orders.filter((o) => o.status === 'shipped').length;
  const recentOrders = orders.slice(0, 3);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="space-y-6">

      {/* Welcome banner */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-2xl p-6 text-white overflow-hidden">
        <div className="absolute -right-6 -top-6 w-36 h-36 bg-white/10 rounded-full" />
        <div className="absolute right-16 -bottom-8 w-28 h-28 bg-white/10 rounded-full" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{greeting}, {user?.name}!</h1>
              <p className="text-blue-100 text-sm mt-1">Welcome to your dashboard. Here's your account overview.</p>
              <div className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-100 bg-white/15 px-3 py-1.5 rounded-full">
                🕐 Member since {memberSince}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Orders',     value: totalOrders,            sub: `${activeOrders.length} active`,  emoji: '🛍️', bg: 'bg-blue-100' },
            { label: 'Total Spent',      value: formatCurrency(totalSpent), sub: 'all time',             emoji: '💳', bg: 'bg-green-100' },
            { label: 'Active Orders',    value: activeOrders.length,    sub: 'in progress',               emoji: '📦', bg: 'bg-pink-100' },
            { label: 'Saved Addresses',  value: savedAddresses,         sub: 'addresses',                 emoji: '📍', bg: 'bg-purple-100' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-secondary-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-secondary-500 font-medium truncate">{stat.label}</p>
                <p className="text-xl font-bold text-secondary-900 mt-0.5 truncate">{stat.value}</p>
                <p className="text-xs text-secondary-400 mt-0.5">{stat.sub}</p>
              </div>
              <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center text-2xl shrink-0`}>
                {stat.emoji}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* In Transit highlight */}
      {inTransitCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
            <Truck size={20} className="text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600 leading-none">{inTransitCount}</p>
            <p className="text-sm font-medium text-orange-600">In Transit</p>
          </div>
          <Link to="/dashboard/customer/orders" className="ml-auto text-sm font-semibold text-orange-600 hover:underline flex items-center gap-0.5">
            Track <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-bold text-secondary-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Track Orders',      sub: 'View order status',    to: '/dashboard/customer/orders',   emoji: '🛒', bg: 'bg-blue-100' },
            { label: 'Manage Addresses',  sub: 'Add or edit addresses', to: '/dashboard/customer/settings', emoji: '📍', bg: 'bg-pink-100' },
            { label: 'Account Settings',  sub: 'Update profile',        to: '/dashboard/customer/settings', emoji: '⚙️', bg: 'bg-secondary-100' },
            { label: 'Browse Products',   sub: 'Shop new arrivals',     to: '/products',                   emoji: '🏪', bg: 'bg-green-100' },
          ].map((a) => (
            <Link key={a.label} to={a.to} className="bg-white border border-secondary-200 rounded-xl p-4 flex items-center gap-3 hover:shadow-md hover:border-secondary-300 transition-all">
              <div className={`w-10 h-10 ${a.bg} rounded-lg flex items-center justify-center text-xl shrink-0`}>
                {a.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-secondary-800 truncate">{a.label}</p>
                <p className="text-xs text-secondary-400 truncate">{a.sub}</p>
              </div>
              <ChevronRight size={15} className="text-secondary-300 shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <div className="bg-white border border-secondary-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
            <h2 className="font-bold text-secondary-800">Recent Orders</h2>
            <Link to="/dashboard/customer/orders" className="text-sm text-primary-600 font-medium hover:underline flex items-center gap-0.5">
              View all <ChevronRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-secondary-50">
            {recentOrders.map((order) => (
              <div key={order._id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex gap-1.5 shrink-0">
                  {order.items?.slice(0, 2).map((item, i) => (
                    <div key={i} className="w-10 h-10 rounded border border-secondary-100 bg-secondary-50 overflow-hidden flex items-center justify-center">
                      {item.image
                        ? <img src={normalizeImageUrl(item.image)} alt={item.title} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
                        : <Package size={14} className="text-secondary-300" />}
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-secondary-700 font-mono">{order.orderId}</p>
                  <p className="text-xs text-secondary-400">{order.items?.length} item(s) · {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatCurrency(order.totalAmount)}</p>
                  <span className={`text-xs font-semibold capitalize px-2 py-0.5 rounded-full ${
                    order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                    order.status === 'shipped'   ? 'bg-purple-100 text-purple-700' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{order.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
