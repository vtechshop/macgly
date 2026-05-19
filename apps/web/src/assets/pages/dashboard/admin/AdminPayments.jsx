import { useState } from 'react';
import { RefreshCw, Download, TrendingUp, CheckCircle2, Clock, RefreshCcw, X, Search } from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';

const STATUS_STYLES = {
  paid:     'bg-green-100 text-green-700',
  pending:  'bg-yellow-100 text-yellow-700',
  failed:   'bg-red-100 text-red-700',
  refunded: 'bg-purple-100 text-purple-700',
};

const METHOD_LABELS = { razorpay: 'Razorpay', cod: 'COD' };

export default function AdminPayments() {
  const [page, setPage] = useState(1);
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-payments', page, methodFilter, statusFilter, rev],
    () => api.get('/admin/payments', {
      params: { page, limit: 20, method: methodFilter || undefined, status: statusFilter || undefined },
    }).then((r) => r.data)
  );

  const summary = data?.summary || {};
  const orders = data?.orders || [];
  const pagination = data?.pagination;
  const totalPages = Math.ceil((pagination?.total || 0) / (pagination?.limit || 20));
  const methodBreakdown = data?.methodBreakdown || [];

  const filtered = search
    ? orders.filter((o) =>
        o.orderId?.toLowerCase().includes(search.toLowerCase()) ||
        o.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        o.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
        o.razorpayPaymentId?.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  function exportCSV() {
    if (!orders.length) return;
    const rows = [['Order ID', 'Customer', 'Email', 'Amount', 'Method', 'Status', 'Date']];
    orders.forEach((o) => rows.push([
      o.orderId, o.user?.name || '', o.user?.email || '',
      o.totalAmount, o.paymentMethod, o.paymentStatus,
      new Date(o.createdAt).toLocaleDateString(),
    ]));
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Payment Dashboard</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Monitor all payment transactions and settlements</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setRev((r) => r + 1)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Account Balance dark card */}
      <div className="rounded-2xl bg-[#0f1117] text-white p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">Account Balance</h2>
          <span className="text-xs bg-white/10 rounded-lg px-3 py-1.5">Last 30 days</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-400 mb-1">Available Balance</p>
            <p className="text-2xl font-black text-green-400">{formatCurrency(summary.availableBalance || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Ready for withdrawal</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Failed Transactions</p>
            <p className="text-2xl font-black text-red-400">{formatCurrency(summary.failed?.revenue || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">{summary.failed?.count || 0} failed payments</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Reserved (Refunds)</p>
            <p className="text-2xl font-black text-orange-400">{formatCurrency(summary.refunded?.revenue || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Held for potential claims</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">Next Payout</p>
            <p className="text-2xl font-black">{formatCurrency(summary.nextPayout || 0)}</p>
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Clock size={11} /> Weekly settlement
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(summary.totalRevenue || 0), sub: `From ${summary.totalOrders || 0} orders`, icon: TrendingUp, iconBg: 'bg-green-100 text-green-600' },
          { label: 'Successful', value: summary.paid?.count ?? 0, sub: formatCurrency(summary.paid?.revenue || 0), icon: CheckCircle2, iconBg: 'bg-blue-100 text-blue-600', valueColor: 'text-green-600' },
          { label: 'Failed', value: summary.failed?.count ?? 0, sub: formatCurrency(summary.failed?.revenue || 0), icon: Clock, iconBg: 'bg-red-100 text-red-500', valueColor: 'text-red-500' },
          { label: 'Refunded', value: summary.refunded?.count ?? 0, sub: formatCurrency(summary.refunded?.revenue || 0), icon: RefreshCcw, iconBg: 'bg-purple-100 text-purple-600', valueColor: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-secondary-500">{s.label}</p>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                <s.icon size={18} />
              </div>
            </div>
            <p className={`text-2xl font-black ${s.valueColor || 'text-secondary-900'}`}>{s.value}</p>
            <p className="text-xs text-secondary-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Payment Methods */}
      {methodBreakdown.length > 0 && (
        <div className="card p-5">
          <h2 className="font-bold text-secondary-800 mb-4">Payment Methods</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {methodBreakdown.map((m) => (
              <div key={m._id} className="bg-secondary-50 rounded-xl p-4">
                <p className="text-xs text-secondary-500 font-medium uppercase tracking-wide mb-2">{METHOD_LABELS[m._id] || m._id}</p>
                <p className="text-lg font-black text-secondary-900">{formatCurrency(m.revenue)}</p>
                <p className="text-xs text-secondary-400 mt-0.5">{m.count} orders</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions table */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-secondary-100">
          <h2 className="font-bold text-secondary-800 mr-auto">Transactions</h2>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
            <input
              className="input pl-8 text-sm w-52"
              placeholder="Search order, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-36 text-sm" value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}>
            <option value="">All Methods</option>
            <option value="razorpay">Razorpay</option>
            <option value="cod">COD</option>
          </select>
          <select className="input w-36 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          {(methodFilter || statusFilter) && (
            <button onClick={() => { setMethodFilter(''); setStatusFilter(''); setPage(1); }} className="p-2 hover:bg-secondary-100 rounded-lg text-secondary-400">
              <X size={14} />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary-50 border-b border-secondary-100">
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Order ID</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Amount</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Method</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide hidden md:table-cell">Transaction ID</th>
                  <th className="text-left px-5 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {!filtered.length ? (
                  <tr><td colSpan={7} className="text-center py-12 text-secondary-400">No transactions found</td></tr>
                ) : filtered.map((o) => (
                  <tr key={o._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-blue-600">{o.orderId}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-secondary-900">{o.user?.name || '—'}</p>
                      <p className="text-xs text-secondary-400">{o.user?.email}</p>
                    </td>
                    <td className="px-5 py-3 font-bold text-secondary-900">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-700">
                        {METHOD_LABELS[o.paymentMethod] || o.paymentMethod}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[o.paymentStatus] || 'bg-secondary-100 text-secondary-600'}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <span className="font-mono text-xs text-secondary-400">{o.razorpayPaymentId || '—'}</span>
                    </td>
                    <td className="px-5 py-3 text-secondary-500 text-xs">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
            <span className="text-xs text-secondary-500">Page {page} of {totalPages} · {pagination?.total} transactions</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40">← Prev</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-xs font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100'}`}>{p}</button>;
              })}
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
