import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeOff, Package, TrendingUp, ShieldCheck, HeadphonesIcon, ArrowRight } from 'lucide-react';
import api from '../../utils/api';
import { setUser } from '../../store/slices/authSlice';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import toast from 'react-hot-toast';

const BENEFITS = [
  { icon: Package, title: 'Reach More Buyers', desc: 'List your tools and machinery to thousands of verified buyers across India.' },
  { icon: TrendingUp, title: 'Grow Your Business', desc: 'Powerful dashboard to track sales, orders, and revenue in real time.' },
  { icon: ShieldCheck, title: 'Secure Payments', desc: 'Get paid on time, every time. Razorpay-powered secure settlements.' },
  { icon: HeadphonesIcon, title: 'Dedicated Support', desc: 'Our vendor support team is here Mon–Sat 9AM–6PM to help you succeed.' },
];

function UpgradeForm({ user, dispatch, navigate }) {
  const [form, setForm] = useState({ businessName: '', gstin: '' });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleUpgrade(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/users/become-vendor', {
        businessName: form.businessName,
        gstin: form.gstin,
      });
      dispatch(setUser(data.user));
      toast.success('You are now a vendor! Welcome to Macgly.');
      navigate('/dashboard/vendor');
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
        You're signed in as a buyer. Click below to upgrade your existing account to a vendor account — no new password needed.
      </div>

      <form onSubmit={handleUpgrade} className="space-y-4">
        <div className="border-t border-secondary-100 pt-4">
          <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-3">Business Details (optional)</p>
          <div className="space-y-3">
            <Input label="Business / Shop Name" placeholder="e.g. Raj Tools & Machinery" value={form.businessName} onChange={set('businessName')} />
            <Input label="GSTIN" placeholder="e.g. 22AAAAA0000A1Z5" value={form.gstin} onChange={set('gstin')} />
          </div>
        </div>
        <Button type="submit" loading={loading} className="w-full">
          Upgrade to Vendor Account <ArrowRight size={15} className="ml-1" />
        </Button>
      </form>

      <p className="text-center text-xs text-secondary-400 mt-4">
        You can always add business details later from your vendor dashboard.
      </p>
    </div>
  );
}

export default function VendorRegister() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', businessName: '', gstin: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // Already a vendor or admin → go to their dashboard
  if (user?.role === 'vendor') return <Navigate to="/dashboard/vendor" replace />;
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
        role: 'vendor',
        vendorProfile: { businessName: form.businessName, gstin: form.gstin },
      });
      dispatch(setUser(data.user));
      toast.success('Vendor account created! Welcome to Macgly.');
      navigate('/dashboard/vendor');
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
          <p className="text-primary-400 font-semibold text-sm uppercase tracking-wider mb-3">Sell on Macgly</p>
          <h1 className="text-4xl font-black mb-4">Grow your tools business online</h1>
          <p className="text-secondary-400 text-lg max-w-xl mx-auto">
            Join hundreds of vendors selling power tools, hand tools, and machinery to buyers across India.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Benefits */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-secondary-900">Why sell on Macgly?</h2>
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

            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm text-primary-800">
              <p className="font-semibold mb-1">Approval required</p>
              <p className="text-primary-700">After registering, our team reviews your account within 1 business day. You can add products immediately — they'll go live once approved.</p>
            </div>
          </div>

          {/* Form — upgrade if logged in as customer, register if not logged in */}
          {user ? (
            <UpgradeForm user={user} dispatch={dispatch} navigate={navigate} />
          ) : (
            <div className="card p-6">
              <h2 className="text-lg font-bold mb-5">Create your vendor account</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Full Name *" placeholder="Your name" value={form.name} onChange={set('name')} error={errors.name} required />
                <Input label="Email *" type="email" placeholder="you@business.com" value={form.email} onChange={set('email')} error={errors.email} required />
                <Input label="Phone" type="tel" placeholder="+91 9876543210" value={form.phone} onChange={set('phone')} error={errors.phone} />
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

                <div className="pt-1 border-t border-secondary-100">
                  <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-3">Business Details (optional)</p>
                  <div className="space-y-3">
                    <Input label="Business / Shop Name" placeholder="e.g. Raj Tools & Machinery" value={form.businessName} onChange={set('businessName')} />
                    <Input label="GSTIN" placeholder="e.g. 22AAAAA0000A1Z5" value={form.gstin} onChange={set('gstin')} />
                  </div>
                </div>

                <Button type="submit" loading={loading} className="w-full mt-2">
                  Create Vendor Account
                </Button>
              </form>

              <p className="text-center text-sm text-secondary-500 mt-4">
                Already have an account?{' '}
                <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
              </p>
              <p className="text-center text-sm text-secondary-500 mt-1">
                Shopping instead?{' '}
                <Link to="/register" className="text-primary-600 font-medium hover:underline">Create a buyer account</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
