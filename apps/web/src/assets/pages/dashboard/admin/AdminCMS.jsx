import { useState } from 'react';
import { Plus, Edit2, Trash2, Eye, FileText, RefreshCw, X } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function autoSlug(title) {
  return title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

// ─── Shared Modal ─────────────────────────────────────────────────────────────
function ContentModal({ mode, item, onClose, onSave }) {
  const isPost = mode === 'post';
  const isEdit = !!item?._id;

  const [form, setForm] = useState({
    title:        item?.title || '',
    slug:         item?.slug || '',
    content:      item?.content || '',
    excerpt:      item?.excerpt || '',
    category:     item?.category || '',
    featuredImage: item?.featuredImage || item?.coverImage || '',
    status:       item?.status || (item?.isPublished ? 'published' : 'draft'),
    published:    item?.isPublished ?? false,
  });
  const [slugLocked, setSlugLocked] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handleTitleChange(v) {
    set('title', v);
    if (!slugLocked) set('slug', autoSlug(v));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.content.trim()) return toast.error('Content is required');
    setSaving(true);
    try {
      if (isPost) {
        if (isEdit) {
          await api.put(`/admin/blog/${item._id}`, { ...form });
        } else {
          await api.post('/admin/blog', { ...form });
        }
      } else {
        if (isEdit) {
          await api.put(`/admin/cms/${item._id}`, { ...form });
        } else {
          await api.post('/admin/cms', { ...form });
        }
      }
      toast.success(isEdit ? 'Saved' : 'Created');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100">
          <h2 className="font-bold text-lg">
            {isEdit ? 'Edit' : 'Create'} {isPost ? 'Blog Post' : 'Page'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary-100 rounded-lg">
            <X size={18} className="text-secondary-400" />
          </button>
        </div>

        <form id="cms-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              className="input w-full"
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
            />
          </div>

          {/* Slug */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Slug *</label>
              {isEdit && (
                <span className="text-xs text-secondary-400">Locked on edit</span>
              )}
            </div>
            <input
              className={`input w-full font-mono text-sm ${isEdit ? 'bg-secondary-50 text-secondary-500' : ''}`}
              value={form.slug}
              onChange={(e) => { setSlugLocked(true); set('slug', e.target.value); }}
              readOnly={isEdit}
              required
            />
          </div>

          {/* Blog-only: Category + Excerpt + Featured Image */}
          {isPost && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <input
                  className="input w-full"
                  placeholder="How-To Guides, Product Reviews…"
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Excerpt</label>
                <textarea
                  className="input w-full resize-none"
                  rows={2}
                  placeholder="Brief summary shown in blog listings…"
                  value={form.excerpt}
                  onChange={(e) => set('excerpt', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Featured Image URL</label>
                <input
                  className="input w-full"
                  placeholder="Enter image URL"
                  value={form.featuredImage}
                  onChange={(e) => set('featuredImage', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Pages-only: Excerpt */}
          {!isPost && (
            <div>
              <label className="block text-sm font-medium mb-1">Excerpt</label>
              <textarea
                className="input w-full resize-none"
                rows={2}
                placeholder="Brief description…"
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
              />
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-sm font-medium mb-1">Content (HTML) *</label>
            <textarea
              className="input w-full resize-y font-mono text-sm"
              rows={12}
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              required
            />
          </div>

          {/* Status */}
          {isPost ? (
            <div>
              <label className="block text-sm font-medium mb-1">Status *</label>
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded"
                checked={form.published}
                onChange={(e) => set('published', e.target.checked)}
              />
              Publish immediately
            </label>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-secondary-100">
          <button onClick={onClose} className="btn text-sm">Cancel</button>
          <button form="cms-form" type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? <Spinner size="sm" /> : null}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : `Create ${isPost ? 'Post' : 'Page'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminCMS() {
  const [activeTab, setActiveTab] = useState('posts');
  const [modal, setModal] = useState(null); // null | { mode: 'post'|'page', item?: object }
  const [postsRev, setPostsRev] = useState(0);
  const [pagesRev, setPagesRev] = useState(0);

  const { data: postsData, isLoading: postsLoading } = useFetch(
    ['admin-blog', postsRev],
    () => api.get('/admin/blog').then((r) => r.data),
    { enabled: activeTab === 'posts' }
  );

  const { data: pagesData, isLoading: pagesLoading } = useFetch(
    ['admin-pages', pagesRev],
    () => api.get('/admin/cms').then((r) => r.data),
    { enabled: activeTab === 'pages' }
  );

  const posts = postsData?.data || [];
  const pages = pagesData?.data || pagesData?.pages || [];

  function openCreate() {
    setModal({ mode: activeTab === 'posts' ? 'post' : 'page' });
  }

  function openEdit(item) {
    setModal({ mode: activeTab === 'posts' ? 'post' : 'page', item });
  }

  function closeModal() { setModal(null); }

  function afterSave() {
    closeModal();
    if (activeTab === 'posts') setPostsRev((r) => r + 1);
    else setPagesRev((r) => r + 1);
  }

  async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    try { await api.delete(`/admin/blog/${id}`); toast.success('Deleted'); setPostsRev((r) => r + 1); }
    catch { toast.error('Delete failed'); }
  }

  async function deletePage(id) {
    if (!confirm('Delete this page?')) return;
    try { await api.delete(`/admin/cms/${id}`); toast.success('Deleted'); setPagesRev((r) => r + 1); }
    catch { toast.error('Delete failed'); }
  }

  const isPost = activeTab === 'posts';
  const isLoading = isPost ? postsLoading : pagesLoading;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Content Management</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Manage blog posts and pages</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (isPost) setPostsRev((r) => r + 1); else setPagesRev((r) => r + 1); }}
            className="btn flex items-center gap-1.5 text-sm"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> {isPost ? 'Create Post' : 'Create Page'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-secondary-200">
        {[['posts', 'Blog Posts'], ['pages', 'Pages']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setActiveTab(val)}
            className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === val
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-secondary-500 hover:text-secondary-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : activeTab === 'posts' ? (
        posts.length === 0 ? (
          <div className="card p-14 text-center text-secondary-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No blog posts yet</p>
            <button onClick={openCreate} className="btn-primary mt-4 text-sm">Create first post</button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase border-b border-secondary-100">
                <tr>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Slug</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {posts.map((p) => (
                  <tr key={p._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium line-clamp-1">{p.title}</p>
                      {p.excerpt && <p className="text-xs text-secondary-400 line-clamp-1 mt-0.5">{p.excerpt}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-secondary-500 max-w-xs">
                      <span className="truncate block">{p.slug ? `/${p.slug}` : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary-600">{p.category || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                        {p.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <a
                          href={`/blog/${p.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-secondary-100 rounded-lg"
                          title="View post"
                        >
                          <Eye size={14} className="text-blue-500" />
                        </a>
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-secondary-100 rounded-lg" title="Edit">
                          <Edit2 size={14} className="text-secondary-500" />
                        </button>
                        <button onClick={() => deletePost(p._id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        pages.length === 0 ? (
          <div className="card p-14 text-center text-secondary-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No pages yet</p>
            <button onClick={openCreate} className="btn-primary mt-4 text-sm">Create first page</button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary-50 text-secondary-500 text-xs uppercase border-b border-secondary-100">
                <tr>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Slug</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100">
                {pages.map((pg) => (
                  <tr key={pg._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3 max-w-sm">
                      <p className="font-medium line-clamp-1">{pg.title}</p>
                      {pg.excerpt && <p className="text-xs text-secondary-400 line-clamp-1 mt-0.5">{pg.excerpt}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-secondary-500">/{pg.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pg.isPublished ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                        {pg.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <a
                          href={`/${pg.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-secondary-100 rounded-lg"
                          title="View page"
                        >
                          <Eye size={14} className="text-blue-500" />
                        </a>
                        <button onClick={() => openEdit(pg)} className="p-1.5 hover:bg-secondary-100 rounded-lg" title="Edit">
                          <Edit2 size={14} className="text-secondary-500" />
                        </button>
                        <button onClick={() => deletePage(pg._id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {modal && (
        <ContentModal
          mode={modal.mode}
          item={modal.item}
          onClose={closeModal}
          onSave={afterSave}
        />
      )}
    </div>
  );
}
