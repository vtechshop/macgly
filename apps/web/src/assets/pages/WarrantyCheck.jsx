import { useState } from 'react';
import { Shield, Search, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import api from '../utils/api';
import Spinner from './components/common/Spinner';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'; }

export default function WarrantyCheck() {
  const [serial, setSerial] = useState('');
  const [warranty, setWarranty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e) {
    e.preventDefault();
    setError('');
    setWarranty(null);
    setLoading(true);
    try {
      const res = await api.get(`/warranties/check/${serial.trim()}`);
      setWarranty(res.data.warranty);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'No warranty found for this serial number');
    } finally { setLoading(false); }
  }

  const isExpired = warranty?.status === 'expired' || (warranty?.expiryDate && new Date(warranty.expiryDate) < new Date());
  const daysLeft = warranty?.expiryDate ? Math.max(0, Math.ceil((new Date(warranty.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))) : 0;

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
          <input className="input w-full font-mono" placeholder="e.g. SN-2024-ABCD1234" value={serial} onChange={(e) => setSerial(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Spinner size="sm" /> : <Search size={15} />} {loading ? 'Checking…' : 'Check Warranty'}
        </button>
      </form>

      {warranty && (
        <div className="space-y-4">
          <div className={`card p-5 border-2 ${isExpired ? 'border-red-200' : 'border-green-200'}`}>
            <div className="flex items-start gap-3 mb-4">
              {isExpired ? <XCircle size={28} className="text-red-500 shrink-0" /> : <CheckCircle size={28} className="text-green-500 shrink-0" />}
              <div>
                <p className={`font-bold text-lg ${isExpired ? 'text-red-700' : 'text-green-700'}`}>
                  {isExpired ? 'Warranty Expired' : 'Warranty Valid'}
                </p>
                {!isExpired && <p className="text-sm text-green-600">{daysLeft} days remaining</p>}
              </div>
            </div>

            {warranty.product && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-secondary-50 rounded-lg">
                {warranty.product.images?.[0] && <img src={warranty.product.images[0]} alt="" className="w-12 h-12 rounded object-cover shrink-0" />}
                <div>
                  <p className="font-semibold">{warranty.product.title}</p>
                  <p className="text-xs text-secondary-400">Serial: {warranty.serialNumber}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Purchase Date', value: fmtDate(warranty.purchaseDate) },
                { label: 'Expiry Date', value: fmtDate(warranty.expiryDate) },
                { label: 'Warranty Period', value: `${warranty.warrantyPeriodMonths} months` },
                { label: 'Status', value: warranty.status },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-secondary-400 text-xs">{label}</p>
                  <p className="font-medium capitalize">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {!isExpired && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
              <p className="font-semibold mb-1">Need to raise a warranty claim?</p>
              <p>Log in to your account → My Orders → Register/Claim Warranty</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
