import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import api from '../../../utils/api';
import { setUser } from '../../../store/slices/authSlice';
import toast from 'react-hot-toast';
import Modal from './Modal';

// Lets a vendor who has not been approved yet go back to a customer account,
// so signing up to sell by mistake never leaves them stuck. The API refuses
// approved vendors and vendors with orders and says to contact support.
export default function CancelVendorButton({ className = '' }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const { data } = await api.post('/users/cancel-vendor');
      dispatch(setUser(data.user));
      toast.success('You are now using a customer account');
      navigate('/dashboard/customer', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not switch your account. Please try again.');
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-sm font-medium text-secondary-600 hover:text-primary-700 underline underline-offset-2 ${className}`}
      >
        <Undo2 size={14} aria-hidden="true" /> Don&apos;t want to sell? Switch back to a customer account
      </button>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Switch back to a customer account?">
        <div className="space-y-4">
          <p className="text-sm text-secondary-600">
            Your vendor application will be cancelled. You keep the same login, and your orders,
            addresses and wishlist stay as they are.
          </p>
          <p className="text-sm text-secondary-600">
            Business and KYC details you entered, and any products you added, will be removed.
            You can apply to sell again later.
          </p>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-outline px-4">
              Keep vendor account
            </button>
            <button type="button" onClick={confirm} disabled={busy} className="btn-primary px-4">
              {busy ? 'Switching…' : 'Yes, switch to customer'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
