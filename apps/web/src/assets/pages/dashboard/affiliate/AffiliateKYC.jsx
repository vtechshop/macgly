import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ShieldCheck, ShieldX, Clock, AlertCircle } from 'lucide-react';
import api from '../../../../utils/api';
import { setUser } from '../../../../store/slices/authSlice';
import toast from 'react-hot-toast';
import Spinner from '../../../components/common/Spinner';

const STATUS_CONFIG = {
  not_submitted: {
    icon: AlertCircle,
    color: 'text-secondary-400',
    bg: 'bg-secondary-50',
    title: 'KYC Not Submitted',
    desc: 'Complete your KYC to enable commission payouts. We need your PAN card and bank details.',
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    title: 'Under Review',
    desc: 'Your KYC documents are being reviewed. This usually takes 1–2 business days.',
  },
  verified: {
    icon: ShieldCheck,
    color: 'text-green-600',
    bg: 'bg-green-50',
    title: 'KYC Verified',
    desc: 'Your identity is verified. Commission payouts are enabled on your account.',
  },
  rejected: {
    icon: ShieldX,
    color: 'text-red-600',
    bg: 'bg-red-50',
    title: 'KYC Rejected',
    desc: 'Your KYC was rejected. Please review the reason below and resubmit.',
  },
};

export default function AffiliateKYC() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const kycStatus = user?.affiliateProfile?.kycStatus || 'not_submitted';
  const kycData = user?.affiliateProfile?.kycData || {};
  const canSubmit = kycStatus === 'not_submitted' || kycStatus === 'rejected';

  const [form, setForm] = useState({
    panCard: kycData.panCard || '',
    accountHolderName: kycData.accountHolderName || '',
    bankAccount: kycData.bankAccount || '',
    ifsc: kycData.ifsc || '',
    aadhaar: kycData.aadhaar || '',
  });
  const [saving, setSaving] = useState(false);

  const cfg = STATUS_CONFIG[kycStatus] || STATUS_CONFIG.not_submitted;
  const StatusIcon = cfg.icon;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/affiliates/kyc', form);
      dispatch(setUser(data.user));
      toast.success('KYC submitted for review!');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not submit KYC');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">KYC Verification</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Required for commission payouts</p>
      </div>

      {/* Status banner */}
      <div className={`${cfg.bg} rounded-xl p-5 flex items-start gap-4`}>
        <StatusIcon size={24} className={`${cfg.color} shrink-0 mt-0.5`} />
        <div>
          <p className={`font-bold ${cfg.color}`}>{cfg.title}</p>
          <p className="text-sm text-secondary-600 mt-0.5">{cfg.desc}</p>
          {kycStatus === 'rejected' && kycData.rejectionReason && (
            <p className="mt-2 text-sm text-red-700 bg-red-100 rounded px-3 py-2">
              <strong>Reason:</strong> {kycData.rejectionReason}
            </p>
          )}
        </div>
      </div>

      {/* Existing data (read-only when pending/verified) */}
      {(kycStatus === 'pending' || kycStatus === 'verified') && (
        <div className="card p-5 space-y-3">
          <h2 className="font-bold text-sm uppercase tracking-wide text-secondary-400">Submitted Details</h2>
          {[
            { label: 'PAN Card', value: kycData.panCard },
            { label: 'Account Holder', value: kycData.accountHolderName },
            { label: 'Bank Account', value: kycData.bankAccount },
            { label: 'IFSC Code', value: kycData.ifsc },
            { label: 'Aadhaar (last 4)', value: kycData.aadhaar ? `xxxx xxxx ${kycData.aadhaar.slice(-4)}` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-secondary-500">{label}</span>
              <span className="font-medium">{value || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* KYC Form */}
      {canSubmit && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <h2 className="font-bold">{kycStatus === 'rejected' ? 'Resubmit KYC' : 'Submit KYC Details'}</h2>

          <div>
            <label className="block text-sm font-medium mb-1">PAN Card Number <span className="text-red-500">*</span></label>
            <input
              className="input w-full uppercase"
              placeholder="ABCDE1234F"
              maxLength={10}
              value={form.panCard}
              onChange={(e) => setForm({ ...form, panCard: e.target.value.toUpperCase() })}
              required
            />
            <p className="text-xs text-secondary-400 mt-1">Required for TDS deduction as per Indian tax law</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Account Holder Name <span className="text-red-500">*</span></label>
            <input
              className="input w-full"
              placeholder="As printed on your passbook"
              value={form.accountHolderName}
              onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Bank Account Number <span className="text-red-500">*</span></label>
            <input
              className="input w-full font-mono"
              placeholder="Account number"
              value={form.bankAccount}
              onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">IFSC Code <span className="text-red-500">*</span></label>
            <input
              className="input w-full uppercase font-mono"
              placeholder="SBIN0001234"
              maxLength={11}
              value={form.ifsc}
              onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Aadhaar Number <span className="text-secondary-400 font-normal">(optional)</span></label>
            <input
              className="input w-full font-mono"
              placeholder="12-digit Aadhaar"
              maxLength={12}
              value={form.aadhaar}
              onChange={(e) => setForm({ ...form, aadhaar: e.target.value })}
            />
          </div>

          <p className="text-xs text-secondary-400 bg-secondary-50 rounded p-3">
            Your details are encrypted and used only for identity verification and commission payouts. We comply with applicable data protection laws.
          </p>

          <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving && <Spinner size="sm" />}
            {saving ? 'Submitting…' : 'Submit for Verification'}
          </button>
        </form>
      )}
    </div>
  );
}
