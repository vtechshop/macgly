import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, useAction } from '../../../../hooks';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/common/Input';
import toast from 'react-hot-toast';

export default function AdminCategories() {
  const [rev, setRev] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', displayOrder: 0, parentId: '' });

  const { data } = useFetch(
    ['admin-categories', rev],
    () => api.get('/admin/categories').then((r) => r.data)
  );

  const { mutate: save, isPending: saving } = useAction(
    (d) => editing ? api.put(`/admin/categories/${editing._id}`, d) : api.post('/admin/categories', d),
    {
      onSuccess: () => { setRev((r) => r + 1); setModalOpen(false); toast.success('Saved'); },
      onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
    }
  );

  const { mutate: del } = useAction(
    (id) => api.delete(`/admin/categories/${id}`),
    { onSuccess: () => { setRev((r) => r + 1); toast.success('Deleted'); } }
  );

  function openEdit(c) { setEditing(c); setForm({ ...c, parentId: c.parentId || '' }); setModalOpen(true); }
  function openNew() { setEditing(null); setForm({ name: '', slug: '', description: '', displayOrder: 0, parentId: '' }); setModalOpen(true); }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button onClick={openNew}><Plus size={16} /> New Category</Button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary-50 border-b border-secondary-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Parent</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Order</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100">
            {data?.categories?.map((c) => {
              const parent = data.categories.find(p => p._id === (c.parentId?._id || c.parentId));
              return (
              <tr key={c._id} className="hover:bg-secondary-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-secondary-400 text-xs">{parent ? parent.name : <span className="text-secondary-300">—</span>}</td>
                <td className="px-4 py-3 text-secondary-400">{c.slug}</td>
                <td className="px-4 py-3">{c.displayOrder}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-500"><Pencil size={14} /></button>
                    <button onClick={() => { if (confirm('Delete?')) del(c._id); }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <form onSubmit={(e) => { e.preventDefault(); save({ ...form, parentId: form.parentId || null }); }} className="space-y-4">
          <Input label="Name" value={form.name} onChange={set('name')} required />
          <Input label="Slug (auto if blank)" value={form.slug} onChange={set('slug')} />
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Parent Category (leave blank for top-level)</label>
            <select
              value={form.parentId || ''}
              onChange={set('parentId')}
              className="input w-full"
            >
              <option value="">— Top-level category —</option>
              {data?.categories?.filter(c => !c.parentId && c._id !== editing?._id).map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input label="Description" value={form.description} onChange={set('description')} />
          <Input label="Display Order" type="number" value={form.displayOrder} onChange={set('displayOrder')} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
