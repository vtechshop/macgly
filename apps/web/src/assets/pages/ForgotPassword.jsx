import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Forgot password?</h1>
          <p className="text-sm text-secondary-500 mt-1">
            {sent ? 'Check your inbox' : "Enter your email and we'll send a reset link"}
          </p>
        </div>

        {sent ? (
          <div className="card p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-secondary-600">
              If <strong>{email}</strong> is registered with us, you'll receive a password reset link shortly.
            </p>
            <p className="text-xs text-secondary-400">Didn't get it? Check your spam folder or try again.</p>
            <button
              onClick={() => setSent(false)}
              className="text-sm text-primary-600 hover:underline font-medium"
            >
              Try a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" loading={loading} className="w-full">
              Send Reset Link
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-secondary-500 mt-4">
          Remember your password?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
