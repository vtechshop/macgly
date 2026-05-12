import { useFetch } from '../../../../hooks';
import api from '../../../../utils/api';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';

const STATUS_COLORS = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  shipped:    'bg-indigo-100 text-indigo-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
  returned:   'bg-gray-100 text-gray-600',
};

export default function AffiliateEarnings() {
  const { data, isLoading } = useFetch(
    ['affiliate-orders'],
    () => api.get('/affiliates/orders?limit=50').then((r) => r.data)
  );

  const orders = data?.orders || [];
  const total = orders.reduce((s, o) => s + (o.affiliateCommission || 0), 0);
  const earned = orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + (o.affiliateCommission || 0), 0);
  const pending = orders.filter((o) => !['delivered', 'cancelled', 'returned'].includes(o.status)).reduce((s, o) => s + (o.affiliateCommission || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Earnings</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Commissions from your referred orders</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 text-center">
          <p className="text-2xl font-black text-green-600">{formatCurrency(earned)}</p>
          <p className="text-sm text-secondary-500 mt-1">Earned (delivered)</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-2xl font-black text-yellow-600">{formatCurrency(pending)}</p>
          <p className="text-sm text-secondary-500 mt-1">Pending</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-2xl font-black">{formatCurrency(total)}</p>
          <p className="text-sm text-secondary-500 mt-1">All time total</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-secondary-100 font-semibold">Referred Orders</div>
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : orders.length === 0 ? (
          <div className="py-10 text-center text-secondary-400 text-sm">No referred orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Order</th>
                  <th className="px-5 py-3 text-left">Customer</th>
                  <th className="px-5 py-3 text-left">Order Total</th>
                  <th className="px-5 py-3 text-left">Commission</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {orders.map((order) => (
                  <tr key={order._id} className="hover:bg-secondary-50">
                    <td className="px-5 py-3 font-mono text-xs">{order.orderId}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{order.user?.name || '—'}</p>
                      <p className="text-xs text-secondary-400">{order.user?.email}</p>
                    </td>
                    <td className="px-5 py-3">{formatCurrency(order.totalAmount)}</td>
                    <td className="px-5 py-3 font-semibold text-green-700">{formatCurrency(order.affiliateCommission || 0)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status] || 'bg-secondary-100 text-secondary-600'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-secondary-500">
                      {new Date(order.createdAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
