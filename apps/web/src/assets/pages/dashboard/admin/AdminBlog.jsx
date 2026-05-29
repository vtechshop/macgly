import { useState } from 'react';
import { Plus, Eye, Edit2, Trash2, FileText, RefreshCw, X, BarChart2, MessageSquare } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ['Tech News', 'Product Reviews', 'How-To Guides', 'Industry Insights', 'Company Updates', 'Tips & Tricks'];

const STATUS_CFG = {
  published: { label: 'Published', class: 'bg-green-100 text-green-700' },
  draft:     { label: 'Draft',     class: 'bg-yellow-100 text-yellow-700' },
  archived:  { label: 'Archived',  class: 'bg-secondary-100 text-secondary-500' },
};

const TYPE_CFG = {
  post:  { label: 'Article', class: 'bg-blue-100 text-blue-700' },
  video: { label: 'Video',   class: 'bg-red-100 text-red-700' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function autoSlug(title) {
  return title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
}

// ─── Blog Modal (Create / Edit) ───────────────────────────────────────────────
const EMPTY_FORM = { title: '', slug: '', content: '', excerpt: '', category: '', status: 'draft', featuredImage: '', type: 'post' };

function BlogModal({ post, onClose, onSave }) {
  const isEdit = !!post?._id;
  const [form, setForm] = useState({
    title:         post?.title || '',
    slug:          post?.slug  || '',
    content:       post?.content || '',
    excerpt:       post?.excerpt || '',
    category:      post?.category || '',
    status:        post?.status || 'draft',
    featuredImage: post?.featuredImage || post?.coverImage || '',
    type:          post?.type || 'post',
  });
  const [slugLocked, setSlugLocked] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handleTitle(v) {
    set('title', v);
    if (!slugLocked) set('slug', autoSlug(v));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return toast.error('Title and content are required');
    setSaving(true);
    try {
      if (isEdit) await api.put(`/admin/blog/${post._id}`, form);
      else        await api.post('/admin/blog', form);
      toast.success(isEdit ? 'Post updated' : 'Post created');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <h2 className="font-bold text-lg">{isEdit ? 'Edit Post' : 'Create Blog Post'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary-100 rounded-lg"><X size={18} className="text-secondary-400" /></button>
        </div>

        <form id="blog-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input className="input w-full" value={form.title} onChange={(e) => handleTitle(e.target.value)} required />
          </div>

          {/* Slug */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Slug *</label>
              {isEdit && <span className="text-xs text-secondary-400">Locked on edit</span>}
            </div>
            <input
              className={`input w-full font-mono text-sm ${isEdit ? 'bg-secondary-50 text-secondary-500' : ''}`}
              value={form.slug}
              onChange={(e) => { setSlugLocked(true); set('slug', e.target.value); }}
              readOnly={isEdit}
              required
            />
          </div>

          {/* Type + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select className="input w-full" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="post">Article</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <select className="input w-full" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium mb-1">Excerpt</label>
            <textarea className="input w-full resize-none" rows={2} value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} placeholder="Brief summary…" />
          </div>

          {/* Featured Image */}
          <div>
            <label className="block text-sm font-medium mb-1">Featured Image URL</label>
            <input className="input w-full" placeholder="https://cdn.example.com/image.jpg" value={form.featuredImage} onChange={(e) => set('featuredImage', e.target.value)} />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium mb-1">Content (HTML) *</label>
            <textarea className="input w-full resize-y font-mono text-sm" rows={12} value={form.content} onChange={(e) => set('content', e.target.value)} required />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1">Status *</label>
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-secondary-100">
          <button onClick={onClose} className="btn text-sm">Cancel</button>
          <button form="blog-form" type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-2">
            {saving && <Spinner size="sm" />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ post, onClose, onConfirm, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-600" />
        </div>
        <h3 className="font-bold text-lg mb-2">Delete Post?</h3>
        <p className="text-secondary-500 text-sm mb-6">
          Are you sure you want to delete <span className="font-semibold text-secondary-800">"{post.title}"</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn flex-1">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-xl text-sm disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminBlog() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', type: '', category: '', search: '' });
  const [rev, setRev] = useState(0);
  const [modal, setModal] = useState(null);     // null | { type: 'create'|'edit'|'delete', post? }
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: statsData } = useFetch(
    ['admin-blog-stats', rev],
    () => api.get('/admin/blog/stats').then((r) => r.data)
  );

  const { data, isLoading } = useFetch(
    ['admin-blog', filters, page, rev],
    () => api.get('/admin/blog', {
      params: { page, limit: 10, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) },
    }).then((r) => r.data)
  );

  const posts = data?.data || data?.posts || [];
  const meta  = data?.meta || data?.pagination || {};
  const stats = statsData?.data || {};

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  async function openEdit(post) {
    setLoadingEdit(true);
    try {
      const res = await api.get(`/admin/blog/${post._id}`);
      setModal({ type: 'edit', post: res.data.data || res.data.post });
    } catch { toast.error('Failed to load post'); }
    finally { setLoadingEdit(false); }
  }

  async function confirmDelete() {
    if (!modal?.post) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/blog/${modal.post._id}`);
      toast.success('Post deleted');
      setModal(null);
      setRev((r) => r + 1);
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(false); }
  }

  function afterSave() { setModal(null); setRev((r) => r + 1); }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Blog Management</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Manage your blog posts and videos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRev((r) => r + 1)} className="btn flex items-center gap-1.5 text-sm">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Create Blog Post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Posts',     value: stats.totalBlogs    ?? 0, icon: FileText,      color: 'blue' },
          { label: 'Published',       value: stats.byStatus?.published ?? 0, icon: Eye,    color: 'green' },
          { label: 'Total Views',     value: stats.totalViews    ?? 0, icon: BarChart2,     color: 'purple' },
          { label: 'Total Comments',  value: stats.totalComments ?? 0, icon: MessageSquare, color: 'amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-${color}-50 shrink-0`}>
              <Icon size={16} className={`text-${color}-600`} />
            </div>
            <div>
              <p className="text-xs text-secondary-500 font-medium">{label}</p>
              <p className="text-xl font-bold mt-0.5">{value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-40">
          <input
            className="input pl-8 text-sm w-full"
            placeholder="Search blogs…"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <select className="input text-sm" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select className="input text-sm" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
          <option value="">All Types</option>
          <option value="post">Article</option>
          <option value="video">Video</option>
        </select>
        <select className="input text-sm" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : posts.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No blog posts found</p>
          <button onClick={() => setModal({ type: 'create' })} className="btn-primary mt-4 text-sm">Write first post</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase border-b border-secondary-100">
              <tr>
                <th className="px-4 py-3 text-left">Blog Post</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Stats</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {posts.map((p) => {
                const statusCfg = STATUS_CFG[p.status] || STATUS_CFG.draft;
                const typeCfg   = TYPE_CFG[p.type]     || TYPE_CFG.post;
                return (
                  <tr key={p._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary-100 shrink-0">
                          {(p.featuredImage || p.coverImage) ? (
                            <img src={p.featuredImage || p.coverImage} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><FileText size={14} className="text-secondary-300" /></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium line-clamp-1">{p.title}</p>
                          <p className="text-xs text-secondary-400 mt-0.5">{p.category || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeCfg.class}`}>{typeCfg.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.class}`}>{statusCfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary-500">
                      <div>{(p.views || 0).toLocaleString()} views</div>
                      <div>{(p.likes || 0).toLocaleString()} likes</div>
                      <div>{(p.commentsCount || 0).toLocaleString()} comments</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary-500">{fmtDate(p.publishedAt || p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-secondary-100 rounded-lg" title="View">
                          <Eye size={14} className="text-blue-500" />
                        </a>
                        <button
                          onClick={() => openEdit(p)}
                          disabled={loadingEdit}
                          className="p-1.5 hover:bg-secondary-100 rounded-lg"
                          title="Edit"
                        >
                          <Edit2 size={14} className="text-secondary-500" />
                        </button>
                        <button onClick={() => setModal({ type: 'delete', post: p })} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-secondary-100 flex items-center justify-between text-sm text-secondary-500">
              <span>Page {meta.page} of {meta.totalPages} · {meta.total} posts</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Prev</button>
                <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="btn py-1 px-3 text-xs disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <BlogModal
          post={modal.post}
          onClose={() => setModal(null)}
          onSave={afterSave}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteModal
          post={modal.post}
          deleting={deleting}
          onClose={() => setModal(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
