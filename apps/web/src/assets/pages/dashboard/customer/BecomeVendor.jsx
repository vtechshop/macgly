import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Users, TrendingUp, Percent, Clock, Store, Building2, CreditCard,
  AlertTriangle, Check, ArrowRight, ArrowLeft,
} from 'lucide-react';
import api from '../../../../utils/api';
import { setUser } from '../../../../store/slices/authSlice';
import toast from 'react-hot-toast';

const BUSINESS_TYPES = [
  { value: 'sole_proprietorship', label: 'Individual / Sole Proprietor' },
  { value: 'partnership',         label: 'Partnership' },
  { value: 'private_limited',     label: 'Private Limited Company' },
  { value: 'public_limited',      label: 'Public Limited Company' },
  { value: 'llp',                 label: 'LLP' },
  { value: 'other',               label: 'Other' },
];

const STEPS = [
  { number: 1, label: 'Store Info',    icon: Store },
  { number: 2, label: 'Business',      icon: Building2 },
  { number: 3, label: 'Bank Details',  icon: CreditCard },
];

const BENEFITS = [
  { icon: Users,     title: 'Reach Thousands',   desc: 'Access our large customer base',     color: 'text-blue-500 bg-blue-50' },
  { icon: TrendingUp, title: 'Grow Your Business', desc: 'Powerful analytics & insights',     color: 'text-purple-500 bg-purple-50' },
  { icon: Percent,   title: 'Low Commissions',   desc: 'Competitive marketplace rates',       color: 'text-green-500 bg-green-50' },
  { icon: Clock,     title: 'Quick Payouts',      desc: 'Weekly settlements to your bank',    color: 'text-orange-500 bg-orange-50' },
];

