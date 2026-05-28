import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Download, TrendingUp, CheckCircle, Clock,
  RotateCcw, Search, ChevronDown, CreditCard, Smartphone,
  Building2, Wallet, IndianRupee, X,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate } from '../../../../utils/format';
import toast from 'react-hot-toast';

// ── constants ─────────────────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { value: '1',    label: 'Today' },
  { value: '7',    label: 'Last 7 Days' },
  { value: '30',   label: 'Last 30 Days' },
  { value: '90',   label: 'Last 90 Days' },
  { value: 'year', label: 'This Year' },
];

const METHOD_OPTIONS = [
  { value: '',             label: 'All Payment Methods' },
  { value: 'razorpay',     label: 'Razorpay' },
  { value: 'cod',          label: 'COD' },
  { value: 'cash',         label: 'Cash' },
  { value: 'upi',          label: 'UPI' },
  { value: 'card',         label: 'Card' },
  { value: 'bank_transfer',label: 'Bank Transfer' },
];

const STATUS_OPTIONS = [
  { value: '',           label: 'All Statuses' },
  { value: 'successful', label: 'Captured' },
  { value: 'pending',    label: 'Pending' },
  { value: 'failed',     label: 'Failed' },
  { value: 'refunded',   label: 'Refunded' },
];

const METHOD_LABELS = {
  razorpay:     'Razorpay',
  cod:          'COD',
  cash:         'Cash',
  upi:          'UPI',
  card:         'Card',
  bank_transfer:'Bank Transfer',
  other:        'Other',
};

// ── helpers ───────────────────────────────────────────────────────────────────

function normalizeStatus(s) {
  if (['paid', 'captured', 'completed'].includes(s)) return 'paid';
  if (s === 'refunded') return 'refunded';
  if (s === 'failed')   return 'failed';
  return 'pending';
}

