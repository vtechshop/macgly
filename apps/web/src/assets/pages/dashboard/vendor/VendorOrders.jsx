import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
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

export default function VendorOrders() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading } = useFetch(
    ['vendor-orders', page],
    () => api.get('/vendors/orders', { params: { page, limit: 20 } }).then((r) => r.data)
  );

  function toggle(id) { setExpanded((p) => (p === id ? null : id)); }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Orders</h1>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="card overflow-hidden">
          {!data?.orders?.length ? (
            <div className="text-center py-16 text-secondary-400">
              <p className="font-medium">No orders yet</p>
              <p className="text-sm mt-1">Orders for your products will appear here</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-secondary-50 border-b border-secondary-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-secondary-600">Order</th>
                    <th className="text-left px-4 py-3 font-medium text-secondary-600">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-secondary-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-secondary-600">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-secondary-600">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100">
                  {data.orders.map((o) => (
                    <React.Fragment key={o._id}>
                      <tr className="hover:bg-secondary-50 cursor-pointer" onClick={() => toggle(o._id)}>
                        <td className="px-4 py-3 font-mono text-xs text-secondary-500">#{o._id.slice(-8).toUpperCase()}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{o.user?.name || 'Guest'}</p>
                          <p className="text-xs text-secondary-400">{o.user?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-secondary-500 text-xs">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(o.totalAmount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLORS[o.status] || 'bg-secondary-100 text-secondary-600'}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-secondary-400">
                          {expanded === o._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {expanded === o._id && (
                        <tr>
                          <td colSpan={6} className="px-4 pb-4 bg-secondary-50">
                            <div className="mt-2 space-y-2">
                              {o.items.map((item, i) => (
                                <div key={i} className="flex items-center gap-3 py-2 border-b border-secondary-100 last:border-0">
                                  {item.image && (
                                    <img src={normalizeImageUrl(item.image)} alt="" className="w-10 h-10 rounded object-cover bg-white border border-secondary-200" onError={(e) => e.target.style.display = 'none'} />
                                  )}
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{item.title}</p>
                                    <p className="text-xs text-secondary-400">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                                  </div>
                                  <p className="font-semibold text-sm">{formatCurrency(item.quantity * item.price)}</p>
                                </div>
                              ))}
                              {o.shippingAddress && (
                                <p className="text-xs text-secondary-500 pt-1">
                                  Ship to: {o.shippingAddress.name}, {o.shippingAddress.line1}, {o.shippingAddress.city} — {o.shippingAddress.phone}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {data?.pagination?.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-100 text-sm text-secondary-500">
                  <span>{data.pagination.total} orders</span>
                  <div className="flex gap-1">
                    {Array.from({ length: data.pagination.pages }, (_, i) => i + 1).map((p) => (
                      <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded text-xs font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100'}`}>{p}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
