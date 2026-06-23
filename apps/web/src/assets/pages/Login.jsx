import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeOff } from 'lucide-react';
import { login, clearError } from '../../store/slices/authSlice';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import WhatsAppFAB from '../components/common/WhatsAppFAB';
import toast from 'react-hot-toast';

const ROLE_DASHBOARD = {
  admin:     '/dashboard/admin',
  vendor:    '/dashboard/vendor',
  affiliate: '/dashboard/affiliate',
  customer:  '/',   // customers go to homepage after login
};

export default function Login() {
  const dispatch        = useDispatch();
  const navigate        = useNavigate();
  const location        = useLocation();
  const [searchParams]  = useSearchParams();
  const { user, loading, error } = useSelector((s) => s.auth);

  const [form,         setForm]         = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const redirect = searchParams.get('redirect') || location.state?.from || null;

  // Already authenticated → redirect immediately
  useEffect(() => {
    if (user) navigate(redirect || ROLE_DASHBOARD[user.role] || '/', { replace: true });
  }, [user, navigate, redirect]);

  // Clear any stale auth error when unmounting
  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const u = await dispatch(login({
        email:    form.email.trim().toLowerCase(),
        password: form.password,
      })).unwrap();
      toast.success(`Welcome back, ${u.name.split(' ')[0]}!`);
      navigate(redirect || ROLE_DASHBOARD[u.role] || '/', { replace: true });
    } catch {
      // error shown via Redux state
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gray-50">
      <WhatsAppFAB />
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Sign in to your account</h1>
          <p className="text-sm text-secondary-500 mt-1">
            Or{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              create a new account
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-sm">
              <p className="font-medium">{error}</p>
              {error.toLowerCase().includes('locked') && (
                <p className="text-xs mt-0.5 text-red-600">Please wait before trying again.</p>
              )}
            </div>
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="Enter email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="email"
            required
          />

          <div>
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-8 text-secondary-400 hover:text-secondary-600 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-secondary-600 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 rounded border-secondary-300 text-primary-600" />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-secondary-500 mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
