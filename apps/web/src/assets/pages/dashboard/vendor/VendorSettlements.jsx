import { useState } from 'react';
import {
  IndianRupee, Clock, CheckCircle, X, TrendingUp, RefreshCw,
  Download, HelpCircle, ChevronDown, ChevronUp, Search, Link2,
  AlertCircle,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { useFetch } from '../../../../hooks';
import api from '../../../../utils/api';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STATUS_CONFIG = {
  pending:   { label: 'pending',   cls: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved:  { label: 'approved',  cls: 'bg-blue-100 text-blue-700',    icon: TrendingUp },
  paid:      { label: 'paid',      cls: 'bg-green-100 text-green-700',  icon: CheckCircle },
  cancelled: { label: 'cancelled', cls: 'bg-red-100 text-red-700',      icon: X },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.cls}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

// ── RazorpayOnboarding ────────────────────────────────────────────────────────

function RazorpayOnboarding() {
  const [form,       setForm]       = useState({ email: '', phone: '', contactName: '' });
  const [connecting, setConnecting] = useState(false);
  const [rev,        setRev]        = useState(0);

  const { data } = useFetch(
    ['razorpay-status', rev],
    () => api.get('/vendors/razorpay/status').then((r) => r.data),
  );
  const rzStatus = data?.data?.status || 'not_connected';

  async function handleConnect(ev) {
    ev.preventDefault();
    if (!form.email || !form.phone || !form.contactName) return toast.error('All fields required');
    setConnecting(true);
    try {
      await api.post('/vendors/razorpay/connect', form);
      toast.success('Account creation initiated — Razorpay will verify your details');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Connection failed');
    } finally { setConnecting(false); }
  }

  if (rzStatus === 'activated') {
    return (
      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
        <CheckCircle size={18} className="text-green-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-green-800">Razorpay Connected</p>
          <p className="text-sm text-green-700 mt-0.5">
            {data?.data?.accountId && <span className="font-mono text-xs mr-2">{data.data.accountId}</span>}
            Automatic payment splits active — funds reach your bank directly.
          </p>
        </div>
      </div>
    );
  }

  if (['created', 'under_review', 'suspended'].includes(rzStatus)) {
    const msgs = {
      created:      'Your Razorpay account is being set up. Razorpay will verify your business details.',
      under_review: 'Your Razorpay account is under review. You will be notified once approved.',
      suspended:    'Your Razorpay account has been suspended. Please contact support.',
    };
    return (
      <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-4">
        <AlertCircle size={18} className="text-yellow-600 mt-0.5 shrink-0" />
        <p className="text-sm text-yellow-800">{msgs[rzStatus]}</p>
      </div>
    );
  }

  // not_connected — show connect form
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <Link2 size={16} className="text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-blue-800">Connect Razorpay Route</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Connect your Razorpay account to receive automatic payment splits directly to your bank. No more waiting for manual payouts!
          </p>
        </div>
      </div>
      <form onSubmit={handleConnect} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { key: 'email',       label: 'Email *',        type: 'email',  placeholder: 'your@email.com' },
          { key: 'phone',       label: 'Phone *',        type: 'tel',    placeholder: '9876543210' },
          { key: 'contactName', label: 'Contact Name *', type: 'text',   placeholder: 'Full Name' },
        ].map(({ key, label, type, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-blue-700 mb-1">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        ))}
        <div className="sm:col-span-3 flex items-center justify-between">
          <button type="submit" disabled={connecting}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <Link2 size={13} /> {connecting ? 'Connecting…' : 'Connect Razorpay Account'}
          </button>
          <p className="text-xs text-blue-600 italic">Your KYC must be approved before connecting.</p>
        </div>
      </form>
    </div>
  );
}

// ── Commission Help Panel ─────────────────────────────────────────────────────

function CommissionHelp({ onClose }) {
  return (
    <div className="bg-white border border-secondary-200 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-secondary-900">How Commissions Work</p>
        <button onClick={onClose} className="p-1 text-secondary-400 hover:text-secondary-600"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-green-700">85%</p>
          <p className="text-xs text-green-600 mt-1 font-medium">Vendor Receives</p>
        </div>
        <div className="bg-secondary-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-secondary-600">15%</p>
          <p className="text-xs text-secondary-500 mt-1 font-medium">Platform Fee</p>
        </div>
      </div>
      <div className="bg-secondary-50 rounded-xl p-4 text-xs text-secondary-600 space-y-1.5">
        <p className="font-semibold text-secondary-700">Example Calculation</p>
        <p>Sale price: <strong>₹1,000</strong></p>
        <p>Platform fee (15%): <strong>−₹150</strong></p>
        <p>Your earnings: <strong className="text-green-600">₹850</strong></p>
      </div>
      <div className="text-xs text-secondary-500 space-y-1">
        <p>• <strong>Pending</strong> — order placed, awaiting delivery confirmation</p>
        <p>• <strong>Approved</strong> — order delivered, earnings in available balance</p>
        <p>• <strong>Paid</strong> — admin has released the payment to your account</p>
        <p>• Payments are released after a 7-day return window</p>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function VendorSettlements() {
  const { user } = useSelector((s) => s.auth);
  const [rev,             setRev]            = useState(0);
  const [page,            setPage]           = useState(1);
  const [statusFilter,    setStatusFilter]   = useState('all');
  const [searchQuery,     setSearchQuery]    = useState('');
  const [showHelp,        setShowHelp]       = useState(false);
  const [showExport,      setShowExport]     = useState(false);
  const [exportStart,     setExportStart]    = useState('');
  const [exportEnd,       setExportEnd]      = useState('');
  const [exportStatus,    setExportStatus]   = useState('all');
  const [downloading,     setDownloading]    = useState(false);

  const { data: statsRaw } = useFetch(
    ['settlement-stats', user?._id, rev],
    () => api.get('/vendors/settlements/stats').then((r) => r.data),
  );
  const { data: listRaw, isLoading } = useFetch(
    ['settlements', user?._id, page, statusFilter, rev],
    () => api.get('/vendors/settlements', {
      params: { page, limit: 20, status: statusFilter !== 'all' ? statusFilter : undefined },
    }).then((r) => r.data),
  );

  const stats      = statsRaw?.data || {};
  const allComms   = listRaw?.data || [];
  const pagination = listRaw?.pagination || {};

  // Client-side search filter
  const commissions = searchQuery.trim()
    ? allComms.filter((c) => (c.order?.orderId || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : allComms;

  function refresh() { setRev((r) => r + 1); }

  async function handleExport() {
    setDownloading(true);
    try {
      const res = await api.get('/vendors/settlements/export', {
        params: { startDate: exportStart || undefined, endDate: exportEnd || undefined, status: exportStatus !== 'all' ? exportStatus : undefined },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `settlements-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExport(false);
    } catch { toast.error('Export failed'); }
    finally { setDownloading(false); }
  }

  function setPreset(preset) {
    const now = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    if (preset === '7') { setExportStart(fmt(new Date(now - 7 * 86400000))); setExportEnd(fmt(now)); }
    else if (preset === '30') { setExportStart(fmt(new Date(now - 30 * 86400000))); setExportEnd(fmt(now)); }
    else if (preset === '90') { setExportStart(fmt(new Date(now - 90 * 86400000))); setExportEnd(fmt(now)); }
    else if (preset === 'month') { const s = new Date(now.getFullYear(), now.getMonth(), 1); setExportStart(fmt(s)); setExportEnd(fmt(now)); }
    else { setExportStart(''); setExportEnd(''); }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-secondary-900">Payments &amp; Settlements</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={refresh} className="flex items-center gap-1.5 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowExport((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <Download size={14} /> Download Report
          </button>
          <button onClick={() => setShowHelp((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <HelpCircle size={14} /> How Commissions Work
          </button>
        </div>
      </div>

      {/* Razorpay onboarding */}
      <RazorpayOnboarding />

      {/* Commission help panel */}
      {showHelp && <CommissionHelp onClose={() => setShowHelp(false)} />}

      {/* Export panel */}
      {showExport && (
        <div className="bg-white border border-secondary-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-secondary-900 text-sm">Download Report</p>
            <button onClick={() => setShowExport(false)} className="p-1 text-secondary-400 hover:text-secondary-600"><X size={16} /></button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-secondary-500">Quick select:</span>
            {[['7', 'Last 7 Days'], ['30', 'Last 30 Days'], ['90', 'Last 90 Days'], ['month', 'This Month'], ['all', 'All Time']].map(([v, l]) => (
              <button key={v} onClick={() => setPreset(v)}
                className="text-xs px-2.5 py-1 border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors">
                {l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-secondary-600 mb-1">Start Date</label>
              <input type="date" value={exportStart} onChange={(e) => setExportStart(e.target.value)}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 mb-1">End Date</label>
              <input type="date" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 mb-1">Status</label>
              <select value={exportStatus} onChange={(e) => setExportStatus(e.target.value)}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <button onClick={handleExport} disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
            <Download size={14} /> {downloading ? 'Downloading…' : 'Download CSV'}
          </button>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Available Balance — green gradient */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-1.5 mb-1 opacity-80">
            <IndianRupee size={13} />
            <span className="text-xs font-bold uppercase tracking-wide">Available Balance</span>
          </div>
          <p className="text-2xl font-black">{formatCurrency(stats.availableBalance || 0)}</p>
          <p className="text-xs opacity-75 mt-0.5">Ready for transfer</p>
        </div>

        {/* Pending */}
        <button onClick={() => { setStatusFilter('pending'); setPage(1); }}
          className={`bg-white border rounded-xl p-5 text-left transition-all hover:shadow-sm ${statusFilter === 'pending' ? 'border-yellow-400 ring-1 ring-yellow-300' : 'border-secondary-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-secondary-500 uppercase tracking-wide">Pending</span>
            <Clock size={14} className="text-yellow-500" />
          </div>
          <p className="text-2xl font-black text-yellow-600">{formatCurrency(stats.pending?.total || 0)}</p>
          <p className="text-xs text-secondary-400 mt-0.5">{stats.pending?.count || 0} transactions</p>
        </button>

        {/* Approved */}
        <button onClick={() => { setStatusFilter('approved'); setPage(1); }}
          className={`bg-white border rounded-xl p-5 text-left transition-all hover:shadow-sm ${statusFilter === 'approved' ? 'border-blue-400 ring-1 ring-blue-300' : 'border-secondary-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-secondary-500 uppercase tracking-wide">Approved</span>
            <TrendingUp size={14} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600">{formatCurrency(stats.approved?.total || 0)}</p>
          <p className="text-xs text-secondary-400 mt-0.5">{stats.approved?.count || 0} transactions</p>
        </button>

        {/* Paid Out */}
        <button onClick={() => { setStatusFilter('paid'); setPage(1); }}
          className={`bg-white border rounded-xl p-5 text-left transition-all hover:shadow-sm ${statusFilter === 'paid' ? 'border-green-400 ring-1 ring-green-300' : 'border-secondary-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-secondary-500 uppercase tracking-wide">Paid Out</span>
            <CheckCircle size={14} className="text-green-500" />
          </div>
          <p className="text-2xl font-black text-green-600">{formatCurrency(stats.paid?.total || 0)}</p>
          <p className="text-xs text-secondary-400 mt-0.5">{stats.paid?.count || 0} transactions</p>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order ID…"
            className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <div className="flex items-center bg-secondary-100 rounded-xl p-1 gap-0.5">
          {[['all', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['paid', 'Paid']].map(([val, label]) => (
            <button key={val} onClick={() => { setStatusFilter(val); setPage(1); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === val ? 'bg-white shadow text-secondary-900' : 'text-secondary-500 hover:text-secondary-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : commissions.length === 0 ? (
        <div className="bg-white border border-secondary-200 rounded-xl p-14 text-center">
          <IndianRupee size={36} className="mx-auto text-secondary-300 mb-3" />
          <p className="text-secondary-500 font-medium">No settlements found</p>
          {statusFilter !== 'all' && (
            <button onClick={() => setStatusFilter('all')} className="mt-2 text-xs text-primary-600 hover:underline">Clear filter</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary-50 border-b border-secondary-200">
                  {['Order ID', 'Date', 'Your Earnings', 'Platform Fee', 'Status', 'Transfer', 'Paid Date'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {commissions.map((c) => (
                  <tr key={c._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-primary-600 font-semibold">
                      {c.order?.orderId || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-500">{fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold text-secondary-900">{formatCurrency(c.commissionAmount || 0)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-orange-600">{c.commissionRate || 0}%</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-xs text-secondary-400">
                      {c.transfer?.transferId ? (
                        <span className={`font-semibold ${
                          c.transfer.status === 'processed' ? 'text-green-600' :
                          c.transfer.status === 'pending'   ? 'text-yellow-600' :
                          c.transfer.status === 'created'   ? 'text-blue-600' :
                          c.transfer.status === 'failed'    ? 'text-red-600' : 'text-secondary-400'
                        }`}>
                          {c.transfer.status}
                        </span>
                      ) : 'Manual'}
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary-500">{c.paidAt ? fmtDate(c.paidAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="block lg:hidden divide-y divide-secondary-100">
            {commissions.map((c) => (
              <div key={c._id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-primary-600">{c.order?.orderId || '—'}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-secondary-500 text-xs">{fmtDate(c.createdAt)}</span>
                  <span className="font-bold text-secondary-900">{formatCurrency(c.commissionAmount || 0)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-secondary-400">
                  <span>Fee: <strong className="text-orange-600">{c.commissionRate || 0}%</strong></span>
                  <span>Transfer: {c.transfer?.transferId ? c.transfer.status : 'Manual'}</span>
                  {c.paidAt && <span>Paid: {fmtDate(c.paidAt)}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
              <p className="text-xs text-secondary-500">{pagination.total} total settlements</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 border border-secondary-200 rounded-lg text-sm disabled:opacity-40 hover:bg-secondary-50 transition-colors">Previous</button>
                {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100 text-secondary-600'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                  className="px-3 py-1.5 border border-secondary-200 rounded-lg text-sm disabled:opacity-40 hover:bg-secondary-50 transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
