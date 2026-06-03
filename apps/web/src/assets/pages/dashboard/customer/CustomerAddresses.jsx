import { useState } from 'react';
import {
  MapPin, Phone, Home, Building2, Plus,
  Pencil, Trash2, CheckCircle, RefreshCw, X, User,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, invalidateCache } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Empty form ───────────────────────────────────────────────────────────────

const EMPTY = {
  name: '', phone: '', line1: '', line2: '',
  city: '', state: '', pincode: '', country: 'India', isDefault: false,
};

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, formData, onChange, onSubmit, saving, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors">
            <X size={16} className="text-secondary-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {/* Name + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium">Full Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                <input
                  className="input w-full pl-8"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(e) => onChange('name', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">Phone Number <span className="text-red-500">*</span></label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                <input
                  className="input w-full pl-8"
                  type="tel"
                  placeholder="9876543210"
                  value={formData.phone}
                  onChange={(e) => onChange('phone', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Address Line 1 */}
          <div className="space-y-1">
            <label className="block text-sm font-medium">Address Line 1 <span className="text-red-500">*</span></label>
            <div className="relative">
              <Home size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
              <input
                className="input w-full pl-8"
                placeholder="Street address, house number"
                value={formData.line1}
                onChange={(e) => onChange('line1', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Address Line 2 */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-secondary-600">Address Line 2 <span className="text-xs text-secondary-400">(Optional)</span></label>
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
              <input
                className="input w-full pl-8"
                placeholder="Apartment, Building, Landmark"
                value={formData.line2}
                onChange={(e) => onChange('line2', e.target.value)}
              />
            </div>
          </div>

          {/* City + State + Pincode */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium">City <span className="text-red-500">*</span></label>
              <input className="input w-full" placeholder="City" value={formData.city} onChange={(e) => onChange('city', e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">State <span className="text-red-500">*</span></label>
              <input className="input w-full" placeholder="State" value={formData.state} onChange={(e) => onChange('state', e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium">PIN Code <span className="text-red-500">*</span></label>
              <input className="input w-full" placeholder="600001" value={formData.pincode} onChange={(e) => onChange('pincode', e.target.value)} required />
            </div>
          </div>

          {/* Country */}
          <div className="space-y-1">
            <label className="block text-sm font-medium">Country <span className="text-red-500">*</span></label>
            <input className="input w-full" placeholder="India" value={formData.country} onChange={(e) => onChange('country', e.target.value)} required />
          </div>

          {/* Default checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-secondary-300 text-primary-600"
              checked={formData.isDefault}
              onChange={(e) => onChange('isDefault', e.target.checked)}
            />
            <span className="text-sm text-secondary-600">Set as default delivery address</span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Spinner size="sm" />}
              {title.startsWith('Edit') ? 'Update Address' : 'Add Address'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── AddressCard ──────────────────────────────────────────────────────────────

function AddressCard({ addr, onEdit, onDelete, onSetDefault }) {
  const [deleting,     setDeleting]     = useState(false);
  const [settingDef,   setSettingDef]   = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this address?')) return;
    setDeleting(true);
    try { await onDelete(addr._id); } finally { setDeleting(false); }
  }

  async function handleSetDefault() {
    setSettingDef(true);
    try { await onSetDefault(addr._id); } finally { setSettingDef(false); }
  }

  return (
    <div className={`card p-5 relative transition-all ${addr.isDefault ? 'border-primary-400 ring-1 ring-primary-200' : ''}`}>
      {addr.isDefault && (
        <span className="absolute top-4 right-4 text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-full">
          Default
        </span>
      )}

      {/* Name */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-secondary-100 rounded-lg flex items-center justify-center shrink-0">
          <Home size={15} className="text-secondary-500" />
        </div>
        <p className="font-semibold text-secondary-800 pr-14">{addr.name}</p>
      </div>

      {/* Phone */}
      <div className="flex items-center gap-2 text-sm text-secondary-600 mb-1.5">
        <Phone size={13} className="text-secondary-400 shrink-0" />
        {addr.phone || '—'}
      </div>

      {/* Address */}
      <div className="flex items-start gap-2 text-sm text-secondary-600">
        <MapPin size={13} className="text-secondary-400 shrink-0 mt-0.5" />
        <div>
          <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
          <p>{addr.city}, {addr.state} {addr.pincode}</p>
          <p className="text-primary-600 font-medium mt-0.5">{addr.country}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-secondary-100">
        <button onClick={() => onEdit(addr)} className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
          <Pencil size={13} /> Edit
        </button>
        <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1 text-sm font-medium text-red-500 hover:underline disabled:opacity-50">
          <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
        </button>
        {!addr.isDefault && (
          <button onClick={handleSetDefault} disabled={settingDef} className="flex items-center gap-1 text-sm font-medium text-secondary-500 hover:underline ml-auto disabled:opacity-50">
            {settingDef ? <Spinner size="sm" /> : <CheckCircle size={13} />}
            Set as Default
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CustomerAddresses() {
  const [rev,      setRev]      = useState(0);
  const [modal,    setModal]    = useState(null); // null | 'add' | address object
  const [saving,   setSaving]   = useState(false);
  const [formData, setFormData] = useState(EMPTY);

  const { data, isLoading } = useFetch(
    ['customer-addresses', rev],
    () => api.get('/users/addresses').then((r) => r.data)
  );

  const addresses = [...(data?.addresses || [])].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

  function openAdd() {
    setFormData(EMPTY);
    setModal('add');
  }

  function openEdit(addr) {
    setFormData({ name: addr.name || '', phone: addr.phone || '', line1: addr.line1 || '', line2: addr.line2 || '', city: addr.city || '', state: addr.state || '', pincode: addr.pincode || '', country: addr.country || 'India', isDefault: addr.isDefault || false });
    setModal(addr);
  }

  function setField(key, val) {
    setFormData((f) => ({ ...f, [key]: val }));
  }

  function refresh() {
    invalidateCache('customer-addresses');
    setRev((r) => r + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'add') {
        await api.post('/users/addresses', formData);
        toast.success('Address added');
      } else {
        await api.put(`/users/addresses/${modal._id}`, formData);
        toast.success('Address updated');
      }
      setModal(null);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not save address');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/users/addresses/${id}`);
      toast.success('Address removed');
      refresh();
    } catch {
      toast.error('Could not delete address');
    }
  }

  async function handleSetDefault(id) {
    try {
      await api.put(`/users/addresses/${id}/default`);
      toast.success('Default address updated');
      refresh();
    } catch {
      toast.error('Could not update default address');
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Addresses</h1>
          <p className="text-sm text-secondary-500 mt-0.5">Manage your delivery addresses</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} /> Add New Address
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading && !addresses.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="card h-40 animate-pulse bg-secondary-100" />)}
        </div>
      ) : addresses.length === 0 ? (
        <div className="card p-14 text-center space-y-3">
          <MapPin size={40} className="mx-auto text-secondary-200" />
          <p className="font-semibold text-secondary-500">No addresses saved</p>
          <p className="text-sm text-secondary-400">Add an address to speed up checkout</p>
          <button onClick={openAdd} className="btn-primary inline-flex items-center gap-1.5 mx-auto">
            <Plus size={14} /> Add Your First Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((a) => (
            <AddressCard
              key={a._id}
              addr={a}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Add New Address' : 'Edit Address'}
          formData={formData}
          onChange={setField}
          onSubmit={handleSubmit}
          saving={saving}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
