import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, ShieldCheck, HelpCircle, Search as SearchIcon, Upload, X, RefreshCw } from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import { useFetch, useAction } from '../../../../hooks';
import Button from '../../../components/common/Button';
import Modal from '../../../components/common/Modal';
import Input from '../../../components/common/Input';
import ImageUpload from '../../../components/common/ImageUpload';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const emptyForm = {
  title: '', slug: '', description: '', price: '', compareAt: '', stock: '',
  brand: '', sku: '', category: '', categoryIds: [], images: [], tags: '',
  gstRate: 18, hsn: '',
  published: true, featured: false, displayOrder: 0,
  hasWarranty: false,
  warranty: { duration: '', durationType: 'months', description: '' },
  specifications: [],
  faqs: [],
  seo: { title: '', description: '', keywords: '' },
  hasVariants: false,
  variantOptions: [],
  variants: [],
};

export default function AdminProducts() {
  const [page, setPage] = useState(1);
  const [rev, setRev] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useFetch(
    ['admin-products', page, rev],
    () => api.get('/admin/products', { params: { page, limit: 20 } }).then((r) => r.data)
  );

  const { data: catsData } = useFetch(
    ['categories'],
    () => api.get('/catalog/categories').then((r) => r.data)
  );

  const { mutate: save, isPending: saving } = useAction(
    (d) => editing ? api.put(`/admin/products/${editing._id}`, d) : api.post('/admin/products', d),
    {
      onSuccess: () => { setRev((r) => r + 1); setModalOpen(false); toast.success(editing ? 'Updated' : 'Product created'); },
      onError: (err) => {
        const e = err.response?.data?.error;
        const msg = e?.message || (e?.fields && `Validation: ${Object.values(e.fields)[0]}`) || 'Save failed';
        toast.error(msg);
      },
    }
  );

  const { mutate: del } = useAction(
    (id) => api.delete(`/admin/products/${id}`),
    { onSuccess: () => { setRev((r) => r + 1); toast.success('Deleted'); }, onError: () => toast.error('Failed') }
  );

  const [l1Id, setL1Id] = useState('');
  const [l2Id, setL2Id] = useState('');
  const [l3Id, setL3Id] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatParentId, setNewCatParentId] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [creatingCat, setCreatingCat] = useState(false);
  const [localCats, setLocalCats] = useState([]);

  const allCats = [...(catsData?.categories || []), ...localCats];
  const l1Cats = allCats.filter((c) => !c.parentId);
  const l2Cats = l1Id ? allCats.filter((c) => c.parentId?.toString() === l1Id) : [];
  const l3Cats = l2Id ? allCats.filter((c) => c.parentId?.toString() === l2Id) : [];

  function addCategory() {
    const deepest = l3Id || l2Id || l1Id;
    if (!deepest) return;
    const cat = allCats.find((c) => c._id.toString() === deepest);
    if (!cat) return;
    if (form.categoryIds.includes(cat._id.toString())) return;
    setForm((f) => ({
      ...f,
      category: cat.slug,
      categoryIds: [...f.categoryIds, cat._id.toString()],
    }));
    setL1Id(''); setL2Id(''); setL3Id('');
  }

  function removeCategoryId(id) {
    setForm((f) => {
      const next = f.categoryIds.filter((c) => c !== id);
      const remaining = allCats.find((c) => c._id.toString() === next[next.length - 1]);
      return { ...f, categoryIds: next, category: remaining?.slug || '' };
    });
  }

  function getCatPath(id) {
    const parts = [];
    let currentId = id?.toString();
    const visited = new Set();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const cat = allCats.find((c) => (c._id?._id || c._id)?.toString() === currentId);
      if (!cat) break;
      parts.unshift(cat.name);
      const pid = cat.parentId?._id || cat.parentId;
      currentId = pid ? pid.toString() : null;
    }
    return parts.join(' › ') || id;
  }

  async function createCategory() {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const slug = newCatName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const body = { name: newCatName.trim(), slug, parentId: newCatParentId || undefined };
      const { data } = await api.post('/admin/categories', body);
      const created = data.category;
      setLocalCats((prev) => [...prev, created]);
      setForm((f) => ({
        ...f,
        category: created.slug,
        categoryIds: [...f.categoryIds, created._id.toString()],
      }));
      setNewCatName(''); setNewCatParentId(''); setShowNewCat(false);
      toast.success(`Category "${created.name}" created & added`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not create category');
    } finally {
      setCreatingCat(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setL1Id(''); setL2Id(''); setL3Id('');
    setLocalCats([]); setShowNewCat(false);
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setL1Id(''); setL2Id(''); setL3Id('');
    setLocalCats([]); setShowNewCat(false);
    setForm({
      ...emptyForm, ...p,
      categoryIds: (p.categoryIds || []).map((id) => id.toString()),
      images: p.images || [],
      tags: p.tags?.join(', ') || '',
      hasWarranty: !!(p.warranty?.duration),
      warranty: p.warranty || emptyForm.warranty,
      specifications: p.specifications || [],
      faqs: p.faqs || [],
      seo: p.seo || emptyForm.seo,
      hasVariants: p.hasVariants || false,
      variantOptions: p.variantOptions || [],
      variants: (p.variants || []).map((v) => ({
        ...v,
        attributes: v.attributes instanceof Map ? Object.fromEntries(v.attributes) : (v.attributes || {}),
      })),
    });
    setModalOpen(true);
  }

  function handleSave(e) {
    e.preventDefault();
    const slug = form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Auto-include any category currently selected in the dropdowns that wasn't explicitly "+ Add"ed
    let finalCategoryIds = [...form.categoryIds];
    let finalCategory = form.category;
    const deepest = l3Id || l2Id || l1Id;
    if (deepest && !finalCategoryIds.includes(deepest)) {
      const cat = allCats.find((c) => c._id.toString() === deepest);
      if (cat) {
        finalCategoryIds = [...finalCategoryIds, cat._id.toString()];
        finalCategory = cat.slug;
      }
    }

    save({
      ...form,
      slug,
      price: parseFloat(form.price),
      compareAt: form.compareAt ? parseFloat(form.compareAt) : undefined,
      stock: form.hasVariants ? form.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0) : parseInt(form.stock),
      category: finalCategory,
      categoryIds: finalCategoryIds,
      displayOrder: parseInt(form.displayOrder) || 0,
      gstRate: parseInt(form.gstRate) || 18,
      images: Array.isArray(form.images) ? form.images : [],
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      warranty: form.hasWarranty && form.warranty.duration
        ? { duration: parseInt(form.warranty.duration), durationType: form.warranty.durationType, description: form.warranty.description }
        : null,
      specifications: form.specifications.filter((s) => s.label?.trim()),
      faqs: form.faqs.filter((f) => f.question?.trim()),
      seo: form.seo,
      hasVariants: form.hasVariants,
      variantOptions: form.hasVariants ? form.variantOptions : [],
      variants: form.hasVariants ? form.variants.map((v) => ({
        ...v,
        price: parseFloat(v.price) || parseFloat(form.price),
        compareAt: v.compareAt ? parseFloat(v.compareAt) : undefined,
        stock: parseInt(v.stock) || 0,
      })) : [],
    });
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setW = (k) => (e) => setForm({ ...form, warranty: { ...form.warranty, [k]: e.target.value } });
  const setSeo = (k) => (e) => setForm({ ...form, seo: { ...form.seo, [k]: e.target.value } });

  function addSpec() { setForm((f) => ({ ...f, specifications: [...f.specifications, { label: '', value: '' }] })); }
  function setSpec(i, k, v) { setForm((f) => { const s = [...f.specifications]; s[i] = { ...s[i], [k]: v }; return { ...f, specifications: s }; }); }
  function removeSpec(i) { setForm((f) => ({ ...f, specifications: f.specifications.filter((_, idx) => idx !== i) })); }

  function addFaq() { setForm((f) => ({ ...f, faqs: [...f.faqs, { question: '', answer: '' }] })); }
  function setFaq(i, k, v) { setForm((f) => { const a = [...f.faqs]; a[i] = { ...a[i], [k]: v }; return { ...f, faqs: a }; }); }
  function removeFaq(i) { setForm((f) => ({ ...f, faqs: f.faqs.filter((_, idx) => idx !== i) })); }

  // Variant helpers
  function addVariantOption() { setForm((f) => ({ ...f, variantOptions: [...f.variantOptions, { name: '', values: [] }] })); }
  function setVariantOptionName(i, v) { setForm((f) => { const o = [...f.variantOptions]; o[i] = { ...o[i], name: v }; return { ...f, variantOptions: o }; }); }
  function setVariantOptionValues(i, csv) { setForm((f) => { const o = [...f.variantOptions]; o[i] = { ...o[i], values: csv.split(',').map((s) => s.trim()).filter(Boolean) }; return { ...f, variantOptions: o }; }); }
  function removeVariantOption(i) { setForm((f) => ({ ...f, variantOptions: f.variantOptions.filter((_, idx) => idx !== i) })); }

  function generateVariantMatrix() {
    const opts = form.variantOptions.filter((o) => o.name && o.values.length);
    if (!opts.length) { toast.error('Add at least one option with values'); return; }
    function cartesian(arrays) {
      return arrays.reduce((acc, arr) => acc.flatMap((a) => arr.map((b) => [...a, b])), [[]]);
    }
    const combos = cartesian(opts.map((o) => o.values.map((v) => ({ name: o.name, value: v }))));
    const existing = form.variants;
    const newVariants = combos.map((combo) => {
      const attributes = {};
      combo.forEach(({ name, value }) => { attributes[name] = value; });
      const key = combo.map((c) => c.value).join('|');
      const prev = existing.find((v) => Object.entries(v.attributes || {}).map(([, val]) => val).join('|') === key);
      return prev || { sku: '', attributes, price: form.price || '', compareAt: '', stock: form.stock || '', images: [] };
    });
    setForm((f) => ({ ...f, variants: newVariants }));
  }

  function setVariant(i, k, v) { setForm((f) => { const vs = [...f.variants]; vs[i] = { ...vs[i], [k]: v }; return { ...f, variants: vs }; }); }

  // CSV import state
  const csvRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  async function handleCsvImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await api.post('/admin/products/import', formData);
      setImportResult(data.results);
      setRev((r) => r + 1);
      toast.success(`Import done: ${data.results.created} created, ${data.results.updated} updated`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Import failed');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex items-center gap-2">
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          <Button variant="outline" onClick={() => csvRef.current?.click()} disabled={importing}>
            {importing ? <Spinner size="xs" /> : <Upload size={16} />} Import CSV
          </Button>
          <Button onClick={openNew}><Plus size={16} /> New Product</Button>
        </div>
      </div>

      {importResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <div className="flex-1 text-sm text-green-800">
            <strong>Import complete</strong> — {importResult.created} created, {importResult.updated} updated
            {importResult.errors?.length > 0 && <span className="ml-2 text-red-600">({importResult.errors.length} errors)</span>}
          </div>
          <button onClick={() => setImportResult(null)} className="text-green-500 hover:text-green-700"><X size={14} /></button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary-50 border-b border-secondary-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-secondary-600">Product</th>
                <th className="text-left px-4 py-3 font-medium text-secondary-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-secondary-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-secondary-600">Stock</th>
                <th className="text-left px-4 py-3 font-medium text-secondary-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {data?.products?.map((p) => (
                <tr key={p._id} className="hover:bg-secondary-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] && <img src={normalizeImageUrl(p.images[0])} alt="" className="w-10 h-10 rounded object-cover bg-secondary-100" onError={(e) => e.target.style.display='none'} />}
                      <div>
                        <p className="font-medium line-clamp-1">{p.title}</p>
                        <p className="text-xs text-secondary-400">{p.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-secondary-500 capitalize">{p.category?.replace(/-/g,' ') || '—'}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(p.price)}</td>
                  <td className="px-4 py-3">
                    <span className={p.stock <= 5 ? 'text-red-600 font-semibold' : p.stock <= 20 ? 'text-yellow-600' : ''}>{p.stock}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${p.published ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-600'}`}>
                      {p.published ? <Eye size={11} /> : <EyeOff size={11} />}
                      {p.published ? 'Live' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-500"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm('Delete this product?')) del(p._id); }} className="p-1.5 hover:bg-red-50 rounded text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.pagination && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-100 text-sm text-secondary-500">
              <span>{data.pagination.total} products</span>
              <div className="flex gap-1">
                {Array.from({ length: data.pagination.pages || 1 }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded text-xs font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100'}`}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'New Product'} size="lg">
        <form onSubmit={handleSave} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Title *" value={form.title} onChange={set('title')} required className="col-span-2" />
            <Input label="Slug (auto if blank)" value={form.slug} onChange={set('slug')} />
            <Input label="SKU (auto if blank)" value={form.sku} onChange={set('sku')} placeholder="e.g. PWR-001" />
            <Input label="Brand" value={form.brand} onChange={set('brand')} />
            {/* Multi-category selector */}
            <div className="col-span-2 space-y-2">
              <label className="block text-sm font-medium text-secondary-700">Categories</label>

              {/* Selected tags */}
              {form.categoryIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.categoryIds.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 bg-primary-50 border border-primary-200 text-primary-700 text-xs px-2.5 py-1 rounded-full">
                      {getCatPath(id)}
                      <button type="button" onClick={() => removeCategoryId(id)} className="ml-0.5 text-primary-400 hover:text-red-500 font-bold leading-none">&times;</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Cascade pickers */}
              <div className="flex gap-2 flex-wrap items-end">
                <div className="space-y-0.5 flex-1 min-w-[130px]">
                  <p className="text-[10px] text-secondary-500 font-medium uppercase tracking-wide">Level 1</p>
                  <select className="input text-sm" value={l1Id} onChange={(e) => { setL1Id(e.target.value); setL2Id(''); setL3Id(''); }}>
                    <option value="">Select category</option>
                    {l1Cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                {l1Id && (
                  <div className="space-y-0.5 flex-1 min-w-[130px]">
                    <p className="text-[10px] text-secondary-500 font-medium uppercase tracking-wide">Level 2</p>
                    <select className="input text-sm" value={l2Id} onChange={(e) => { setL2Id(e.target.value); setL3Id(''); }}>
                      <option value="">— None</option>
                      {l2Cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                {l2Id && l3Cats.length > 0 && (
                  <div className="space-y-0.5 flex-1 min-w-[130px]">
                    <p className="text-[10px] text-secondary-500 font-medium uppercase tracking-wide">Level 3</p>
                    <select className="input text-sm" value={l3Id} onChange={(e) => setL3Id(e.target.value)}>
                      <option value="">— None</option>
                      {l3Cats.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={addCategory}
                  disabled={!l1Id}
                  className="px-3 py-2 text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-40 transition-colors shrink-0"
                >
                  + Add
                </button>
              </div>
              <p className="text-[11px] text-secondary-400">
                Select the <strong>deepest</strong> level you need (e.g. L1 → L2 → L3), then click <strong>+ Add</strong> once. The full path is stored automatically. A product can belong to multiple category paths.
              </p>

              {/* Create new category inline */}
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setShowNewCat((v) => !v)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
                >
                  <Plus size={12} /> {showNewCat ? 'Cancel' : "Can't find it? Create new category"}
                </button>
                {showNewCat && (
                  <div className="mt-2 p-3 bg-secondary-50 border border-secondary-200 rounded-lg space-y-2">
                    <p className="text-[10px] font-bold text-secondary-500 uppercase tracking-wide">New Category</p>
                    <div className="flex gap-2">
                      <input
                        className="input text-sm flex-1"
                        placeholder="Category name (e.g. Cordless Drills)"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), createCategory())}
                      />
                      <select
                        className="input text-sm w-40"
                        value={newCatParentId}
                        onChange={(e) => setNewCatParentId(e.target.value)}
                      >
                        <option value="">Top-level</option>
                        {allCats.map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={createCategory}
                        disabled={!newCatName.trim() || creatingCat}
                        className="px-3 py-2 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40 transition-colors shrink-0"
                      >
                        {creatingCat ? '...' : 'Create'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Input label="Price (₹) *" type="number" step="0.01" value={form.price} onChange={set('price')} required />
            <Input label="Compare At Price (₹)" type="number" step="0.01" value={form.compareAt} onChange={set('compareAt')} />
            <Input label="Stock *" type="number" value={form.stock} onChange={set('stock')} required />
            <Input label="Display Order" type="number" value={form.displayOrder} onChange={set('displayOrder')} />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-secondary-700">GST Rate (%)</label>
              <select className="input" value={form.gstRate} onChange={set('gstRate')}>
                {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <Input label="HSN Code" value={form.hsn} onChange={set('hsn')} placeholder="e.g. 8467" />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-secondary-700">Description *</label>
            <textarea className="input h-24 resize-none" value={form.description} onChange={set('description')} required />
          </div>

          <ImageUpload urls={Array.isArray(form.images) ? form.images : []} onChange={(imgs) => setForm((f) => ({ ...f, images: imgs }))} />

          <Input label="Tags (comma separated)" value={form.tags} onChange={set('tags')} placeholder="drill, bosch, power-tool" />

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.published} onChange={set('published')} className="accent-primary-600" /> Published (Live)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.featured} onChange={set('featured')} className="accent-primary-600" /> Featured
            </label>
          </div>

          {/* Specifications */}
          <div className="border border-secondary-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-secondary-50 border-b border-secondary-200">
              <p className="text-sm font-semibold text-secondary-700">Specifications</p>
              <button type="button" onClick={addSpec} className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Plus size={13} /> Add Row
              </button>
            </div>
            <div className="p-4 space-y-2">
              {form.specifications.length === 0 ? (
                <p className="text-xs text-secondary-400 text-center py-2">No specifications added. Click "Add Row" to add product specs.</p>
              ) : (
                form.specifications.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input className="input flex-1 text-sm" placeholder="Label (e.g. Power)" value={s.label} onChange={(e) => setSpec(i, 'label', e.target.value)} />
                    <input className="input flex-1 text-sm" placeholder="Value (e.g. 710W)" value={s.value} onChange={(e) => setSpec(i, 'value', e.target.value)} />
                    <button type="button" onClick={() => removeSpec(i)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Warranty */}
          <div className="border border-secondary-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-secondary-50 border-b border-secondary-200">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-secondary-500" />
                <p className="text-sm font-semibold text-secondary-700">Warranty Information</p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.hasWarranty}
                  onChange={set('hasWarranty')}
                  className="accent-primary-600"
                />
                Has Warranty
              </label>
            </div>
            {form.hasWarranty && (
              <div className="p-4 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-secondary-600">Duration</label>
                  <input
                    type="number"
                    min="1"
                    className="input text-sm"
                    placeholder="e.g. 12"
                    value={form.warranty.duration}
                    onChange={setW('duration')}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-secondary-600">Unit</label>
                  <select className="input text-sm" value={form.warranty.durationType} onChange={setW('durationType')}>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                    <option value="days">Days</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-secondary-600">Warranty Description</label>
                  <input
                    className="input text-sm"
                    placeholder="e.g. Manufacturer warranty, covers manufacturing defects"
                    value={form.warranty.description}
                    onChange={setW('description')}
                  />
                </div>
              </div>
            )}
            {!form.hasWarranty && (
              <p className="px-4 py-3 text-xs text-secondary-400">Check "Has Warranty" to add warranty details.</p>
            )}
          </div>

          {/* FAQs */}
          <div className="border border-secondary-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-secondary-50 border-b border-secondary-200">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className="text-secondary-500" />
                <p className="text-sm font-semibold text-secondary-700">Frequently Asked Questions</p>
              </div>
              <button type="button" onClick={addFaq} className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Plus size={13} /> Add FAQ
              </button>
            </div>
            <div className="p-4 space-y-3">
              {form.faqs.length === 0 ? (
                <p className="text-xs text-secondary-400 text-center py-2">No FAQs added yet. Click "+ Add FAQ" to add.</p>
              ) : (
                form.faqs.map((f, i) => (
                  <div key={i} className="space-y-2 p-3 bg-secondary-50 rounded-lg relative">
                    <button type="button" onClick={() => removeFaq(i)} className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={13} />
                    </button>
                    <input
                      className="input text-sm w-full"
                      placeholder="Question"
                      value={f.question}
                      onChange={(e) => setFaq(i, 'question', e.target.value)}
                    />
                    <textarea
                      className="input text-sm w-full resize-none h-16"
                      placeholder="Answer"
                      value={f.answer}
                      onChange={(e) => setFaq(i, 'answer', e.target.value)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Variants */}
          <div className="border border-secondary-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-secondary-50 border-b border-secondary-200">
              <p className="text-sm font-semibold text-secondary-700">Product Variants</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.hasVariants} onChange={set('hasVariants')} className="accent-primary-600" />
                Has Variants
              </label>
            </div>
            {!form.hasVariants && (
              <p className="px-4 py-3 text-xs text-secondary-400">Enable if this product comes in different sizes, colors, etc.</p>
            )}
            {form.hasVariants && (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">Options (e.g. Color, Size)</p>
                    <button type="button" onClick={addVariantOption} className="text-xs text-primary-600 font-semibold flex items-center gap-1 hover:text-primary-700"><Plus size={12} /> Add Option</button>
                  </div>
                  {form.variantOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input className="input text-sm w-32 shrink-0" placeholder="Name (e.g. Color)" value={opt.name} onChange={(e) => setVariantOptionName(i, e.target.value)} />
                      <input className="input text-sm flex-1" placeholder="Values comma separated (Red, Blue, Green)" value={opt.values.join(', ')} onChange={(e) => setVariantOptionValues(i, e.target.value)} />
                      <button type="button" onClick={() => removeVariantOption(i)} className="p-1.5 text-red-400 hover:text-red-600 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {form.variantOptions.length > 0 && (
                    <button type="button" onClick={generateVariantMatrix} className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary-100 hover:bg-secondary-200 text-secondary-700 text-xs font-semibold rounded-lg transition-colors">
                      <RefreshCw size={12} /> Generate / Refresh Variants
                    </button>
                  )}
                </div>
                {form.variants.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">{form.variants.length} Variants</p>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {form.variants.map((v, i) => (
                        <div key={i} className="bg-secondary-50 border border-secondary-200 rounded-lg p-3">
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {Object.entries(v.attributes || {}).map(([k, val]) => (
                              <span key={k} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">{k}: {val}</span>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-0.5">
                              <label className="text-[10px] text-secondary-500">SKU</label>
                              <input className="input text-xs py-1" placeholder="auto" value={v.sku || ''} onChange={(e) => setVariant(i, 'sku', e.target.value)} />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[10px] text-secondary-500">Price (₹)</label>
                              <input type="number" className="input text-xs py-1" placeholder={form.price} value={v.price || ''} onChange={(e) => setVariant(i, 'price', e.target.value)} />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[10px] text-secondary-500">Stock</label>
                              <input type="number" className="input text-xs py-1" placeholder="0" value={v.stock || ''} onChange={(e) => setVariant(i, 'stock', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SEO */}
          <div className="border border-secondary-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-secondary-50 border-b border-secondary-200">
              <SearchIcon size={16} className="text-secondary-500" />
              <p className="text-sm font-semibold text-secondary-700">SEO Settings</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-xs font-medium text-secondary-600">Meta Title <span className="text-secondary-400">(50–60 chars recommended)</span></label>
                  <span className="text-xs text-secondary-400">{(form.seo.title || '').length}/60</span>
                </div>
                <input className="input text-sm" placeholder="Product title for search results" maxLength={80} value={form.seo.title} onChange={setSeo('title')} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-xs font-medium text-secondary-600">Meta Description <span className="text-secondary-400">(150–160 chars recommended)</span></label>
                  <span className="text-xs text-secondary-400">{(form.seo.description || '').length}/160</span>
                </div>
                <textarea className="input text-sm resize-none h-16" placeholder="Brief description for search results..." maxLength={200} value={form.seo.description} onChange={setSeo('description')} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-secondary-600">Keywords <span className="text-secondary-400">(comma separated)</span></label>
                <input className="input text-sm" placeholder="drill, bosch, power tools" value={form.seo.keywords} onChange={setSeo('keywords')} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-secondary-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update Product' : 'Create Product'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
