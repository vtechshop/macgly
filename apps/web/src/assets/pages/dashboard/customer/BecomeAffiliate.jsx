import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Users, Percent, Clock, BarChart3, IndianRupee,
  Building2, Wallet, CreditCard, AlertTriangle, Check,
} from 'lucide-react';
import api from '../../../../utils/api';
import { setUser } from '../../../../store/slices/authSlice';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Config ───────────────────────────────────────────────────────────────────

const BENEFITS = [
  { icon: Percent,      title: 'High Commissions',    desc: 'Earn up to 10% on every sale you refer',       highlight: true },
  { icon: Clock,        title: '30-Day Cookie',        desc: 'Credit for purchases within 30 days' },
  { icon: BarChart3,    title: 'Real-time Dashboard',  desc: 'Track clicks, conversions & earnings' },
  { icon: IndianRupee,  title: 'Monthly Payouts',      desc: 'Get paid every month, multiple options' },
];

const PAYMENT_METHODS = [
  { key: 'bank',   icon: Building2,   label: 'Bank Transfer', sub: 'Direct to your bank' },
  { key: 'upi',    icon: Wallet,      label: 'UPI',           sub: 'GPay, PhonePe, etc.' },
  { key: 'paypal', icon: CreditCard,  label: 'PayPal',        sub: 'International payments' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function BenefitCard({ icon: Icon, title, desc, highlight }) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${highlight ? 'bg-green-50 border-green-200' : 'bg-white border-secondary-200'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${highlight ? 'bg-green-100' : 'bg-secondary-100'}`}>
        <Icon size={17} className={highlight ? 'text-green-600' : 'text-secondary-500'} />
      </div>
      <div>
        <p className="text-sm font-semibold text-secondary-800">{title}</p>
        <p className="text-xs text-secondary-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function PaymentMethodCard({ method, selected, onSelect }) {
  const Icon = method.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(method.key)}
      className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border text-left transition-colors ${
        selected ? 'border-primary-400 bg-blue-50 ring-1 ring-primary-200' : 'border-secondary-200 bg-white hover:border-secondary-300'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-primary-100' : 'bg-secondary-100'}`}>
          <Icon size={16} className={selected ? 'text-primary-600' : 'text-secondary-500'} />
        </div>
        <div>
          <p className="text-sm font-semibold">{method.label}</p>
          <p className="text-xs text-secondary-400">{method.sub}</p>
        </div>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
        selected ? 'border-primary-500 bg-primary-500' : 'border-secondary-300'
      }`}>
        {selected && <Check size={11} className="text-white" />}
      </div>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BecomeAffiliate() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const [submitting,        setSubmitting]        = useState(false);
  const [confirmRoleSwitch, setConfirmRoleSwitch] = useState(false);
  const [formData,          setFormData]          = useState({
    paymentMethod: 'bank',
    accountName: '', accountNumber: '', ifsc: '',
    upiId: '',
    paypalEmail: '',
  });

  const needsRoleConfirm = user?.role === 'vendor' || user?.role === 'support';
  const currentRoleLabel = user?.role === 'vendor' ? 'Vendor' : user?.role === 'support' ? 'Support Agent' : '';

  function set(k) {
    return (e) => setFormData((p) => ({ ...p, [k]: e.target.value }));
  }

  function setMethod(m) {
    setFormData((p) => ({ ...p, paymentMethod: m }));
  }

  const isFormValid = (() => {
    if (needsRoleConfirm && !confirmRoleSwitch) return false;
    if (formData.paymentMethod === 'bank')   return formData.accountName.trim() && formData.accountNumber.trim() && formData.ifsc.trim();
    if (formData.paymentMethod === 'upi')    return formData.upiId.trim();
    if (formData.paymentMethod === 'paypal') return formData.paypalEmail.trim();
    return false;
  })();

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const paymentDetails = {
        bank:   { accountName: formData.accountName, accountNumber: formData.accountNumber, ifsc: formData.ifsc.toUpperCase() },
        upi:    { upiId: formData.upiId },
        paypal: { paypalEmail: formData.paypalEmail },
      };

      const { data } = await api.post('/affiliates/apply', {
        paymentMethod: formData.paymentMethod,
        paymentDetails,
      });

      // Refresh session so user.role updates to 'affiliate'
      const meRes = await api.get('/auth/me');
      dispatch(setUser(meRes.data.user || meRes.data.data));

      toast.success('Affiliate application submitted successfully!');
      setTimeout(() => navigate('/dashboard/affiliate'), 800);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* 1 — Header */}
      <div className="rounded-2xl bg-gradient-to-r from-green-600 to-emerald-700 text-white p-6 relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute right-12 -bottom-8 w-20 h-20 bg-white/10 rounded-full" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Users size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Become an Affiliate</h1>
            <p className="text-green-100 text-sm mt-0.5">Earn commissions by promoting our products</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="flex items-center gap-1 text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
                <Percent size={11} /> Up to 10% commission
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
                <Clock size={11} /> 30-day cookie
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2 — Program Benefits */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-secondary-600 mb-4">Program Benefits</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BENEFITS.map((b) => <BenefitCard key={b.title} {...b} />)}
        </div>
      </div>

      {/* 3 — Role Warning */}
      {needsRoleConfirm && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-amber-800">Role Switching Warning</p>
            <p className="text-sm text-amber-700 mt-1">
              You are currently {currentRoleLabel === 'Vendor' ? 'a' : 'a'} {currentRoleLabel}. Becoming an Affiliate will replace your current role.
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Want both roles? Contact{' '}
              <a href="mailto:macglyshop@gmail.com" className="underline">macglyshop@gmail.com</a>
            </p>
          </div>
        </div>
      )}

      {/* 4 — Payment Information Form */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-secondary-100">
          <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
            <CreditCard size={18} className="text-green-600" />
          </div>
          <div>
            <p className="font-bold text-secondary-800">Payment Information</p>
            <p className="text-xs text-secondary-400">How you'd like to receive your earnings</p>
          </div>
        </div>

        {/* Payment method selector */}
        <div>
          <p className="text-sm font-medium text-secondary-700 mb-3">Select Payment Method</p>
          <div className="grid grid-cols-3 gap-3">
            {PAYMENT_METHODS.map((m) => (
              <PaymentMethodCard
                key={m.key}
                method={m}
                selected={formData.paymentMethod === m.key}
                onSelect={setMethod}
              />
            ))}
          </div>
        </div>

        {/* Bank fields */}
        {formData.paymentMethod === 'bank' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Account Holder Name <span className="text-red-500">*</span></label>
              <input className="input w-full" placeholder="Name as per bank account" value={formData.accountName} onChange={set('accountName')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">Account Number <span className="text-red-500">*</span></label>
                <input className="input w-full" placeholder="Enter account number" value={formData.accountNumber} onChange={set('accountNumber')} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium">IFSC Code <span className="text-red-500">*</span></label>
                <input className="input w-full uppercase" placeholder="Enter IFSC code" value={formData.ifsc} onChange={(e) => setFormData((p) => ({ ...p, ifsc: e.target.value.toUpperCase() }))} maxLength={11} />
              </div>
            </div>
          </div>
        )}

        {/* UPI fields */}
        {formData.paymentMethod === 'upi' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">UPI ID <span className="text-red-500">*</span></label>
            <input className="input w-full" placeholder="Enter UPI ID" value={formData.upiId} onChange={set('upiId')} />
            <p className="text-xs text-secondary-400">e.g., yourname@paytm, yourname@gpay</p>
          </div>
        )}

        {/* PayPal fields */}
        {formData.paymentMethod === 'paypal' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">PayPal Email <span className="text-red-500">*</span></label>
            <input className="input w-full" type="email" placeholder="Enter PayPal email" value={formData.paypalEmail} onChange={set('paypalEmail')} />
          </div>
        )}

        {/* Role switch confirmation */}
        {needsRoleConfirm && (
          <label className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-red-300"
              checked={confirmRoleSwitch}
              onChange={(e) => setConfirmRoleSwitch(e.target.checked)}
            />
            <span className="text-sm text-red-700 font-medium">
              I understand that I will lose my {currentRoleLabel} role and accept the consequences.
            </span>
          </label>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => navigate('/dashboard/customer')}
            className="px-4 py-2.5 border border-secondary-200 rounded-xl text-sm font-semibold hover:bg-secondary-50 text-secondary-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
          >
            {submitting && <Spinner size="sm" />}
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
        </div>
      </div>

      {/* Note footer */}
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
        <span className="font-semibold">Note:</span> Your application will be reviewed by our team. After approval, you'll get your unique affiliate code and tracking links.
      </div>
    </div>
  );
}
