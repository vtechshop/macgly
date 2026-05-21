import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, useAction } from '../../../../hooks';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/common/Input';
import toast from 'react-hot-toast';

function buildTree(cats) {
  const map = {};
  cats.forEach((c) => { map[c._id] = { ...c, children: [] }; });
  const roots = [];
  cats.forEach((c) => {
    const pid = c.parentId?._id || c.parentId;
    if (pid && map[pid]) map[pid].children.push(map[c._id]);
    else roots.push(map[c._id]);
  });
  roots.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  return roots;
}

function flattenTree(nodes, depth = 0) {
  const result = [];
  nodes.forEach((n) => {
    result.push({ ...n, depth });
    if (n.children?.length) result.push(...flattenTree(n.children, depth + 1));
  });
  return result;
}

function getDepth(allCats, cat) {
  if (!cat.parentId) return 0;
  const pid = cat.parentId?._id || cat.parentId;
  const parent = allCats.find((c) => c._id?.toString() === pid?.toString());
  return parent ? getDepth(allCats, parent) + 1 : 1;
}

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

  function openEdit(c) { setEditing(c); setForm({ ...c, parentId: c.parentId?._id || c.parentId || '' }); setModalOpen(true); }
  function openNew() { setEditing(null); setForm({ name: '', slug: '', description: '', displayOrder: 0, parentId: '' }); setModalOpen(true); }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const allCats = data?.categories || [];
  const rows = flattenTree(buildTree(allCats));

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
              <th className="text-left px-4 py-3 font-medium text-secondary-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-secondary-600 w-16">Order</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100">
            {rows.map((c) => (
              <tr key={c._id} className={`hover:bg-secondary-50 ${c.depth > 0 ? 'bg-white' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center" style={{ paddingLeft: c.depth * 24 }}>
                    {c.depth > 0 && (
                      <span className="text-secondary-300 mr-2 flex items-center">
                        {'─'.repeat(1)}
                      </span>
                    )}
                    <span className={`font-medium ${c.depth === 0 ? 'text-secondary-900' : c.depth === 1 ? 'text-secondary-700' : 'text-secondary-500'}`}>
                      {c.name}
                    </span>
                    {c.children?.length > 0 && (
                      <span className="ml-2 text-[10px] text-secondary-400 bg-secondary-100 px-1.5 py-0.5 rounded-full">
                        {c.children.length} sub
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-secondary-400 text-xs">{c.slug}</td>
                <td className="px-4 py-3 text-secondary-500">{c.displayOrder}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-secondary-700">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => { if (confirm('Delete this category?')) del(c._id); }} className="p-1.5 hover:bg-red-50 rounded text-secondary-300 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-secondary-400">No categories yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <form onSubmit={(e) => { e.preventDefault(); save({ ...form, slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), parentId: form.parentId || null }); }} className="space-y-4">
          <Input label="Name" value={form.name} onChange={set('name')} required />
          <Input label="Slug (auto if blank)" value={form.slug} onChange={set('slug')} />
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Parent Category</label>
            <select value={form.parentId || ''} onChange={set('parentId')} className="input w-full">
              <option value="">— None (top-level) —</option>
              {flattenTree(buildTree(allCats.filter((c) => c._id !== editing?._id))).map((c) => (
                <option key={c._id} value={c._id}>
                  {'  '.repeat(c.depth)}{c.depth > 0 ? '└ ' : ''}{c.name}
                </option>
              ))}
            </select>
          </div>
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
