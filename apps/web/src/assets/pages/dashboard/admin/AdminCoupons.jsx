import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Tag, Copy, Check } from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isExpired(expiry) {
  return expiry && new Date(expiry) < new Date();
}

const EMPTY_FORM = {
  code: '', description: '', type: 'percent', value: '',
  minOrderAmount: '', maxDiscount: '', usageLimit: '', perUserLimit: '1',
  expiry: '', active: true,
};

function CouponModal({ coupon, onClose, onSaved }) {
  const editing = !!coupon;
  const [form, setForm] = useState(
    editing
      ? {
          code: coupon.code,
          description: coupon.description || '',
          type: coupon.type,
          value: coupon.value,
          minOrderAmount: coupon.minOrderAmount || '',
          maxDiscount: coupon.maxDiscount || '',
          usageLimit: coupon.usageLimit || '',
          perUserLimit: coupon.perUserLimit ?? 1,
          expiry: coupon.expiry ? coupon.expiry.slice(0, 10) : '',
          active: coupon.active,
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);

  function set(k) { return (e) => setForm((p) => ({ ...p, [k]: e.target.value })); }

  async function save(e) {
    e.preventDefault();
    if (!form.code.trim()) return toast.error('Coupon code is required');
    if (!form.value || parseFloat(form.value) <= 0) return toast.error('Value must be greater than 0');
    if (form.type === 'percent' && parseFloat(form.value) > 100) return toast.error('Percent cannot exceed 100');

    setSaving(true);
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase().trim(),
        value: parseFloat(form.value),
        minOrderAmount: parseFloat(form.minOrderAmount) || 0,
        maxDiscount: parseFloat(form.maxDiscount) || 0,
        usageLimit: parseInt(form.usageLimit) || 0,
        perUserLimit: parseInt(form.perUserLimit) ?? 1,
        expiry: form.expiry || null,
      };
      if (editing) {
        await api.put(`/admin/coupons/${coupon._id}`, payload);
        toast.success('Coupon updated');
      } else {
        await api.post('/admin/coupons', payload);
        toast.success('Coupon created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 my-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">{editing ? 'Edit Coupon' : 'Create Coupon'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Code *</label>
              <input
                className="input w-full uppercase"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="SAVE20"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <input className="input w-full" value={form.description} onChange={set('description')} placeholder="20% off on all products" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select className="input w-full" value={form.type} onChange={set('type')}>
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {form.type === 'percent' ? 'Discount (%)' : 'Discount (₹)'} *
              </label>
              <input
                className="input w-full" type="number" min="0" step="0.01"
                value={form.value} onChange={set('value')}
                placeholder={form.type === 'percent' ? '20' : '100'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min Order (₹)</label>
              <input className="input w-full" type="number" min="0" value={form.minOrderAmount} onChange={set('minOrderAmount')} placeholder="0 = no minimum" />
            </div>
            {form.type === 'percent' && (
              <div>
                <label className="block text-sm font-medium mb-1">Max Discount (₹)</label>
                <input className="input w-full" type="number" min="0" value={form.maxDiscount} onChange={set('maxDiscount')} placeholder="0 = no cap" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Usage Limit</label>
              <input className="input w-full" type="number" min="0" value={form.usageLimit} onChange={set('usageLimit')} placeholder="0 = unlimited" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Per User Limit</label>
              <input className="input w-full" type="number" min="0" value={form.perUserLimit} onChange={set('perUserLimit')} placeholder="1 = one-time" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Expiry Date</label>
              <input className="input w-full" type="date" value={form.expiry} onChange={set('expiry')} />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
                <div className="w-10 h-5 bg-secondary-200 peer-focus:outline-none rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
              <span className="text-sm font-medium">Active</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Coupon'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCoupons() {
  const [rev, setRev] = useState(0);
  const [modal, setModal] = useState(null); // null | 'create' | coupon object
  const [deleting, setDeleting] = useState(null);
  const [copied, setCopied] = useState(null);

  const { data, isLoading } = useFetch(
    ['admin-coupons', rev],
    () => api.get('/admin/coupons', { params: { limit: 100 } }).then((r) => r.data)
  );

  const coupons = data?.coupons || [];

  function onSaved() { setRev((r) => r + 1); }

  async function toggleActive(coupon) {
    try {
      await api.put(`/admin/coupons/${coupon._id}`, { active: !coupon.active });
      toast.success(coupon.active ? 'Coupon deactivated' : 'Coupon activated');
      setRev((r) => r + 1);
    } catch { toast.error('Failed to update coupon'); }
  }

  async function deleteCoupon(id) {
    setDeleting(id);
    try {
      await api.delete(`/admin/coupons/${id}`);
      toast.success('Coupon deleted');
      setRev((r) => r + 1);
    } catch { toast.error('Failed to delete coupon'); } finally { setDeleting(null); }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Coupons</h1>
          <p className="text-sm text-secondary-500 mt-0.5">{coupons.length} coupon{coupons.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setModal('create')}>
          <Plus size={16} /> New Coupon
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 text-secondary-400">
          <Tag size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No coupons yet</p>
          <p className="text-sm mt-1">Create your first coupon to start offering discounts</p>
        </div>
      ) : (
        <div className="bg-white border border-secondary-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Discount</th>
                <th className="px-4 py-3 text-left">Min Order</th>
                <th className="px-4 py-3 text-left">Usage</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {coupons.map((c) => {
                const expired = isExpired(c.expiry);
                return (
                  <tr key={c._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-secondary-800">{c.code}</span>
                        <button
                          onClick={() => copyCode(c.code)}
                          className="text-secondary-400 hover:text-secondary-600"
                          title="Copy code"
                        >
                          {copied === c.code ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        </button>
                      </div>
                      {c.description && <p className="text-xs text-secondary-400 mt-0.5">{c.description}</p>}
                    </td>
                    <td className="px-4 py-3 font-medium text-secondary-800">
                      {c.type === 'percent'
                        ? `${c.value}%${c.maxDiscount > 0 ? ` (max ${formatCurrency(c.maxDiscount)})` : ''}`
                        : formatCurrency(c.value)}
                    </td>
                    <td className="px-4 py-3 text-secondary-600">
                      {c.minOrderAmount > 0 ? formatCurrency(c.minOrderAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-secondary-600">
                      {c.usedCount}
                      {c.usageLimit > 0 ? ` / ${c.usageLimit}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      {c.expiry ? (
                        <span className={expired ? 'text-red-500' : 'text-secondary-600'}>{fmtDate(c.expiry)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {expired ? (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Expired</span>
                      ) : c.active ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                      ) : (
                        <span className="text-xs bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-full font-medium">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleActive(c)}
                          className="p-1.5 rounded hover:bg-secondary-100 text-secondary-500 text-xs"
                          title={c.active ? 'Deactivate' : 'Activate'}
                        >
                          {c.active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => setModal(c)} className="p-1.5 rounded hover:bg-secondary-100 text-secondary-500">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteCoupon(c._id)}
                          disabled={deleting === c._id}
                          className="p-1.5 rounded hover:bg-red-50 text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <CouponModal
          coupon={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
