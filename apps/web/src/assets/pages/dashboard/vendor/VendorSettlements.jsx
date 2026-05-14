import { useState } from 'react';
import { IndianRupee, Clock, CheckCircle, Banknote } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  class: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Approved', class: 'bg-blue-100 text-blue-700',    icon: CheckCircle },
  paid:     { label: 'Paid',     class: 'bg-green-100 text-green-700',  icon: Banknote },
  cancelled:{ label: 'Cancelled',class: 'bg-red-100 text-red-700',      icon: Clock },
};

export default function VendorSettlements() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useFetch(
    ['vendor-settlements', status, page],
    () => api.get('/vendors/settlements', { params: { status: status || undefined, page, limit: 20 } }).then((r) => r.data)
  );

  const commissions = data?.commissions || [];
  const pagination = data?.pagination || {};
  const summary = data?.summary || {};

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Settlements</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Your commission earnings and payout history</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
        {[
          { label: 'Pending Earnings', value: `₹${(summary.pendingAmount || 0).toLocaleString()}`, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Total Paid', value: `₹${(summary.paidAmount || 0).toLocaleString()}`, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`card p-4 ${bg}`}>
            <p className="text-xs text-secondary-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 bg-secondary-100 p-1 rounded-lg w-fit">
        {[['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['paid', 'Paid']].map(([val, label]) => (
          <button key={val} onClick={() => { setStatus(val); setPage(1); }}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${status === val ? 'bg-white shadow-sm text-secondary-800' : 'text-secondary-500 hover:text-secondary-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : commissions.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400"><IndianRupee size={40} className="mx-auto mb-3 opacity-30" /><p>No commissions found</p></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-right">Sale</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Your Earning</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {commissions.map((c) => {
                const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={c._id} className="hover:bg-secondary-50">
                    <td className="px-4 py-3 font-mono text-xs">{c.order?.orderId || '—'}</td>
                    <td className="px-4 py-3 text-right">₹{(c.saleAmount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-secondary-500">{c.commissionRate}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">₹{(c.commissionAmount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-secondary-500 text-xs">{fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.class}`}>{cfg.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex items-center justify-between text-sm text-secondary-500">
              <span>Page {pagination.page} of {pagination.pages}</span>
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
