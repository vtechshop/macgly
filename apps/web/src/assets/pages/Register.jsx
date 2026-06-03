import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Eye, EyeOff } from 'lucide-react';
import { register, clearError } from '../../store/slices/authSlice';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import WhatsAppFAB from '../components/common/WhatsAppFAB';
import toast from 'react-hot-toast';

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_DASHBOARD = {
  admin:     '/dashboard/admin',
  vendor:    '/dashboard/vendor',
  affiliate: '/dashboard/affiliate',
  customer:  '/dashboard/customer',
};

const ACCOUNT_TYPES = [
  { value: 'customer',  label: 'Customer'  },
  { value: 'vendor',    label: 'Vendor'    },
  { value: 'affiliate', label: 'Affiliate' },
];

const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=[\]{}|;:,.<>])\S{8,}$/;

// ─── Client-side validation ───────────────────────────────────────────────────

function validate({ name, phone, email, password, confirmPassword, agreed }) {
  const errors = {};

  const trimName = name.trim();
  if (trimName.length < 2)                       errors.name = 'Name must be at least 2 characters';
  else if (!/^[a-zA-Z\s]+$/.test(trimName))      errors.name = 'Name must contain only letters and spaces';

  if (phone.trim()) {
    const digits = phone.replace(/[\s\-()+]/g, '');
    if (!/^\d+$/.test(digits) || digits.length < 10 || digits.length > 15) {
      errors.phone = 'Enter a valid phone number (10–15 digits)';
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address';

  if (!PWD_REGEX.test(password)) {
    errors.password = 'Must be at least 8 characters with uppercase, lowercase, number, and special character';
  }

  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

  if (!agreed) errors.agreed = 'You must agree to the Terms and Conditions';

  return errors;
}

// ─── Role info banners ────────────────────────────────────────────────────────

function RoleBanner({ role }) {
  if (role === 'vendor') {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
        <span className="font-semibold">Vendor account:</span> Your account will be reviewed by our team before you can start selling.
      </div>
    );
  }
  if (role === 'affiliate') {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-800">
        <span className="font-semibold">Affiliate account:</span> Earn commissions by promoting products to your audience.
      </div>
    );
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Register() {
  const dispatch       = useDispatch();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, error: serverError } = useSelector((s) => s.auth);

  const refCode = searchParams.get('ref') || '';

  const [form, setForm] = useState({
    name:            '',
    phone:           '',
    role:            'customer',
    email:           '',
    password:        '',
    confirmPassword: '',
    agreed:          false,
  });
  const [errors,          setErrors]          = useState({});
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirmPwd,  setShowConfirmPwd]  = useState(false);

  // Already authenticated → redirect
  useEffect(() => {
    if (user) navigate(ROLE_DASHBOARD[user.role] || '/', { replace: true });
  }, [user, navigate]);

  // Clear server error on unmount
  useEffect(() => () => { dispatch(clearError()); }, [dispatch]);

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }

    const phone = form.phone.replace(/[\s\-()+]/g, '');
    const payload = {
      name:     form.name.trim(),
      email:    form.email.trim().toLowerCase(),
      password: form.password,
      role:     form.role,
      ...(phone   ? { phone }      : {}),
      ...(refCode ? { referralCode: refCode } : {}),
    };

    try {
      const u = await dispatch(register(payload)).unwrap();
      toast.success('Account created! Welcome to Macgly.');
      navigate(ROLE_DASHBOARD[u.role] || '/', { replace: true });
    } catch {
      // serverError shown via Redux state
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gray-50">
      <WhatsAppFAB />
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-secondary-500 mt-1">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>

        {refCode && (
          <div className="mb-4 text-xs text-center bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2">
            Referred by <span className="font-bold">{refCode}</span> — you're signing up with a referral!
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-sm font-medium">
              {serverError}
            </div>
          )}

          {/* Full Name */}
          <div>
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={form.name}
              onChange={set('name')}
              error={errors.name}
              autoComplete="name"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <Input
              label="Phone Number"
              type="tel"
              placeholder="+91 9876543210"
              value={form.phone}
              onChange={set('phone')}
              error={errors.phone}
              autoComplete="tel"
            />
            {!errors.phone && (
              <p className="text-xs text-secondary-400 mt-1">Required for order updates &amp; invoice delivery</p>
            )}
          </div>

          {/* Account Type */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-secondary-700">
              Account Type <span className="text-red-500">*</span>
            </label>
            <select
              className="input w-full"
              value={form.role}
              onChange={set('role')}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="text-xs text-secondary-400">Choose how you want to use the platform</p>
          </div>

          {/* Role banner */}
          <RoleBanner role={form.role} />

          {/* Email */}
          <div>
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
              autoComplete="email"
              required
            />
            {!errors.email && (
              <p className="text-xs text-secondary-400 mt-1">Enter a valid email address</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                error={errors.password}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-8 text-secondary-400 hover:text-secondary-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {!errors.password && (
              <p className="text-xs text-secondary-400 mt-1">
                Must be at least 8 characters with uppercase, lowercase, number, and special character
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirmPwd ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                error={errors.confirmPassword}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((v) => !v)}
                className="absolute right-3 top-8 text-secondary-400 hover:text-secondary-600 transition-colors"
                tabIndex={-1}
              >
                {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Terms */}
          <div>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 mt-0.5 rounded border-secondary-300 text-primary-600 shrink-0"
                checked={form.agreed}
                onChange={set('agreed')}
              />
              <span className="text-sm text-secondary-600">
                I agree to the{' '}
                <Link to="/info/terms" className="text-primary-600 hover:underline" target="_blank" rel="noopener">
                  Terms and Conditions
                </Link>
              </span>
            </label>
            {errors.agreed && <p className="text-xs text-red-600 mt-1">{errors.agreed}</p>}
          </div>

          <Button type="submit" loading={loading} className="w-full">
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
