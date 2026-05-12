import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, formatDate } from '../../../../utils/format';
import { useFetch, useAction } from '../../../../hooks';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/common/Input';
import toast from 'react-hot-toast';

const empty = {
  code: '', description: '', discountType: 'percent', discountValue: '',
  minOrderAmount: '', maxDiscount: '', usageLimit: '', isActive: true,
  startsAt: '', expiresAt: '',
};

export default function AdminCoupons() {
  const [rev, setRev] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const { data } = useFetch(['admin-coupons', rev], () => api.get('/admin/coupons').then((r) => r.data));

  const { mutate: save, isPending: saving } = useAction(
    (d) => editing ? api.put(`/admin/coupons/${editing._id}`, d) : api.post('/admin/coupons', d),
    { onSuccess: () => { setRev((r) => r + 1); setModalOpen(false); toast.success('Saved'); }, onError: () => toast.error('Failed') }
  );

  const { mutate: del } = useAction(
    (id) => api.delete(`/admin/coupons/${id}`),
    { onSuccess: () => { setRev((r) => r + 1); toast.success('Deleted'); } }
  );

  function openNew() { setEditing(null); setForm(empty); setModalOpen(true); }
  function openEdit(c) {
    setEditing(c);
    setForm({
      ...c,
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 10) : '',
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : '',
    });
    setModalOpen(true);
  }

  function handleSave(e) {
    e.preventDefault();
    save({
      ...form,
      discountValue: parseFloat(form.discountValue),
      minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : 0,
      maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : undefined,
      startsAt: form.startsAt || undefined,
      expiresAt: form.expiresAt || undefined,
    });
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Coupons</h1>
        <Button onClick={openNew}><Plus size={16} /> New Coupon</Button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary-50 border-b border-secondary-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Code</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Discount</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Min Order</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Usage</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Expires</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100">
            {!data?.coupons?.length ? (
              <tr><td colSpan={7} className="text-center py-12 text-secondary-400">No coupons yet</td></tr>
            ) : data.coupons.map((c) => (
              <tr key={c._id} className="hover:bg-secondary-50">
                <td className="px-4 py-3">
                  <span className="font-mono font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                    <Tag size={12} />{c.code}
                  </span>
                  {c.description && <p className="text-xs text-secondary-400 mt-0.5">{c.description}</p>}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {c.discountType === 'percent' ? `${c.discountValue}%` : formatCurrency(c.discountValue)}
                  {c.maxDiscount && <span className="text-xs text-secondary-400 ml-1">(max {formatCurrency(c.maxDiscount)})</span>}
                </td>
                <td className="px-4 py-3 text-secondary-600">{c.minOrderAmount ? formatCurrency(c.minOrderAmount) : '—'}</td>
                <td className="px-4 py-3">
                  <span>{c.usedCount}</span>
                  {c.usageLimit && <span className="text-secondary-400">/{c.usageLimit}</span>}
                </td>
                <td className="px-4 py-3 text-secondary-500 text-xs">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-500"><Pencil size={14} /></button>
                    <button onClick={() => { if (confirm('Delete coupon?')) del(c._id); }} className="p-1.5 hover:bg-red-50 rounded text-red-400"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Coupon' : 'New Coupon'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Code *" value={form.code} onChange={set('code')} placeholder="SAVE20" required className="uppercase" />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-secondary-700">Type *</label>
              <select className="input" value={form.discountType} onChange={set('discountType')}>
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat (₹)</option>
              </select>
            </div>
            <Input label={form.discountType === 'percent' ? 'Discount % *' : 'Discount ₹ *'} type="number" step="0.01" value={form.discountValue} onChange={set('discountValue')} required />
            {form.discountType === 'percent' && <Input label="Max Discount (₹)" type="number" value={form.maxDiscount} onChange={set('maxDiscount')} />}
            <Input label="Min Order Amount (₹)" type="number" value={form.minOrderAmount} onChange={set('minOrderAmount')} />
            <Input label="Usage Limit" type="number" value={form.usageLimit} onChange={set('usageLimit')} placeholder="Unlimited" />
            <Input label="Starts At" type="date" value={form.startsAt} onChange={set('startsAt')} />
            <Input label="Expires At" type="date" value={form.expiresAt} onChange={set('expiresAt')} />
          </div>
          <Input label="Description" value={form.description} onChange={set('description')} placeholder="Summer sale discount" />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} className="accent-primary-600" /> Active
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Coupon</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
