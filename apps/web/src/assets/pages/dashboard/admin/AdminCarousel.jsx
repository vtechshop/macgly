import { useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

const EMPTY = { title: '', subtitle: '', image: '', link: '', buttonText: 'Shop Now', order: 0, isActive: true, validFrom: '', validTo: '' };

export default function AdminCarousel() {
  const [rev, setRev] = useState(0);
  const [modal, setModal] = useState(null); // null | 'add' | slide object
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useFetch(
    ['admin-carousel', rev],
    () => api.get('/admin/carousel').then((r) => r.data)
  );

  const slides = data?.slides || [];

  function openAdd() { setForm(EMPTY); setModal('add'); }
  function openEdit(slide) { setForm({ ...EMPTY, ...slide, validFrom: slide.validFrom ? slide.validFrom.slice(0, 10) : '', validTo: slide.validTo ? slide.validTo.slice(0, 10) : '' }); setModal(slide); }

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function uploadImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'carousel');
      const res = await api.post('/upload', fd);
      set('image', res.data.url);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title || !form.image) return toast.error('Title and image are required');
    setSaving(true);
    try {
      if (modal === 'add') {
        await api.post('/admin/carousel', form);
        toast.success('Slide added');
      } else {
        await api.put(`/admin/carousel/${modal._id}`, form);
        toast.success('Slide updated');
      }
      setModal(null);
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this slide?')) return;
    try {
      await api.delete(`/admin/carousel/${id}`);
      toast.success('Deleted');
      setRev((r) => r + 1);
    } catch { toast.error('Failed'); }
  }

  async function toggleActive(slide) {
    try {
      await api.put(`/admin/carousel/${slide._id}`, { ...slide, isActive: !slide.isActive });
      setRev((r) => r + 1);
    } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Carousel Management</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Manage homepage banner slides</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Slide</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : slides.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <p className="font-medium">No slides yet. Add your first carousel slide.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((slide) => (
            <div key={slide._id} className="card p-4 flex items-center gap-4">
              <GripVertical size={16} className="text-secondary-300 shrink-0" />
              <div className="w-24 h-14 rounded overflow-hidden bg-secondary-50 shrink-0">
                {slide.image && <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold line-clamp-1">{slide.title}</p>
                {slide.subtitle && <p className="text-sm text-secondary-400 line-clamp-1">{slide.subtitle}</p>}
                <p className="text-xs text-secondary-400 mt-0.5">Order: {slide.order} · {slide.link || 'No link'}</p>
                {(slide.validFrom || slide.validTo) && (
                  <p className="text-xs text-secondary-400">{fmtDate(slide.validFrom)} – {fmtDate(slide.validTo)}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${slide.isActive ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                  {slide.isActive ? 'Active' : 'Inactive'}
                </span>
                <button onClick={() => toggleActive(slide)} className="p-1.5 hover:bg-secondary-100 rounded-lg" title={slide.isActive ? 'Deactivate' : 'Activate'}>
                  {slide.isActive ? <EyeOff size={14} className="text-secondary-500" /> : <Eye size={14} className="text-secondary-500" />}
                </button>
                <button onClick={() => openEdit(slide)} className="p-1.5 hover:bg-secondary-100 rounded-lg"><Pencil size={14} className="text-secondary-500" /></button>
                <button onClick={() => handleDelete(slide._id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} className="text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="font-bold text-lg mb-5">{modal === 'add' ? 'Add Slide' : 'Edit Slide'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input className="input w-full" value={form.title} onChange={(e) => set('title', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subtitle</label>
                <input className="input w-full" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Image *</label>
                {form.image && <img src={form.image} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />}
                <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-secondary-300 rounded-lg hover:bg-secondary-50 text-sm">
                  {uploading ? <Spinner size="sm" /> : null} {uploading ? 'Uploading…' : 'Upload image'}
                  <input type="file" className="hidden" accept="image/*" onChange={uploadImage} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Link URL</label>
                  <input className="input w-full" placeholder="/products" value={form.link} onChange={(e) => set('link', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Button Text</label>
                  <input className="input w-full" value={form.buttonText} onChange={(e) => set('buttonText', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Valid From</label>
                  <input type="date" className="input w-full" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valid To</label>
                  <input type="date" className="input w-full" value={form.validTo} onChange={(e) => set('validTo', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Display Order</label>
                  <input type="number" className="input w-full" value={form.order} onChange={(e) => set('order', Number(e.target.value))} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="rounded" />
                  <label htmlFor="isActive" className="text-sm font-medium">Active</label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn flex-1">Cancel</button>
                <button type="submit" disabled={saving || uploading} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
