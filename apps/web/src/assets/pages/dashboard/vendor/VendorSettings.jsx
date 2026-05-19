import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setUser } from '../../../../store/slices/authSlice';
import api from '../../../../utils/api';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

export default function VendorSettings() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const vp = user?.vendorProfile || {};

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    businessName: vp.businessName || '',
    businessPhone: vp.businessPhone || '',
    gstin: vp.gstin || '',
    accountHolderName: vp.accountHolderName || '',
    bankAccount: vp.bankAccount || '',
    ifsc: vp.ifsc || '',
    panCard: vp.panCard || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/vendors/profile', form);
      dispatch(setUser(res.data.vendor));
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const Section = ({ title, children }) => (
    <div className="card p-5 space-y-4">
      <h2 className="font-semibold text-base border-b border-secondary-100 pb-2">{title}</h2>
      {children}
    </div>
  );

  const Field = ({ label, k, type = 'text', placeholder }) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type={type} className="input w-full" value={form[k]} onChange={set(k)} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="space-y-5 w-full">
      <div>
        <h1 className="text-2xl font-bold">Vendor Settings</h1>
        <p className="text-secondary-500 text-sm mt-0.5">Manage your store and payout details</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Section title="Personal">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" k="name" />
            <Field label="Phone" k="phone" type="tel" />
          </div>
        </Section>

        <Section title="Business Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Business Name *" k="businessName" />
            <Field label="Business Phone *" k="businessPhone" />
            <Field label="GSTIN" k="gstin" placeholder="22AAAAA0000A1Z5" />
            <Field label="PAN Card *" k="panCard" placeholder="ABCDE1234F" />
          </div>
        </Section>

        <Section title="Bank Account (for payouts)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Account Holder Name *" k="accountHolderName" />
            <Field label="Bank Account Number *" k="bankAccount" />
            <Field label="IFSC Code *" k="ifsc" placeholder="SBIN0001234" />
          </div>
          <p className="text-xs text-secondary-400">These details are used for Razorpay payouts. Make sure they're accurate.</p>
        </Section>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 px-6">
            {saving ? <Spinner size="sm" /> : null} {saving ? 'Savingâ€¦' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
