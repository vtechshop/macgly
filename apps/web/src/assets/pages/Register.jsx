import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Eye, EyeOff } from 'lucide-react';
import api from '../../utils/api';
import { setUser } from '../../store/slices/authSlice';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import toast from 'react-hot-toast';

export default function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const { data } = await api.post('/auth/register', { ...form, ...(refCode ? { referralCode: refCode } : {}) });
      dispatch(setUser(data.user));
      toast.success('Account created!');
      navigate('/');
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Create account</h1>
          <p className="text-sm text-secondary-500 mt-1">Join Macgly today</p>
        </div>
        {refCode && (
          <div className="mb-4 text-xs text-center bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">
            Referred by <span className="font-bold">{refCode}</span> — you're signing up with a referral!
          </div>
        )}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <Input label="Full Name" placeholder="John Doe" value={form.name} onChange={set('name')} error={errors.name} required />
          <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} error={errors.email} required />
          <Input label="Phone (optional)" type="tel" placeholder="+91 9876543210" value={form.phone} onChange={set('phone')} error={errors.phone} />
          <div className="relative">
            <Input label="Password" type={showPassword ? 'text' : 'password'} placeholder="Min 6 characters" value={form.password} onChange={set('password')} error={errors.password} required />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-8 text-secondary-400 hover:text-secondary-600">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <Button type="submit" loading={loading} className="w-full mt-2">
            Create Account
          </Button>
        </form>
        <p className="text-center text-sm text-secondary-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
