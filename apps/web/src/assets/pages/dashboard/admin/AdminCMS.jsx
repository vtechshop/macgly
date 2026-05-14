import { useState } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, ArrowLeft, FileText } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const EMPTY = { title: '', slug: '', content: '', metaTitle: '', metaDescription: '', isPublished: true };

function PageForm({ initial = EMPTY, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="card p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Page Title *</label>
          <input className="input w-full" value={form.title} onChange={set('title')} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slug (auto-generated if empty)</label>
          <input className="input w-full font-mono text-sm" value={form.slug} onChange={set('slug')} placeholder="about-us" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Content (HTML) *</label>
        <textarea className="input w-full resize-y font-mono text-sm" rows={12} value={form.content} onChange={set('content')} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Meta Title</label>
          <input className="input w-full" value={form.metaTitle} onChange={set('metaTitle')} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Meta Description</label>
          <input className="input w-full" value={form.metaDescription} onChange={set('metaDescription')} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input type="checkbox" className="w-4 h-4 rounded" checked={form.isPublished} onChange={set('isPublished')} />
        Published
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Spinner size="sm" /> : null} Save Page
        </button>
        <button type="button" onClick={onCancel} className="btn">Cancel</button>
      </div>
    </form>
  );
}

export default function AdminCMS() {
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-cms', rev],
    () => api.get('/admin/cms').then((r) => r.data)
  );

  const pages = data?.pages || [];

  async function handleSave(form) {
    setSaving(true);
    try {
      if (view === 'edit' && selected) {
        await api.put(`/admin/cms/${selected._id}`, form);
        toast.success('Page updated');
      } else {
        await api.post('/admin/cms', form);
        toast.success('Page created');
      }
      setView('list');
      setSelected(null);
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    if (!confirm('Delete this page?')) return;
    try {
      await api.delete(`/admin/cms/${id}`);
      toast.success('Deleted');
      setRev((r) => r + 1);
    } catch { toast.error('Delete failed'); }
  }

  const goBack = () => { setView('list'); setSelected(null); };

  if (view === 'new') return (
    <div className="space-y-4">
      <button onClick={goBack} className="flex items-center gap-2 text-secondary-500 hover:text-secondary-800 text-sm font-medium"><ArrowLeft size={16} /> Back</button>
      <h1 className="text-2xl font-bold">New Page</h1>
      <PageForm onSave={handleSave} onCancel={goBack} saving={saving} />
    </div>
  );

  if (view === 'edit' && selected) return (
    <div className="space-y-4">
      <button onClick={goBack} className="flex items-center gap-2 text-secondary-500 hover:text-secondary-800 text-sm font-medium"><ArrowLeft size={16} /> Back</button>
      <h1 className="text-2xl font-bold">Edit Page</h1>
      <PageForm initial={selected} onSave={handleSave} onCancel={goBack} saving={saving} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">CMS Pages</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Manage static content pages</p>
        </div>
        <button onClick={() => setView('new')} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New Page
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : pages.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No pages yet</p>
          <button onClick={() => setView('new')} className="btn-primary mt-4">Create first page</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {pages.map((pg) => (
                <tr key={pg._id} className="hover:bg-secondary-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{pg.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-secondary-500">/page/{pg.slug}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pg.isPublished ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                      {pg.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setSelected(pg); setView('edit'); }} className="p-1.5 hover:bg-secondary-100 rounded-lg">
                        <Edit2 size={14} className="text-blue-600" />
                      </button>
                      <button onClick={() => del(pg._id)} className="p-1.5 hover:bg-secondary-100 rounded-lg">
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
