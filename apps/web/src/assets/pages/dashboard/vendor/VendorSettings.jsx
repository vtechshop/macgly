import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  Store, CreditCard, FileText, IndianRupee, Lock,
  Shield, Copy, Check, Eye, EyeOff, AlertTriangle,
  Upload, Trash2, ChevronRight, Globe, ShieldCheck,
  Monitor, LogIn, LogOut, Volume2, VolumeX, Loader2,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, invalidateCache } from '../../../../hooks';
import { formatCurrency } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import Modal from '../../../components/common/Modal';
import Button from '../../../components/common/Button';
import toast from 'react-hot-toast';

// ─── Tabs config ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'profile',  label: 'Store Profile',  short: 'Profile',  icon: Store },
  { id: 'bank',     label: 'Bank Account',   short: 'Bank',     icon: CreditCard },
  { id: 'policies', label: 'Policies',       short: 'Policies', icon: FileText },
  { id: 'payout',   label: 'Payout',         short: 'Payout',   icon: IndianRupee },
  { id: 'security', label: 'Security',       short: 'Security', icon: Lock },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:       { label: 'Active',       cls: 'bg-green-100 text-green-700' },
  pending:      { label: 'Pending',      cls: 'bg-yellow-100 text-yellow-700' },
  suspended:    { label: 'Suspended',    cls: 'bg-red-100 text-red-700' },
  under_review: { label: 'Under Review', cls: 'bg-blue-100 text-blue-700' },
};

function calcCompletion(v) {
  if (!v) return { count: 0, total: 7, missing: [] };
  const checks = [
    { done: !!v.storeName?.trim(),                           label: 'Store Name' },
    { done: !!v.storeDescription?.trim(),                    label: 'Store Description' },
    { done: !!v.logo,                                        label: 'Store Logo' },
    { done: !!(v.bankAccount?.trim() && v.ifsc?.trim()),     label: 'Bank Account' },
    { done: !!v.panCard?.trim(),                             label: 'PAN Number' },
    { done: !!v.returnPolicy?.trim(),                        label: 'Return Policy' },
    { done: !!v.shippingPolicy?.trim(),                      label: 'Shipping Policy' },
  ];
  return {
    count:   checks.filter((c) => c.done).length,
    total:   checks.length,
    missing: checks.filter((c) => !c.done).map((c) => c.label),
  };
}

function getSoundEnabled() {
  try { return JSON.parse(localStorage.getItem('pref_sound') ?? 'true'); } catch { return true; }
}

