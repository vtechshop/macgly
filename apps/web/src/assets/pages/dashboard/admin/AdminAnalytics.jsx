import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Users, ShoppingBag, Package } from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';

const PERIODS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

const STATUS_COLORS = {
  pending: '#f59e0b', confirmed: '#3b82f6', processing: '#6366f1',
  shipped: '#8b5cf6', delivered: '#22c55e', cancelled: '#ef4444', returned: '#9ca3af',
};

const CATEGORY_PALETTE = ['#f97316', '#3b82f6', '#22c55e', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16', '#6366f1'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-secondary-900 text-white text-xs rounded-xl px-3 py-2 shadow-lg space-y-1">
      <p className="font-bold opacity-70">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'revenue' ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState(30);

  const { data, isLoading } = useFetch(
    ['admin-analytics', period],
    () => api.get('/admin/analytics', { params: { days: period } }).then((r) => r.data)
  );

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-secondary-400">Loading analytics…</p>
    </div>
  );

  const revenueByDay = data?.revenueByDay || [];
  const ordersByStatus = data?.ordersByStatus || {};
  const topProducts = data?.topProducts || [];
  const topVendors = data?.topVendors || [];
  const topCategories = data?.topCategories || [];

  const totalRevenue = revenueByDay.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = revenueByDay.reduce((s, d) => s + d.orders, 0);
  const totalNewUsers = revenueByDay.reduce((s, d) => s + (d.newUsers || 0), 0);

  const pieData = Object.entries(ordersByStatus).map(([status, count]) => ({ name: status, value: count }));

  // Sparse date labels for readability
  const tickInterval = Math.floor(revenueByDay.length / 6);

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-xs text-secondary-400 mt-0.5">Business performance overview</p>
        </div>
        <div className="flex gap-1 bg-secondary-100 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p.value ? 'bg-white text-secondary-900 shadow-sm' : 'text-secondary-500 hover:text-secondary-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'bg-emerald-500' },
          { label: 'Total Orders', value: totalOrders, icon: ShoppingBag, color: 'bg-primary-500' },
          { label: 'New Customers', value: totalNewUsers, icon: Users, color: 'bg-violet-500' },
          { label: 'Avg Order Value', value: totalOrders > 0 ? formatCurrency(totalRevenue / totalOrders) : '—', icon: Package, color: 'bg-orange-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-secondary-100 p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} mb-3`}>
              <Icon size={17} className="text-white" />
            </div>
            <p className="text-2xl font-black text-secondary-900 leading-none">{value}</p>
            <p className="text-xs text-secondary-500 mt-1.5 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Revenue area chart */}
      <div className="bg-white rounded-xl border border-secondary-100 p-5">
        <h2 className="font-bold text-secondary-900 mb-5">Revenue & Orders — Last {period} Days</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenueByDay} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
              tickFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            />
            <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
            <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue" stroke="#f97316" strokeWidth={2} fill="url(#revGrad)" />
            <Area yAxisId="ord" type="monotone" dataKey="orders" name="Orders" stroke="#3b82f6" strokeWidth={2} fill="url(#ordGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* New users + order status row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-secondary-100 p-5">
          <h2 className="font-bold text-secondary-900 mb-5">New Customers Per Day</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueByDay} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={tickInterval}
                tickFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="newUsers" name="New Users" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-secondary-100 p-5">
          <h2 className="font-bold text-secondary-900 mb-5">Order Status Breakdown</h2>
          {pieData.length ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: STATUS_COLORS[entry.name] || '#94a3b8' }} />
                      <span className="capitalize text-secondary-600">{entry.name}</span>
                    </div>
                    <strong className="text-secondary-800">{entry.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center py-10 text-secondary-400 text-sm">No orders in this period</p>
          )}
        </div>
      </div>

      {/* Top products + top categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-secondary-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-100 flex items-center justify-between">
            <h2 className="font-bold text-secondary-900 text-sm">Top Products by Revenue</h2>
            <Link to="/dashboard/admin/products" className="text-xs text-primary-600 hover:underline font-medium">All products</Link>
          </div>
          {topProducts.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProducts.slice(0, 6)} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                <YAxis type="category" dataKey="title" width={120} tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v?.length > 18 ? v.slice(0, 18) + '…' : v} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="totalRevenue" name="Revenue" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-10 text-secondary-400 text-sm">No sales data yet</p>}
        </div>

        <div className="bg-white rounded-xl border border-secondary-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-100">
            <h2 className="font-bold text-secondary-900 text-sm">Revenue by Category</h2>
          </div>
          {topCategories.length ? (
            <div className="p-5 space-y-3">
              {topCategories.slice(0, 8).map((cat, i) => {
                const max = topCategories[0]?.totalRevenue || 1;
                const pct = (cat.totalRevenue / max) * 100;
                return (
                  <div key={cat._id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize text-secondary-700 font-medium">{cat._id?.replace(/-/g, ' ')}</span>
                      <span className="text-secondary-500">{formatCurrency(cat.totalRevenue)}</span>
                    </div>
                    <div className="h-2 bg-secondary-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-center py-10 text-secondary-400 text-sm">No category data yet</p>}
        </div>
      </div>

      {/* Top vendors */}
      {topVendors.length > 0 && (
        <div className="bg-white rounded-xl border border-secondary-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-secondary-100 flex items-center justify-between">
            <h2 className="font-bold text-secondary-900 text-sm">Top Vendors by Revenue</h2>
            <Link to="/dashboard/admin/vendors" className="text-xs text-primary-600 hover:underline font-medium">All vendors</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  {['#', 'Vendor', 'Revenue', 'Items Sold'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {topVendors.map((v, i) => (
                  <tr key={v._id} className="hover:bg-secondary-50/50">
                    <td className="px-5 py-3 text-secondary-400 font-medium text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-semibold text-secondary-800">{v.name || 'Unknown Vendor'}</td>
                    <td className="px-5 py-3 font-bold text-green-600">{formatCurrency(v.totalRevenue)}</td>
                    <td className="px-5 py-3 text-secondary-500">{v.totalOrders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
