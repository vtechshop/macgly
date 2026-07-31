import { useState, useEffect, useRef } from 'react';
import {
  Shield, ShieldCheck, ShieldX, Clock, AlertCircle, RefreshCw,
  Upload, X, Check, Loader2, IndianRupee, FileText, Lock,
  CheckCircle2, Circle, ChevronRight, ChevronLeft, User, CreditCard,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, invalidateCache } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import Button from '../../../components/common/Button';
import toast from 'react-hot-toast';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  not_submitted: { icon: AlertCircle,  color: 'text-secondary-400', border: 'border-secondary-200', bg: 'bg-secondary-50',  label: 'Not Submitted' },
  pending:       { icon: Clock,        color: 'text-yellow-600',    border: 'border-yellow-200',    bg: 'bg-yellow-50',     label: 'Pending Review' },
  approved:      { icon: ShieldCheck,  color: 'text-green-600',     border: 'border-green-200',     bg: 'bg-green-50',      label: 'Approved' },
  verified:      { icon: ShieldCheck,  color: 'text-green-600',     border: 'border-green-200',     bg: 'bg-green-50',      label: 'Approved' },
  rejected:      { icon: ShieldX,      color: 'text-red-600',       border: 'border-red-200',       bg: 'bg-red-50',        label: 'Rejected' },
};

const ID_TYPES = [
  { value: 'passport',        label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'national_id',     label: 'National ID / Aadhaar' },
  { value: 'other',           label: 'Other' },
];

const DOC_SLOTS = [
  { type: 'id_proof',      label: 'ID Proof',       desc: 'Upload a copy of your government-issued ID',                    required: true  },
  { type: 'address_proof', label: 'Address Proof',  desc: 'Utility bill or bank statement showing your address',            required: true  },
  { type: 'tax_document',  label: 'Tax Document',   desc: 'Upload tax identification documents if applicable',              required: false },
];

