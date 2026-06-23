import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  ShieldCheck, Building2, Phone, FileText, CreditCard, User, CheckCircle2,
  XCircle, Clock, AlertCircle, Upload, Trash2, Eye, RefreshCw, ChevronDown, ChevronUp,
  Check, X,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import { setUser } from '../../../../store/slices/authSlice';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  { value: 'sole_proprietorship', label: 'Individual / Sole Proprietor' },
  { value: 'partnership',         label: 'Partnership' },
  { value: 'private_limited',     label: 'Private Limited' },
  { value: 'public_limited',      label: 'Public Limited' },
  { value: 'llp',                 label: 'LLP' },
  { value: 'other',               label: 'Other' },
];

const DOC_TYPES = [
  { key: 'id_proof',         label: 'Owner ID Proof',    icon: User,       required: true  },
  { key: 'address_proof',    label: 'Address Proof',     icon: FileText,   required: true  },
  { key: 'business_license', label: 'Business License',  icon: Building2,  required: false },
  { key: 'tax_certificate',  label: 'Tax Certificate',   icon: CreditCard, required: false },
];

const FAQS = [
  { q: 'What documents are accepted?', a: 'Business License, GST Certificate, PAN, Aadhaar, Passport. JPG/PNG/PDF under 5MB.' },
  { q: 'How long does verification take?', a: '2-3 business days. You will receive an email notification upon approval.' },
  { q: 'Why is GST mandatory?', a: 'GST verification ensures tax compliance and confirms your business legitimacy.' },
  { q: 'What if my application is rejected?', a: 'The admin will provide a reason. Fix the specific issue shown and resubmit.' },
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ steps }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, i) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
              step.status === 'completed' ? 'bg-green-500 border-green-500 text-white' :
              step.status === 'current'   ? 'bg-primary-600 border-primary-600 text-white' :
              'bg-white border-secondary-200 text-secondary-400'
            }`}>
              {step.status === 'completed' ? <Check size={15} /> : step.number}
            </div>
            <div className="mt-1.5 text-center">
              <p className={`text-xs font-semibold ${step.status === 'pending' ? 'text-secondary-400' : 'text-secondary-700'}`}>
                {step.title}
              </p>
              <p className={`text-[10px] ${
                step.status === 'completed' ? 'text-green-600' :
                step.status === 'current'   ? 'text-primary-600' : 'text-secondary-300'
              }`}>
                {step.status === 'completed' ? 'Done' : step.status === 'current' ? 'In progress' : 'Required'}
              </p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-6 ${step.status === 'completed' ? 'bg-green-400' : 'bg-secondary-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }) {
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-secondary-500 mb-1.5">
        <span>Overall completion</span><span>{pct}%</span>
      </div>
      <div className="h-2 bg-secondary-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, complete }) {
  return (
    <div className={`flex items-center gap-3 mb-4 pb-3 border-b ${complete ? 'border-green-200' : 'border-secondary-100'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${complete ? 'bg-green-50' : 'bg-primary-50'}`}>
        <Icon size={17} className={complete ? 'text-green-600' : 'text-primary-600'} />
      </div>
      <h2 className="font-bold text-secondary-900">{title}</h2>
      {complete && <CheckCircle2 size={17} className="text-green-500 ml-auto" />}
    </div>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────

function DocCard({ docType, uploadedDoc, onUpload, onDelete, uploading }) {
  const Icon = docType.icon;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5MB'); return; }
    onUpload(docType.key, file);
    e.target.value = '';
  }

  return (
    <div className={`border-2 rounded-xl p-4 transition-colors ${
      uploadedDoc ? 'border-green-200 bg-green-50' : 'border-dashed border-orange-200 bg-orange-50/30'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={15} className={uploadedDoc ? 'text-green-600' : 'text-orange-500'} />
          <span className="text-sm font-semibold text-secondary-800">{docType.label}</span>
        </div>
        {docType.required ? (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${uploadedDoc ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {uploadedDoc ? '✓ Uploaded' : 'Required'}
          </span>
        ) : (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-500">
            {uploadedDoc ? '✓ Uploaded' : 'Optional'}
          </span>
        )}
      </div>

      {uploadedDoc ? (
        <div className="flex items-center gap-2 mt-2">
          <FileText size={13} className="text-green-500 shrink-0" />
          <span className="text-xs text-secondary-600 truncate flex-1">{uploadedDoc.filename}</span>
          <a href={uploadedDoc.url} target="_blank" rel="noreferrer" className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="View">
            <Eye size={13} />
          </a>
          <button onClick={() => onDelete(uploadedDoc._id)} className="p-1 text-red-400 hover:bg-red-50 rounded" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <label className={`flex items-center gap-2 mt-2 cursor-pointer text-xs font-medium px-3 py-2 rounded-lg border border-dashed border-secondary-300 bg-white hover:bg-secondary-50 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? <Spinner size="sm" /> : <Upload size={13} />}
          {uploading ? 'Uploading…' : 'Choose file (JPG, PNG, PDF)'}
          <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFile} />
        </label>
      )}
    </div>
  );
}

// ─── FAQ Accordion ────────────────────────────────────────────────────────────

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-secondary-100 last:border-0">
      <button className="w-full flex items-center justify-between py-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="text-sm font-medium text-secondary-800">{q}</span>
        {open ? <ChevronUp size={15} className="text-secondary-400 shrink-0" /> : <ChevronDown size={15} className="text-secondary-400 shrink-0" />}
      </button>
      {open && <p className="text-xs text-secondary-500 pb-3">{a}</p>}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function VendorKYC() {
  const dispatch = useDispatch();
  const [rev, setRev] = useState(0);

  const [formData, setFormData] = useState({
    businessName: '', businessType: '', businessAddress: '', taxId: '', phoneNumber: '',
  });
  const [formLoaded, setFormLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [gstVerifying, setGstVerifying] = useState(false);
  const [gstVerified, setGstVerified] = useState(false);
  const [gstDetails, setGstDetails] = useState(null);
  const [gstError, setGstError] = useState('');

  const [uploadingDoc, setUploadingDoc] = useState(null);

  const { data: kycData, isLoading: kycLoading } = useFetch(
    ['vendor-kyc', rev],
    () => api.get('/vendors/kyc').then((r) => r.data.data),
  );

  useEffect(() => {
    if (kycData && !formLoaded) {
      setFormData({
        businessName:    kycData.businessName || '',
        businessType:    kycData.businessType || '',
        businessAddress: kycData.businessAddress || '',
        taxId:           kycData.taxId || '',
        phoneNumber:     kycData.phoneNumber || '',
      });
      setGstVerified(kycData.gstVerified || false);
      setGstDetails(kycData.gstDetails || null);
      setFormLoaded(true);
    }
  }, [kycData, formLoaded]);

  const { data: kycStats } = useFetch(
    ['vendor-kyc-stats', rev],
    () => api.get('/vendors/kyc/stats').then((r) => r.data),
  );

  const kyc = kycData || {};
  const docs = kyc.documents || [];
  const status = kyc.status || 'not_submitted';
  const steps = kycStats?.steps || [
    { number: 1, title: 'Business Info', status: 'current' },
    { number: 2, title: 'GST Verify',    status: 'pending' },
    { number: 3, title: 'Documents',     status: 'pending' },
    { number: 4, title: 'Approved',      status: 'pending' },
  ];
  const overallPct = kycStats?.completion?.overall || 0;
  const businessInfoComplete = kycStats?.completion?.businessInfo?.percentage === 100;
  const isSubmitted = status === 'pending';
  const isApproved  = status === 'approved';
  const isRejected  = status === 'rejected';

  function setField(k) { return (e) => setFormData((p) => ({ ...p, [k]: e.target.value })); }

  async function saveBusinessInfo() {
    setSaving(true);
    try {
      await api.put('/vendors/kyc', formData);
      toast.success('Business info saved');
      setRev((r) => r + 1);
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  async function verifyGST() {
    const gstin = formData.taxId.trim().toUpperCase();
    if (!gstin) { setGstError('Enter a GSTIN number'); return; }
    setGstVerifying(true);
    setGstError('');
    try {
      const { data } = await api.post('/vendors/gst/verify', { gstNumber: gstin });
      setGstVerified(true);
      setGstDetails(data.data);
      if (!data.active) toast.info('GST verified but currently inactive');
      else toast.success('GST verified successfully');
      // Auto-fill business name and address from GST
      setFormData((p) => ({
        ...p,
        businessName: p.businessName || data.data.tradeName || data.data.legalName || p.businessName,
        businessAddress: p.businessAddress || data.data.address || p.businessAddress,
      }));
      // Save GST data
      await api.put('/vendors/kyc', {
        ...formData,
        taxId: gstin,
        gstVerified: true,
        gstDetails: data.data,
      });
      setRev((r) => r + 1);
    } catch (e) {
      setGstError(e.response?.data?.error?.message || 'GST verification failed');
      setGstVerified(false);
    } finally { setGstVerifying(false); }
  }

  function handleTaxIdChange(e) {
    setFormData((p) => ({ ...p, taxId: e.target.value }));
    if (gstVerified) { setGstVerified(false); setGstDetails(null); }
    setGstError('');
  }

  async function uploadDocument(type, file) {
    setUploadingDoc(type);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'kyc-documents');
      const uploadRes = await api.post('/upload', fd);
      await api.post('/vendors/kyc/documents', {
        type,
        url: uploadRes.data.url,
        filename: file.name,
      });
      toast.success('Document uploaded');
      setRev((r) => r + 1);
    } catch {
      toast.error('Upload failed');
    } finally { setUploadingDoc(null); }
  }

  async function deleteDocument(docId) {
    try {
      await api.delete(`/vendors/kyc/documents/${docId}`);
      toast.success('Document removed');
      setRev((r) => r + 1);
    } catch {
      toast.error('Delete failed');
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.put('/vendors/kyc', { ...formData, gstVerified, gstDetails, submit: true });
      toast.success('Application submitted for review!');
      setRev((r) => r + 1);
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Submission failed');
    } finally { setSubmitting(false); }
  }

  async function refreshStatus() {
    setRefreshing(true);
    try {
      const { data } = await api.get('/auth/me');
      dispatch(setUser(data.data || data.user));
      setRev((r) => r + 1);
      toast.success('Status refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally { setRefreshing(false); }
  }

  const checklist = [
    { label: 'Business information filled', done: businessInfoComplete },
    { label: 'GST number verified', done: gstVerified },
    { label: 'ID proof uploaded', done: docs.some((d) => d.type === 'id_proof') },
    { label: 'Address proof uploaded', done: docs.some((d) => d.type === 'address_proof') },
  ];

  if (kycLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 flex items-center gap-2">
            <ShieldCheck size={24} className="text-primary-600" /> KYC Verification
          </h1>
          <p className="text-sm text-secondary-500 mt-0.5">
            Complete your business verification to get full dashboard access
          </p>
        </div>
        <button onClick={refreshStatus} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 disabled:opacity-50">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Approved Banner */}
      {isApproved && (
        <div className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 size={28} />
            <div>
              <h2 className="font-bold text-lg">🎉 Congratulations! Your account is verified</h2>
              <p className="text-green-100 text-sm">You now have full access to all vendor features</p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Link to="/dashboard/vendor/products"
              className="px-4 py-2 bg-white text-green-700 rounded-lg text-sm font-semibold hover:bg-green-50">
              Add Products →
            </Link>
            <Link to="/dashboard/vendor/settings"
              className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/30">
              Store Settings →
            </Link>
          </div>
        </div>
      )}

      {/* Rejected Banner */}
      {isRejected && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-red-700">⚠️ Application Rejected</p>
            {kyc.rejectionReason && (
              <p className="text-sm text-red-600 mt-1">Reason: {kyc.rejectionReason}</p>
            )}
            <p className="text-xs text-red-500 mt-1">Please update your information and resubmit.</p>
          </div>
        </div>
      )}

      {/* Under Review Banner */}
      {isSubmitted && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <Clock size={20} className="text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm text-blue-700">⏱ Application Under Review</p>
            <p className="text-sm text-blue-600 mt-0.5">Your application is under review. We'll notify you via email once processed.</p>
          </div>
        </div>
      )}

      {/* Stepper */}
      <StepIndicator steps={steps} />
      <ProgressBar pct={overallPct} />

      {/* Section 1: Business Information */}
      <div className="card p-5">
        <SectionHeader icon={Building2} title="Business Information" complete={businessInfoComplete} />
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input className="input w-full" placeholder="Enter business name"
              value={formData.businessName} onChange={setField('businessName')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">
              Business Type <span className="text-red-500">*</span>
            </label>
            <select className="input w-full" value={formData.businessType} onChange={setField('businessType')}>
              <option value="">Select business type</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">
              Business Address <span className="text-red-500">*</span>
            </label>
            <textarea className="input w-full resize-none" rows={3}
              placeholder="Full registered business address"
              value={formData.businessAddress} onChange={setField('businessAddress')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1.5">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
              <input className="input w-full pl-8" type="tel" placeholder="10-digit mobile number"
                value={formData.phoneNumber} onChange={setField('phoneNumber')} />
            </div>
          </div>
          <button onClick={saveBusinessInfo} disabled={saving}
            className="px-4 py-2 bg-primary-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Business Info'}
          </button>
        </div>
      </div>

      {/* Section 2: GST Verification */}
      <div className="card p-5">
        <SectionHeader icon={FileText} title="GST Verification" complete={gstVerified} />
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1.5">
            GSTIN <span className="text-red-500">*</span>
            <span className="text-secondary-400 font-normal ml-1">(mandatory)</span>
          </label>
          <div className="flex gap-2">
            <input
              className={`input flex-1 uppercase font-mono ${gstVerified ? 'border-green-400 bg-green-50' : ''}`}
              placeholder="22AAAAA0000A1Z5"
              value={formData.taxId}
              onChange={handleTaxIdChange}
              maxLength={15}
              disabled={gstVerified}
            />
            <button
              onClick={verifyGST}
              disabled={gstVerifying || gstVerified}
              className={`px-4 py-2 rounded-lg text-sm font-semibold shrink-0 transition-colors ${
                gstVerified
                  ? 'bg-green-500 text-white cursor-default'
                  : 'bg-primary-600 hover:bg-blue-700 text-white disabled:opacity-50'
              }`}
            >
              {gstVerifying ? <Spinner size="sm" /> : gstVerified ? '✓ Verified' : 'Verify GST'}
            </button>
          </div>
          {gstError && <p className="text-xs text-red-500 mt-1">{gstError}</p>}

          {gstVerified && gstDetails && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl text-sm space-y-1">
              <p><span className="text-secondary-500">Trade Name:</span> <span className="font-medium">{gstDetails.tradeName}</span></p>
              <p><span className="text-secondary-500">Legal Name:</span> <span className="font-medium">{gstDetails.legalName}</span></p>
              <p><span className="text-secondary-500">GST Number:</span> <span className="font-mono font-medium">{gstDetails.gstNumber}</span></p>
              <p>
                <span className="text-secondary-500">Status:</span>{' '}
                <span className={`font-semibold ${gstDetails.status === 'Active' ? 'text-green-600' : 'text-red-500'}`}>
                  {gstDetails.status}
                </span>
              </p>
            </div>
          )}

          {gstVerified && (
            <button onClick={() => { setGstVerified(false); setGstDetails(null); setFormData((p) => ({ ...p, taxId: '' })); }}
              className="mt-2 text-xs text-secondary-400 hover:text-secondary-600 underline">
              Change GSTIN
            </button>
          )}
        </div>
      </div>

      {/* Section 3: Documents */}
      <div className="card p-5">
        <SectionHeader
          icon={FileText}
          title="Required Documents"
          complete={docs.some((d) => d.type === 'id_proof') && docs.some((d) => d.type === 'address_proof')}
        />
        <p className="text-xs text-secondary-400 mb-4">JPG/PNG/PDF only · Max 5MB per file</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DOC_TYPES.map((dt) => (
            <DocCard
              key={dt.key}
              docType={dt}
              uploadedDoc={docs.find((d) => d.type === dt.key)}
              onUpload={uploadDocument}
              onDelete={deleteDocument}
              uploading={uploadingDoc === dt.key}
            />
          ))}
        </div>
      </div>

      {/* Section 4: Submit for Review */}
      {!isApproved && (
        <div className="card p-5">
          <SectionHeader icon={ShieldCheck} title="Submit for Review" complete={isSubmitted} />

          <div className="space-y-2 mb-5">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                {item.done
                  ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                  : <AlertCircle size={16} className="text-secondary-300 shrink-0" />}
                <span className={item.done ? 'text-secondary-700' : 'text-secondary-400'}>{item.label}</span>
              </div>
            ))}
          </div>

          {isSubmitted ? (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
              <Clock size={16} />
              Your application is under review. We'll notify you via email.
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || isSubmitted}
              className="w-full py-3 bg-primary-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          )}
        </div>
      )}

      {/* FAQs */}
      <div className="card p-5">
        <h3 className="font-bold text-secondary-800 mb-3">Tips & FAQs</h3>
        {FAQS.map((faq) => <FAQ key={faq.q} q={faq.q} a={faq.a} />)}
      </div>
    </div>
  );
}
