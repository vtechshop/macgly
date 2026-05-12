import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Settings, Info, AlertTriangle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import api from '../../../../utils/api';
import { setUser, clearUser } from '../../../../store/slices/authSlice';
import toast from 'react-hot-toast';

function SectionCard({ icon: Icon, title, subtitle, children, className = '' }) {
  return (
    <div className={`bg-white border border-secondary-200 rounded-xl overflow-hidden ${className}`}>
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

function PasswordInput({ label, value, onChange, placeholder, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-secondary-500 mb-1.5">{label}</label>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-300" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="input pl-9 pr-10 w-full"
        />
        <button type="button" onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {hint && <p className="text-xs text-secondary-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function CustomerSettings() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);

  const [soundNotif, setSoundNotif] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pref_sound') ?? 'true'); } catch { return true; }
  });

  const [deletingAccount, setDeletingAccount] = useState(false);

  function toggleSound(val) {
    setSoundNotif(val);
    localStorage.setItem('pref_sound', JSON.stringify(val));
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!profile.name.trim()) { toast.error('Name is required'); return; }
    setSavingProfile(true);
    try {
      const { data } = await api.put('/users/profile', { name: profile.name.trim(), phone: profile.phone });
      dispatch(setUser(data.user));
      toast.success('Profile updated');
    } catch { toast.error('Failed to update profile'); }
    finally { setSavingProfile(false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (!pw.current) { toast.error('Enter your current password'); return; }
    if (pw.next.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    if (pw.next !== pw.confirm) { toast.error('Passwords do not match'); return; }
    setSavingPw(true);
    try {
      await api.put('/users/password', { currentPassword: pw.current, newPassword: pw.next });
      toast.success('Password changed');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Incorrect current password'); }
    finally { setSavingPw(false); }
  }

  async function deleteAccount() {
    if (!window.confirm('Are you sure? This will permanently delete your account and all data. This cannot be undone.')) return;
    setDeletingAccount(true);
    try {
      await api.delete('/users/account');
      dispatch(clearUser());
      navigate('/');
      toast.success('Account deleted');
    } catch { toast.error('Failed to delete account'); }
    finally { setDeletingAccount(false); }
  }

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Account Settings</h1>
        <p className="text-sm text-secondary-400 mt-0.5">Manage your account preferences and security</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — forms */}
        <div className="lg:col-span-2 space-y-5">

          {/* Profile Information */}
          <SectionCard icon={User} title="Profile Information" subtitle="Update your personal details">
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-secondary-500 mb-1.5">Full Name</label>
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
                <div>
                  <label className="block text-xs font-medium text-secondary-500 mb-1.5">Email Address</label>
                  <input className="input w-full bg-secondary-50 text-secondary-400 cursor-not-allowed" value={user?.email || ''} disabled />
                  <p className="text-xs text-secondary-400 mt-1">Email cannot be changed</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-500 mb-1.5">Phone Number</label>
                <input
                  className="input w-full"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={savingProfile}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                  {savingProfile ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </SectionCard>

          {/* Change Password */}
          <SectionCard icon={Lock} title="Change Password" subtitle="Keep your account secure with a strong password">
            <form onSubmit={changePassword} className="space-y-4">
              <PasswordInput
                label="Current Password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                placeholder="••••••••"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PasswordInput
                  label="New Password"
                  value={pw.next}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })}
                  placeholder="••••••••"
                  hint="Minimum 6 characters"
                />
                <PasswordInput
                  label="Confirm New Password"
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={savingPw}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                  {savingPw ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </SectionCard>

        </div>

        {/* Right column — info panels */}
        <div className="space-y-5">

          {/* Account Information */}
          <SectionCard icon={Info} title="Account Information" subtitle="Your account details and status">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <User size={14} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-[11px] text-secondary-400 uppercase tracking-wide font-medium">Account Type</p>
                  <p className="text-sm font-bold text-blue-600 capitalize">{user?.role || 'Customer'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                  <Info size={14} className="text-purple-500" />
                </div>
                <div>
                  <p className="text-[11px] text-secondary-400 uppercase tracking-wide font-medium">Member Since</p>
                  <p className="text-sm font-bold text-secondary-800">{memberSince}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 size={14} className="text-green-500" />
                </div>
                <div>
                  <p className="text-[11px] text-secondary-400 uppercase tracking-wide font-medium">Account Status</p>
                  <p className={`text-sm font-bold ${user?.isActive === false ? 'text-red-600' : 'text-green-600'}`}>
                    {user?.isActive === false ? 'Suspended' : 'Active'}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Preferences */}
          <SectionCard icon={Settings} title="Preferences" subtitle="Customize your experience">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-secondary-800">Sound Notifications</p>
                <p className="text-xs text-secondary-400 mt-0.5">Play sounds for cart, checkout, and other actions</p>
              </div>
              <button
                type="button"
                onClick={() => toggleSound(!soundNotif)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${soundNotif ? 'bg-blue-600' : 'bg-secondary-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${soundNotif ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </SectionCard>

          {/* Danger Zone */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-red-500" />
              <p className="text-sm font-bold text-red-700">Danger Zone</p>
            </div>
            <p className="text-xs text-red-400 mb-4">Irreversible actions</p>
            <p className="text-xs text-secondary-500 mb-4 leading-relaxed">
              Once you delete your account, all of your data will be permanently removed.
              This action <span className="font-semibold text-red-600">cannot be undone</span>.
            </p>
            <button
              onClick={deleteAccount}
              disabled={deletingAccount}
              className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {deletingAccount ? 'Deleting…' : 'Delete Account'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