const STEPS = [
  { title: 'Personal Info',  icon: User        },
  { title: 'Documents',      icon: FileText    },
  { title: 'Bank & PAN',     icon: CreditCard  },
  { title: 'Review',         icon: ShieldCheck },
];

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckItem({ done, label }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${done ? 'text-green-700' : 'text-secondary-500'}`}>
      {done
        ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
        : <Circle       size={16} className="text-secondary-300 shrink-0" />}
      {label}
    </div>
  );
}

function StepBar({ current, onGo, locked }) {
  return (
    <div className="flex items-center gap-0 w-full mb-6">
      {STEPS.map((s, i) => {
        const done    = i < current;
        const active  = i === current;
        const Icon    = s.icon;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => { if (!locked) onGo(i); }}
              className={`flex flex-col items-center gap-1 shrink-0 ${locked ? 'cursor-default' : ''}`}
            >
              <span className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors
                ${done   ? 'bg-primary-600 text-white' : ''}
                ${active ? 'bg-primary-600 text-white ring-4 ring-primary-100' : ''}
                ${!done && !active ? 'bg-secondary-100 text-secondary-400' : ''}
              `}>
                {done ? <Check size={16} /> : <Icon size={16} />}
              </span>
              <span className={`text-[11px] font-medium hidden sm:block ${active ? 'text-primary-600' : done ? 'text-secondary-600' : 'text-secondary-400'}`}>
                {s.title}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-primary-500' : 'bg-secondary-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AffiliateKYC() {
  const [rev, setRev] = useState(0);
  const [step, setStep] = useState(0);

  // Personal form
  const [formData, setFormData] = useState({
    fullName: '', address: '', city: '', state: '',
    country: '', zipCode: '', phoneNumber: '',
    idType: '', idNumber: '',
  });
  const [savingInfo, setSavingInfo] = useState(false);

  // GST
  const [gstNumber,    setGstNumber]    = useState('');
  const [gstVerifying, setGstVerifying] = useState(false);
  const [gstVerified,  setGstVerified]  = useState(false);
  const [gstDetails,   setGstDetails]   = useState(null);
  const [gstError,     setGstError]     = useState('');

  // Documents
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const fileInputRef   = useRef(null);
  const currentDocType = useRef('');

  // Bank/payment form
  const [paymentData, setPaymentData] = useState({
    accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '', upiId: '', panNumber: '',
  });
  const [savingBank, setSavingBank] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: kycData, isLoading, error } = useFetch(
    ['affiliate-kyc', rev],
    () => api.get('/affiliates/kyc').then((r) => r.data)
  );

  useEffect(() => {
    if (!kycData) return;
    const k = kycData.kyc || {};
    setFormData({
      fullName:    k.fullName    || '',
      address:     k.address     || '',
      city:        k.city        || '',
      state:       k.state       || '',
      country:     k.country     || '',
      zipCode:     k.zipCode     || '',
      phoneNumber: k.phoneNumber || '',
      idType:      k.idType      || '',
      idNumber:    k.idNumber    || '',
    });
    setGstNumber(k.gstNumber || '');
    setGstVerified(k.gstVerified || false);
    setGstDetails(k.gstDetails || null);
    const pd = kycData.paymentDetails || {};
    setPaymentData({
      accountHolderName: pd.accountHolderName || '',
      bankName:          pd.bankName          || '',
      accountNumber:     pd.accountNumber     || '',
      ifscCode:          pd.ifscCode          || '',
      upiId:             pd.upiId             || '',
      panNumber:         kycData.panNumber    || '',
    });
  }, [kycData]);

  // ── Loading / error ───────────────────────────────────────────────────────────

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (error?.response?.status === 404) {
    return (
      <div className="card p-12 text-center space-y-4">
        <Spinner size="lg" />
        <p className="text-secondary-500">Setting up your affiliate profile…</p>
        <button onClick={() => { invalidateCache('affiliate-kyc'); setRev((r) => r + 1); }} className="btn-secondary text-sm">
          <RefreshCw size={14} className="inline mr-1" /> Refresh
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-12 text-center space-y-3">
        <p className="font-medium text-secondary-700">Unable to load KYC</p>
        <button onClick={() => window.location.reload()} className="btn-secondary text-sm">Reload</button>
      </div>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────────

  const kyc        = kycData?.kyc || {};
  const kycStatus  = kyc.status || 'not_submitted';
  const statusCfg  = STATUS_CFG[kycStatus] || STATUS_CFG.not_submitted;
  const StatusIcon = statusCfg.icon;
  const docs       = kyc.documents || [];
  const isApproved = kycStatus === 'approved' || kycStatus === 'verified';
  const isPending  = kycStatus === 'pending';
  const locked     = isPending || isApproved;

  const personalComplete = !!(formData.fullName && formData.phoneNumber && formData.idType && formData.idNumber && formData.address && formData.city && formData.state && formData.country);
  const bankComplete     = !!(kycData?.paymentDetails?.accountNumber && kycData?.paymentDetails?.ifscCode);
  const panComplete      = !!(kycData?.panNumber || paymentData.panNumber);
  const idProofUploaded  = docs.some((d) => d.type === 'id_proof');

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function setForm(k) { return (e) => setFormData((f) => ({ ...f, [k]: e.target.value })); }
  function setPay(k)  { return (e) => setPaymentData((f) => ({ ...f, [k]: e.target.value })); }

  async function handleVerifyGst() {
    if (!gstNumber.trim()) return;
    setGstVerifying(true); setGstError(''); setGstVerified(false); setGstDetails(null);
    try {
      const { data } = await api.post('/vendors/gst/verify', { gstNumber: gstNumber.toUpperCase() });
      if (data.active) {
        setGstVerified(true); setGstDetails(data.data);
        toast.success('GST verified!');
      } else {
        setGstError('GST number is inactive or invalid');
      }
    } catch (err) {
      setGstError(err.response?.data?.error?.message || 'GST verification failed');
    } finally { setGstVerifying(false); }
  }

  async function handleSaveInfo(advance = false) {
    setSavingInfo(true);
    try {
      await api.put('/affiliates/kyc', {
        ...formData,
        gstNumber:   gstVerified ? gstNumber : (gstNumber || undefined),
        gstVerified: gstVerified || undefined,
        gstDetails:  gstDetails  || undefined,
      });
      toast.success('Information saved');
      invalidateCache('affiliate-kyc');
      setRev((r) => r + 1);
      if (advance) setStep(1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally { setSavingInfo(false); }
  }

  function triggerDocUpload(type) {
    currentDocType.current = type;
    fileInputRef.current?.click();
  }

  async function handleDocFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5MB'); return; }
    const type = currentDocType.current;
    setUploadingDoc(type);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'kyc-documents');
      const { data: uploadData } = await api.post('/upload', fd);
      const url = uploadData.url || uploadData.secure_url;
      await api.post('/affiliates/kyc/documents', { type, url, filename: file.name });
      toast.success('Document uploaded');
      invalidateCache('affiliate-kyc');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploadingDoc(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteDoc(docId) {
    if (!confirm('Delete this document?')) return;
    try {
      await api.delete(`/affiliates/kyc/documents/${docId}`);
      toast.success('Document removed');
      invalidateCache('affiliate-kyc');
      setRev((r) => r + 1);
    } catch { toast.error('Could not delete document'); }
  }

  async function handleSaveBank(advance = false) {
    const pan = paymentData.panNumber.toUpperCase();
    if (pan && !PAN_REGEX.test(pan)) { toast.error('Invalid PAN number format (e.g. ABCDE1234F)'); return; }
    setSavingBank(true);
    try {
      await api.put('/affiliates/payment-details', {
        paymentDetails: {
          accountHolderName: paymentData.accountHolderName,
          bankName:          paymentData.bankName,
          accountNumber:     paymentData.accountNumber,
          ifscCode:          paymentData.ifscCode,
          upiId:             paymentData.upiId,
        },
        panNumber: pan || undefined,
      });
      toast.success('Bank details saved');
      invalidateCache('affiliate-kyc');
      setRev((r) => r + 1);
      if (advance) setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally { setSavingBank(false); }
  }

  async function handleSubmitForReview() {
    const missing = [];
    if (!personalComplete) missing.push('Personal information');
    if (!bankComplete)     missing.push('Bank details');
    if (!panComplete)      missing.push('PAN number');
    if (!idProofUploaded)  missing.push('ID proof document');
    if (missing.length) { toast.error(`Please complete: ${missing.join(', ')}`); return; }
    setSubmitting(true);
    try {
      await api.put('/affiliates/kyc', { ...formData, submit: true });
      toast.success('KYC submitted for review!');
      invalidateCache('affiliate-kyc');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Submit failed');
    } finally { setSubmitting(false); }
  }

  // ── Step content ──────────────────────────────────────────────────────────────

  function renderStep() {
    const s = locked ? 3 : step;
    // Step 0 — Personal Information
    if (s === 0) return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Personal Information</h2>
          <p className="text-sm text-secondary-400 mt-0.5">Fill in your details exactly as on your government ID</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Full Name *</label>
            <input className="input w-full" value={formData.fullName} onChange={setForm('fullName')} placeholder="As on your ID" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Address *</label>
            <input className="input w-full" value={formData.address} onChange={setForm('address')} placeholder="Street address" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">City *</label>
            <input className="input w-full" value={formData.city} onChange={setForm('city')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">State *</label>
            <input className="input w-full" value={formData.state} onChange={setForm('state')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Country *</label>
            <input className="input w-full" value={formData.country} onChange={setForm('country')} placeholder="India" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">PIN Code *</label>
            <input className="input w-full" value={formData.zipCode} onChange={setForm('zipCode')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number *</label>
            <input className="input w-full" type="tel" value={formData.phoneNumber} onChange={setForm('phoneNumber')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ID Type *</label>
            <select className="input w-full" value={formData.idType} onChange={setForm('idType')}>
              <option value="">Select ID type</option>
              {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">ID Number *</label>
            <input className="input w-full" value={formData.idNumber} onChange={setForm('idNumber')} placeholder="As printed on your ID" />
          </div>
        </div>

        {/* GST */}
        <div className="border-t border-secondary-100 pt-4">
          <label className="block text-sm font-medium mb-1">
            GST Number <span className="text-secondary-400 font-normal">(Optional)</span>
          </label>
          <p className="text-xs text-secondary-400 mb-2">Have a GST number? Verify it here</p>
          <div className="flex gap-2">
            <input
              className={`input flex-1 uppercase ${gstVerified ? 'border-green-400 focus:ring-green-400' : ''}`}
              placeholder="Enter GSTIN"
              value={gstNumber}
              onChange={(e) => { setGstNumber(e.target.value); setGstVerified(false); setGstDetails(null); setGstError(''); }}
            />
            <Button type="button" variant="primary" loading={gstVerifying} onClick={handleVerifyGst} disabled={!gstNumber.trim() || gstVerifying}>
              Verify GST
            </Button>
          </div>
          {gstError && <p className="text-xs text-red-500 mt-1">{gstError}</p>}
          {gstVerified && gstDetails && (
            <div className="mt-2 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700 space-y-0.5">
              <p className="font-semibold text-green-800 flex items-center gap-1"><Check size={13} /> GST Verified</p>
              {gstDetails.tradeName && <p>Trade Name: <strong>{gstDetails.tradeName}</strong></p>}
              {gstDetails.legalName && <p>Legal Name: <strong>{gstDetails.legalName}</strong></p>}
              {gstDetails.status    && <p>Status: <strong>{gstDetails.status}</strong></p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-secondary-100">
          <span className="text-xs text-secondary-400">Step 1 of 4</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => handleSaveInfo(false)} loading={savingInfo}>
              Save
            </Button>
            <Button type="button" onClick={() => handleSaveInfo(true)} loading={savingInfo}>
              Save & Continue <ChevronRight size={15} className="ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );

    // Step 1 — Documents
    if (s === 1) return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold">Required Documents</h2>
          <p className="text-sm text-secondary-400 mt-0.5">Upload clear copies — PDF or image, max 5MB each</p>
        </div>

        {DOC_SLOTS.map((slot) => {
          const slotDocs = docs.filter((d) => d.type === slot.type);
          const uploading = uploadingDoc === slot.type;
          const uploaded  = slotDocs.length > 0;
          return (
            <div key={slot.type} className={`rounded-xl border p-4 space-y-3 ${uploaded ? 'border-green-200 bg-green-50/40' : 'border-secondary-200 bg-white'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    {uploaded && <CheckCircle2 size={14} className="text-green-500" />}
                    {slot.label}
                    {slot.required && !uploaded && <span className="text-red-500">*</span>}
                    {!slot.required && <span className="text-secondary-400 font-normal">(Optional)</span>}
                  </p>
                  <p className="text-xs text-secondary-400 mt-0.5">{slot.desc}</p>
                </div>
              </div>
              {slotDocs.map((doc) => (
                <div key={doc._id} className="flex items-center gap-2 text-sm text-secondary-600 bg-white rounded-lg border border-secondary-100 px-3 py-2">
                  <FileText size={14} className="text-primary-500 shrink-0" />
                  <a href={typeof doc.url === 'object' ? doc.url.url : doc.url} target="_blank" rel="noreferrer" className="flex-1 truncate hover:underline text-primary-600">
                    {doc.filename || 'Document'}
                  </a>
                  <button onClick={() => handleDeleteDoc(doc._id)} className="text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => triggerDocUpload(slot.type)}
                disabled={!!uploadingDoc}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Uploading…' : uploaded ? 'Replace Document' : 'Upload Document'}
              </button>
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-2 border-t border-secondary-100">
          <button type="button" onClick={() => setStep(0)} className="btn-secondary flex items-center gap-1.5 text-sm">
            <ChevronLeft size={15} /> Back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-secondary-400">Step 2 of 4</span>
            <Button type="button" onClick={() => setStep(2)}>
              Continue <ChevronRight size={15} className="ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );

    // Step 2 — Bank & PAN
    if (s === 2) return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <IndianRupee size={16} className="text-primary-600" /> Bank & PAN Details
          </h2>
          <p className="text-sm text-secondary-400 mt-0.5">Required to receive your commission payouts</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Account Holder Name</label>
            <input className="input w-full" placeholder="Full name as per bank account" value={paymentData.accountHolderName} onChange={setPay('accountHolderName')} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Bank Name</label>
            <input className="input w-full" placeholder="Enter bank name" value={paymentData.bankName} onChange={setPay('bankName')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Account Number *</label>
            <input className="input w-full" placeholder="Enter account number" value={paymentData.accountNumber} onChange={setPay('accountNumber')} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">IFSC Code *</label>
            <input
              className="input w-full uppercase"
              placeholder="Enter IFSC code"
              maxLength={11}
              value={paymentData.ifscCode}
              onChange={(e) => setPaymentData((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">UPI ID <span className="text-secondary-400 font-normal">(Optional)</span></label>
            <input className="input w-full" placeholder="yourname@upi" value={paymentData.upiId} onChange={setPay('upiId')} />
          </div>
        </div>

        <div className="border-t border-secondary-100 pt-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">PAN Number <span className="text-red-500">*</span></p>
            <p className="text-xs text-amber-600 mt-0.5">Mandatory for TDS compliance — 2% TDS deducted on all payouts</p>
          </div>
          <input
            className="input w-full uppercase"
            placeholder="ABCDE1234F"
            maxLength={10}
            value={paymentData.panNumber}
            onChange={(e) => setPaymentData((f) => ({ ...f, panNumber: e.target.value.toUpperCase() }))}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-secondary-100">
          <button type="button" onClick={() => setStep(1)} className="btn-secondary flex items-center gap-1.5 text-sm">
            <ChevronLeft size={15} /> Back
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-secondary-400">Step 3 of 4</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => handleSaveBank(false)} loading={savingBank}>Save</Button>
              <Button type="button" onClick={() => handleSaveBank(true)} loading={savingBank}>
                Save & Continue <ChevronRight size={15} className="ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );

    // Step 3 — Review & Submit
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold">Review & Submit</h2>
          <p className="text-sm text-secondary-400 mt-0.5">Make sure everything is complete before submitting</p>
        </div>

        <div className="rounded-xl border border-secondary-200 divide-y divide-secondary-100">
          {[
            { done: personalComplete, label: 'Personal information filled',  step: 0 },
            { done: idProofUploaded,  label: 'ID proof document uploaded',   step: 1 },
            { done: bankComplete,     label: 'Bank details saved',           step: 2 },
            { done: panComplete,      label: 'PAN number added',             step: 2 },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <CheckItem done={item.done} label={item.label} />
              {!item.done && (
                <button type="button" onClick={() => setStep(item.step)} className="text-xs text-primary-600 hover:underline font-medium shrink-0 ml-3">
                  Fix →
                </button>
              )}
            </div>
          ))}
        </div>

        {isPending ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-200 bg-yellow-50">
            <Clock size={18} className="text-yellow-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-yellow-800">KYC Under Review</p>
              <p className="text-xs text-yellow-600 mt-0.5">Our team will review your documents within 1–2 business days.</p>
            </div>
          </div>
        ) : isApproved ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50">
            <ShieldCheck size={20} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-800">KYC Approved</p>
              <p className="text-xs text-green-600 mt-0.5">Your identity is verified. Commission payouts are enabled.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {(!personalComplete || !bankComplete || !panComplete || !idProofUploaded) && (
              <p className="text-xs text-secondary-400">Complete all required sections above before submitting.</p>
            )}
            <Button
              type="button"
              onClick={handleSubmitForReview}
              loading={submitting}
              disabled={submitting || !personalComplete || !bankComplete || !panComplete || !idProofUploaded}
              className="w-full sm:w-auto"
            >
              Submit for Review
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-secondary-100">
          <span className="text-xs text-secondary-400">Step 4 of 4</span>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleDocFileChange} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield size={22} className="text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold">KYC Verification</h1>
            <p className="text-secondary-500 text-sm">Complete your verification to receive payouts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { invalidateCache('affiliate-kyc'); setRev((r) => r + 1); }} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}>
            <StatusIcon size={14} /> {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Rejection banner */}
      {kycStatus === 'rejected' && kyc.rejectionReason && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
          <ShieldX size={16} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700">Your KYC was rejected</p>
            <p className="text-sm text-red-600 mt-0.5">{kyc.rejectionReason}</p>
            <p className="text-xs text-red-500 mt-1">Update your information and resubmit for review.</p>
          </div>
        </div>
      )}

      {/* Step wizard card */}
      <div className="card p-5 sm:p-6">
        <StepBar current={locked ? 3 : step} onGo={setStep} locked={locked} />
        {renderStep()}
      </div>

    </div>
  );
}
