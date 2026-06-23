import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Building2, Phone, FileText, CreditCard, ShieldCheck } from 'lucide-react';
import api from '../../../../utils/api';
import { setUser } from '../../../../store/slices/authSlice';
import toast from 'react-hot-toast';

export default function VendorOnboarding() {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    businessName: '', businessPhone: '', gstin: '',
    accountHolderName: '', bankAccount: '', ifsc: '', panCard: '',
  });
  const [errors, setErrors] = useState({});

  function set(k) { return (e) => { setForm((p) => ({ ...p, [k]: e.target.value })); setErrors((p) => ({ ...p, [k]: '' })); }; }

  function validateStep1() {
    const errs = {};
    if (!form.businessName.trim()) errs.businessName = 'Business name is required';
    if (!form.businessPhone.trim()) errs.businessPhone = 'Business phone is required';
    else if (!/^\d{10}$/.test(form.businessPhone.replace(/[\s+\-()]/g, ''))) errs.businessPhone = 'Enter a valid 10-digit phone';
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin.toUpperCase())) errs.gstin = 'Invalid GSTIN format';
    return errs;
  }

  function validateStep2() {
    const errs = {};
    if (!form.panCard.trim()) errs.panCard = 'PAN card is required';
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.panCard.toUpperCase())) errs.panCard = 'Invalid PAN format (e.g. ABCDE1234F)';
    if (!form.accountHolderName.trim()) errs.accountHolderName = 'Account holder name is required';
    if (!form.bankAccount.trim()) errs.bankAccount = 'Bank account number is required';
    if (!form.ifsc.trim()) errs.ifsc = 'IFSC code is required';
    else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.toUpperCase())) errs.ifsc = 'Invalid IFSC format (e.g. SBIN0001234)';
    return errs;
  }

  function handleNext() {
    const errs = validateStep1();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setStep(2);
  }

  async function handleSubmit() {
    const errs = validateStep2();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const { data } = await api.put('/vendors/profile', form);
      dispatch(setUser(data.vendor));
      toast.success('Profile submitted! Awaiting admin approval.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-3 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${step >= s ? 'bg-primary-600 text-white' : 'bg-secondary-100 text-secondary-400'}`}>{s}</div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${step >= s ? 'text-secondary-900' : 'text-secondary-400'}`}>
                {s === 1 ? 'Business Details' : 'KYC & Banking'}
              </p>
              <p className="text-xs text-secondary-400">{s === 1 ? 'Required' : 'Required'}</p>
            </div>
            {s < 2 && <div className={`h-0.5 w-8 ${step > s ? 'bg-primary-600' : 'bg-secondary-200'}`} />}
          </div>
        ))}
      </div>

      <div className="card p-6 space-y-5">
        {step === 1 ? (
          <>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><Building2 size={20} className="text-primary-600" /> Business Details</h2>
              <p className="text-secondary-500 text-sm mt-0.5">Tell us about your business to get started</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Business Name <span className="text-red-500">*</span></label>
                <input className={`input w-full ${errors.businessName ? 'border-red-400' : ''}`} placeholder="Enter business name" value={form.businessName} onChange={set('businessName')} />
                {errors.businessName && <p className="text-xs text-red-500 mt-1">{errors.businessName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Business Phone <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                  <input className={`input w-full pl-8 ${errors.businessPhone ? 'border-red-400' : ''}`} placeholder="10-digit mobile number" value={form.businessPhone} onChange={set('businessPhone')} />
                </div>
                {errors.businessPhone && <p className="text-xs text-red-500 mt-1">{errors.businessPhone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">GSTIN <span className="text-secondary-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                  <input className={`input w-full pl-8 uppercase ${errors.gstin ? 'border-red-400' : ''}`} placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={set('gstin')} maxLength={15} />
                </div>
                {errors.gstin && <p className="text-xs text-red-500 mt-1">{errors.gstin}</p>}
                <p className="text-xs text-secondary-400 mt-1">Required if your annual turnover exceeds ₹40 lakhs</p>
              </div>
            </div>

            <button onClick={handleNext} className="btn-primary w-full">Continue to KYC →</button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck size={20} className="text-primary-600" /> KYC & Banking</h2>
              <p className="text-secondary-500 text-sm mt-0.5">Required for verification and payouts. All fields are mandatory.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">PAN Card <span className="text-red-500">*</span></label>
                <div className="relative">
                  <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                  <input className={`input w-full pl-8 uppercase ${errors.panCard ? 'border-red-400' : ''}`} placeholder="ABCDE1234F" value={form.panCard} onChange={set('panCard')} maxLength={10} />
                </div>
                {errors.panCard && <p className="text-xs text-red-500 mt-1">{errors.panCard}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Account Holder Name <span className="text-red-500">*</span></label>
                <input className={`input w-full ${errors.accountHolderName ? 'border-red-400' : ''}`} placeholder="As per bank records" value={form.accountHolderName} onChange={set('accountHolderName')} />
                {errors.accountHolderName && <p className="text-xs text-red-500 mt-1">{errors.accountHolderName}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">Bank Account Number <span className="text-red-500">*</span></label>
                  <input className={`input w-full ${errors.bankAccount ? 'border-red-400' : ''}`} placeholder="Account number" value={form.bankAccount} onChange={set('bankAccount')} />
                  {errors.bankAccount && <p className="text-xs text-red-500 mt-1">{errors.bankAccount}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-1">IFSC Code <span className="text-red-500">*</span></label>
                  <input className={`input w-full uppercase ${errors.ifsc ? 'border-red-400' : ''}`} placeholder="SBIN0001234" value={form.ifsc} onChange={set('ifsc')} maxLength={11} />
                  {errors.ifsc && <p className="text-xs text-red-500 mt-1">{errors.ifsc}</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-outline flex-1">← Back</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </div>
            <p className="text-center text-xs text-secondary-400">All fields are required before your account can be submitted for approval</p>
          </>
        )}
      </div>
    </div>
  );
}
