import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  User, Lock, Bell, Shield, AlertTriangle,
  Eye, EyeOff, CheckCircle, Phone, Mail, X,
} from 'lucide-react';
import api from '../../../../utils/api';
import { updateUserProfile, clearUser } from '../../../../store/slices/authSlice';
import { getSoundEnabled, toggleSound, playClick } from '../../../../utils/sounds';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Reusable section card ────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-secondary-100">
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
          <Icon size={16} className="text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-blue-600">{title}</p>
          <p className="text-xs text-secondary-400">{subtitle}</p>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Password field with eye toggle ──────────────────────────────────────────

function PwdInput({ label, value, onChange, hint, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-secondary-600">{label}</label>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-300" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className="input pl-9 pr-10 w-full"
          placeholder="••••••••"
        />
        <button type="button" onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600 transition-colors" tabIndex={-1}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {hint && <p className="text-xs text-secondary-400">{hint}</p>}
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${checked ? 'bg-primary-600' : 'bg-secondary-300'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ─── Delete Account Modal ─────────────────────────────────────────────────────

function DeleteModal({ onConfirm, onClose, loading }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="font-bold text-red-700">Delete Account</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors">
            <X size={16} className="text-secondary-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 space-y-1">
            <p className="font-semibold">This will permanently delete:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-red-600">
              <li>Your profile and account information</li>
              <li>Your order history</li>
              <li>Saved addresses and wishlist</li>
              <li>All account data and preferences</li>
            </ul>
            <p className="font-semibold mt-2">This action cannot be undone.</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Enter your password to confirm</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-300" />
              <input
                type={show ? 'text' : 'password'}
                className="input pl-9 pr-10 w-full"
                placeholder="Your current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button type="button" onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600" tabIndex={-1}>
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={() => onConfirm(password)}
              disabled={!password || loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading && <Spinner size="sm" />}
              Delete My Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CustomerSettings() {
  const { user }  = useSelector((s) => s.auth);
  const dispatch  = useDispatch();
  const navigate  = useNavigate();

  // Profile
  const [profile,       setProfile]       = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw,  setSavingPw]  = useState(false);

  // Preferences
  const [soundEnabled, setSoundEnabled] = useState(getSoundEnabled);

  // Delete modal
  const [showDelete,    setShowDelete]    = useState(false);
  const [deletingAcct,  setDeletingAcct]  = useState(false);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleProfileSave(e) {
    e.preventDefault();
    if (!profile.name.trim()) { toast.error('Name is required'); return; }
    setSavingProfile(true);
    try {
      const { data } = await api.put('/users/profile', { name: profile.name.trim(), phone: profile.phone });
      dispatch(updateUserProfile(data.user || data));
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    if (!pw.current) { toast.error('Enter your current password'); return; }
    if (pw.next.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (pw.next !== pw.confirm) { toast.error('Passwords do not match'); return; }
    setSavingPw(true);
    try {
      await api.put('/users/password', { currentPassword: pw.current, newPassword: pw.next });
      toast.success('Password changed successfully');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Incorrect current password');
    } finally {
      setSavingPw(false);
    }
  }

  function handleSoundToggle(val) {
    setSoundEnabled(val);
    toggleSound(val);
    if (val) setTimeout(() => playClick(), 50);
  }

  async function handleDeleteAccount(password) {
    if (!password) { toast.error('Password is required'); return; }
    setDeletingAcct(true);
    try {
      await api.delete('/users/account', { data: { password } });
      dispatch(clearUser());
      toast.success('Account deleted');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not delete account');
    } finally {
      setDeletingAcct(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-sm text-secondary-400 mt-0.5">Manage your account preferences and security</p>
      </div>

      {/* 1 — Profile Information */}
      <SectionCard icon={User} title="Profile Information" subtitle="Update your personal details">
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-secondary-600">Full Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-300" />
                <input
                  className="input pl-9 w-full"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Your name"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-secondary-600">Email Address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-300" />
                <input
                  className="input pl-9 w-full bg-secondary-50 text-secondary-400 cursor-not-allowed"
                  value={user?.email || ''}
                  disabled
                />
              </div>
              <p className="text-xs text-secondary-400">Email cannot be changed</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-secondary-600">Phone Number</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-300" />
              <input
                className="input pl-9 w-full"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingProfile}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {savingProfile && <Spinner size="sm" />}
              Save Changes
            </button>
          </div>
        </form>
      </SectionCard>

      {/* 2 — Change Password */}
      <SectionCard icon={Lock} title="Change Password" subtitle="Keep your account secure with a strong password">
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <PwdInput
            label="Current Password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
            autoComplete="current-password"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PwdInput
              label="New Password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              hint="Minimum 8 characters"
              autoComplete="new-password"
            />
            <PwdInput
              label="Confirm New Password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingPw}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {savingPw && <Spinner size="sm" />}
              Update Password
            </button>
          </div>
        </form>
      </SectionCard>

      {/* 3 — Preferences */}
      <SectionCard icon={Bell} title="Preferences" subtitle="Customize your experience">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-secondary-800">Sound Notifications</p>
            <p className="text-xs text-secondary-400 mt-0.5">Play sounds for cart, checkout, and other actions</p>
          </div>
          <ToggleSwitch checked={soundEnabled} onChange={handleSoundToggle} />
        </div>
      </SectionCard>

      {/* 4 — Account Information */}
      <SectionCard icon={Shield} title="Account Information" subtitle="Your account details and status">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
              <User size={14} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-secondary-400">Account Type</p>
              <p className="text-sm font-semibold text-blue-600 capitalize">{user?.role || 'Customer'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center shrink-0">
              <Shield size={14} className="text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-secondary-400">Member Since</p>
              <p className="text-sm font-semibold text-secondary-800">{memberSince}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle size={14} className="text-green-500" />
            </div>
            <div>
              <p className="text-xs text-secondary-400">Account Status</p>
              <p className={`text-sm font-semibold ${user?.isActive === false ? 'text-red-600' : 'text-green-600'}`}>
                {user?.isActive === false ? 'Suspended' : 'Active'}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 5 — Danger Zone */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={16} className="text-red-500" />
          <p className="text-sm font-bold text-red-700">Danger Zone</p>
        </div>
        <p className="text-xs text-red-400 mb-3">Irreversible actions</p>
        <p className="text-xs text-secondary-500 mb-4 leading-relaxed">
          Once you delete your account, all of your data will be permanently removed.
          This action <span className="font-semibold text-red-600">cannot be undone</span>.
        </p>
        <button
          onClick={() => setShowDelete(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <AlertTriangle size={14} /> Delete Account
        </button>
      </div>

      {/* Delete modal */}
      {showDelete && (
        <DeleteModal
          onConfirm={handleDeleteAccount}
          onClose={() => setShowDelete(false)}
          loading={deletingAcct}
        />
      )}
    </div>
  );
}