function PasswordField({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className="input w-full pr-10"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="p-2 rounded-lg hover:bg-secondary-100 transition-colors text-secondary-400"
      title={`Copy ${label}`}
    >
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VendorSettings() {
  const { user }  = useSelector((s) => s.auth);
  const [rev, setRev] = useState(0);

  // ── Tab ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('profile');

  // ── Form state ────────────────────────────────────────────────────────────
  const [profileData, setProfileData]   = useState({ storeName: '', description: '', logo: '' });
  const [bankData,    setBankData]       = useState({
    accountHolderName: '', bankName: '', accountNumber: '',
    ifscCode: '', swiftCode: '', upiId: '', panNumber: '',
  });
  const [policiesData, setPoliciesData] = useState({ returnPolicy: '', shippingPolicy: '' });

  // ── Saving flags ─────────────────────────────────────────────────────────
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [savingBank,     setSavingBank]     = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);
  const [uploading,      setUploading]      = useState(false);
  const logoInputRef = useRef(null);

  // ── Security modal ────────────────────────────────────────────────────────
  const [showPwModal,  setShowPwModal]  = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [pwData, setPwData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPw, setSavingPw] = useState(false);

  // ── Sound pref ────────────────────────────────────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(getSoundEnabled);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: settingsData, isLoading } = useFetch(
    ['vendor-settings', rev],
    () => api.get('/vendors/settings').then((r) => r.data)
  );

  const { data: kycData } = useFetch(
    ['vendor-kyc'],
    () => api.get('/vendors/kyc').then((r) => r.data)
  );

  const { data: activityData, isLoading: activityLoading } = useFetch(
    ['login-activities'],
    () => api.get('/users/login-activity', { params: { limit: 20 } }).then((r) => r.data),
    { enabled: showActivity }
  );

  const vendor     = settingsData?.vendor;
  const completion = calcCompletion(vendor);
  const statusCfg  = STATUS_CFG[vendor?.status] || STATUS_CFG.pending;
  const storeUrl   = `${window.location.hostname}/store/${vendor?.slug || ''}`;
  const activities = activityData?.activities || [];

  // Sync API data → form state
  useEffect(() => {
    if (!vendor) return;
    setProfileData({ storeName: vendor.storeName, description: vendor.storeDescription, logo: vendor.logo });
    setBankData({
      accountHolderName: vendor.accountHolderName,
      bankName:          vendor.bankName,
      accountNumber:     vendor.bankAccount,
      ifscCode:          vendor.ifsc,
      swiftCode:         vendor.swiftCode,
      upiId:             vendor.upiId,
      panNumber:         vendor.panCard,
    });
    setPoliciesData({ returnPolicy: vendor.returnPolicy, shippingPolicy: vendor.shippingPolicy });
  }, [vendor]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function pSet(k) { return (e) => setProfileData((f) => ({ ...f, [k]: e.target.value })); }
  function bSet(k) { return (e) => setBankData((f)    => ({ ...f, [k]: e.target.value })); }
  function polSet(k) { return (e) => setPoliciesData((f) => ({ ...f, [k]: e.target.value })); }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'vendor-logos');
      const { data } = await api.post('/upload', fd);
      setProfileData((f) => ({ ...f, logo: data.url || data.secure_url }));
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!profileData.storeName?.trim()) { toast.error('Store name is required'); return; }
    setSavingProfile(true);
    try {
      await api.put('/vendors/settings/profile', {
        storeName:        profileData.storeName,
        storeDescription: profileData.description,
        logo:             profileData.logo,
      });
      toast.success('Store profile saved');
      invalidateCache('vendor-settings');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveBank(e) {
    e.preventDefault();
    if (!bankData.accountHolderName?.trim()) { toast.error('Account holder name is required'); return; }
    if (!bankData.bankName?.trim())          { toast.error('Bank name is required'); return; }
    if (!bankData.accountNumber?.trim())     { toast.error('Account number is required'); return; }
    if (!bankData.panNumber?.trim())         { toast.error('PAN number is required'); return; }
    setSavingBank(true);
    try {
      await api.put('/vendors/settings/bank', {
        accountHolderName: bankData.accountHolderName,
        bankName:          bankData.bankName,
        bankAccount:       bankData.accountNumber,
        ifsc:              bankData.ifscCode,
        swiftCode:         bankData.swiftCode,
        upiId:             bankData.upiId,
        panCard:           bankData.panNumber,
      });
      toast.success('Bank details saved');
      invalidateCache('vendor-settings');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSavingBank(false);
    }
  }

  async function handleSavePolicies(e) {
    e.preventDefault();
    setSavingPolicies(true);
    try {
      await api.put('/vendors/settings/policies', policiesData);
      toast.success('Policies saved');
      invalidateCache('vendor-settings');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSavingPolicies(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwData.newPassword !== pwData.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (pwData.newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSavingPw(true);
    try {
      await api.put('/users/password', {
        currentPassword: pwData.currentPassword,
        newPassword:     pwData.newPassword,
      });
      toast.success('Password changed — please log in again on other devices');
      setShowPwModal(false);
      setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Password change failed');
    } finally {
      setSavingPw(false);
    }
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('pref_sound', JSON.stringify(next));
    toast.success(next ? 'Sound notifications enabled' : 'Sound notifications disabled');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5 w-full">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store size={22} /> Vendor Settings
          </h1>
          <p className="text-secondary-500 text-sm mt-0.5">Manage your store settings and preferences</p>
        </div>
        <Link to="/dashboard/vendor/kyc" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
          <ShieldCheck size={14} /> KYC Verification <ChevronRight size={12} />
        </Link>
      </div>

      {/* Account health card */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Logo + name */}
        <div className="flex items-center gap-3 flex-1">
          {vendor?.logo
            ? <img src={vendor.logo} alt="logo" className="w-12 h-12 rounded-lg object-contain border border-secondary-200" />
            : <div className="w-12 h-12 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0">
                <Store size={22} className="text-secondary-400" />
              </div>
          }
          <div>
            <p className="font-bold text-base">{vendor?.storeName || user?.name || '—'}</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.cls}`}>
                {statusCfg.label}
              </span>
              {vendor?.slug && (
                <span className="text-xs text-secondary-400 font-mono">/{vendor.slug}</span>
              )}
            </div>
          </div>
        </div>

        {/* Profile completion */}
        <div className="min-w-[180px]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-secondary-500 font-medium">Profile Completion</span>
            <span className="font-bold text-primary-600">{Math.round((completion.count / completion.total) * 100)}%</span>
          </div>
          <div className="h-2 bg-secondary-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${(completion.count / completion.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-secondary-400 mt-1">{completion.count}/{completion.total} items completed</p>
        </div>

        {/* Quick stats */}
        <div className="hidden xl:flex items-center gap-6 text-center">
          <div>
            <p className="text-xs text-secondary-400">Commission</p>
            <p className="font-bold">{vendor?.commissionRate ?? 10}%</p>
          </div>
          <div>
            <p className="text-xs text-secondary-400">Total Sales</p>
            <p className="font-bold text-primary-600">{formatCurrency(vendor?.totalEarnings || 0)}</p>
          </div>
        </div>
      </div>

      {/* Incomplete profile warning */}
      {completion.missing.length > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-amber-700 font-medium">Complete your profile to receive payouts</p>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {completion.missing.map((m) => (
                <span key={m} className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">{m}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-secondary-200">
        <nav className="flex -mb-px gap-1 overflow-x-auto">
          {TABS.map(({ id, label, short, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:text-secondary-700'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Store Profile ────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="card p-5 space-y-5">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><Store size={16} /> Store Profile</h2>
            <p className="text-xs text-secondary-400 mt-0.5">Update your store information and branding</p>
          </div>

          {/* Logo upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Store Logo</label>
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-secondary-200 flex items-center justify-center overflow-hidden bg-secondary-50 shrink-0">
                {profileData.logo
                  ? <img src={profileData.logo} alt="logo" className="w-full h-full object-contain" />
                  : <Store size={24} className="text-secondary-300" />
                }
              </div>
              <div className="space-y-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? 'Uploading…' : 'Upload Logo'}
                </button>
                <p className="text-xs text-secondary-400">JPG, PNG, GIF, WebP, AVIF, or SVG — max 10MB</p>
                {profileData.logo && (
                  <button
                    type="button"
                    onClick={() => setProfileData((f) => ({ ...f, logo: '' }))}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Store name + URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Store Name *</label>
              <input
                className="input w-full"
                value={profileData.storeName}
                onChange={pSet('storeName')}
                placeholder="e.g. Vtech Kitchen"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Store URL</label>
              <div className="flex items-center gap-1">
                <input
                  className="input w-full text-secondary-400 bg-secondary-50"
                  value={storeUrl}
                  readOnly
                />
                <CopyButton text={`https://${storeUrl}`} label="store URL" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Store Description</label>
            <textarea
              className="input w-full h-24 resize-none"
              value={profileData.description}
              onChange={pSet('description')}
              placeholder="Describe your store and products…"
            />
            <p className="text-xs text-secondary-400 mt-1">This will be displayed on your store page</p>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" loading={savingProfile}>Save Changes</Button>
          </div>
        </form>
      )}

      {/* ── Tab: Bank Account ─────────────────────────────────────────────────── */}
      {activeTab === 'bank' && (
        <form onSubmit={handleSaveBank} className="card p-5 space-y-5">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><CreditCard size={16} /> Bank Account</h2>
            <p className="text-xs text-secondary-400 mt-0.5">Used for payouts and settlements</p>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
            <Shield size={15} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Your bank details are encrypted and stored securely. They are only used for processing payouts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Account Holder Name *</label>
              <input className="input w-full" value={bankData.accountHolderName} onChange={bSet('accountHolderName')} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bank Name *</label>
              <input className="input w-full" value={bankData.bankName} onChange={bSet('bankName')} placeholder="e.g. State Bank of India" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Account Number *</label>
              <input className="input w-full" type="text" inputMode="numeric" value={bankData.accountNumber} onChange={bSet('accountNumber')} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">IFSC Code</label>
              <input
                className="input w-full uppercase"
                value={bankData.ifscCode}
                onChange={(e) => setBankData((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                placeholder="SBIN0001234"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">SWIFT Code</label>
              <input
                className="input w-full uppercase"
                value={bankData.swiftCode}
                onChange={(e) => setBankData((f) => ({ ...f, swiftCode: e.target.value.toUpperCase() }))}
                placeholder="SBININBB"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">UPI ID</label>
              <input className="input w-full" value={bankData.upiId} onChange={bSet('upiId')} placeholder="yourname@upi" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">PAN Number * <span className="text-xs text-secondary-400 font-normal">(for TDS compliance)</span></label>
              <input
                className="input w-full uppercase"
                value={bankData.panNumber}
                onChange={(e) => setBankData((f) => ({ ...f, panNumber: e.target.value.toUpperCase() }))}
                placeholder="ABCDE1234F"
                maxLength={10}
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" loading={savingBank}>Save Bank Details</Button>
          </div>
        </form>
      )}

      {/* ── Tab: Policies ─────────────────────────────────────────────────────── */}
      {activeTab === 'policies' && (
        <form onSubmit={handleSavePolicies} className="card p-5 space-y-5">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><FileText size={16} /> Policies</h2>
            <p className="text-xs text-secondary-400 mt-0.5">Set your store return and shipping policies</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Return Policy</label>
            <textarea
              className="input w-full resize-y"
              rows={6}
              value={policiesData.returnPolicy}
              onChange={polSet('returnPolicy')}
              placeholder="Describe your return and refund policy…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Shipping Policy</label>
            <textarea
              className="input w-full resize-y"
              rows={6}
              value={policiesData.shippingPolicy}
              onChange={polSet('shippingPolicy')}
              placeholder="Describe your shipping rates, timelines, and carriers…"
            />
          </div>

          <div className="p-3 rounded-lg bg-secondary-50 border border-secondary-200 space-y-1">
            <p className="text-xs font-semibold text-secondary-600">Tips for writing good policies:</p>
            <ul className="text-xs text-secondary-500 space-y-1 list-disc list-inside">
              <li>Be specific about timeframes (e.g., "returns within 7 days of delivery")</li>
              <li>Mention which items are non-returnable (e.g., opened consumables)</li>
              <li>Specify who bears return shipping costs</li>
              <li>Include estimated delivery times for different regions</li>
            </ul>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" loading={savingPolicies}>Save Policies</Button>
          </div>
        </form>
      )}

      {/* ── Tab: Payout ───────────────────────────────────────────────────────── */}
      {activeTab === 'payout' && (
        <div className="card p-5 space-y-5">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><IndianRupee size={16} /> Payout Settings</h2>
            <p className="text-xs text-secondary-400 mt-0.5">Your earnings and commission breakdown</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Earnings',   value: formatCurrency(vendor?.totalEarnings   || 0), cls: 'text-green-600' },
              { label: 'Pending',          value: formatCurrency(vendor?.pendingEarnings  || 0), cls: 'text-yellow-600' },
              { label: 'Commission Rate',  value: `${vendor?.commissionRate ?? 10}%`,            cls: 'text-secondary-700' },
              { label: 'You Keep',         value: `${100 - (vendor?.commissionRate ?? 10)}%`,    cls: 'text-primary-600' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-xl border border-secondary-200 p-4 text-center">
                <p className="text-xs text-secondary-400">{label}</p>
                <p className={`font-bold text-xl mt-1 ${cls}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Commission explanation */}
          <div className="rounded-xl bg-secondary-50 border border-secondary-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-secondary-700">How commission works</p>
            <p className="text-sm text-secondary-500">
              For every sale, Macgly deducts a {vendor?.commissionRate ?? 10}% platform commission.
              The remaining {100 - (vendor?.commissionRate ?? 10)}% is settled to your bank account
              after the order is delivered.
            </p>
            <p className="text-xs text-secondary-400">
              Example: A ₹1,000 sale → Macgly keeps ₹{((vendor?.commissionRate ?? 10) * 10).toFixed(0)} →
              You receive ₹{((100 - (vendor?.commissionRate ?? 10)) * 10).toFixed(0)}
            </p>
          </div>

          <p className="text-sm text-secondary-500">
            Commission rates are set by Macgly and cannot be changed here.{' '}
            <Link to="/dashboard/vendor/support" className="text-primary-600 hover:underline">
              Contact Support
            </Link>{' '}
            to discuss a custom rate.
          </p>
        </div>
      )}

      {/* ── Tab: Security ─────────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><Lock size={16} /> Security</h2>
            <p className="text-xs text-secondary-400 mt-0.5">Manage your account security settings</p>
          </div>

          <div className="space-y-3">
            {/* Change password */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-secondary-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center">
                  <Lock size={16} className="text-secondary-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Change Password</p>
                  <p className="text-xs text-secondary-400">Update your account password</p>
                </div>
              </div>
              <Button variant="secondary" onClick={() => setShowPwModal(true)}>Change</Button>
            </div>

            {/* Login activity */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-secondary-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center">
                  <Monitor size={16} className="text-secondary-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Login Activity</p>
                  <p className="text-xs text-secondary-400">View recent sign-in history</p>
                </div>
              </div>
              <Button variant="secondary" onClick={() => setShowActivity(true)}>View</Button>
            </div>

            {/* Sound notifications */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-secondary-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center">
                  {soundEnabled
                    ? <Volume2 size={16} className="text-secondary-500" />
                    : <VolumeX size={16} className="text-secondary-400" />
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold">Sound Notifications</p>
                  <p className="text-xs text-secondary-400">Play sounds for new orders and actions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleSound}
                className={`w-11 h-6 rounded-full transition-colors relative ${soundEnabled ? 'bg-primary-500' : 'bg-secondary-200'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${soundEnabled ? 'translate-x-5' : ''}`}
                />
              </button>
            </div>

            {/* KYC status */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-secondary-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center">
                  <ShieldCheck size={16} className="text-secondary-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">KYC Verification</p>
                  <p className="text-xs text-secondary-400 capitalize">
                    Status: {(kycData?.data?.status || vendor?.kycStatus || 'not_submitted').replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <Link to="/dashboard/vendor/kyc" className="btn-secondary text-sm">
                Manage <ChevronRight size={13} className="inline" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Password Modal ─────────────────────────────────────────────── */}
      <Modal open={showPwModal} onClose={() => setShowPwModal(false)} title="Change Password">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <PasswordField
            label="Current Password"
            value={pwData.currentPassword}
            onChange={(e) => setPwData((f) => ({ ...f, currentPassword: e.target.value }))}
            placeholder="Enter current password"
          />
          <PasswordField
            label="New Password"
            value={pwData.newPassword}
            onChange={(e) => setPwData((f) => ({ ...f, newPassword: e.target.value }))}
            placeholder="Min. 6 characters"
          />
          <PasswordField
            label="Confirm New Password"
            value={pwData.confirmPassword}
            onChange={(e) => setPwData((f) => ({ ...f, confirmPassword: e.target.value }))}
            placeholder="Repeat new password"
          />
          {pwData.newPassword && pwData.confirmPassword && pwData.newPassword !== pwData.confirmPassword && (
            <p className="text-xs text-red-500">Passwords do not match</p>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setShowPwModal(false)} className="btn-secondary text-sm">Cancel</button>
            <Button type="submit" loading={savingPw}>Update Password</Button>
          </div>
        </form>
      </Modal>

      {/* ── Login Activity Modal ──────────────────────────────────────────────── */}
      <Modal open={showActivity} onClose={() => setShowActivity(false)} title="Login Activity" size="lg">
        {activityLoading
          ? <div className="flex justify-center py-8"><Spinner /></div>
          : activities.length === 0
            ? (
              <div className="text-center py-10 text-secondary-400">
                <Monitor size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No login activity recorded yet</p>
              </div>
            )
            : (
              <div className="divide-y divide-secondary-100">
                {activities.map((a) => (
                  <div key={a._id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${a.type === 'login' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {a.type === 'login'
                          ? <LogIn size={13} className="text-green-600" />
                          : <LogOut size={13} className="text-red-500" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{a.type?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-secondary-400">{a.browser} · {a.os} · {a.ipAddress}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {a.status}
                      </span>
                      <p className="text-xs text-secondary-400 mt-1">
                        {new Date(a.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
        }
      </Modal>
    </div>
  );
}
