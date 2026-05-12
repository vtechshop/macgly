import React, { useState } from 'react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate } from '../../../../utils/format';
import { useFetch, useAction } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function AffiliateAttribution({ order, onDone }) {
  const [selectedCode, setSelectedCode] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: affiliatesData } = useFetch(
    ['admin-affiliates-list'],
    () => api.get('/admin/users?role=affiliate&limit=100').then((r) => r.data)
  );
  const affiliates = (affiliatesData?.users || []).filter((a) => a.affiliateProfile?.referralCode);

  async function handleSet() {
    if (!selectedCode) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/orders/${order._id}/affiliate`, { affiliateCode: selectedCode });
      toast.success(`Attributed to ${data.affiliate.name} — commission ${formatCurrency(data.affiliate.commission)}`);
      setSelectedCode('');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to set affiliate');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="text-sm space-y-1.5">
      {order.affiliateId ? (
        <p className="font-medium text-green-700">Attributed ✓</p>
      ) : (
        <p className="text-secondary-400 italic text-xs">No affiliate</p>
      )}
      {order.affiliateCommission > 0 && (
        <p className="text-secondary-600 text-xs">Commission: <span className="font-semibold">{formatCurrency(order.affiliateCommission)}</span></p>
      )}
      <div className="flex gap-1.5 mt-2">
        <select
          className="input text-xs py-1 flex-1"
          value={selectedCode}
          onChange={(e) => setSelectedCode(e.target.value)}
        >
          <option value="">Select affiliate…</option>
          {affiliates.map((a) => (
            <option key={a._id} value={a.affiliateProfile.referralCode}>
              {a.name} ({a.affiliateProfile.referralCode})
            </option>
          ))}
        </select>
        <button
          onClick={handleSet}
          disabled={saving || !selectedCode}
          className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 font-medium shrink-0"
        >
          {saving ? '…' : 'Set'}
        </button>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  shipped:    'bg-purple-100 text-purple-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
  returned:   'bg-secondary-100 text-secondary-600',
};

const STATUSES = ['pending','confirmed','processing','shipped','delivered','cancelled','returned'];

export default function AdminOrders() {
  const [page, setPage] = useState(1);
  const [rev, setRev] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading } = useFetch(
    ['admin-orders', page, rev, statusFilter],
    () => api.get('/admin/orders', { params: { page, limit: 20, status: statusFilter || undefined } }).then((r) => r.data)
  );

  const { mutate: updateStatus } = useAction(
    ({ id, status }) => api.put(`/admin/orders/${id}`, { status }),
    {
      onSuccess: () => { setRev((r) => r + 1); toast.success('Status updated'); },
      onError: () => toast.error('Failed to update'),
    }
  );

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const orders = data?.orders || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-2">
          <select className="input w-auto text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          <span className="text-sm text-secondary-500">{data?.pagination?.total || 0} orders</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary-50 border-b border-secondary-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Order ID</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Payment</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100">
            {!orders.length ? (
              <tr><td colSpan={6} className="text-center py-12 text-secondary-400">No orders found</td></tr>
            ) : orders.map((o) => (
              <React.Fragment key={o._id}>
                <tr className="hover:bg-secondary-50 cursor-pointer" onClick={() => setExpanded(expanded === o._id ? null : o._id)}>
                  <td className="px-4 py-3 font-medium text-primary-600">{o.orderId}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.user?.name || 'Guest'}</p>
                    <p className="text-xs text-secondary-400">{o.user?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-secondary-500">{formatDate(o.createdAt)}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(o.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${o.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <select
                      className={`text-xs rounded px-2 py-1.5 border font-semibold cursor-pointer ${STATUS_COLORS[o.status] || ''}`}
                      value={o.status}
                      onChange={(e) => updateStatus({ id: o._id, status: e.target.value })}
                    >
                      {STATUSES.map((s) => <option key={s} value={s} className="bg-white text-secondary-900 capitalize">{s}</option>)}
                    </select>
                  </td>
                </tr>
                {expanded === o._id && (
                  <tr>
                    <td colSpan={6} className="bg-secondary-50 px-6 py-4">
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-xs font-bold text-secondary-500 uppercase mb-2">Items</p>
                          <div className="space-y-1">
                            {o.items?.map((item, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span>{item.title} × {item.quantity}</span>
                                <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-secondary-500 uppercase mb-2">Shipping Address</p>
                          {o.shippingAddress ? (
                            <address className="text-sm not-italic text-secondary-600 leading-relaxed">
                              {o.shippingAddress.name}<br />
                              {o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ''}<br />
                              {o.shippingAddress.city}, {o.shippingAddress.state} — {o.shippingAddress.pincode}<br />
                              📞 {o.shippingAddress.phone}
                            </address>
                          ) : <p className="text-sm text-secondary-400">—</p>}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-secondary-500 uppercase mb-2">Affiliate</p>
                          <AffiliateAttribution order={o} onDone={() => setRev((r) => r + 1)} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {data?.pagination?.pages > 1 && (
          <div className="flex justify-center gap-1 px-4 py-3 border-t border-secondary-100">
            {Array.from({ length: data.pagination.pages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded text-xs font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100'}`}>{p}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
