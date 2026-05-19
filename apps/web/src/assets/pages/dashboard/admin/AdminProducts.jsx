import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff, ShieldCheck, HelpCircle, Search as SearchIcon } from 'lucide-react';
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
  brand: '', sku: '', category: '', images: [], tags: '',
  gstRate: 18, hsn: '',
  published: true, featured: false, displayOrder: 0,
  hasWarranty: false,
  warranty: { duration: '', durationType: 'months', description: '' },
  specifications: [],
  faqs: [],
  seo: { title: '', description: '', keywords: '' },
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
      onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
    }
  );

  const { mutate: del } = useAction(
    (id) => api.delete(`/admin/products/${id}`),
    { onSuccess: () => { setRev((r) => r + 1); toast.success('Deleted'); }, onError: () => toast.error('Failed') }
  );

  const [parentCatId, setParentCatId] = useState('');

  const allCats = catsData?.categories || [];
  const parentCats = allCats.filter((c) => !c.parentId);
  const subCats = parentCatId ? allCats.filter((c) => c.parentId?.toString() === parentCatId) : [];

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setParentCatId('');
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    // Resolve parent category from the product's category slug
    const cat = allCats.find((c) => c.slug === p.category);
    if (cat?.parentId) {
      setParentCatId(cat.parentId.toString());
    } else if (cat) {
      setParentCatId(cat._id.toString());
    } else {
      setParentCatId('');
    }
    setForm({
      ...emptyForm, ...p,
      images: p.images || [],
      tags: p.tags?.join(', ') || '',
      hasWarranty: !!(p.warranty?.duration),
      warranty: p.warranty || emptyForm.warranty,
      specifications: p.specifications || [],
      faqs: p.faqs || [],
      seo: p.seo || emptyForm.seo,
    });
    setModalOpen(true);
  }

  function handleSave(e) {
    e.preventDefault();
    const slug = form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    save({
      ...form,
      slug,
      price: parseFloat(form.price),
      compareAt: form.compareAt ? parseFloat(form.compareAt) : undefined,
      stock: parseInt(form.stock),
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button onClick={openNew}><Plus size={16} /> New Product</Button>
      </div>

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
            <div className="space-y-1">
              <label className="block text-sm font-medium text-secondary-700">Category</label>
              <select
                className="input"
                value={parentCatId}
                onChange={(e) => {
                  const pid = e.target.value;
                  setParentCatId(pid);
                  const parent = parentCats.find((c) => c._id.toString() === pid);
                  // Set category to parent slug immediately; overridden if subcategory picked
                  setForm((f) => ({ ...f, category: parent?.slug || '' }));
                }}
              >
                <option value="">Select category</option>
                {parentCats.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            {/* Subcategory — shown when parent is selected */}
            {parentCatId && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-secondary-700">Subcategory</label>
                {subCats.length > 0 ? (
                  <select
                    className="input"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    <option value={parentCats.find((c) => c._id.toString() === parentCatId)?.slug || ''}>
                      — No subcategory
                    </option>
                    {subCats.map((c) => (
                      <option key={c._id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="input bg-secondary-50 text-secondary-400 text-xs flex items-center gap-2">
                    No subcategories yet —
                    <a href="/dashboard/admin/categories" target="_blank" className="text-primary-600 hover:underline font-semibold">
                      Add subcategories in Categories
                    </a>
                  </div>
                )}
              </div>
            )}
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
