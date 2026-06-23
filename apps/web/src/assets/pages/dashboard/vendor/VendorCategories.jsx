import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight,
  Tag, Package, PackagePlus, PlusCircle, X, Check,
  LayoutGrid, Eye, EyeOff, AlertTriangle, Upload, ZoomIn,
  Layers, Users, BarChart2,
} from 'lucide-react';
import { useFetch, useAction } from '../../../../hooks';
import api from '../../../../utils/api';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ── ManageCategoryProductsModal ───────────────────────────────────────────────

function ManageCategoryProductsModal({ category, initialTab = 'view', onClose, onChanged }) {
  const [tab,      setTab]      = useState(initialTab);
  const [selected, setSelected] = useState([]);
  const [busy,     setBusy]     = useState(false);

  const { data: rawData, isLoading } = useFetch(
    ['vendor-products-all', category._id],
    () => api.get('/vendors/products', { params: { page: 1, limit: 500 } }).then((r) => r.data),
  );

  const allProducts = rawData?.products || [];

  const { inCategory, notInCategory } = useMemo(() => {
    const catIdStr = category._id?.toString();
    const inCat  = allProducts.filter((p) => p.categoryIds?.some((id) => id?.toString() === catIdStr));
    const notCat = allProducts.filter((p) => !p.categoryIds?.some((id) => id?.toString() === catIdStr));
    return { inCategory: inCat, notInCategory: notCat };
  }, [allProducts, category._id]);

  const allAddSelected = notInCategory.length > 0 && notInCategory.every((p) => selected.includes(p._id));
  function toggleAll() {
    if (allAddSelected) setSelected([]);
    else setSelected(notInCategory.map((p) => p._id));
  }
  function toggleOne(id) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  async function handleRemove(productId) {
    setBusy(true);
    try {
      await api.post('/vendors/products/remove-from-category', {
        categoryId: category._id,
        productIds: [productId],
      });
      toast.success('Product removed from category');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to remove');
    } finally { setBusy(false); }
  }

  async function handleAssign() {
    if (!selected.length) return toast.error('Select at least one product');
    setBusy(true);
    try {
      const { data } = await api.post('/vendors/products/assign-category', {
        categoryId: category._id,
        productIds: selected,
      });
      toast.success(`${data.data?.updated ?? selected.length} product(s) added to "${category.name}"`);
      setSelected([]);
      setTab('view');
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to assign');
    } finally { setBusy(false); }
  }

  function ProductRow({ p, action }) {
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-secondary-50 last:border-0">
        {action === 'add' && (
          <input type="checkbox" checked={selected.includes(p._id)} onChange={() => toggleOne(p._id)}
            className="w-4 h-4 accent-primary-600 cursor-pointer shrink-0" />
        )}
        {p.images?.[0] ? (
          <img src={normalizeImageUrl(p.images[0])} alt={p.title}
            className="w-9 h-9 rounded object-cover bg-secondary-100 shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded bg-secondary-100 flex items-center justify-center shrink-0">
            <Package size={14} className="text-secondary-300" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-secondary-900 line-clamp-1">{p.title}</p>
          <p className="text-xs text-secondary-400">{p.sku || '—'} · {formatCurrency(p.price)}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
          p.published ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'
        }`}>
          {p.published ? 'Published' : 'Draft'}
        </span>
        {action === 'remove' && (
          <button onClick={() => handleRemove(p._id)} disabled={busy}
            className="p-1.5 text-secondary-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
            <Trash2 size={13} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-100 shrink-0">
          <div>
            <h2 className="font-bold text-secondary-900">{category.name}</h2>
            <p className="text-xs text-secondary-400 mt-0.5">{inCategory.length} product(s) in this category</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-secondary-100 shrink-0">
          {[
            { id: 'view', label: `In Category (${inCategory.length})` },
            { id: 'add',  label: `Add Products (${notInCategory.length})` },
          ].map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setSelected([]); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : tab === 'view' ? (
            inCategory.length === 0 ? (
              <div className="text-center py-10">
                <Package size={32} className="mx-auto text-secondary-300 mb-2" />
                <p className="text-secondary-400 text-sm">No products in this category yet</p>
                <button onClick={() => setTab('add')} className="mt-3 text-xs text-primary-600 font-semibold hover:underline">
                  Add products →
                </button>
              </div>
            ) : inCategory.map((p) => <ProductRow key={p._id} p={p} action="remove" />)
          ) : (
            notInCategory.length === 0 ? (
              <div className="text-center py-10">
                <Check size={32} className="mx-auto text-green-400 mb-2" />
                <p className="text-secondary-400 text-sm">All your products are already in this category</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-secondary-100">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={allAddSelected} onChange={toggleAll}
                      className="w-4 h-4 accent-primary-600" />
                    <span className="font-medium text-secondary-700">Select all ({notInCategory.length})</span>
                  </label>
                  {selected.length > 0 && (
                    <span className="text-xs text-secondary-400">{selected.length} selected</span>
                  )}
                </div>
                {notInCategory.map((p) => <ProductRow key={p._id} p={p} action="add" />)}
              </>
            )
          )}
        </div>

        {/* Footer */}
        {tab === 'add' && (
          <div className="px-5 py-4 border-t border-secondary-100 shrink-0">
            <button onClick={handleAssign} disabled={busy || selected.length === 0}
              className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {busy ? 'Adding…' : `Add ${selected.length || ''} Product${selected.length !== 1 ? 's' : ''} to Category`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CategoryModal (create / edit) ─────────────────────────────────────────────

const EMPTY_CAT = {
  name: '', slug: '', description: '', image: '',
  parentId: '', sortOrder: 0, isActive: true,
};

function CategoryModal({ open, onClose, editing, allCats, onSaved }) {
  const [form,      setForm]      = useState(EMPTY_CAT);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zoomImg,   setZoomImg]   = useState(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name:        editing.name || '',
        slug:        editing.slug || '',
        description: editing.description || '',
        image:       editing.image || '',
        parentId:    editing.parentId?.toString() || '',
        sortOrder:   editing.sortOrder ?? 0,
        isActive:    editing.isActive ?? true,
      });
    } else {
      setForm(EMPTY_CAT);
    }
  }, [open, editing?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  function slugify(name) {
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function handleNameChange(val) {
    setForm((f) => ({
      ...f,
      name: val,
      // Auto-generate slug only on create
      ...(!editing && { slug: slugify(val) }),
    }));
  }

  function handleSlugChange(val) {
    setForm((f) => ({ ...f, slug: val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') }));
  }

  async function handleImageUpload(ev) {
    const files = Array.from(ev.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      const { data } = await api.post('/upload/multiple', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = data.urls?.[0]?.url || data.urls?.[0] || '';
      if (url) setForm((f) => ({ ...f, image: url }));
    } catch {
      toast.error('Image upload failed');
    } finally { setUploading(false); }
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!form.name.trim()) return toast.error('Category name is required');
    if (!form.slug.trim()) return toast.error('Slug is required');

    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        slug:        form.slug.trim(),
        description: form.description.trim() || undefined,
        image:       form.image || undefined,
        parentId:    form.parentId || null,
        sortOrder:   parseInt(form.sortOrder) || 0,
        isActive:    form.isActive,
      };

      if (editing) {
        await api.put(`/vendors/categories/${editing._id}`, payload);
        toast.success('Category updated');
      } else {
        await api.post('/vendors/categories', payload);
        toast.success('Category created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  // Top-level categories for parent dropdown (excludes self)
  const parentOptions = allCats.filter((c) => !c.parentId && c._id?.toString() !== editing?._id?.toString());

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100 shrink-0">
          <h2 className="font-bold text-secondary-900">{editing ? 'Edit Category' : 'New Category'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Category Image</label>
            {form.image ? (
              <div className="relative inline-block">
                <img src={normalizeImageUrl(form.image)} alt="" className="w-24 h-24 rounded-xl object-cover border border-secondary-200" />
                <button type="button" onClick={() => setZoomImg(form.image)}
                  className="absolute top-1 left-1 p-1 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors">
                  <ZoomIn size={12} />
                </button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, image: '' }))}
                  className="absolute top-1 right-1 p-1 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-secondary-200 rounded-xl cursor-pointer hover:border-primary-300 hover:bg-primary-50 transition-colors">
                {uploading
                  ? <Spinner size="sm" />
                  : <><Upload size={18} className="text-secondary-400 mb-1" /><span className="text-xs text-secondary-400">Upload</span></>
                }
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Name *</label>
            <input value={form.name} onChange={(ev) => handleNameChange(ev.target.value)} required
              className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              placeholder="Enter category name" />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Slug <span className="text-secondary-400 font-normal">(URL-safe identifier)</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-secondary-400 text-sm shrink-0">macgly.com/category/</span>
              <input value={form.slug} onChange={(ev) => handleSlugChange(ev.target.value)} required
                className="flex-1 border border-secondary-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="power-tools" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Parent category */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Parent Category</label>
              <select value={form.parentId} onChange={(ev) => setForm((f) => ({ ...f, parentId: ev.target.value }))}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="">Top-level (no parent)</option>
                {parentOptions.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            {/* Sort order */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Sort Order <span className="text-secondary-400 font-normal">(higher = first)</span>
              </label>
              <input type="number" value={form.sortOrder}
                onChange={(ev) => setForm((f) => ({ ...f, sortOrder: ev.target.value }))}
                className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))}
              rows={3} placeholder="Brief description for customers…"
              className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between bg-secondary-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-secondary-800">Active</p>
              <p className="text-xs text-secondary-400 mt-0.5">Inactive categories are hidden from customers</p>
            </div>
            <button type="button" onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.isActive ? 'bg-green-500' : 'bg-secondary-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5.5 left-0.5' : 'left-0.5'}`} />
            </button>
          </div>

        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-secondary-100 shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 border border-secondary-200 rounded-lg text-sm font-medium text-secondary-700 hover:bg-secondary-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors min-w-[120px]">
            {saving ? 'Saving…' : editing ? 'Update Category' : 'Create Category'}
          </button>
        </div>
      </div>

      {/* Zoom modal */}
      {zoomImg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setZoomImg(null)}>
          <img src={normalizeImageUrl(zoomImg)} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function VendorCategories() {
  const { user } = useSelector((s) => s.auth);
  const [rev,              setRev]             = useState(0);
  const [search,           setSearch]          = useState('');
  const [expanded,         setExpanded]        = useState({});
  const [showModal,        setShowModal]       = useState(false);
  const [editingCategory,  setEditingCategory] = useState(null);
  const [managingCategory, setManaging]        = useState(null); // { category, initialTab }

  const { data: catsRaw, isLoading } = useFetch(
    ['vendor-categories', rev],
    () => api.get('/vendors/categories', { params: { includeInactive: true } }).then((r) => r.data),
  );
  const { data: statsRaw } = useFetch(
    ['vendor-category-stats', rev],
    () => api.get('/vendors/categories/stats').then((r) => r.data),
  );

  const allCats = catsRaw?.data || [];
  const stats   = statsRaw?.data || {};

  // Build tree
  const { parents, childrenByParent } = useMemo(() => {
    const p  = allCats.filter((c) => !c.parentId);
    const cm = {};
    allCats.filter((c) => c.parentId).forEach((c) => {
      const pid = c.parentId?.toString();
      if (!cm[pid]) cm[pid] = [];
      cm[pid].push(c);
    });
    return { parents: p, childrenByParent: cm };
  }, [allCats]);

  // Default expand all parents
  useEffect(() => {
    const init = {};
    parents.forEach((p) => { init[p._id] = true; });
    setExpanded(init);
  }, [parents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered + search
  const searchLower = search.toLowerCase();
  const filteredParents = useMemo(() => {
    if (!search) return parents;
    return allCats.filter((c) =>
      c.name.toLowerCase().includes(searchLower) ||
      c.slug.toLowerCase().includes(searchLower) ||
      (c.description || '').toLowerCase().includes(searchLower)
    );
  }, [allCats, search, searchLower, parents]);

  function toggleExpand(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  function openCreate() { setEditingCategory(null); setShowModal(true); }
  function openEdit(cat) { setEditingCategory(cat); setShowModal(true); }
  function refresh()     { setRev((r) => r + 1); }

  async function handleDelete(cat) {
    const msg = cat.createdBy?.toString() === user?._id?.toString()
      ? `Submit a delete request for "${cat.name}"? Admin will review and approve.`
      : null;
    if (!msg) return;
    if (!confirm(msg)) return;
    try {
      const { data } = await api.delete(`/vendors/categories/${cat._id}`);
      toast.success(data.message || 'Delete request submitted');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    }
  }

  const isMyCategory   = (cat) => cat.createdBy?.toString() === user?._id?.toString();
  const canEditDelete  = (cat) => isMyCategory(cat) || user?.role === 'admin';

  function CategoryBadge({ cat }) {
    if (cat.deleteRequested) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Delete Pending</span>;
    }
    if (isMyCategory(cat)) {
      return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">You</span>;
    }
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Admin</span>;
  }

  function ActionButtons({ cat }) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => setManaging({ category: cat, initialTab: 'add' })}
          className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
          <PackagePlus size={12} /> Add Products
        </button>
        <Link
          to={`/dashboard/vendor/products?action=add&category=${cat._id}`}
          className="flex items-center gap-1 text-xs font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded-lg transition-colors whitespace-nowrap">
          <PlusCircle size={12} /> New Product
        </Link>
        {canEditDelete(cat) && (
          <>
            <button onClick={() => openEdit(cat)}
              className="p-1.5 text-secondary-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
              <Pencil size={13} />
            </button>
            {!cat.deleteRequested && (
              <button onClick={() => handleDelete(cat)}
                className="p-1.5 text-secondary-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Request delete">
                <Trash2 size={13} />
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // Flat list when searching (no tree structure)
  const displayList = search ? filteredParents : null;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-secondary-900">Category Management</h1>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors">
          <Plus size={15} /> Add Category
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Categories',  value: stats.totalCategories ?? 0,        icon: LayoutGrid,  color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Active',            value: stats.activeCategories ?? 0,        icon: Eye,         color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Your Categories',   value: stats.yourCategories ?? 0,          icon: Users,       color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'With Products',     value: stats.categoriesWithProducts ?? 0,  icon: BarChart2,   color: 'text-orange-500', bg: 'bg-orange-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border border-secondary-200 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xl font-black text-secondary-900 leading-tight">{value}</p>
              <p className="text-xs text-secondary-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending deletion alert */}
      {stats.pendingDeletion > 0 && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-orange-500 shrink-0" />
          <p className="text-sm font-medium text-orange-800">
            {stats.pendingDeletion} category deletion request{stats.pendingDeletion !== 1 ? 's' : ''} awaiting admin review
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          value={search}
          onChange={(ev) => setSearch(ev.target.value)}
          placeholder="Search categories…"
          className="w-full pl-9 pr-3 py-2.5 border border-secondary-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      {/* ── Desktop table (hidden on mobile) ── */}
      <div className="hidden lg:block bg-white rounded-xl border border-secondary-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary-50 border-b border-secondary-200">
              {['CATEGORY', 'SLUG', 'PRODUCTS', 'SORT', 'STATUS', 'ACTIONS'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12"><Spinner /></td>
              </tr>
            ) : (displayList || parents).length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <Tag size={32} className="mx-auto text-secondary-300 mb-2" />
                  <p className="text-secondary-400">{search ? 'No categories match your search' : 'No categories yet'}</p>
                </td>
              </tr>
            ) : (
              (displayList || parents).map((cat) => {
                const children  = !search ? (childrenByParent[cat._id?.toString()] || []) : [];
                const isExpanded = expanded[cat._id] !== false;

                return [
                  // Parent row
                  <tr key={cat._id} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {children.length > 0 && !search && (
                          <button onClick={() => toggleExpand(cat._id)} className="text-secondary-400 hover:text-secondary-600 transition-colors shrink-0">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                        {cat.image ? (
                          <img src={normalizeImageUrl(cat.image)} alt={cat.name}
                            className="w-8 h-8 rounded-lg object-cover bg-secondary-100 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <Tag size={13} className="text-blue-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-secondary-900">{cat.name}</span>
                            <CategoryBadge cat={cat} />
                          </div>
                          {cat.description && (
                            <p className="text-xs text-secondary-400 mt-0.5 line-clamp-1 max-w-xs">{cat.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-secondary-100 text-secondary-600 px-2 py-0.5 rounded">{cat.slug}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setManaging({ category: cat, initialTab: 'view' })}
                        className="flex items-center gap-1 text-sm font-semibold text-secondary-700 hover:text-primary-600 transition-colors">
                        <Package size={13} className="text-secondary-400" /> {cat.productCount ?? 0}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-secondary-500 text-sm">{cat.sortOrder ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        cat.isActive ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'
                      }`}>
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ActionButtons cat={cat} />
                    </td>
                  </tr>,

                  // Child rows (indented)
                  ...(isExpanded && !search ? children.map((child) => (
                    <tr key={child._id} className="hover:bg-secondary-50 transition-colors bg-secondary-50/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3 pl-8">
                          <span className="text-secondary-300 text-sm shrink-0">└─</span>
                          {child.image ? (
                            <img src={normalizeImageUrl(child.image)} alt={child.name}
                              className="w-6 h-6 rounded object-cover bg-secondary-100 shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded bg-secondary-100 flex items-center justify-center shrink-0">
                              <Layers size={10} className="text-secondary-300" />
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-secondary-700">{child.name}</span>
                            <CategoryBadge cat={child} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-mono bg-secondary-100 text-secondary-600 px-2 py-0.5 rounded">{child.slug}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => setManaging({ category: child, initialTab: 'view' })}
                          className="flex items-center gap-1 text-sm font-semibold text-secondary-700 hover:text-primary-600 transition-colors">
                          <Package size={12} className="text-secondary-400" /> {child.productCount ?? 0}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-secondary-500 text-sm">{child.sortOrder ?? 0}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          child.isActive ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'
                        }`}>
                          {child.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <ActionButtons cat={child} />
                      </td>
                    </tr>
                  )) : []),
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards (shown on mobile only) ── */}
      <div className="block lg:hidden space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (displayList || parents).length === 0 ? (
          <div className="text-center py-10">
            <Tag size={32} className="mx-auto text-secondary-300 mb-2" />
            <p className="text-secondary-400">{search ? 'No categories match your search' : 'No categories yet'}</p>
          </div>
        ) : (
          (displayList || parents).map((cat) => {
            const children = !search ? (childrenByParent[cat._id?.toString()] || []) : [];
            const isExpanded = expanded[cat._id] !== false;

            return (
              <div key={cat._id} className="bg-white border border-secondary-200 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {cat.image ? (
                      <img src={normalizeImageUrl(cat.image)} alt={cat.name}
                        className="w-10 h-10 rounded-lg object-cover bg-secondary-100 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Tag size={14} className="text-blue-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="font-semibold text-secondary-900">{cat.name}</span>
                        <CategoryBadge cat={cat} />
                      </div>
                      <span className="text-xs font-mono text-secondary-400">{cat.slug}</span>
                      {cat.description && (
                        <p className="text-xs text-secondary-500 mt-1 line-clamp-2">{cat.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-secondary-500">
                        <span>{cat.productCount ?? 0} products</span>
                        <span>Sort: {cat.sortOrder ?? 0}</span>
                        <span className={`font-semibold ${cat.isActive ? 'text-green-600' : 'text-secondary-400'}`}>
                          {cat.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <ActionButtons cat={cat} />
                  </div>
                </div>

                {/* Children */}
                {children.length > 0 && (
                  <>
                    <button onClick={() => toggleExpand(cat._id)}
                      className="w-full px-4 py-2 bg-secondary-50 text-xs font-medium text-secondary-500 flex items-center gap-1 hover:bg-secondary-100 transition-colors border-t border-secondary-100">
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {children.length} sub-categor{children.length !== 1 ? 'ies' : 'y'}
                    </button>
                    {isExpanded && children.map((child) => (
                      <div key={child._id} className="px-4 py-3 border-t border-secondary-100 bg-secondary-50/50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-secondary-300 text-sm">└─</span>
                          <span className="text-sm font-medium text-secondary-700">{child.name}</span>
                          <CategoryBadge cat={child} />
                        </div>
                        <ActionButtons cat={child} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Modals ── */}
      {showModal && (
        <CategoryModal
          open={showModal}
          onClose={() => setShowModal(false)}
          editing={editingCategory}
          allCats={allCats}
          onSaved={refresh}
        />
      )}

      {managingCategory && (
        <ManageCategoryProductsModal
          category={managingCategory.category}
          initialTab={managingCategory.initialTab}
          onClose={() => setManaging(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
