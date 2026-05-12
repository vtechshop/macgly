import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../../../../utils/api';
import { normalizeImageUrl } from '../../../../utils/format';
import { useFetch, useAction } from '../../../../hooks';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/common/Input';
import toast from 'react-hot-toast';

export default function AdminBanners() {
  const [rev, setRev] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', subtitle: '', image: '', link: '', platform: 'both', displayOrder: 0, isActive: true });

  const { data } = useFetch(
    ['admin-banners', rev],
    () => api.get('/admin/banners').then((r) => r.data)
  );

  const { mutate: save, isPending: saving } = useAction(
    (d) => editing ? api.put(`/admin/banners/${editing._id}`, d) : api.post('/admin/banners', d),
    {
      onSuccess: () => { setRev((r) => r + 1); setModalOpen(false); toast.success('Saved'); },
      onError: () => toast.error('Failed'),
    }
  );

  const { mutate: del } = useAction(
    (id) => api.delete(`/admin/banners/${id}`),
    { onSuccess: () => { setRev((r) => r + 1); toast.success('Deleted'); } }
  );

  function openEdit(b) { setEditing(b); setForm(b); setModalOpen(true); }
  function openNew() {
    setEditing(null);
    setForm({ title: '', subtitle: '', image: '', link: '', platform: 'both', displayOrder: 0, isActive: true });
    setModalOpen(true);
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Banners</h1>
        <Button onClick={openNew}><Plus size={16} /> New Banner</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.banners?.map((b) => (
          <div key={b._id} className="card overflow-hidden">
            {b.image && <img src={normalizeImageUrl(b.image)} alt={b.title} className="w-full h-32 object-cover" onError={(e) => e.target.style.display='none'} />}
            <div className="p-3">
              <p className="font-medium">{b.title}</p>
              <p className="text-xs text-secondary-400 mt-0.5 capitalize">{b.platform} · Order {b.displayOrder}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => openEdit(b)} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-500"><Pencil size={14} /></button>
                <button onClick={() => { if (confirm('Delete?')) del(b._id); }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Banner' : 'New Banner'}>
        <form onSubmit={(e) => { e.preventDefault(); save(form); }} className="space-y-4">
          <Input label="Title" value={form.title} onChange={set('title')} required />
          <Input label="Subtitle" value={form.subtitle} onChange={set('subtitle')} />
          <Input label="Image URL" value={form.image} onChange={set('image')} required />
          <Input label="Link URL" value={form.link} onChange={set('link')} />
          <div className="space-y-1">
            <label className="text-sm font-medium text-secondary-700">Platform</label>
            <select className="input" value={form.platform} onChange={set('platform')}>
              <option value="website">Website</option>
              <option value="mobile">Mobile</option>
              <option value="both">Both</option>
            </select>
          </div>
          <Input label="Display Order" type="number" value={form.displayOrder} onChange={set('displayOrder')} />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Active
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
