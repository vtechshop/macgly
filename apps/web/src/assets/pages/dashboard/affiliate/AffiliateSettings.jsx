import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '../../../../store/slices/authSlice';
import api from '../../../../utils/api';
import toast from 'react-hot-toast';
import Spinner from '../../../components/common/Spinner';

export default function AffiliateSettings() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  async function handleProfileSave(e) {
    e.preventDefault();
    if (!profile.name.trim()) return toast.error('Name is required');
    setSavingProfile(true);
    try {
      const { data } = await api.put('/users/profile', { name: profile.name.trim(), phone: profile.phone.trim() });
      dispatch(setUser(data.user));
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    if (!pwd.current || !pwd.newPwd || !pwd.confirm) return toast.error('All fields are required');
    if (pwd.newPwd.length < 6) return toast.error('New password must be at least 6 characters');
    if (pwd.newPwd !== pwd.confirm) return toast.error('Passwords do not match');
    setSavingPwd(true);
    try {
      await api.put('/users/password', { currentPassword: pwd.current, newPassword: pwd.newPwd });
      toast.success('Password changed');
      setPwd({ current: '', newPwd: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not change password');
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Manage your account details</p>
      </div>

      {/* Profile */}
      <form onSubmit={handleProfileSave} className="card p-6 space-y-4">
        <h2 className="font-bold">Profile Information</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            className="input w-full"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            className="input w-full"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            placeholder="10-digit mobile number"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input className="input w-full bg-secondary-50 text-secondary-400" value={user?.email || ''} readOnly />
          <p className="text-xs text-secondary-400 mt-1">Email cannot be changed</p>
        </div>
        <button type="submit" disabled={savingProfile} className="btn-primary flex items-center gap-2">
          {savingProfile && <Spinner size="sm" />}
          Save Profile
        </button>
      </form>

      {/* Change password */}
      <form onSubmit={handlePasswordSave} className="card p-6 space-y-4">
        <h2 className="font-bold">Change Password</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Current Password</label>
          <input
            type="password"
            className="input w-full"
            value={pwd.current}
            onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New Password</label>
          <input
            type="password"
            className="input w-full"
            value={pwd.newPwd}
            onChange={(e) => setPwd({ ...pwd, newPwd: e.target.value })}
            minLength={6}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm New Password</label>
          <input
            type="password"
            className="input w-full"
            value={pwd.confirm}
            onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
            required
          />
        </div>
        <button type="submit" disabled={savingPwd} className="btn-primary flex items-center gap-2">
          {savingPwd && <Spinner size="sm" />}
          Change Password
        </button>
      </form>

      {/* Account info */}
      <div className="card p-6 space-y-3">
        <h2 className="font-bold">Account Info</h2>
        <div className="flex justify-between text-sm">
          <span className="text-secondary-500">Commission Rate</span>
          <span className="font-semibold">{user?.affiliateProfile?.commissionRate ?? 5}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-secondary-500">KYC Status</span>
          <KycBadge status={user?.affiliateProfile?.kycStatus || 'not_submitted'} />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-secondary-500">Member Since</span>
          <span className="font-semibold">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' }) : '—'}</span>
        </div>
      </div>
    </div>
  );
}

function KycBadge({ status }) {
  const map = {
    not_submitted: 'bg-secondary-100 text-secondary-600',
    pending:       'bg-yellow-100 text-yellow-700',
    verified:      'bg-green-100 text-green-700',
    rejected:      'bg-red-100 text-red-700',
  };
  const label = {
    not_submitted: 'Not Submitted',
    pending:       'Under Review',
    verified:      'Verified',
    rejected:      'Rejected',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] || map.not_submitted}`}>
      {label[status] || status}
    </span>
  );
}
