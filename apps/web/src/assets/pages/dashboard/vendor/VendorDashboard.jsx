import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Package, ShoppingBag, IndianRupee, TrendingUp, TrendingDown,
  AlertTriangle, ArrowRight, RefreshCw, Box, Megaphone,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';
import { formatCurrency } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import api from '../../../../utils/api';
import Spinner from '../../../components/common/Spinner';

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS = [
  { id: 'today',   label: 'Today'     },
  { id: '7days',   label: '7 Days'    },
  { id: '30days',  label: '30 Days'   },
  { id: 'month',   label: 'This Month'},
];

const MOCK_CHART = [
  { name: 'Mon', sales: 1200 },
  { name: 'Tue', sales: 1900 },
  { name: 'Wed', sales: 1500 },
  { name: 'Thu', sales: 2100 },
  { name: 'Fri', sales: 2400 },
  { name: 'Sat', sales: 2800 },
  { name: 'Sun', sales: 2200 },
];

// ─── TrendIndicator ───────────────────────────────────────────────────────────

function TrendIndicator({ current, previous }) {
  if (!previous || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-green-600' : 'text-red-500'}`}>
      <Icon size={12} />
      {up ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function VendorDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [period, setPeriod] = useState('30days');
  const [rev, setRev] = useState(0);

  const { data: raw, isLoading } = useFetch(
    ['vendor-stats', user?._id, period, rev],
    () => api.get(`/vendors/dashboard/stats?period=${period}`).then((r) => r.data),
    { staleTime: 5 * 60 * 1000, cacheTime: 10 * 60 * 1000 },
  );

  const stats = raw?.data || {};
  const prev = stats.previousPeriod || {};

  const totalPendingActions = (stats.pendingOrders || 0) + (stats.lowStockProducts || 0) + (stats.pendingReviews || 0);
  const chartData = stats.salesChart?.length ? stats.salesChart : MOCK_CHART;

  const statCards = [
    {
      label: 'Total Products',
      value: stats.totalProducts ?? 0,
      sub: `+${stats.activeProducts ?? 0} active`,
      icon: Box,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50',
      trend: { current: stats.totalProducts, previous: prev.totalProducts },
    },
    {
      label: 'Total Orders',
      value: stats.totalOrders ?? 0,
      sub: stats.pendingOrders > 0 ? `${stats.pendingOrders} pending` : 'All caught up',
      subColor: stats.pendingOrders > 0 ? 'text-orange-500' : 'text-green-600',
      icon: ShoppingBag,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-50',
      trend: { current: stats.totalOrders, previous: prev.totalOrders },
    },
    {
      label: 'Total Sales',
      value: formatCurrency(stats.totalSales ?? 0),
      sub: 'This period',
      icon: IndianRupee,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
      trend: { current: stats.totalSales, previous: prev.totalSales },
    },
    {
      label: 'Earnings',
      value: formatCurrency(stats.totalEarnings ?? 0),
      sub: 'Total earnings',
      icon: IndianRupee,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      trend: { current: stats.totalEarnings, previous: prev.totalEarnings },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Vendor Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRev((r) => r + 1)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                period === p.id
                  ? 'bg-primary-600 text-white'
                  : 'text-secondary-600 hover:bg-secondary-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert banner */}
      {totalPendingActions > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              You have {totalPendingActions} item{totalPendingActions > 1 ? 's' : ''} that need attention
            </p>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {stats.pendingOrders > 0 && (
                <Link
                  to="/dashboard/vendor/orders?status=pending"
                  className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-full transition-colors"
                >
                  📦 {stats.pendingOrders} orders to ship
                  <ArrowRight size={11} />
                </Link>
              )}
              {stats.lowStockProducts > 0 && (
                <Link
                  to="/dashboard/vendor/inventory?filter=low-stock"
                  className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-full transition-colors"
                >
                  ⚠️ {stats.lowStockProducts} low stock items
                  <ArrowRight size={11} />
                </Link>
              )}
              {stats.pendingReviews > 0 && (
                <Link
                  to="/dashboard/vendor/reviews"
                  className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-full transition-colors"
                >
                  ⭐ {stats.pendingReviews} reviews to respond
                  <ArrowRight size={11} />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                    <s.icon size={20} className={s.iconColor} />
                  </div>
                  <TrendIndicator current={s.trend.current} previous={s.trend.previous} />
                </div>
                <p className="text-2xl font-black text-secondary-900">{s.value}</p>
                <p className="text-sm text-secondary-500 mt-0.5">{s.label}</p>
                {s.sub && (
                  <p className={`text-xs mt-0.5 ${s.subColor || 'text-secondary-400'}`}>{s.sub}</p>
                )}
              </div>
            ))}
          </div>

          {/* Sales Chart */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-secondary-900">Sales Overview</h2>
                {prev.totalSales > 0 && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-secondary-400">vs previous period:</span>
                    <TrendIndicator current={stats.totalSales} previous={prev.totalSales} />
                  </div>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => v === 0 ? '0' : `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => [formatCurrency(value), 'Sales']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: '#2563eb' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quick action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Manage Products',
                desc: 'Add, edit, or remove products from your store',
                to: '/dashboard/vendor/products',
                icon: Package,
              },
              {
                label: 'Process Orders',
                desc: 'View and fulfill customer orders',
                to: '/dashboard/vendor/orders',
                icon: ShoppingBag,
                badge: stats.pendingOrders || 0,
              },
              {
                label: 'Sponsored Ads',
                desc: 'Create campaigns to promote your products',
                to: '/dashboard/vendor/ads',
                icon: Megaphone,
              },
            ].map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="card p-5 flex items-center justify-between hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary-100 flex items-center justify-center group-hover:bg-primary-50 transition-colors">
                    <a.icon size={18} className="text-secondary-500 group-hover:text-primary-600 transition-colors" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary-900 text-sm">{a.label}</p>
                    <p className="text-xs text-secondary-400 mt-0.5">{a.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.badge > 0 && (
                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                      {a.badge}
                    </span>
                  )}
                  <ArrowRight size={16} className="text-secondary-300 group-hover:text-secondary-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
