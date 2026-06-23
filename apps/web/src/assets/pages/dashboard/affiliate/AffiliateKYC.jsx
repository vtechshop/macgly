import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, ShieldCheck, ShieldX, Clock, AlertCircle, RefreshCw,
  Upload, X, Check, Loader2, IndianRupee, FileText, Lock,
  CheckCircle2, Circle, ChevronDown,
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
  { value: 'passport',         label: 'Passport' },
  { value: 'drivers_license',  label: "Driver's License" },
  { value: 'national_id',      label: 'National ID / Aadhaar' },
  { value: 'other',            label: 'Other' },
];

const DOC_SLOTS = [
  { type: 'id_proof',       label: 'ID Proof',          desc: 'Upload a copy of your government-issued ID',         required: true },
  { type: 'address_proof',  label: 'Address Proof',     desc: 'Uploads utility bill or bank statement showing your address', required: true },
  { type: 'tax_document',   label: 'Tax Document',      desc: 'Upload tax identification documents if applicable',   required: false },
];

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CheckItem({ done, label }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${done ? 'text-green-700' : 'text-secondary-500'}`}>
      {done
        ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
        : <Circle       size={16} className="text-secondary-300 shrink-0" />
      }
      {label}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AffiliateKYC() {
  const [rev, setRev] = useState(0);

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
  const [uploadingDoc, setUploadingDoc] = useState(null); // type being uploaded
  const fileInputRef = useRef(null);
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

  // Pre-fill on load
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

  // ── Error states ──────────────────────────────────────────────────────────

  const errStatus = error?.response?.status;

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (errStatus === 404) {
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

  // ── Derived state ─────────────────────────────────────────────────────────

  const kyc       = kycData?.kyc || {};
  const kycStatus = kyc.status || 'not_submitted';
  const statusCfg = STATUS_CFG[kycStatus] || STATUS_CFG.not_submitted;
  const StatusIcon = statusCfg.icon;
  const docs      = kyc.documents || [];
  const isApproved = kycStatus === 'approved' || kycStatus === 'verified';
  const isPending  = kycStatus === 'pending';

  // Checklist
  const personalComplete = !!(formData.fullName && formData.phoneNumber && formData.idType && formData.idNumber && formData.address && formData.city && formData.state && formData.country);
  const bankComplete     = !!(kycData?.paymentDetails?.accountNumber && kycData?.paymentDetails?.ifscCode);
  const panComplete      = !!(kycData?.panNumber || paymentData.panNumber);
  const idProofUploaded  = docs.some((d) => d.type === 'id_proof');

  // ── Handlers ─────────────────────────────────────────────────────────────

  function setForm(k) { return (e) => setFormData((f) => ({ ...f, [k]: e.target.value })); }
  function setPay(k)  { return (e) => setPaymentData((f) => ({ ...f, [k]: e.target.value })); }

  async function handleVerifyGst() {
    if (!gstNumber.trim()) return;
    setGstVerifying(true);
    setGstError('');
    setGstVerified(false);
    setGstDetails(null);
    try {
      const { data } = await api.post('/vendors/gst/verify', { gstNumber: gstNumber.toUpperCase() });
      if (data.active) {
        setGstVerified(true);
        setGstDetails(data.data);
        toast.success('GST verified!');
      } else {
        setGstError('GST number is inactive or invalid');
      }
    } catch (err) {
      setGstError(err.response?.data?.error?.message || 'GST verification failed');
    } finally {
      setGstVerifying(false);
    }
  }

  async function handleSaveInfo(e) {
    e.preventDefault();
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
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSavingInfo(false);
    }
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
      // Step 1: upload file
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'kyc-documents');
      const { data: uploadData } = await api.post('/upload', fd);
      const url = uploadData.url || uploadData.secure_url;
      // Step 2: save document reference
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
    } catch {
      toast.error('Could not delete document');
    }
  }

  async function handleSaveBank(e) {
    e.preventDefault();
    const pan = paymentData.panNumber.toUpperCase();
    if (pan && !PAN_REGEX.test(pan)) {
      toast.error('Invalid PAN number format (e.g. ABCDE1234F)');
      return;
    }
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
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSavingBank(false);
    }
  }

  async function handleSubmitForReview() {
    // Client-side validation
    const missing = [];
    if (!personalComplete) missing.push('Personal information');
    if (!bankComplete)     missing.push('Bank details');
    if (!panComplete)      missing.push('PAN number');
    if (!idProofUploaded)  missing.push('ID proof document');
    if (missing.length) {
      toast.error(`Please complete: ${missing.join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      await api.put('/affiliates/kyc', { ...formData, submit: true });
      toast.success('KYC submitted for review!');
      invalidateCache('affiliate-kyc');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
        onChange={handleDocFileChange} className="hidden" />

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

      {/* ── Personal Information ─────────────────────────────────────────────── */}
      <form onSubmit={handleSaveInfo} className="card p-5 space-y-4">
        <h2 className="font-semibold text-base">Personal Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Full Name *</label>
            <input className="input w-full" value={formData.fullName} onChange={setForm('fullName')} required />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Address *</label>
            <input className="input w-full" value={formData.address} onChange={setForm('address')} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">City *</label>
            <input className="input w-full" value={formData.city} onChange={setForm('city')} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">State / Province *</label>
            <input className="input w-full" value={formData.state} onChange={setForm('state')} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Country *</label>
            <input className="input w-full" value={formData.country} onChange={setForm('country')} placeholder="India" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ZIP / Postal Code *</label>
            <input className="input w-full" value={formData.zipCode} onChange={setForm('zipCode')} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number *</label>
            <input className="input w-full" type="tel" value={formData.phoneNumber} onChange={setForm('phoneNumber')} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ID Type *</label>
            <select className="input w-full" value={formData.idType} onChange={setForm('idType')} required>
              <option value="">Select ID type</option>
              {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">ID Number *</label>
            <input className="input w-full" value={formData.idNumber} onChange={setForm('idNumber')} required />
          </div>
        </div>

        {/* GST */}
        <div>
          <label className="block text-sm font-medium mb-1">
            GST Number <span className="text-secondary-400 font-normal">(Optional)</span>
          </label>
          <p className="text-xs text-secondary-400 mb-1.5">Have a GST number, you can verify it here</p>
          <div className="flex gap-2">
            <input
              className={`input flex-1 uppercase ${gstVerified ? 'border-green-400 focus:ring-green-400' : ''}`}
              placeholder="Enter GSTIN"
              value={gstNumber}
              onChange={(e) => { setGstNumber(e.target.value); setGstVerified(false); setGstDetails(null); setGstError(''); }}
            />
            <Button
              type="button"
              variant="primary"
              loading={gstVerifying}
              onClick={handleVerifyGst}
              disabled={!gstNumber.trim() || gstVerifying}
            >
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

        <div className="flex justify-end pt-1">
          <Button type="submit" loading={savingInfo}>Save Information</Button>
        </div>
      </form>

      {/* ── Required Documents ────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-base">Required Documents</h2>
        {DOC_SLOTS.map((slot) => {
          const slotDocs = docs.filter((d) => d.type === slot.type);
          const uploading = uploadingDoc === slot.type;
          return (
            <div key={slot.type} className="space-y-2">
              <div>
                <p className="text-sm font-semibold">
                  {slot.label}
                  {slot.required && <span className="text-red-500 ml-1">*</span>}
                  {!slot.required && <span className="text-secondary-400 font-normal ml-1">(Optional)</span>}
                </p>
                <p className="text-xs text-secondary-400">{slot.desc}</p>
              </div>
              {slotDocs.map((doc) => (
                <div key={doc._id} className="flex items-center gap-2 text-sm text-secondary-600 bg-secondary-50 rounded-lg px-3 py-2">
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
                {uploading ? 'Uploading…' : 'Upload Document'}
              </button>
            </div>
          );
        })}
        <p className="text-xs text-secondary-400">Accepted: JPG, PNG, PDF — max 5MB each</p>
      </div>

      {/* ── Bank Account Details ──────────────────────────────────────────────── */}
      <form onSubmit={handleSaveBank} className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-primary-600">
          <IndianRupee size={16} />
          <h2 className="font-semibold text-base">Bank Account Details <span className="text-secondary-400 font-normal text-sm">(For Payouts)</span></h2>
        </div>
        <p className="text-xs text-secondary-400">Add your bank details to receive commission payouts</p>

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
            <input className="input w-full" placeholder="Enter UPI ID" value={paymentData.upiId} onChange={setPay('upiId')} />
          </div>
        </div>

        <div className="border-t border-secondary-100 pt-4 space-y-2">
          <p className="text-sm font-semibold">PAN Details <span className="text-red-500">*</span> <span className="text-secondary-400 font-normal">(Required for Payouts)</span></p>
          <p className="text-xs text-amber-600">PAN is mandatory for TDS compliance. 2% TDS will be deducted on all payouts.</p>
          <label className="block text-sm font-medium mb-1">PAN Number *</label>
          <input
            className="input w-full uppercase"
            placeholder="Enter PAN number"
            maxLength={10}
            value={paymentData.panNumber}
            onChange={(e) => setPaymentData((f) => ({ ...f, panNumber: e.target.value.toUpperCase() }))}
          />
        </div>

        <div className="flex justify-end pt-1">
          <Button type="submit" loading={savingBank} variant="primary" className="bg-green-600 hover:bg-green-700">
            Save Bank Details
          </Button>
        </div>
      </form>

      {/* ── Submit for Review ─────────────────────────────────────────────────── */}
      {!isApproved && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-base">Submit for Review</h2>

          {/* Checklist */}
          <div className="space-y-2">
            <CheckItem done={personalComplete} label="Personal information filled" />
            <CheckItem done={bankComplete}     label="Bank details saved" />
            <CheckItem done={panComplete}      label="PAN number added" />
            <CheckItem done={idProofUploaded}  label="ID proof uploaded" />
          </div>

          {isPending ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-200 bg-yellow-50">
              <Clock size={18} className="text-yellow-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-yellow-800">KYC Under Review</p>
                <p className="text-xs text-yellow-600 mt-0.5">Our team is reviewing your documents. This usually takes 1–2 business days.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(!personalComplete || !bankComplete || !panComplete || !idProofUploaded) && (
                <p className="text-xs text-secondary-400">Complete all required fields above before submitting.</p>
              )}
              <Button
                type="button"
                onClick={handleSubmitForReview}
                loading={submitting}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                Submit for Review
              </Button>
            </div>
          )}
        </div>
      )}

      {isApproved && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50">
          <ShieldCheck size={20} className="text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-800">KYC Approved</p>
            <p className="text-xs text-green-600 mt-0.5">Your identity has been verified. Commission payouts are enabled.</p>
          </div>
        </div>
      )}

      {/* ── Verification Process Info ─────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2 text-secondary-700">
          <Lock size={15} className="text-secondary-400" />
          <h3 className="font-semibold text-sm">Verification Process</h3>
        </div>
        <ul className="space-y-2">
          {[
            'Fill in your personal information and click "Save Information"',
            'Upload your ID proof and address proof documents (PDF or image)',
            'Add your bank account details for receiving commission payouts',
            'Add your PAN number for TDS compliance',
            'Click "Submit for Review" once all required fields are complete',
            'Our team will review your submission within 1–2 business days',
            "You'll receive a notification once your KYC is approved or if any changes are needed",
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-xs text-secondary-500">
              <span className="w-4 h-4 bg-secondary-100 text-secondary-500 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ul>
        <div className="flex gap-3 mt-2 text-xs text-secondary-400">
          <div className="flex gap-1.5"><IndianRupee size={13} className="text-primary-500 shrink-0" /><span>Required by RBI for commission payouts above ₹10,000</span></div>
        </div>
      </div>

    </div>
  );
}
