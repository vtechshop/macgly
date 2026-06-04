import { useState, useEffect, useRef } from 'react';
import {
  Plus, Edit2, Trash2, Package, Search,
  Upload, X, Check, AlertCircle, FolderOpen,
  Layers, Image,
} from 'lucide-react';
import api from '../../../../utils/api';
import { normalizeImageUrl } from '../../../../utils/format';
import toast from 'react-hot-toast';

// ── tree helpers ──────────────────────────────────────────────────────────────

function buildTree(categories) {
  const map = {};
  categories.forEach((c) => { map[c._id] = { ...c, children: [] }; });
  const roots = [];
  categories.forEach((c) => {
    const pid = c.parentId?._id || c.parentId;
    if (pid && map[pid]) {
      map[pid].children.push(map[c._id]);
    } else {
      roots.push(map[c._id]);
    }
  });
  function sortNodes(nodes) {
    nodes.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name));
    nodes.forEach((n) => n.children?.length && sortNodes(n.children));
  }
  sortNodes(roots);
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

// ── constants ─────────────────────────────────────────────────────────────────

const BLANK = {
  name: '', slug: '', description: '', image: '',
  parentId: '', displayOrder: 0, isActive: true,
  _slugEdited: false,
};

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminCategories() {
  const [categories, setCategories]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // form modal
  const [showForm, setShowForm]         = useState(false);
  const [editCat, setEditCat]           = useState(null);
  const [form, setForm]                 = useState(BLANK);
  const [saving, setSaving]             = useState(false);
  const [imgUploading, setImgUploading] = useState(false);
  const imgInputRef                     = useRef(null);

  // delete confirm
  const [deleteId, setDeleteId]         = useState(null);
  const [deleting, setDeleting]         = useState(false);

  // products modal
  const [prodModal, setProdModal]           = useState(null);
  const [prodTab, setProdTab]               = useState('in');
  const [inProds, setInProds]               = useState([]);
  const [outProds, setOutProds]             = useState([]);
  const [prodSearch, setProdSearch]         = useState('');
  const [selectedProds, setSelectedProds]   = useState(new Set());
  const [prodsLoading, setProdsLoading]     = useState(false);
  const [addingProds, setAddingProds]       = useState(false);

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/categories');
      setCategories(data.categories || []);
    } catch { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  }

  // ── slug ─────────────────────────────────────────────────────────────────────

  function toSlug(str) {
    return str.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function setField(key, val) {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === 'name' && !f._slugEdited) next.slug = toSlug(val);
      return next;
    });
  }

  // ── form ─────────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditCat(null);
    setForm(BLANK);
    setShowForm(true);
  }

  function openAddSub(parentCat) {
    setEditCat(null);
    setForm({ ...BLANK, parentId: parentCat._id.toString() });
    setShowForm(true);
  }

  function openEdit(cat) {
    setEditCat(cat);
    setForm({
      name:         cat.name || '',
      slug:         cat.slug || '',
      description:  cat.description || '',
      image:        cat.image || '',
      parentId:     cat.parentId?._id?.toString() || cat.parentId?.toString() || '',
      displayOrder: cat.displayOrder ?? 0,
      isActive:     cat.isActive !== false,
      _slugEdited:  true,
    });
    setShowForm(true);
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/admin/upload/image?folder=categories', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((f) => ({ ...f, image: data.url }));
      toast.success('Image uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setImgUploading(false); e.target.value = ''; }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.slug.trim()) return toast.error('Slug is required');
    setSaving(true);
    try {
      const { _slugEdited, ...fields } = form;
      const payload = {
        ...fields,
        parentId:     fields.parentId || null,
        displayOrder: Number(fields.displayOrder) || 0,
      };
      if (editCat) {
        await api.put(`/admin/categories/${editCat._id}`, payload);
        toast.success('Category updated');
      } else {
        await api.post('/admin/categories', payload);
        toast.success('Category created');
      }
      setShowForm(false);
      loadCategories();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  // ── delete ────────────────────────────────────────────────────────────────────

  async function handleDelete(id) {
    setDeleting(true);
    try {
      await api.delete(`/admin/categories/${id}`);
      toast.success('Category deleted');
      setDeleteId(null);
      loadCategories();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    } finally { setDeleting(false); }
  }

  // ── products modal ────────────────────────────────────────────────────────────

  async function openProductsModal(cat) {
    setProdModal(cat);
    setProdTab('in');
    setProdSearch('');
    setSelectedProds(new Set());
    setProdsLoading(true);
    try {
      const [inRes, outRes] = await Promise.all([
        api.get(`/admin/products?categoryId=${cat._id}&limit=200`),
        api.get(`/admin/products?notInCategoryId=${cat._id}&limit=200`),
      ]);
      setInProds(inRes.data.products || []);
      setOutProds(outRes.data.products || []);
    } catch { toast.error('Failed to load products'); }
    finally { setProdsLoading(false); }
  }

  async function removeFromCategory(productId) {
    try {
      await api.post('/admin/products/remove-from-category', {
        productId,
        categoryId: prodModal._id,
      });
      setInProds((p) => p.filter((x) => x._id !== productId));
      toast.success('Removed from category');
    } catch { toast.error('Failed to remove'); }
  }

  async function addSelected() {
    if (!selectedProds.size) return toast.error('Select at least one product');
    setAddingProds(true);
    try {
      await api.post('/admin/products/assign-category', {
        productIds: [...selectedProds],
        categoryId: prodModal._id,
      });
      const added = outProds.filter((p) => selectedProds.has(p._id));
      setInProds((prev) => [...prev, ...added]);
      setOutProds((prev) => prev.filter((p) => !selectedProds.has(p._id)));
      setSelectedProds(new Set());
      toast.success(`${added.length} product(s) added`);
    } catch { toast.error('Failed to add products'); }
    finally { setAddingProds(false); }
  }

  // ── derived ───────────────────────────────────────────────────────────────────

  const tree      = buildTree(categories);
  const flattened = flattenTree(tree);

  const displayed = flattened.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.slug.includes(q);
    const matchStatus = !statusFilter
      || (statusFilter === 'active' ? c.isActive : !c.isActive);
    return matchSearch && matchStatus;
  });

  function getParentOptions(excludeId) {
    if (!excludeId) return categories;
    const descendants = new Set();
    const addDesc = (id) => {
      categories.forEach((c) => {
        const pid = c.parentId?._id?.toString() || c.parentId?.toString();
        if (pid === id?.toString()) {
          descendants.add(c._id.toString());
          addDesc(c._id);
        }
      });
    };
    addDesc(excludeId);
    return categories.filter(
      (c) => c._id.toString() !== excludeId.toString() && !descendants.has(c._id.toString()),
    );
  }

  const parentOptions  = editCat ? getParentOptions(editCat._id) : categories;
  const filteredIn     = inProds.filter((p) => !prodSearch || p.title?.toLowerCase().includes(prodSearch.toLowerCase()));
  const filteredOut    = outProds.filter((p) => !prodSearch || p.title?.toLowerCase().includes(prodSearch.toLowerCase()));
  const allSelected    = filteredOut.length > 0 && filteredOut.every((p) => selectedProds.has(p._id));

  function toggleSelectAll() {
    if (allSelected) setSelectedProds(new Set());
    else setSelectedProds(new Set(filteredOut.map((p) => p._id)));
  }

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Category Management</h1>
          <p className="text-sm text-secondary-500 mt-0.5">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors"
        >
          <Plus size={15} /> Add Category
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories…"
            className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-secondary-200 bg-secondary-50">
                <th className="text-left px-4 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">
                  Category
                </th>
                <th className="text-left px-4 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide">
                  Slug
                </th>
                <th className="text-center px-4 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide w-16">
                  Sort
                </th>
                <th className="text-center px-4 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide w-24">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-semibold text-secondary-500 text-xs uppercase tracking-wide w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-secondary-400">
                    <div className="w-6 h-6 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin mx-auto mb-2" />
                    Loading…
                  </td>
                </tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-secondary-400">
                    <Layers size={36} className="mx-auto mb-2 opacity-25" />
                    {search || statusFilter ? 'No matching categories' : 'No categories yet — add one above'}
                  </td>
                </tr>
              ) : displayed.map((cat) => (
                <tr key={cat._id} className="hover:bg-secondary-50 transition-colors group">

                  {/* Category */}
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-3"
                      style={{ paddingLeft: cat.depth * 22 }}
                    >
                      {cat.depth > 0 && (
                        <span className="text-secondary-300 text-base select-none flex-shrink-0 leading-none">
                          └─
                        </span>
                      )}
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-secondary-100 flex-shrink-0 flex items-center justify-center">
                        {cat.image ? (
                          <img
                            src={normalizeImageUrl(cat.image)}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <FolderOpen size={15} className="text-secondary-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-secondary-800">{cat.name}</p>
                        {cat.description && (
                          <p className="text-xs text-secondary-400 truncate max-w-xs">{cat.description}</p>
                        )}
                        {cat.children?.length > 0 && (
                          <p className="text-xs text-primary-500 mt-0.5">
                            {cat.children.length} subcategor{cat.children.length === 1 ? 'y' : 'ies'}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Slug */}
                  <td className="px-4 py-3">
                    <code className="text-xs bg-secondary-100 px-2 py-0.5 rounded text-secondary-600">
                      {cat.slug}
                    </code>
                  </td>

                  {/* Sort */}
                  <td className="px-4 py-3 text-center text-secondary-600">
                    {cat.displayOrder}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      cat.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-secondary-100 text-secondary-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        cat.isActive ? 'bg-green-500' : 'bg-secondary-400'
                      }`} />
                      {cat.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        onClick={() => openAddSub(cat)}
                        title="Add subcategory"
                        className="flex items-center gap-0.5 px-2 py-1 text-xs text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors font-medium"
                      >
                        <Plus size={11} /> Sub
                      </button>
                      <button
                        onClick={() => openEdit(cat)}
                        title="Edit"
                        className="p-1.5 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteId(cat._id)}
                        title="Delete"
                        className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ Category Form Modal ══════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200">
              <h2 className="font-bold text-secondary-900 text-lg">
                {editCat ? 'Edit Category' : 'Add Category'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Category Image</label>
                <div className="flex items-start gap-4">
                  <div
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-secondary-200 bg-secondary-50 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-primary-400 transition-colors"
                    onClick={() => imgInputRef.current?.click()}
                  >
                    {form.image ? (
                      <img
                        src={normalizeImageUrl(form.image)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center px-2">
                        <Image size={18} className="mx-auto text-secondary-300 mb-1" />
                        <span className="text-xs text-secondary-400 leading-tight block">Click to upload</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => imgInputRef.current?.click()}
                      disabled={imgUploading}
                      className="flex items-center gap-2 px-3 py-1.5 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 disabled:opacity-50 transition-colors"
                    >
                      <Upload size={13} />
                      {imgUploading ? 'Uploading…' : 'Upload Image'}
                    </button>
                    {form.image && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, image: '' }))}
                        className="flex items-center gap-1 text-xs text-red-500 hover:underline"
                      >
                        <X size={11} /> Remove image
                      </button>
                    )}
                    <p className="text-xs text-secondary-400">PNG, JPG up to 2 MB</p>
                  </div>
                  <input
                    ref={imgInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. Power Tools"
                  className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value, _slugEdited: true }))
                  }
                  placeholder="power-tools"
                  className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <p className="text-xs text-secondary-400 mt-1">
                  Auto-generated from name · used in storefront URLs
                </p>
              </div>

              {/* Parent */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Parent Category
                </label>
                {!editCat && form.parentId ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 font-medium">
                    <FolderOpen size={14} className="text-green-600" />
                    {categories.find(c => c._id.toString() === form.parentId)?.name || 'Selected'}
                    <button type="button" onClick={() => setField('parentId', '')} className="ml-auto text-green-500 hover:text-red-500">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <select
                    value={form.parentId}
                    onChange={(e) => setField('parentId', e.target.value)}
                    className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                  >
                    <option value="">— None (Root Category) —</option>
                    {parentOptions.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-secondary-400 mt-1">
                  Leave blank to create a top-level category
                </p>
              </div>

              {/* Sort order */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  min="0"
                  value={form.displayOrder}
                  onChange={(e) => setField('displayOrder', e.target.value)}
                  className="w-28 border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <p className="text-xs text-secondary-400 mt-1">Lower numbers appear first</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={3}
                  placeholder="Short description shown on the storefront…"
                  className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-xl border border-secondary-100">
                <button
                  type="button"
                  onClick={() => setField('isActive', !form.isActive)}
                  className={`relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    form.isActive ? 'bg-primary-600' : 'bg-secondary-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      form.isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div>
                  <p className="text-sm font-medium text-secondary-800">
                    {form.isActive ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-xs text-secondary-500">
                    Inactive categories are hidden from the storefront
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <><Check size={15} /> Save Category</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ Delete Confirm ═══════════════════════════════════════════════════════ */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-secondary-900">Delete Category?</h3>
                <p className="text-sm text-secondary-600 mt-1 leading-relaxed">
                  Products won't be deleted, but will lose this category assignment.
                  Subcategories will become root-level categories.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Products Modal ═══════════════════════════════════════════════════════ */}
      {prodModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-6">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-200">
              <div>
                <h2 className="font-bold text-secondary-900">Products — {prodModal.name}</h2>
                <p className="text-xs text-secondary-500 mt-0.5">
                  Assign or remove products from this category
                </p>
              </div>
              <button
                onClick={() => setProdModal(null)}
                className="p-1.5 hover:bg-secondary-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-secondary-200 px-6">
              {[
                { key: 'in',  label: `In Category (${inProds.length})` },
                { key: 'add', label: `Add Products (${outProds.length})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setProdTab(key); setProdSearch(''); }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    prodTab === key
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-secondary-500 hover:text-secondary-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
                <input
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>

              {prodsLoading ? (
                <div className="flex items-center justify-center py-12 text-secondary-400 gap-2">
                  <div className="w-5 h-5 border-2 border-primary-300 border-t-primary-600 rounded-full animate-spin" />
                  Loading products…
                </div>
              ) : prodTab === 'in' ? (
                /* ── In Category ── */
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredIn.length === 0 ? (
                    <div className="text-center py-10 text-secondary-400">
                      <Package size={32} className="mx-auto mb-2 opacity-25" />
                      {prodSearch ? 'No matching products' : 'No products in this category yet'}
                    </div>
                  ) : filteredIn.map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-secondary-100 hover:border-secondary-200 hover:bg-secondary-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-secondary-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {p.images?.[0] ? (
                          <img
                            src={normalizeImageUrl(p.images[0])}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <Package size={14} className="text-secondary-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-secondary-800 truncate">{p.title}</p>
                        <p className="text-xs text-secondary-400">
                          SKU: {p.sku || '—'} · ₹{p.price?.toLocaleString('en-IN') ?? 0}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCategory(p._id)}
                        className="flex-shrink-0 text-xs px-3 py-1.5 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── Add Products ── */
                <>
                  {filteredOut.length > 0 && (
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-secondary-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded accent-primary-600"
                        />
                        Select All ({filteredOut.length})
                      </label>
                      {selectedProds.size > 0 && (
                        <span className="text-xs text-primary-600 font-medium">
                          {selectedProds.size} selected
                        </span>
                      )}
                    </div>
                  )}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredOut.length === 0 ? (
                      <div className="text-center py-10 text-secondary-400">
                        <Package size={32} className="mx-auto mb-2 opacity-25" />
                        {prodSearch
                          ? 'No matching products'
                          : 'All products are already in this category'}
                      </div>
                    ) : filteredOut.map((p) => (
                      <label
                        key={p._id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-secondary-100 hover:border-secondary-200 hover:bg-secondary-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedProds.has(p._id)}
                          onChange={(e) => {
                            const s = new Set(selectedProds);
                            e.target.checked ? s.add(p._id) : s.delete(p._id);
                            setSelectedProds(s);
                          }}
                          className="w-4 h-4 rounded accent-primary-600 flex-shrink-0"
                        />
                        <div className="w-10 h-10 rounded-lg bg-secondary-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {p.images?.[0] ? (
                            <img
                              src={normalizeImageUrl(p.images[0])}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <Package size={14} className="text-secondary-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-secondary-800 truncate">{p.title}</p>
                          <p className="text-xs text-secondary-400">
                            SKU: {p.sku || '—'} · ₹{p.price?.toLocaleString('en-IN') ?? 0}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedProds.size > 0 && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={addSelected}
                        disabled={addingProds}
                        className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                      >
                        {addingProds ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Adding…
                          </>
                        ) : (
                          <>
                            <Plus size={15} />
                            Add {selectedProds.size} Product{selectedProds.size > 1 ? 's' : ''}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
