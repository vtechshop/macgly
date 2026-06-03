import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, CheckCircle2, Wallet, TrendingUp, RefreshCw, ChevronDown, ChevronUp,
  Search, X, Link2, Calendar, FileText,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, invalidateCache } from '../../../../hooks';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending:  { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', cls: 'bg-blue-100 text-blue-700' },
  paid:     { label: 'Paid',     cls: 'bg-green-100 text-green-700' },
};

const DATE_OPTIONS = [
  { value: 'all',     label: 'All Time' },
  { value: 'today',   label: 'Today' },
  { value: 'week',    label: 'This Week' },
  { value: 'month',   label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ssGet(key, fallback) {
  try { return sessionStorage.getItem(key) || fallback; } catch { return fallback; }
}
function ssSet(key, val) {
  try { sessionStorage.setItem(key, String(val)); } catch {}
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsCard({ icon: Icon, label, sub, value, iconBg, iconColor, valColor, active, onClick, trend }) {
  return (
    <button
      onClick={onClick}
      className={`card p-4 text-left w-full transition-all hover:shadow-md ${active ? 'ring-2 ring-primary-400' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={16} className={iconColor} />
        </div>
        {trend != null && (
          <span className={`text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className={`text-xl font-bold mt-1 ${valColor}`}>{value}</p>
      <p className="text-xs font-medium text-secondary-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-secondary-400">{sub}</p>}
    </button>
  );
}

function CommissionCard({ c }) {
  const cfg = STATUS_CFG[c.status] || STATUS_CFG.pending;
  const hasTds = c.status === 'paid' && (c.tds?.amount ?? 0) > 0;
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold font-mono">{c.orderId || '—'}</p>
          <p className="text-xs text-secondary-400 mt-0.5">{fmtDate(c.createdAt)}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${cfg.cls}`}>{cfg.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-secondary-400">Commission</p>
          <p className="font-bold text-green-600">{formatCurrency(c.amount)}</p>
        </div>
        <div>
          <p className="text-secondary-400">TDS (2%)</p>
          <p className={`font-bold ${hasTds ? 'text-red-500' : 'text-secondary-400'}`}>
            {hasTds ? `-${formatCurrency(c.tds.amount)}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-secondary-400">Net Payout</p>
          <p className="font-bold">{formatCurrency(hasTds ? c.tds.netAmount : c.amount)}</p>
        </div>
      </div>
      {c.status === 'paid' && c.paidAt && (
        <p className="text-xs text-secondary-400">Paid on {fmtDate(c.paidAt)}</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AffiliateEarnings() {
  const [page,         setPage]         = useState(() => parseInt(ssGet('affiliate-commissions-page', '1')));
  const [statusFilter, setStatusFilter] = useState(() => ssGet('affiliate-commissions-filter', ''));
  const [dateRange,    setDateRange]    = useState('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showInfo,     setShowInfo]     = useState(false);
  const [rev,          setRev]          = useState(0);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: stats } = useFetch(
    ['affiliate-stats', rev],
    () => api.get('/affiliates/dashboard/stats').then((r) => r.data)
  );

  const { data: commissionStats } = useFetch(
    ['affiliate-commission-stats', rev],
    () => api.get('/affiliates/commissions/stats').then((r) => r.data)
  );

  const {
    data:      commissionsData,
    isLoading: commissionsLoading,
    error:     commissionsError,
  } = useFetch(
    ['affiliate-commissions', page, statusFilter, dateRange, rev],
    () => api.get('/affiliates/commissions', {
      params: { page, limit: 20, status: statusFilter || undefined, dateRange: dateRange !== 'all' ? dateRange : undefined },
    }).then((r) => r.data),
    { keepPrevious: true }
  );

  // ── Error handling ────────────────────────────────────────────────────────

  const commError = commissionsError?.response?.status;
  if (commError && commError !== 404) {
    return (
      <div className="card p-12 text-center space-y-3">
        <p className="text-secondary-500 font-medium">Unable to load commissions</p>
        <button onClick={() => window.location.reload()} className="btn-secondary text-sm">Reload</button>
      </div>
    );
  }

  // ── Derived amounts ───────────────────────────────────────────────────────

  const pending         = stats?.pendingEarnings  || 0;
  const totalEarnings   = stats?.totalEarnings    || 0;
  const paid            = stats?.paidEarnings     || 0;
  const approved        = Math.max(0, totalEarnings - pending - paid);
  const thisMonthEarnings = stats?.thisMonthEarnings || 0;
  const earningsChange  = stats?.earningsChange;
  const commRate        = stats?.commissionPercentage ?? commissionStats?.commissionPercentage ?? 5;

  // ── Commission list ────────────────────────────────────────────────────────

  const rawCommissions = commissionsData?.data || [];
  const meta           = commissionsData?.meta || { total: 0, pages: 1 };

  const commissions = useMemo(() => {
    if (!searchQuery.trim()) return rawCommissions;
    const q = searchQuery.toLowerCase();
    return rawCommissions.filter((c) => c.orderId?.toLowerCase().includes(q));
  }, [rawCommissions, searchQuery]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function refresh() {
    invalidateCache('affiliate-stats');
    invalidateCache('affiliate-commission-stats');
    invalidateCache('affiliate-commissions');
    setRev((r) => r + 1);
    toast.success('Refreshed');
  }

  function handleStatusFilter(val) {
    setStatusFilter(val);
    setPage(1);
    ssSet('affiliate-commissions-filter', val);
    ssSet('affiliate-commissions-page', '1');
  }

  function handlePage(p) {
    setPage(p);
    ssSet('affiliate-commissions-page', String(p));
  }

  function handleDateRange(val) {
    setDateRange(val);
    setPage(1);
    ssSet('affiliate-commissions-page', '1');
  }

  const anyFilter = statusFilter || dateRange !== 'all' || searchQuery;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Commissions</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Track your earnings and payouts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
          >
            How It Works {showInfo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* How It Works panel */}
      {showInfo && (
        <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div>
                <p className="font-semibold text-green-800">Created</p>
                <p className="text-xs text-green-600 mt-0.5">Commission created when a referred order is placed ({commRate}% of order value)</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div>
                <p className="font-semibold text-green-800">Approved</p>
                <p className="text-xs text-green-600 mt-0.5">Commission approved after the order is delivered and return window closes</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <div>
                <p className="font-semibold text-green-800">Paid</p>
                <p className="text-xs text-green-600 mt-0.5">Payouts processed 1st–15th each month to your registered bank account</p>
              </div>
            </div>
          </div>
          <div className="p-3 bg-white/60 rounded-lg border border-green-100 text-xs text-green-700 space-y-1">
            <p><strong>Example:</strong> ₹10,000 order → ₹{(10000 * commRate / 100).toLocaleString()} commission ({commRate}%) → -₹{(10000 * commRate / 100 * 0.02).toFixed(0)} TDS (2%) → <strong>₹{(10000 * commRate / 100 * 0.98).toLocaleString()} net payout</strong></p>
            <p className="text-amber-600"><strong>TDS Notice:</strong> 2% TDS deducted as per Indian Income Tax regulations (Section 194O)</p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          icon={Clock} label="Pending" sub="Awaiting approval"
          value={formatCurrency(pending)}
          iconBg="bg-yellow-100" iconColor="text-yellow-600" valColor="text-yellow-600"
          active={statusFilter === 'pending'}
          onClick={() => handleStatusFilter(statusFilter === 'pending' ? '' : 'pending')}
        />
        <StatsCard
          icon={CheckCircle2} label="Approved" sub="Ready for payout"
          value={formatCurrency(approved)}
          iconBg="bg-green-100" iconColor="text-green-600" valColor="text-green-600"
          active={statusFilter === 'approved'}
          onClick={() => handleStatusFilter(statusFilter === 'approved' ? '' : 'approved')}
        />
        <StatsCard
          icon={Wallet} label="Paid" sub="Successfully paid out"
          value={formatCurrency(paid)}
          iconBg="bg-blue-100" iconColor="text-blue-600" valColor="text-blue-600"
          active={statusFilter === 'paid'}
          onClick={() => handleStatusFilter(statusFilter === 'paid' ? '' : 'paid')}
        />
        <StatsCard
          icon={TrendingUp} label="This Month" sub={earningsChange != null ? undefined : undefined}
          value={formatCurrency(thisMonthEarnings)}
          iconBg="bg-purple-100" iconColor="text-purple-600" valColor="text-purple-600"
          trend={earningsChange}
          active={dateRange === 'month'}
          onClick={() => handleDateRange(dateRange === 'month' ? 'all' : 'month')}
        />
      </div>

      {/* Commission history */}
      <div className="space-y-3">
        {/* Filter bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
            <input
              className="input w-full pl-9 text-sm"
              placeholder="Search by Order ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="input text-sm w-36"
            value={dateRange}
            onChange={(e) => handleDateRange(e.target.value)}
          >
            {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            className="input text-sm w-32"
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
          {anyFilter && (
            <button
              onClick={() => { setSearchQuery(''); handleStatusFilter(''); handleDateRange('all'); }}
              className="flex items-center gap-1 text-xs text-secondary-400 hover:text-red-500"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Title + count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-secondary-400" />
            <p className="font-semibold text-sm">Commission History</p>
          </div>
          {meta.total > 0 && (
            <p className="text-xs text-secondary-400">{meta.total} records</p>
          )}
        </div>

        {/* Table / cards */}
        {commissionsLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : commissions.length === 0 ? (
          <div className="card p-12 text-center space-y-3">
            <Link2 size={32} className="mx-auto text-secondary-200" />
            <p className="text-secondary-500 font-medium">No commissions yet</p>
            <p className="text-xs text-secondary-400">Commissions appear here after someone purchases via your affiliate links.</p>
            <Link to="/dashboard/affiliate/links" className="btn-primary text-sm inline-block">
              Get Your Affiliate Links →
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="lg:hidden grid gap-3">
              {commissions.map((c) => <CommissionCard key={c._id} c={c} />)}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary-50 border-b border-secondary-100">
                  <tr>
                    {['Order ID', 'Date', 'Commission', 'TDS (2%)', 'Net Payout', 'Status', 'Paid Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-secondary-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100">
                  {commissions.map((c) => {
                    const cfg    = STATUS_CFG[c.status] || STATUS_CFG.pending;
                    const hasTds = c.status === 'paid' && (c.tds?.amount ?? 0) > 0;
                    return (
                      <tr key={c._id} className="hover:bg-secondary-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-medium">{c.orderId || '—'}</td>
                        <td className="px-4 py-3 text-secondary-500 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                        <td className="px-4 py-3 font-semibold text-green-600">{formatCurrency(c.amount)}</td>
                        <td className="px-4 py-3">
                          {hasTds
                            ? <span className="text-red-500 font-medium">-{formatCurrency(c.tds.amount)}</span>
                            : <span className="text-secondary-400">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {formatCurrency(hasTds ? c.tds.netAmount : c.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>
                        </td>
                        <td className="px-4 py-3 text-secondary-400 whitespace-nowrap">
                          {c.status === 'paid' ? fmtDate(c.paidAt) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {meta.pages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-secondary-400">
                  Page {page} of {meta.pages} ({meta.total} records)
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-secondary-200 disabled:opacity-40 hover:border-primary-300 transition-colors"
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: Math.min(5, meta.pages) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : page - 2 + i;
                    if (p < 1 || p > meta.pages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => handlePage(p)}
                        className={`w-8 h-8 text-xs rounded-lg border transition-colors ${p === page ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold' : 'border-secondary-200 hover:border-primary-300'}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePage(Math.min(meta.pages, page + 1))}
                    disabled={page === meta.pages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-secondary-200 disabled:opacity-40 hover:border-primary-300 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payout info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-blue-700">
            <Calendar size={15} />
            <p className="text-sm font-semibold">Payout Schedule</p>
            <p className="text-xs text-blue-500 ml-auto">Monthly payouts</p>
          </div>
          <ul className="space-y-1 text-xs text-blue-700">
            <li className="flex items-center gap-2"><CheckCircle2 size={12} /> Payouts processed 1st–15th of each month</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={12} /> Minimum payout: ₹500</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={12} /> Direct bank transfer (NEFT/IMPS)</li>
          </ul>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700">
            <FileText size={15} />
            <p className="text-sm font-semibold">Tax Documents</p>
            <p className="text-xs text-amber-500 ml-auto">TDS & compliance</p>
          </div>
          <ul className="space-y-1 text-xs text-amber-700">
            <li className="flex items-center gap-2"><CheckCircle2 size={12} /> 2% TDS deducted as per IT rules</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={12} /> Form 16A available quarterly</li>
            <li className="flex items-center gap-2"><CheckCircle2 size={12} /> Annual TDS certificate for ITR</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
