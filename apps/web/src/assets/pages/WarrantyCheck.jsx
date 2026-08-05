import { useState, useEffect } from 'react';
import { Shield, Search, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../../utils/api';
import { setMeta, SITE_URL } from '../../utils/seo';
import Spinner from '../components/common/Spinner';

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}

export default function WarrantyCheck() {
  const [serial, setSerial] = useState('');
  const [warranty, setWarranty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMeta({
      title: 'Warranty Check — Verify Your Product Warranty | Macgly',
      description: 'Enter the serial number of your tool or machine to check its warranty status, coverage period and expiry date on Macgly.',
      canonical: `${SITE_URL}/warranty-check`,
    });
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    setWarranty(null);
    setLoading(true);
    try {
      const res = await api.get(`/warranties/check/${encodeURIComponent(serial.trim())}`);
      setWarranty(res.data.warranty);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'No warranty found for this serial number');
    } finally { setLoading(false); }
  }

  const isExpired = warranty?.status === 'expired';
  const isVoid    = warranty?.status === 'void';
  const daysLeft  = warranty?.warrantyEndDate
    ? Math.max(0, Math.ceil((new Date(warranty.warrantyEndDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  function statusColor() {
    if (isExpired || isVoid) return 'border-red-200';
    if (warranty?.status === 'expiring_soon') return 'border-yellow-200';
    return 'border-green-200';
  }

  function StatusIcon() {
    if (isExpired || isVoid) return <XCircle size={28} className="text-red-500 shrink-0" />;
    if (warranty?.status === 'expiring_soon') return <Clock size={28} className="text-yellow-500 shrink-0" />;
    return <CheckCircle size={28} className="text-green-500 shrink-0" />;
  }

  function statusLabel() {
    if (isVoid) return 'Warranty Void';
    if (isExpired) return 'Warranty Expired';
    if (warranty?.status === 'expiring_soon') return 'Expiring Soon';
    if (warranty?.status === 'claimed') return 'Claim In Progress';
    return 'Warranty Valid';
  }

  function statusTextColor() {
    if (isExpired || isVoid) return 'text-red-700';
    if (warranty?.status === 'expiring_soon') return 'text-yellow-700';
    return 'text-green-700';
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <Shield size={48} className="mx-auto mb-4 text-primary-600" />
        <h1 className="text-3xl font-bold text-secondary-900">Warranty Check</h1>
        <p className="text-secondary-500 mt-2">Enter the serial number to verify your product warranty</p>
      </div>

      <form onSubmit={handleSearch} className="card p-6 space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Serial Number / IMEI</label>
          <input
            className="input w-full font-mono"
            placeholder="Enter serial number"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Spinner size="sm" /> : <Search size={15} />}
          {loading ? 'Checking…' : 'Check Warranty'}
        </button>
      </form>

      {warranty && (
        <div className="space-y-4">
          <div className={`card p-5 border-2 ${statusColor()}`}>
            <div className="flex items-start gap-3 mb-4">
              <StatusIcon />
              <div>
                <p className={`font-bold text-lg ${statusTextColor()}`}>{statusLabel()}</p>
                {!isExpired && !isVoid && warranty.status !== 'claimed' && (
                  <p className={`text-sm ${warranty.status === 'expiring_soon' ? 'text-yellow-600' : 'text-green-600'}`}>
                    {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
                  </p>
                )}
              </div>
            </div>

            {warranty.product && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-secondary-50 rounded-lg">
                <div>
                  <p className="font-semibold">{warranty.product.name}</p>
                  {warranty.product.model && <p className="text-xs text-secondary-400">Model: {warranty.product.model}</p>}
                  {warranty.product.serial && <p className="text-xs text-secondary-400">Serial: {warranty.product.serial}</p>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Purchase Date',  value: fmtDate(warranty.purchaseDate) },
                { label: 'Expires On',     value: fmtDate(warranty.warrantyEndDate) },
                { label: 'Period',         value: `${Math.round((warranty.warrantyPeriodDays || 365) / 30)} months` },
                { label: 'Type',           value: warranty.warrantyType || 'Manufacturer' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-secondary-400 text-xs">{label}</p>
                  <p className="font-medium capitalize">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {!isExpired && !isVoid && warranty.status !== 'claimed' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
              <p className="font-semibold mb-1">Need to raise a warranty claim?</p>
              <p>Log in to your account → My Orders → Raise a Warranty Claim</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
