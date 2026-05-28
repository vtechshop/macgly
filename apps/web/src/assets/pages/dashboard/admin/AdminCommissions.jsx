import { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee, CheckCircle, XCircle, Clock, Download,
  RefreshCw, ChevronDown, Copy, Smartphone, Building2,
  Wallet, CreditCard, X, Check, AlertCircle, ArrowRight,
  TrendingUp, Users,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate } from '../../../../utils/format';
import toast from 'react-hot-toast';

// ── constants ─────────────────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { value: '7',   label: 'Last 7 days' },
  { value: '30',  label: 'Last 30 days' },
  { value: '90',  label: 'Last 90 days' },
  { value: '365', label: 'Last 365 days' },
  { value: 'all', label: 'All time' },
];

const STATUS_TABS = [
  { value: 'all',       label: 'All' },
  { value: 'pending',   label: 'Pending' },
  { value: 'approved',  label: 'Approved' },
  { value: 'paid',      label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    pending:   'bg-yellow-100 text-yellow-700',
    approved:  'bg-blue-100 text-blue-700',
    paid:      'bg-green-100 text-green-700',
    cancelled: 'bg-secondary-100 text-secondary-500',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${map[status] || map.cancelled}`}>
      {status}
    </span>
  );
}

function copy(text) {
  navigator.clipboard.writeText(text)
    .then(() => toast.success('Copied'))
    .catch(() => toast.error('Copy failed'));
}

// ── 3-step Payout Modal ───────────────────────────────────────────────────────

function PayoutModal({ payout, onClose, onSuccess, isAffiliate }) {
  const [step,    setStep]    = useState('method');
  const [method,  setMethod]  = useState('');
  const [ref,     setRef]     = useState('');
  const [amount,  setAmount]  = useState(String(payout.pendingAmount));
  const [saving,  setSaving]  = useState(false);

  const grossAmount = parseFloat(amount) || 0;
  const tds         = isAffiliate ? parseFloat((grossAmount * 0.02).toFixed(2)) : 0;
  const netAmount   = parseFloat((grossAmount - tds).toFixed(2));

  const { bankDetails = {} } = payout;
  const hasBankAccount = !!bankDetails.accountNumber;
  const hasUPI         = !!bankDetails.upiId;
  const noPaymentInfo  = !hasBankAccount && !hasUPI;

  const METHODS = [
    hasUPI         ? { value: 'upi',  label: 'UPI',  Icon: Smartphone } : null,
    hasBankAccount ? { value: 'neft', label: 'NEFT', Icon: Building2  } : null,
    hasBankAccount ? { value: 'imps', label: 'IMPS', Icon: Building2  } : null,
    hasBankAccount ? { value: 'rtgs', label: 'RTGS', Icon: Building2  } : null,
    { value: 'cash', label: 'Cash', Icon: IndianRupee },
  ].filter(Boolean);

  const upiUrl = hasUPI
    ? `upi://pay?pa=${encodeURIComponent(bankDetails.upiId)}&pn=${encodeURIComponent(payout.vendorName)}&am=${payout.pendingAmount}&cu=INR`
    : '';
  const qrUrl = upiUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`
    : '';

  function copyAll() {
    const text = [
      `Account Holder: ${bankDetails.accountHolderName}`,
      `Bank Name: ${bankDetails.bankName || 'N/A'}`,
      `Account Number: ${bankDetails.accountNumber}`,
      `IFSC Code: ${bankDetails.ifscCode}`,
      `Amount: ₹${payout.pendingAmount}`,
    ].join('\n');
    copy(text);
  }

  async function confirm() {
    if (!ref.trim()) return toast.error('UTR / Transaction ID is required');
    if (grossAmount <= 0) return toast.error('Amount must be greater than 0');
    setSaving(true);
    try {
      if (isAffiliate) {
        await api.post(`/admin/affiliates/${payout.vendorId}/payout`, {
          amount: grossAmount, paymentMethod: method, reference: ref.trim(),
        });
      } else {
        await api.post('/admin/payouts/process', {
          vendorId:      payout.vendorId,
          amount:        grossAmount,
          paymentMethod: method,
          paymentRef:    ref.trim(),
          commissionIds: payout.commissionIds || [],
        });
      }
      toast.success(`Payout confirmed for ${payout.vendorName}`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to record payout');
    } finally { setSaving(false); }
  }

  const stepLabel = { method: 'Choose Method', pay: 'Make Payment', record: 'Record Payment' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <div>
            <h2 className="font-bold text-secondary-900">Payout — {payout.vendorName}</h2>
            <p className="text-xs text-secondary-400 mt-0.5">
              {formatCurrency(payout.pendingAmount)} · {payout.commissionCount} commission{payout.commissionCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400"><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 pt-4">
          {['method', 'pay', 'record'].map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step === s ? 'bg-primary-600 text-white' : ['pay','record'].includes(step) && i < ['method','pay','record'].indexOf(step) ? 'bg-green-500 text-white' : 'bg-secondary-200 text-secondary-500'}`}>
                {['pay','record'].includes(step) && i < ['method','pay','record'].indexOf(step) ? <Check size={10} /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${step === s ? 'font-semibold text-secondary-800' : 'text-secondary-400'}`}>{stepLabel[s]}</span>
              {i < 2 && <div className="flex-1 h-px bg-secondary-200 mx-1" />}
            </div>
          ))}
        </div>

        <div className="p-6">

          {/* ── Step 1: Choose Method ── */}
          {step === 'method' && (
            <div className="space-y-3">
              {/* Affiliate: editable payout amount with TDS */}
              {isAffiliate && (
                <div className="bg-secondary-50 rounded-xl p-4 space-y-2">
                  <label className="text-xs font-medium text-secondary-600">Payout Amount (₹)</label>
                  <input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-300" />
                  {grossAmount > 0 && (
                    <div className="flex items-center justify-between text-xs text-secondary-500 pt-1">
                      <span>TDS 2%: <strong className="text-red-500">−{formatCurrency(tds)}</strong></span>
                      <span>Net to transfer: <strong className="text-green-600">{formatCurrency(netAmount)}</strong></span>
                    </div>
                  )}
                </div>
              )}
              {noPaymentInfo && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle size={16} /> Ask {isAffiliate ? 'affiliate' : 'vendor'} to add bank details in their settings.
                </div>
              )}
              <p className="text-sm font-medium text-secondary-700 mb-2">Select payment method:</p>
              {METHODS.map(({ value, label, Icon }) => (
                <button key={value} onClick={() => setMethod(value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${method === value ? 'border-primary-500 bg-primary-50' : 'border-secondary-200 hover:border-secondary-300'}`}>
                  <div className="w-9 h-9 rounded-xl bg-secondary-100 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-secondary-600" />
                  </div>
                  <span className="font-medium text-secondary-800">{label}</span>
                  {method === value && <Check size={16} className="ml-auto text-primary-600" />}
                </button>
              ))}
              <button
                onClick={() => method && setStep('pay')}
                disabled={!method}
                className="mt-2 w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
                Continue <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* ── Step 2: Make Payment ── */}
          {step === 'pay' && (
            <div className="space-y-4">
              {method === 'upi' && (
                <div className="text-center space-y-3">
                  <img src={qrUrl} alt="UPI QR" className="w-48 h-48 mx-auto rounded-xl border border-secondary-200" />
                  <p className="text-sm text-secondary-600">Scan to pay <strong>{formatCurrency(isAffiliate ? netAmount : payout.pendingAmount)}</strong> to {payout.vendorName}</p>
                  <div className="flex items-center justify-between bg-secondary-50 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-secondary-500">UPI ID</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-secondary-800">{bankDetails.upiId}</span>
                      <button onClick={() => copy(bankDetails.upiId)} className="p-1 hover:text-primary-600"><Copy size={12} /></button>
                    </div>
                  </div>
                  <a href={upiUrl} className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:underline">
                    <Smartphone size={12} /> Open UPI App
                  </a>
                </div>
              )}

              {['neft', 'imps', 'rtgs'].includes(method) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-secondary-700 mb-1">Transfer <strong>{formatCurrency(isAffiliate ? netAmount : payout.pendingAmount)}</strong> via {method.toUpperCase()}:</p>
                  {[
                    { label: 'Account Holder', value: bankDetails.accountHolderName || 'N/A' },
                    { label: 'Bank Name',      value: bankDetails.bankName || 'N/A' },
                    { label: 'Account Number', value: bankDetails.accountNumber || 'N/A' },
                    { label: 'IFSC Code',      value: bankDetails.ifscCode || 'N/A' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between bg-secondary-50 rounded-xl px-4 py-2.5">
                      <span className="text-xs text-secondary-500">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-secondary-800">{value}</span>
                        <button onClick={() => copy(value)} className="p-1 hover:text-primary-600 text-secondary-400"><Copy size={12} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={copyAll}
                    className="w-full py-2 mt-1 border border-secondary-200 rounded-xl text-xs font-medium text-secondary-700 hover:bg-secondary-50 flex items-center justify-center gap-1.5 transition-colors">
                    <Copy size={12} /> Copy All Details
                  </button>
                </div>
              )}

              {method === 'cash' && (
                <div className="text-center py-6 space-y-2">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <IndianRupee size={28} className="text-green-600" />
                  </div>
                  <p className="text-lg font-bold text-secondary-900">{formatCurrency(payout.pendingAmount)}</p>
                  <p className="text-sm text-secondary-500">Pay this amount in cash to the vendor and record the transaction below.</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep('method')}
                  className="flex-1 py-2.5 border border-secondary-200 rounded-xl text-sm font-medium text-secondary-700 hover:bg-secondary-50">
                  Back
                </button>
                <button onClick={() => setStep('record')}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 flex items-center justify-center gap-2">
                  Done, Record <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Record Payment ── */}
          {step === 'record' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  UTR / Transaction ID <span className="text-red-500">*</span>
                </label>
                <input
                  value={ref} onChange={(e) => setRef(e.target.value)}
                  placeholder="Enter UTR or transaction reference…"
                  className="w-full border border-secondary-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              {/* Summary */}
              <div className="bg-secondary-50 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-secondary-500">{isAffiliate ? 'Affiliate' : 'Vendor'}</span><span className="font-semibold">{payout.vendorName}</span></div>
                {isAffiliate ? (
                  <>
                    <div className="flex justify-between"><span className="text-secondary-500">Gross</span><span className="font-semibold">{formatCurrency(grossAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-secondary-500">TDS (2%)</span><span className="font-semibold text-red-500">−{formatCurrency(tds)}</span></div>
                    <div className="flex justify-between border-t border-secondary-200 pt-1.5"><span className="text-secondary-500">Net Paid</span><span className="font-bold text-green-600">{formatCurrency(netAmount)}</span></div>
                  </>
                ) : (
                  <div className="flex justify-between"><span className="text-secondary-500">Amount</span><span className="font-bold text-green-600">{formatCurrency(grossAmount)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-secondary-500">Method</span><span className="font-semibold">{method.toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-secondary-500">UTR</span><span className="font-mono text-xs">{ref || '—'}</span></div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('pay')}
                  className="flex-1 py-2.5 border border-secondary-200 rounded-xl text-sm font-medium text-secondary-700 hover:bg-secondary-50">
                  Back
                </button>
                <button onClick={confirm} disabled={saving || !ref.trim()}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? 'Confirming…' : <><CheckCircle size={14} /> Confirm & Mark Paid</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const EMPTY_STATS = {
  totalAmount: 0, totalCount: 0,
  pendingAmount: 0, pendingCount: 0,
  approvedAmount: 0, approvedCount: 0,
  paidAmount: 0, paidCount: 0,
  topVendors: [],
};

export default function AdminCommissions({ defaultType = 'vendor' }) {
  const [stats,         setStats]         = useState(EMPTY_STATS);
  const [commissions,   setCommissions]   = useState([]);
  const [pagination,    setPagination]    = useState({});
  const [pendingPayouts,setPendingPayouts]= useState([]);
  const [loading,       setLoading]       = useState(true);
  const [statsLoading,  setStatsLoading]  = useState(true);

  const [type,          setType]          = useState(defaultType);
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [dateRange,     setDateRange]     = useState('30');
  const [page,          setPage]          = useState(1);

  const [payoutData,    setPayoutData]    = useState(null);
  const [approving,     setApproving]     = useState(null);
  const [bulkBusy,      setBulkBusy]      = useState(false);

  // ── data loading ───────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/admin/commissions/stats', {
        params: { type, days: dateRange !== 'all' ? dateRange : undefined },
      });
      setStats(data);
    } catch {}
    finally { setStatsLoading(false); }
  }, [type, dateRange]);

  const loadCommissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/commissions', {
        params: {
          type, page, limit: 20,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          days: dateRange !== 'all' ? dateRange : undefined,
        },
      });
      setCommissions(data.commissions || []);
      setPagination(data.pagination || {});
    } catch { toast.error('Failed to load commissions'); }
    finally { setLoading(false); }
  }, [type, page, statusFilter, dateRange]);

  const loadPendingPayouts = useCallback(async () => {
    if (type !== 'vendor') return;
    try {
      const { data } = await api.get('/admin/payouts/pending');
      setPendingPayouts(data.payouts || []);
    } catch {}
  }, [type]);

  // Sync type when navigating between /commissions and /affiliate-commissions
  useEffect(() => { setType(defaultType); setPage(1); setStatusFilter('all'); }, [defaultType]);

  useEffect(() => { loadStats(); },          [loadStats]);
  useEffect(() => { loadCommissions(); },     [loadCommissions]);
  useEffect(() => { loadPendingPayouts(); },  [loadPendingPayouts]);

  function refresh() { loadStats(); loadCommissions(); loadPendingPayouts(); }

  // ── actions ────────────────────────────────────────────────────────────────

  async function approve(id) {
    setApproving(id);
    try {
      await api.put(`/admin/commissions/${id}/approve`);
      toast.success('Commission approved');
      loadCommissions(); loadStats(); loadPendingPayouts();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
    finally { setApproving(null); }
  }

  async function reject(id) {
    try {
      await api.put(`/admin/commissions/${id}/reject`);
      toast.success('Commission rejected');
      loadCommissions(); loadStats();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
  }

  async function approveAllPending() {
    setBulkBusy(true);
    try {
      const { data } = await api.post('/admin/commissions/bulk-approve', {
        type, days: dateRange !== 'all' ? dateRange : undefined,
      });
      toast.success(data.message || `${data.count} approved`);
      loadCommissions(); loadStats(); loadPendingPayouts();
    } catch (err) { toast.error(err?.response?.data?.error?.message || 'Failed'); }
    finally { setBulkBusy(false); }
  }

  async function openPay(commission) {
    try {
      const userId = commission.user?._id || commission.user;
      if (type === 'affiliate') {
        const { data } = await api.get(`/admin/affiliates/${userId}`);
        const ap = data.affiliate.affiliateProfile || {};
        setPayoutData({
          vendorId:        userId,
          vendorName:      data.affiliate.name,
          pendingAmount:   ap.pendingEarnings || commission.commissionAmount,
          commissionCount: 1,
          commissionIds:   [commission._id],
          bankDetails: {
            accountHolderName: ap.kycData?.accountHolderName || '',
            bankName:          ap.kycData?.bankName          || '',
            accountNumber:     ap.kycData?.bankAccount       || '',
            ifscCode:          ap.kycData?.ifsc              || '',
            upiId:             ap.kycData?.upiId             || '',
          },
        });
      } else {
        const { data } = await api.get(`/admin/vendors/${userId}`);
        const vp = data.vendor.vendorProfile || {};
        setPayoutData({
          vendorId:        userId,
          vendorName:      vp.businessName || data.vendor.name,
          pendingAmount:   commission.commissionAmount,
          commissionCount: 1,
          commissionIds:   [commission._id],
          bankDetails: {
            accountHolderName: vp.accountHolderName || '',
            bankName:          vp.bankName          || '',
            accountNumber:     vp.bankAccount       || '',
            ifscCode:          vp.ifsc              || '',
            upiId:             vp.upiId             || '',
          },
        });
      }
    } catch { toast.error('Failed to load payment details'); }
  }

  function exportCSV() {
    if (!commissions.length) return;
    const headers = ['Vendor','Order','Product','Amount (₹)','Rate (%)','Status','Date'];
    const rows = commissions.map((c) => [
      c.user?.vendorProfile?.businessName || c.user?.name || '',
      c.order?.orderId || '',
      c.product?.title || '',
      c.commissionAmount ?? 0,
      c.commissionRate   ?? 0,
      c.status,
      formatDate(c.createdAt),
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `commissions-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const maxTopVendor = Math.max(...(stats.topVendors?.map((v) => v.totalAmount) || [1]), 1);

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">
            {type === 'vendor' ? 'Vendor Commissions' : 'Affiliate Commissions'}
          </h1>
          <p className="text-sm text-secondary-500 mt-0.5">Manage vendor commissions and payouts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <a href={`/api/admin/commissions/export?type=${type}&days=${dateRange}`} download
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <Download size={14} /> Download Report
          </a>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <Download size={14} /> Export CSV
          </button>
          {stats.pendingCount > 0 && type !== 'affiliate' && (
            <button onClick={approveAllPending} disabled={bulkBusy}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
              <CheckCircle size={14} /> {bulkBusy ? 'Approving…' : `Approve All Pending`}
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white rounded-xl border border-secondary-200 p-5">
          <div className="w-10 h-10 bg-secondary-100 rounded-xl flex items-center justify-center mb-3">
            <IndianRupee size={18} className="text-secondary-600" />
          </div>
          <p className="text-xs text-secondary-500 mb-1">Total Commissions</p>
          <p className="text-xl font-black text-secondary-900">{formatCurrency(stats.totalAmount)}</p>
          <p className="text-xs text-secondary-400 mt-1">{DATE_OPTIONS.find(o => o.value === dateRange)?.label}</p>
        </div>

        {/* Pending Approval */}
        <div className="bg-white rounded-xl border border-secondary-200 p-5">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center mb-3">
            <Clock size={18} className="text-yellow-600" />
          </div>
          <p className="text-xs text-secondary-500 mb-1">Pending Approval</p>
          <p className="text-xl font-black text-yellow-600">{formatCurrency(stats.pendingAmount)}</p>
          <p className="text-xs text-secondary-400 mt-1">{stats.pendingCount} commission{stats.pendingCount !== 1 ? 's' : ''}</p>
        </div>

        {/* Ready to Pay — highlighted */}
        <div className="bg-primary-600 rounded-xl p-5 text-white">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp size={18} className="text-white" />
          </div>
          <p className="text-xs opacity-75 mb-1">Ready to Pay</p>
          <p className="text-xl font-black">{formatCurrency(stats.approvedAmount)}</p>
          <p className="text-xs opacity-60 mt-1">
            {stats.approvedCount} approved · {pendingPayouts.length} vendor{pendingPayouts.length !== 1 ? 's' : ''} awaiting payout
          </p>
        </div>

        {/* Paid Out */}
        <div className="bg-white rounded-xl border border-secondary-200 p-5">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <CheckCircle size={18} className="text-green-600" />
          </div>
          <p className="text-xs text-secondary-500 mb-1">Paid Out</p>
          <p className="text-xl font-black text-green-600">{formatCurrency(stats.paidAmount)}</p>
          <p className="text-xs text-secondary-400 mt-1">{stats.paidCount} commission{stats.paidCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Top Vendors */}
      {stats.topVendors?.length > 0 && (
        <div className="bg-white rounded-xl border border-secondary-200 p-5">
          <h3 className="font-bold text-secondary-800 mb-4 flex items-center gap-2">
            <Users size={15} /> Top Vendors by Commission
          </h3>
          <div className="space-y-3">
            {stats.topVendors.map((v, i) => (
              <div key={v._id} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-secondary-400">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-secondary-800 truncate">{v.storeName}</p>
                    <p className="text-sm font-bold text-primary-700 ml-2">{formatCurrency(v.totalAmount)}</p>
                  </div>
                  <div className="h-1.5 bg-secondary-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${(v.totalAmount / maxTopVendor) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-secondary-400 mt-0.5">{v.count} commission{v.count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date range */}
        <div className="relative">
          <select value={dateRange} onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
            className="border border-secondary-200 rounded-lg px-3 py-2 text-sm bg-white pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-primary-300">
            {DATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-secondary-400 mr-1">Status:</span>
          {STATUS_TABS.map(({ value, label }) => (
            <button key={value} onClick={() => { setStatusFilter(value); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === value ? 'bg-secondary-900 text-white' : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary-900 text-white">
                {(type === 'affiliate' ? ['Affiliate','Order','Amount','Rate','Status','Date','Actions'] : ['Vendor','Order','Product','Amount','Rate','Status','Date','Actions']).map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-secondary-400 text-sm">Loading commissions…</p>
                  </td>
                </tr>
              ) : commissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-secondary-400">
                    No commissions found for the selected period
                  </td>
                </tr>
              ) : commissions.map((c) => {
                const vp = c.user?.vendorProfile || {};
                return (
                  <tr key={c._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-secondary-900 text-sm">{vp.businessName || c.user?.name || '—'}</p>
                      <p className="text-xs text-secondary-400">{c.user?.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-secondary-500">
                      {c.order?.orderId || '—'}
                    </td>
                    {type !== 'affiliate' && (
                      <td className="px-4 py-3 text-xs text-secondary-600 max-w-[120px] truncate">
                        {c.product?.title || '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 font-bold text-green-600">
                      {formatCurrency(c.commissionAmount ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-secondary-600 text-xs">
                      {c.commissionRate ?? 0}%
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-secondary-500 text-xs whitespace-nowrap">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {type !== 'affiliate' && c.status === 'pending' && (
                          <>
                            <button onClick={() => approve(c._id)} disabled={approving === c._id}
                              className="px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50">
                              {approving === c._id ? '…' : 'Approve'}
                            </button>
                            <button onClick={() => reject(c._id)}
                              className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <XCircle size={13} />
                            </button>
                          </>
                        )}
                        {(c.status === 'approved' || (type === 'affiliate' && c.status === 'pending')) && (
                          <button onClick={() => openPay(c)}
                            className="px-2.5 py-1 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                            Pay
                          </button>
                        )}
                        {c.status === 'paid' && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle size={11} /> Paid
                          </span>
                        )}
                        {c.status === 'cancelled' && (
                          <span className="flex items-center gap-1 text-xs text-secondary-400 font-medium">
                            <XCircle size={11} /> Rejected
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
            <p className="text-xs text-secondary-500">
              Page {pagination.page} of {pagination.pages} · {pagination.total} records
            </p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40">← Prev</button>
              <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Payout Modal */}
      {payoutData && (
        <PayoutModal
          payout={payoutData}
          isAffiliate={type === 'affiliate'}
          onClose={() => setPayoutData(null)}
          onSuccess={() => { loadCommissions(); loadStats(); loadPendingPayouts(); }}
        />
      )}
    </div>
  );
}