function StatusBadge({ status }) {
  const n = normalizeStatus(status);
  const map = {
    paid:     'bg-green-100 text-green-700',
    pending:  'bg-yellow-100 text-yellow-700',
    failed:   'bg-red-100 text-red-700',
    refunded: 'bg-purple-100 text-purple-700',
  };
  const labels = { paid: 'Captured', pending: 'Pending', failed: 'Failed', refunded: 'Refunded' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${map[n]}`}>
      {n === 'pending'  && <Clock size={9} />}
      {n === 'paid'     && <CheckCircle size={9} />}
      {labels[n]}
    </span>
  );
}

function MethodIcon({ method }) {
  const m = (method || '').toLowerCase();
  if (['cod', 'cash'].includes(m))             return <IndianRupee size={14} className="text-green-600" />;
  if (m === 'upi')                              return <Smartphone  size={14} className="text-purple-600" />;
  if (['card', 'credit_card'].includes(m))      return <CreditCard  size={14} className="text-blue-600" />;
  if (['netbanking', 'bank_transfer'].includes(m)) return <Building2 size={14} className="text-gray-600" />;
  if (m === 'wallet')                           return <Wallet      size={14} className="text-orange-600" />;
  return <CreditCard size={14} className="text-blue-500" />;
}

function SelectFilter({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={onChange}
        className="border border-secondary-200 rounded-lg px-3 py-2 text-sm bg-white pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-primary-300 min-w-36">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY_STATS = {
  totalRevenue: 0, totalTransactions: 0,
  successfulPayments: 0, successfulAmount: 0,
  pendingPayments: 0,    pendingAmount: 0,
  failedPayments: 0,     failedAmount: 0,
  refundedPayments: 0,   refundedAmount: 0,
  paymentMethods: [],
  availableBalance: 0, reservedAmount: 0,
  nextPayoutAmount: 0, nextPayoutDate: 'Weekly settlement',
};

export default function AdminPayments() {
  const [stats,        setStats]        = useState(EMPTY_STATS);
  const [transactions, setTransactions] = useState([]);
  const [meta,         setMeta]         = useState({});
  const [statsLoading, setStatsLoading] = useState(true);
  const [listLoading,  setListLoading]  = useState(true);

  const [page,         setPage]         = useState(1);
  const [dateRange,    setDateRange]    = useState('30');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/admin/payments/stats', { params: { days: dateRange } });
      setStats(data);
    } catch { toast.error('Failed to load stats'); }
    finally { setStatsLoading(false); }
  }, [dateRange]);

  const loadTransactions = useCallback(async () => {
    setListLoading(true);
    try {
      const { data } = await api.get('/admin/payments', {
        params: {
          page, limit: 20, days: dateRange,
          paymentMethod: methodFilter || undefined,
          status:        statusFilter || undefined,
          search:        search       || undefined,
        },
      });
      setTransactions(data.data || []);
      setMeta(data.meta || {});
    } catch { toast.error('Failed to load transactions'); }
    finally { setListLoading(false); }
  }, [page, dateRange, methodFilter, statusFilter, search]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  function clearFilters() {
    setMethodFilter(''); setStatusFilter(''); setSearch(''); setSearchInput(''); setPage(1);
  }

  function refresh() { loadStats(); loadTransactions(); }

  function exportCSV() {
    if (!transactions.length) return;
    const headers = ['Order ID','Customer','Email','Payment Method','Amount','Platform Fee','Net Amount','Status','Date'];
    const rows = transactions.map((t) => [
      t.orderId, t.customerName, t.customerEmail,
      METHOD_LABELS[t.paymentMethod] || t.paymentMethod,
      t.amount, t.platformFee, (t.amount - t.platformFee).toFixed(2),
      t.status, formatDate(t.createdAt),
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const hasFilters = methodFilter || statusFilter || search;

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Payment Dashboard</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Monitor all payment transactions and settlements</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Account Balance — dark card */}
      <div className="rounded-2xl bg-[#0f1117] text-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg">Account Balance</h2>
          <SelectFilter
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
            options={DATE_OPTIONS.map((o) => ({ ...o }))}
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-400 mb-1">Available Balance</p>
            <p className="text-2xl font-black text-green-400">{formatCurrency(stats.availableBalance)}</p>
            <p className="text-xs text-gray-500 mt-1">Ready for withdrawal</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Pending Balance</p>
            <p className="text-2xl font-black text-yellow-400">{formatCurrency(stats.pendingAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.pendingPayments} transactions processing</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Reserved (Refunds)</p>
            <p className="text-2xl font-black text-red-400">{formatCurrency(stats.reservedAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">Held for potential claims</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-2">Next Payout</p>
            <p className="text-2xl font-black">{formatCurrency(stats.nextPayoutAmount)}</p>
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Clock size={11} /> {stats.nextPayoutDate}
            </p>
          </div>
        </div>
      </div>

      {/* Quick stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Revenue',
            value: formatCurrency(stats.totalRevenue),
            sub:   `From ${stats.totalTransactions} orders`,
            Icon: TrendingUp, iconCls: 'bg-primary-100 text-primary-600',
          },
          {
            label: 'Successful',
            value: stats.successfulPayments,
            sub:   formatCurrency(stats.successfulAmount),
            Icon: CheckCircle, iconCls: 'bg-green-100 text-green-600', valCls: 'text-green-600',
          },
          {
            label: 'Pending',
            value: stats.pendingPayments,
            sub:   formatCurrency(stats.pendingAmount),
            Icon: Clock, iconCls: 'bg-yellow-100 text-yellow-600', valCls: 'text-yellow-600',
          },
          {
            label: 'Refunded',
            value: stats.refundedPayments,
            sub:   formatCurrency(stats.refundedAmount),
            Icon: RotateCcw, iconCls: 'bg-purple-100 text-purple-600', valCls: 'text-purple-600',
          },
        ].map(({ label, value, sub, Icon, iconCls, valCls }) => (
          <div key={label} className="bg-white rounded-xl border border-secondary-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-secondary-500">{label}</p>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconCls}`}>
                <Icon size={17} />
              </div>
            </div>
            <p className={`text-2xl font-black ${valCls || 'text-secondary-900'}`}>{value}</p>
            <p className="text-xs text-secondary-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Payment Methods breakdown */}
      {stats.paymentMethods.length > 0 && (
        <div className="bg-white rounded-xl border border-secondary-200 p-5">
          <h2 className="font-bold text-secondary-800 mb-4">Payment Methods</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats.paymentMethods.map((m) => (
              <div key={m._id} className="bg-secondary-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 bg-white rounded-lg border border-secondary-100 flex items-center justify-center">
                    <MethodIcon method={m._id} />
                  </div>
                  <p className="text-xs font-semibold text-secondary-700">{METHOD_LABELS[m._id] || m._id}</p>
                </div>
                <p className="text-base font-black text-secondary-900">{formatCurrency(m.total)}</p>
                <p className="text-xs text-secondary-400 mt-0.5">{m.count} transaction{m.count !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <form onSubmit={handleSearch} className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by Order ID or Customer…"
            className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </form>
        <SelectFilter
          value={methodFilter}
          onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
          options={METHOD_OPTIONS}
        />
        <SelectFilter
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          options={STATUS_OPTIONS}
        />
        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors whitespace-nowrap">
            <X size={13} /> Clear All Filters
          </button>
        )}
      </div>

      {meta.total !== undefined && (
        <p className="text-sm text-secondary-500">
          Showing {transactions.length} of {meta.total} transactions
        </p>
      )}

      {/* Transaction table */}
      <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary-900 text-white">
                {['Order ID','Customer','Payment Method','Amount','Status','Date'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {listLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-secondary-400 text-sm">Loading transactions…</p>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-secondary-400">
                    <IndianRupee size={32} className="mx-auto mb-2 opacity-20" />
                    No transactions found
                  </td>
                </tr>
              ) : transactions.map((t) => (
                <tr key={t._id} className="hover:bg-secondary-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-bold text-primary-600">#{t.orderId}</p>
                    {t.razorpayPaymentId && (
                      <p className="font-mono text-[10px] text-secondary-300 mt-0.5">{t.razorpayPaymentId}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-secondary-900 text-sm">{t.customerName}</p>
                    <p className="text-xs text-secondary-400">{t.customerEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MethodIcon method={t.paymentMethod} />
                      <span className="text-xs font-medium text-secondary-700">
                        {METHOD_LABELS[t.paymentMethod] || t.paymentMethod || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-secondary-900">{formatCurrency(t.amount)}</p>
                    {t.platformFee > 0 && (
                      <p className="text-[10px] text-secondary-400">Fee: {formatCurrency(t.platformFee)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-secondary-500 text-xs whitespace-nowrap">
                    {formatDate(t.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
            <p className="text-xs text-secondary-500">
              Page {meta.page} of {meta.totalPages} · {meta.total} transactions
            </p>
            <div className="flex gap-1 items-center">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40 transition-colors">
                ← Prev
              </button>
              {Array.from({ length: Math.min(meta.totalPages, 7) }, (_, i) => {
                const tp = meta.totalPages;
                const p  = tp <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= tp - 3 ? tp - 6 + i : page - 3 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100 text-secondary-600'}`}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page === meta.totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40 transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
