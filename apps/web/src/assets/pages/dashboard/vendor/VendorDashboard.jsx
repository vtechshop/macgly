import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Package, ShoppingBag, IndianRupee, TrendingUp, Plus, AlertTriangle, ArrowRight, Eye, RefreshCw, Clock } from 'lucide-react';
import { formatCurrency } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import api from '../../../../utils/api';
import Spinner from '../../../components/common/Spinner';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function VendorDashboard() {
  const { user } = useSelector((s) => s.auth);

  const { data: productsData, isLoading: loadingP } = useFetch(
    ['vendor-products-dash'],
    () => api.get('/vendors/products', { params: { page: 1, limit: 100 } }).then((r) => r.data)
  );
  const { data: ordersData, isLoading: loadingO } = useFetch(
    ['vendor-orders-dash'],
    () => api.get('/vendors/orders', { params: { page: 1, limit: 50 } }).then((r) => r.data)
  );
  const { data: statsData } = useFetch(
    ['vendor-stats'],
    () => api.get('/vendors/stats').then((r) => r.data)
  );

  const products = productsData?.products || [];
  const orders = ordersData?.orders || [];
  const totalProducts = productsData?.pagination?.total ?? 0;
  const totalOrders = ordersData?.pagination?.total ?? 0;

  const confirmedEarnings = statsData?.confirmedEarnings ?? 0;
  const pendingEarnings = statsData?.pendingEarnings ?? 0;
  const commissionRate = statsData?.commissionRate ?? 10;

  const pendingOrders = orders.filter((o) => o.status === 'pending').length;
  const lowStock = products.filter((p) => p.stock <= 10);
  const publishedProducts = products.filter((p) => p.published).length;
  const draftProducts = products.filter((p) => !p.published).length;

  if (loadingP || loadingO) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const isApproved = user?.vendorProfile?.approved;

  return (
    <div className="space-y-6">
      {/* Pending approval banner */}
      {!isApproved && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
          <Clock size={18} className="text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Account pending approval</p>
            <p className="text-xs text-yellow-700 mt-0.5">Our team will review your vendor account within 1 business day. You can add products now — they'll go live once you're approved.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendor Dashboard</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Welcome back, {user?.name}</p>
        </div>
        <Link to="/dashboard/vendor/products" className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors">
          <Plus size={16} /> Add Product
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: totalProducts, icon: Package, color: 'bg-blue-500', sub: `${publishedProducts} live · ${draftProducts} draft` },
          { label: 'Total Orders', value: totalOrders, icon: ShoppingBag, color: 'bg-orange-500', sub: `${pendingOrders} pending` },
          { label: 'Confirmed Earnings', value: formatCurrency(confirmedEarnings), icon: IndianRupee, color: 'bg-green-500', sub: `After ${commissionRate}% platform fee` },
          { label: 'Pending Earnings', value: formatCurrency(pendingEarnings), icon: TrendingUp, color: 'bg-yellow-500', sub: 'Awaiting delivery' },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color} mb-3`}>
              <s.icon size={20} className="text-white" />
            </div>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-sm text-secondary-500 mt-0.5">{s.label}</p>
            {s.sub && <p className="text-xs text-secondary-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Add New Product', to: '/dashboard/vendor/products', icon: Plus, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'View All Orders', to: '/dashboard/vendor/orders', icon: ShoppingBag, color: 'bg-orange-50 text-orange-700 border-orange-200' },
          { label: 'Manage Products', to: '/dashboard/vendor/products', icon: Package, color: 'bg-green-50 text-green-700 border-green-200' },
          { label: 'Restock Alerts', to: '/dashboard/vendor/products', icon: AlertTriangle, color: 'bg-red-50 text-red-700 border-red-200' },
        ].map((a) => (
          <Link key={a.label} to={a.to} className={`card border p-4 flex items-center gap-3 font-semibold text-sm hover:shadow-md transition-shadow ${a.color}`}>
            <a.icon size={18} /> {a.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
            <h2 className="font-bold">Recent Orders</h2>
            <Link to="/dashboard/vendor/orders" className="text-xs text-primary-600 hover:underline font-medium flex items-center gap-1">View all <ArrowRight size={12} /></Link>
          </div>
          {!orders.length ? (
            <div className="text-center py-10 text-secondary-400">
              <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No orders yet. Start by adding products.</p>
            </div>
          ) : (
            <div className="divide-y divide-secondary-50">
              {orders.slice(0, 6).map((o) => (
                <div key={o._id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-mono font-semibold text-primary-600">#{o._id.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-secondary-500">{o.user?.name} · {new Date(o.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold">{formatCurrency(o.totalAmount)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[o.status] || 'bg-secondary-100 text-secondary-600'}`}>{o.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Low stock */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
              <h2 className="font-bold text-orange-600 flex items-center gap-2"><AlertTriangle size={15} /> Low Stock</h2>
              <Link to="/dashboard/vendor/products" className="text-xs text-primary-600 hover:underline font-medium">Fix</Link>
            </div>
            {!lowStock.length ? (
              <p className="text-center py-6 text-secondary-400 text-sm">All products well stocked ✓</p>
            ) : (
              <div className="divide-y divide-secondary-50">
                {lowStock.slice(0, 5).map((p) => (
                  <div key={p._id} className="flex items-center justify-between px-5 py-2.5">
                    <p className="text-sm font-medium line-clamp-1 flex-1 mr-2">{p.title}</p>
                    <span className={`text-xs font-bold shrink-0 ${p.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      {p.stock === 0 ? 'Out' : `${p.stock} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top products */}
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100">
              <h2 className="font-bold">Your Products</h2>
              <Link to="/dashboard/vendor/products" className="text-xs text-primary-600 hover:underline font-medium flex items-center gap-1">Manage <ArrowRight size={12} /></Link>
            </div>
            {!products.length ? (
              <div className="text-center py-6 text-secondary-400">
                <p className="text-sm">No products yet</p>
                <Link to="/dashboard/vendor/products" className="text-xs text-primary-600 font-semibold mt-1 block">+ Add your first product</Link>
              </div>
            ) : (
              <div className="divide-y divide-secondary-50">
                {products.slice(0, 4).map((p) => (
                  <div key={p._id} className="flex items-center gap-3 px-5 py-2.5">
                    {p.images?.[0] && <img src={p.images[0]} alt="" className="w-8 h-8 rounded object-cover bg-secondary-100" onError={(e) => e.target.style.display='none'} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-1">{p.title}</p>
                      <p className="text-xs text-secondary-400">Stock: {p.stock}</p>
                    </div>
                    <p className="text-xs font-bold text-primary-700 shrink-0">{formatCurrency(p.price)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
