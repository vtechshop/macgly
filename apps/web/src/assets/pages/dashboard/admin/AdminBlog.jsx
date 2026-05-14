import { useState } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, ArrowLeft, FileText } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const EMPTY = { title: '', slug: '', excerpt: '', content: '', coverImage: '', tags: '', isPublished: false };

function BlogForm({ initial = EMPTY, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="card p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input className="input w-full" value={form.title} onChange={set('title')} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slug (auto-generated if empty)</label>
          <input className="input w-full font-mono text-sm" value={form.slug} onChange={set('slug')} placeholder="my-blog-post" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Excerpt</label>
        <textarea className="input w-full resize-none" rows={2} value={form.excerpt} onChange={set('excerpt')} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Content *</label>
        <textarea className="input w-full resize-y font-mono text-sm" rows={10} value={form.content} onChange={set('content')} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Cover Image URL</label>
          <input className="input w-full" type="url" value={form.coverImage} onChange={set('coverImage')} placeholder="https://…" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
          <input className="input w-full" value={form.tags} onChange={set('tags')} placeholder="tools, machinery, tips" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input type="checkbox" className="w-4 h-4 rounded" checked={form.isPublished} onChange={set('isPublished')} />
        Publish immediately
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Spinner size="sm" /> : null} Save Post
        </button>
        <button type="button" onClick={onCancel} className="btn">Cancel</button>
      </div>
    </form>
  );
}

export default function AdminBlog() {
  const [view, setView] = useState('list'); // list | new | edit
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rev, setRev] = useState(0);

  const { data, isLoading } = useFetch(
    ['admin-blog', rev],
    () => api.get('/admin/blog').then((r) => r.data)
  );

  const posts = data?.posts || [];

  async function handleSave(form) {
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };
      if (view === 'edit' && selected) {
        await api.put(`/admin/blog/${selected._id}`, payload);
        toast.success('Post updated');
      } else {
        await api.post('/admin/blog', payload);
        toast.success('Post created');
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

  async function togglePublish(post) {
    try {
      await api.patch(`/admin/blog/${post._id}/publish`, { isPublished: !post.isPublished });
      setRev((r) => r + 1);
    } catch { toast.error('Could not update'); }
  }

  async function del(id) {
    if (!confirm('Delete this post?')) return;
    try {
      await api.delete(`/admin/blog/${id}`);
      toast.success('Deleted');
      setRev((r) => r + 1);
    } catch { toast.error('Delete failed'); }
  }

  if (view === 'new') {
    return (
      <div className="space-y-4">
        <button onClick={() => setView('list')} className="flex items-center gap-2 text-secondary-500 hover:text-secondary-800 text-sm font-medium">
          <ArrowLeft size={16} /> Back to Blog
        </button>
        <h1 className="text-2xl font-bold">New Post</h1>
        <BlogForm onSave={handleSave} onCancel={() => setView('list')} saving={saving} />
      </div>
    );
  }

  if (view === 'edit' && selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => { setView('list'); setSelected(null); }} className="flex items-center gap-2 text-secondary-500 hover:text-secondary-800 text-sm font-medium">
          <ArrowLeft size={16} /> Back to Blog
        </button>
        <h1 className="text-2xl font-bold">Edit Post</h1>
        <BlogForm
          initial={{ ...selected, tags: Array.isArray(selected.tags) ? selected.tags.join(', ') : '' }}
          onSave={handleSave}
          onCancel={() => { setView('list'); setSelected(null); }}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Manage blog posts and articles</p>
        </div>
        <button onClick={() => setView('new')} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New Post
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : posts.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No blog posts yet</p>
          <button onClick={() => setView('new')} className="btn-primary mt-4">Write first post</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Post</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {posts.map((p) => (
                <tr key={p._id} className="hover:bg-secondary-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium line-clamp-1">{p.title}</p>
                    {p.excerpt && <p className="text-xs text-secondary-400 line-clamp-1 mt-0.5">{p.excerpt}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-secondary-500">{p.slug}</td>
                  <td className="px-4 py-3 text-secondary-500 text-xs">{fmtDate(p.publishedAt || p.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.isPublished ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                      {p.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => togglePublish(p)}
                        className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors"
                        title={p.isPublished ? 'Unpublish' : 'Publish'}
                      >
                        {p.isPublished ? <EyeOff size={14} className="text-secondary-400" /> : <Eye size={14} className="text-green-600" />}
                      </button>
                      <button
                        onClick={() => { setSelected(p); setView('edit'); }}
                        className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} className="text-blue-600" />
                      </button>
                      <button
                        onClick={() => del(p._id)}
                        className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors"
                      >
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