export default function BecomeVendor() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmRoleSwitch, setConfirmRoleSwitch] = useState(false);

  const [formData, setFormData] = useState({
    storeName:         '',
    description:       '',
    businessName:      '',
    businessType:      'sole_proprietorship',
    taxId:             '',
    bankAccountNumber: '',
    bankName:          '',
    bankAccountName:   '',
    ifscCode:          '',
  });

  const needsRoleConfirm = user?.role === 'affiliate' || user?.role === 'support';
  const currentRoleLabel = user?.role === 'affiliate' ? 'Affiliate' : user?.role === 'support' ? 'Support Agent' : '';

  function set(k) {
    return (e) => setFormData((p) => ({ ...p, [k]: e.target.value }));
  }

  const step1Valid = formData.storeName.trim() && formData.description.trim();
  const step2Valid = formData.businessName.trim() && formData.taxId.trim();
  const step3Valid = formData.bankAccountName.trim() && formData.bankName.trim() && formData.bankAccountNumber.trim()
    && (!needsRoleConfirm || confirmRoleSwitch);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const { data } = await api.post('/vendors/onboard', {
        storeName:   formData.storeName,
        description: formData.description,
        kyc: {
          businessName: formData.businessName,
          businessType: formData.businessType,
          taxId:        formData.taxId.toUpperCase(),
        },
        bank: {
          accountNumber: formData.bankAccountNumber,
          bankName:      formData.bankName,
          accountName:   formData.bankAccountName,
          ifscCode:      formData.ifscCode.toUpperCase(),
        },
      });

      // Refresh session — user.role is now 'vendor'
      const meRes = await api.get('/auth/me');
      dispatch(setUser(meRes.data.data || meRes.data.user));

      toast.success('Vendor application submitted successfully!');
      setTimeout(() => navigate('/dashboard/vendor/kyc'), 800);
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Submission failed');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Hero banner */}
      <div className="rounded-2xl bg-gradient-to-r from-primary-600 to-blue-700 text-white p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
          <Store size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Become a Vendor</h1>
          <p className="text-blue-100 text-sm mt-0.5">Start selling your products on our platform</p>
        </div>
      </div>

      {/* Benefits */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-secondary-600 mb-4">Why sell with us?</p>
        <div className="grid grid-cols-2 gap-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${b.color}`}>
                <b.icon size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold text-secondary-800">{b.title}</p>
                <p className="text-xs text-secondary-400">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role switch warning */}
      {needsRoleConfirm && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-amber-800">⚠️ Role Switching Warning</p>
            <p className="text-sm text-amber-700 mt-1">
              You are currently {currentRoleLabel === 'Affiliate' ? 'an' : 'a'} {currentRoleLabel}. Becoming a Vendor will replace your current role.
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Want both roles? Contact support at{' '}
              <a href="mailto:vtechshop.customercare@gmail.com" className="underline">vtechshop.customercare@gmail.com</a>
            </p>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="card p-4">
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((step, i) => {
            const done    = currentStep + 1 > step.number;
            const current = currentStep + 1 === step.number;
            return (
              <div key={step.number} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  done    ? 'bg-green-500 text-white'
                  : current ? 'bg-primary-600 text-white'
                  : 'bg-secondary-100 text-secondary-400'
                }`}>
                  {done ? <Check size={13} /> : <span>{step.number}</span>}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight size={14} className={done ? 'text-green-400' : 'text-secondary-300'} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Form card */}
      <div className="card p-6 space-y-5">
        {/* ── Step 1: Store Information ── */}
        {currentStep === 0 && (
          <>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-secondary-900">
                <Store size={20} className="text-primary-600" /> Store Information
              </h2>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                Store Name <span className="text-red-500">*</span>
              </label>
              <input
                className="input w-full"
                placeholder="Enter your store name"
                value={formData.storeName}
                onChange={set('storeName')}
              />
              <p className="text-xs text-secondary-400 mt-1">This will be displayed to customers</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                Store Description <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input w-full resize-none"
                rows={4}
                placeholder="Describe what you sell and what makes your store unique"
                value={formData.description}
                onChange={set('description')}
              />
            </div>
          </>
        )}

        {/* ── Step 2: Business Information ── */}
        {currentStep === 1 && (
          <>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-secondary-900">
                <Building2 size={20} className="text-primary-600" /> Business Information
              </h2>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                Business / Legal Name <span className="text-red-500">*</span>
              </label>
              <input
                className="input w-full"
                placeholder="Legal business name"
                value={formData.businessName}
                onChange={set('businessName')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1.5">Business Type</label>
              <select className="input w-full" value={formData.businessType} onChange={set('businessType')}>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                Tax ID / PAN Number <span className="text-red-500">*</span>
              </label>
              <input
                className="input w-full uppercase"
                placeholder="PAN or Tax ID"
                value={formData.taxId}
                onChange={(e) => setFormData((p) => ({ ...p, taxId: e.target.value.toUpperCase() }))}
                maxLength={15}
              />
            </div>
          </>
        )}

        {/* ── Step 3: Bank Details ── */}
        {currentStep === 2 && (
          <>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-secondary-900">
                <CreditCard size={20} className="text-primary-600" /> Bank Details
              </h2>
              <p className="text-xs text-secondary-400 mt-0.5">Required for weekly payouts to your account</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                  Account Holder Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="input w-full"
                  placeholder="As per bank records"
                  value={formData.bankAccountName}
                  onChange={set('bankAccountName')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="input w-full"
                  placeholder="e.g. State Bank of India"
                  value={formData.bankName}
                  onChange={set('bankName')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  className="input w-full"
                  placeholder="Bank account number"
                  value={formData.bankAccountNumber}
                  onChange={set('bankAccountNumber')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1.5">
                  IFSC Code <span className="text-secondary-400 font-normal">(optional)</span>
                </label>
                <input
                  className="input w-full uppercase"
                  placeholder="SBIN0001234"
                  value={formData.ifscCode}
                  onChange={(e) => setFormData((p) => ({ ...p, ifscCode: e.target.value.toUpperCase() }))}
                  maxLength={11}
                />
              </div>
            </div>

            {/* Role switch confirmation checkbox */}
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
          </>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2">
          {currentStep === 0 ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-secondary-200 rounded-xl text-sm font-semibold hover:bg-secondary-50 text-secondary-600"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-secondary-200 rounded-xl text-sm font-semibold hover:bg-secondary-50"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {currentStep < 2 ? (
            <button
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={currentStep === 0 ? !step1Valid : !step2Valid}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-primary-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
            >
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!step3Valid || submitting}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-primary-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
        <span className="font-semibold">Note:</span> Your application will be reviewed by our team. You'll receive an email notification once approved.
      </div>
    </div>
  );
}
