import { useState } from 'react';
import { Search, ArrowLeft, Users, ShoppingBag, IndianRupee } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CustomerDetail({ id, onBack }) {
  const { data, isLoading } = useFetch(['admin-crm-detail', id], () =>
    api.get(`/admin/crm/${id}`).then((r) => r.data)
  );
  const customer = data?.customer;
  const orders = data?.orders || [];

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!customer) return <div className="text-center py-20 text-secondary-400">Customer not found</div>;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-secondary-500 hover:text-secondary-800 text-sm font-medium">
        <ArrowLeft size={16} /> Back to CRM
      </button>

      <div className="card p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg shrink-0">
          {customer.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold">{customer.name}</h2>
          <p className="text-secondary-500 text-sm">{customer.email}</p>
          {customer.phone && <p className="text-secondary-500 text-sm">{customer.phone}</p>}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${customer.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {customer.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="text-xs text-secondary-400">Joined {fmtDate(customer.createdAt)}</span>
            {customer.lastLogin && <span className="text-xs text-secondary-400">Last login {fmtDate(customer.lastLogin)}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Orders', value: orders.length, icon: ShoppingBag },
          { label: 'Total Spend', value: `₹${orders.reduce((s, o) => s + (o.totalAmount || 0), 0).toLocaleString()}`, icon: IndianRupee },
          { label: 'Last Order', value: orders[0] ? fmtDate(orders[0].createdAt) : '—', icon: ShoppingBag },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50"><Icon size={16} className="text-blue-600" /></div>
            <div>
              <p className="text-xs text-secondary-500">{label}</p>
              <p className="font-bold text-secondary-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {orders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-secondary-100 font-semibold text-sm">Order History</div>
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Order ID</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {orders.map((o) => (
                <tr key={o._id} className="hover:bg-secondary-50">
                  <td className="px-4 py-2 font-mono text-xs">{o.orderId}</td>
                  <td className="px-4 py-2 text-secondary-500">{fmtDate(o.createdAt)}</td>
                  <td className="px-4 py-2 capitalize">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary-100 text-secondary-600">{o.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">₹{(o.totalAmount || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminCRM() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const { data, isLoading } = useFetch(
    ['admin-crm', search, page],
    () => api.get('/admin/crm', { params: { search: search || undefined, page, limit: 20 } }).then((r) => r.data)
  );

  if (selectedId) return <CustomerDetail id={selectedId} onBack={() => setSelectedId(null)} />;

  const customers = data?.customers || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Customer relationship management</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-8 pr-3 py-2 text-sm w-56"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

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
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-center">Orders</th>
                <th className="px-4 py-3 text-right">Total Spend</th>
                <th className="px-4 py-3 text-left">Last Order</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {customers.map((c) => (
                <tr
                  key={c._id}
                  className="hover:bg-secondary-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedId(c._id)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-secondary-400">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{c.totalOrders || 0}</td>
                  <td className="px-4 py-3 text-right font-medium">₹{(c.totalSpend || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-secondary-500 text-xs">{fmtDate(c.lastOrderAt)}</td>
                  <td className="px-4 py-3 text-secondary-500 text-xs">{fmtDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
