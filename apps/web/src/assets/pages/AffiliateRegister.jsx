import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeOff, Link2, IndianRupee, BarChart2, Headphones, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import { setUser } from '../../store/slices/authSlice';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import toast from 'react-hot-toast';

const BENEFITS = [
  { icon: Link2, title: 'Your Unique Referral Link', desc: 'Share your personal link on social media, WhatsApp, or your website to start earning.' },
  { icon: IndianRupee, title: 'Earn Commission on Every Sale', desc: 'Get paid a commission for every order placed through your referral link. Default rate: 5%.' },
  { icon: BarChart2, title: 'Real-Time Earnings Dashboard', desc: 'Track clicks, conversions, and commissions in your affiliate dashboard — updated live.' },
  { icon: Headphones, title: 'Dedicated Affiliate Support', desc: 'Our team is here to help you maximise your earnings Mon–Sat 9AM–6PM.' },
];

function UpgradeForm({ user, dispatch, navigate }) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/users/become-affiliate');
      dispatch(setUser(data.user));
      toast.success('You are now an affiliate! Welcome.');
      navigate('/dashboard/affiliate');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not upgrade account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm shrink-0">
          {user.name[0].toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-secondary-900">{user.name}</p>
          <p className="text-xs text-secondary-400">{user.email}</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 text-sm text-blue-800">
        You're signed in. Click below to upgrade your existing account to an affiliate account — no new password needed.
      </div>

      <form onSubmit={handleUpgrade}>
        <Button type="submit" loading={loading} className="w-full">
          Become an Affiliate <ArrowRight size={15} className="ml-1" />
        </Button>
      </form>

      <p className="text-center text-xs text-secondary-400 mt-4">
        You'll be able to generate your referral link from your affiliate dashboard.
      </p>
    </div>
  );
}

export default function AffiliateRegister() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  if (user?.role === 'affiliate') return <Navigate to="/dashboard/affiliate" replace />;
  if (user?.role === 'admin') return <Navigate to="/dashboard/admin" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const { data } = await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: 'affiliate',
      });
      dispatch(setUser(data.user));
      toast.success('Affiliate account created! Welcome to Macgly.');
      navigate('/dashboard/affiliate');
    } catch (err) {
      const e = err.response?.data?.error;
      if (e?.fields) setErrors(e.fields);
      else toast.error(e?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-secondary-50">
      {/* Hero */}
      <div className="bg-secondary-900 text-white py-14 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-primary-400 font-semibold text-sm uppercase tracking-wider mb-3">Affiliate Program</p>
          <h1 className="text-4xl font-black mb-4">Earn money by sharing Macgly</h1>
          <p className="text-secondary-400 text-lg max-w-xl mx-auto">
            Refer buyers to Macgly and earn a commission on every sale. No inventory, no hassle.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Benefits */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-secondary-900">How it works</h2>
            <div className="space-y-5">
              {BENEFITS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-xl flex items-center justify-center shrink-0">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary-900">{title}</p>
                    <p className="text-sm text-secondary-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-green-800 mb-1">Commission is paid on delivery</p>
              <p className="text-green-700">You earn commission once the referred order is marked as delivered. Commissions are tracked in real time on your dashboard.</p>
            </div>
          </div>

          {/* Form */}
          {user ? (
            <UpgradeForm user={user} dispatch={dispatch} navigate={navigate} />
          ) : (
            <div className="card p-6">
              <h2 className="text-lg font-bold mb-5">Create your affiliate account</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Full Name *" placeholder="Your name" value={form.name} onChange={set('name')} error={errors.name} required />
                <Input label="Email *" type="email" placeholder="Enter email address" value={form.email} onChange={set('email')} error={errors.email} required />
                <Input label="Phone" type="tel" placeholder="Enter phone number" value={form.phone} onChange={set('phone')} error={errors.phone} />
                <div className="relative">
                  <Input
                    label="Password *"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={set('password')}
                    error={errors.password}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-8 text-secondary-400 hover:text-secondary-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <Button type="submit" loading={loading} className="w-full mt-2">
                  Join Affiliate Program
                </Button>
              </form>

              <p className="text-center text-sm text-secondary-500 mt-4">
                Already have an account?{' '}
                <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
              </p>
              <p className="text-center text-sm text-secondary-500 mt-1">
                Want to sell instead?{' '}
                <Link to="/sell" className="text-primary-600 font-medium hover:underline">Become a vendor</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
