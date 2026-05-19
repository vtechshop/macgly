import { useState } from 'react';
import { MapPin, Plus, Trash2, Check, Pencil, X } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import toast from 'react-hot-toast';

const emptyAddress = { label: 'Home', name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India', isDefault: false };

function AddressForm({ initial = emptyAddress, onSave, onCancel, saving, title }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="bg-white border border-secondary-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-secondary-800">{title}</h2>
        <button type="button" onClick={onCancel} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400"><X size={15} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-medium text-secondary-500">Label</label>
          <select className="input w-full" value={form.label} onChange={set('label')}>
            {['Home', 'Work', 'Other'].map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <Input label="Full Name *" value={form.name} onChange={set('name')} required />
        <Input label="Phone *" type="tel" value={form.phone} onChange={set('phone')} required />
        <div className="col-span-2"><Input label="Address Line 1 *" value={form.line1} onChange={set('line1')} required /></div>
        <div className="col-span-2"><Input label="Address Line 2" value={form.line2} onChange={set('line2')} /></div>
        <Input label="City *" value={form.city} onChange={set('city')} required />
        <Input label="Pincode *" value={form.pincode} onChange={set('pincode')} required />
        <div className="col-span-2"><Input label="State *" value={form.state} onChange={set('state')} required /></div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="accent-blue-600" />
        Set as default address
      </label>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>Save Address</Button>
      </div>
    </form>
  );
}

function AddressCard({ addr, onDelete, onSetDefault, onEdit }) {
  const [deleting, setDeleting] = useState(false);
  async function del() {
    if (!confirm('Delete this address?')) return;
    setDeleting(true);
    try { await onDelete(addr._id); } finally { setDeleting(false); }
  }
  return (
    <div className={`border rounded-xl p-4 relative bg-white ${addr.isDefault ? 'border-blue-400 bg-blue-50/50' : 'border-secondary-200'}`}>
      {addr.isDefault && (
        <span className="absolute top-3 right-12 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Default</span>
      )}
      <button onClick={() => onEdit(addr)} className="absolute top-3 right-3 p-1 hover:bg-secondary-100 rounded-lg text-secondary-400 hover:text-secondary-600">
        <Pencil size={13} />
      </button>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${addr.isDefault ? 'bg-blue-100' : 'bg-secondary-100'}`}>
          <MapPin size={16} className={addr.isDefault ? 'text-blue-600' : 'text-secondary-500'} />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-xs font-bold text-secondary-400 uppercase tracking-wide mb-0.5">{addr.label || 'Address'}</p>
          <p className="font-semibold text-sm text-secondary-800">{addr.name}</p>
          <p className="text-sm text-secondary-500 mt-0.5">{addr.phone}</p>
          <p className="text-sm text-secondary-500 mt-0.5 leading-relaxed">
            {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
            {addr.city}, {addr.state} — {addr.pincode}
          </p>
        </div>
      </div>
      <div className="flex gap-3 mt-3 pt-3 border-t border-secondary-100">
        {!addr.isDefault && (
          <button onClick={() => onSetDefault(addr._id)} className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline">
            <Check size={12} /> Set as Default
          </button>
        )}
        <button onClick={del} disabled={deleting} className="text-xs text-red-500 font-medium flex items-center gap-1 hover:underline ml-auto">
          <Trash2 size={12} /> {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

export default function CustomerAddresses() {
  const [rev, setRev] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editingAddr, setEditingAddr] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data } = useFetch(
    ['customer-addresses', rev],
    () => api.get('/users/profile').then((r) => r.data)
  );
  const addresses = data?.user?.addresses || [];

  async function addAddress(form) {
    setSaving(true);
    try {
      await api.post('/users/addresses', form);
      setRev((r) => r + 1);
      setShowAdd(false);
      toast.success('Address added');
    } catch { toast.error('Failed to add address'); }
    finally { setSaving(false); }
  }

  async function editAddress(form) {
    setSaving(true);
    try {
      await api.put(`/users/addresses/${editingAddr._id}`, form);
      setRev((r) => r + 1);
      setEditingAddr(null);
      toast.success('Address updated');
    } catch { toast.error('Failed to update address'); }
    finally { setSaving(false); }
  }

  async function deleteAddress(id) {
    try {
      await api.delete(`/users/addresses/${id}`);
      setRev((r) => r + 1);
      toast.success('Address removed');
    } catch { toast.error('Failed to delete address'); }
  }

  async function setDefaultAddress(id) {
    try {
      await api.put(`/users/addresses/${id}`, { isDefault: true });
      setRev((r) => r + 1);
      toast.success('Default address updated');
    } catch { toast.error('Failed to update default address'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin size={22} className="text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">My Addresses</h1>
            <p className="text-sm text-secondary-500 mt-0.5">{addresses.length} saved address{addresses.length !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        {!showAdd && !editingAddr && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> Add Address
          </button>
        )}
      </div>

      {showAdd && (
        <AddressForm
          title="New Address"
          onSave={addAddress}
          onCancel={() => setShowAdd(false)}
          saving={saving}
        />
      )}

      {editingAddr && (
        <AddressForm
          title="Edit Address"
          initial={editingAddr}
          onSave={editAddress}
          onCancel={() => setEditingAddr(null)}
          saving={saving}
        />
      )}

      {addresses.length === 0 && !showAdd ? (
        <div className="bg-white border border-secondary-200 rounded-xl text-center py-14 space-y-3">
          <MapPin size={40} className="mx-auto text-secondary-200" />
          <p className="font-semibold text-secondary-500">No saved addresses</p>
          <p className="text-sm text-secondary-400">Add an address to speed up checkout</p>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:underline mt-1">
            <Plus size={14} /> Add your first address
          </button>
        </div>
      ) : (
        !showAdd && !editingAddr && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addresses.map((a) => (
              <AddressCard
                key={a._id}
                addr={a}
                onDelete={deleteAddress}
                onSetDefault={setDefaultAddress}
                onEdit={(addr) => { setEditingAddr(addr); setShowAdd(false); }}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
