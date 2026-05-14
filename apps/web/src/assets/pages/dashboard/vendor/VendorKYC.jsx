import { useState } from 'react';
import { ShieldCheck, Upload, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import { useSelector } from 'react-redux';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const DOCS = [
  { key: 'gstCertificate', label: 'GST Certificate', hint: 'Upload your GST registration certificate (PDF or image)' },
  { key: 'panCard', label: 'PAN Card', hint: 'Business or proprietor PAN card' },
  { key: 'bankStatement', label: 'Bank Statement / Cancelled Cheque', hint: 'To verify bank account for payouts' },
  { key: 'addressProof', label: 'Address Proof', hint: 'Utility bill, rental agreement, or trade license' },
];

function DocUploader({ label, hint, value, onChange, disabled }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'kyc');
      const res = await api.post('/upload', fd);
      onChange(res.data.url);
      toast.success(`${label} uploaded`);
    } catch {
      toast.error('Upload failed');
    } finally { setUploading(false); }
  }

  return (
    <div className="border border-secondary-200 rounded-xl p-4">
      <p className="font-semibold text-sm mb-0.5">{label}</p>
      <p className="text-xs text-secondary-400 mb-3">{hint}</p>
      {value ? (
        <div className="flex items-center gap-3">
          <CheckCircle size={16} className="text-green-500 shrink-0" />
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate flex-1">{value.split('/').pop()}</a>
          {!disabled && <button onClick={() => onChange('')} className="text-xs text-secondary-400 hover:text-red-500">Remove</button>}
        </div>
      ) : (
        <label className={`flex items-center gap-2 text-sm font-medium cursor-pointer px-3 py-2 border border-dashed border-secondary-300 rounded-lg hover:bg-secondary-50 transition-colors ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? <Spinner size="sm" /> : <Upload size={14} />}
          {uploading ? 'Uploading…' : 'Choose file'}
          <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFile} disabled={disabled} />
        </label>
      )}
    </div>
  );
}

export default function VendorKYC() {
  const { user } = useSelector((s) => s.auth);
  const kycStatus = user?.vendorProfile?.kycStatus || 'pending';
  const isApproved = kycStatus === 'approved';
  const isRejected = kycStatus === 'rejected';
  const isSubmitted = kycStatus === 'submitted';

  const [docs, setDocs] = useState({
    gstCertificate: user?.vendorProfile?.kycDocs?.gstCertificate || '',
    panCard: user?.vendorProfile?.kycDocs?.panCard || '',
    bankStatement: user?.vendorProfile?.kycDocs?.bankStatement || '',
    addressProof: user?.vendorProfile?.kycDocs?.addressProof || '',
  });
  const [submitting, setSubmitting] = useState(false);

  function setDoc(key, value) { setDocs((d) => ({ ...d, [key]: value })); }

  const filled = Object.values(docs).filter(Boolean).length;
  const canSubmit = filled >= 2 && !isApproved && !isSubmitted;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.patch('/vendors/kyc', { docs });
      toast.success('KYC documents submitted for review');
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to submit KYC');
    } finally { setSubmitting(false); }
  }

  const statusBanner = {
    approved: { bg: 'bg-green-50 border-green-200', icon: CheckCircle, color: 'text-green-700', title: 'KYC Approved', msg: 'Your documents have been verified. You can now list products.' },
    submitted: { bg: 'bg-blue-50 border-blue-200', icon: Clock, color: 'text-blue-700', title: 'Under Review', msg: 'Your documents have been submitted and are being reviewed. This usually takes 1-2 business days.' },
    rejected: { bg: 'bg-red-50 border-red-200', icon: XCircle, color: 'text-red-700', title: 'KYC Rejected', msg: `Reason: ${user?.vendorProfile?.kycRejectionReason || 'Please resubmit with valid documents.'}` },
    pending: { bg: 'bg-yellow-50 border-yellow-200', icon: AlertCircle, color: 'text-yellow-700', title: 'KYC Pending', msg: 'Upload your business documents below to get approved to list products.' },
  };

  const banner = statusBanner[kycStatus] || statusBanner.pending;
  const BannerIcon = banner.icon;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck size={22} /> KYC Verification</h1>
        <p className="text-secondary-500 text-sm mt-1">Upload your business documents to get verified and start selling</p>
      </div>

      {/* Status banner */}
      <div className={`flex items-start gap-3 border rounded-xl p-4 ${banner.bg}`}>
        <BannerIcon size={20} className={`${banner.color} shrink-0 mt-0.5`} />
        <div>
          <p className={`font-bold text-sm ${banner.color}`}>{banner.title}</p>
          <p className={`text-sm mt-0.5 ${banner.color}`}>{banner.msg}</p>
        </div>
      </div>

      {/* Document uploads */}
      <div className="card p-5 space-y-4">
        <h2 className="font-bold text-secondary-800">Required Documents</h2>
        <p className="text-xs text-secondary-400">Upload at least 2 documents. GST certificate + PAN card are mandatory for GST billing.</p>
        {DOCS.map((doc) => (
          <DocUploader
            key={doc.key}
            label={doc.label}
            hint={doc.hint}
            value={docs[doc.key]}
            onChange={(v) => setDoc(doc.key, v)}
            disabled={isApproved || isSubmitted}
          />
        ))}
      </div>

      {/* Business info */}
      <div className="card p-5 text-sm text-secondary-600 space-y-1">
        <p className="font-semibold text-secondary-800 mb-2">Business Details on File</p>
        <p>Business: <span className="font-medium">{user?.vendorProfile?.businessName || '—'}</span></p>
        <p>GST: <span className="font-medium">{user?.vendorProfile?.gstNumber || '—'}</span></p>
        <p>Bank: <span className="font-medium">{user?.vendorProfile?.bankAccount?.bankName || '—'}</span></p>
        {!user?.vendorProfile?.businessName && (
          <p className="text-secondary-400 text-xs mt-2">Update your business details in <a href="/dashboard/vendor/settings" className="text-primary-600 hover:underline">Vendor Settings</a> before submitting KYC.</p>
        )}
      </div>

      {canSubmit && (
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Submitting…' : `Submit for Review (${filled}/4 documents uploaded)`}
        </button>
      )}
    </div>
  );
}
