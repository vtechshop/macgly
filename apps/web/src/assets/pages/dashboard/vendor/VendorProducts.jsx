import { useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { useSelector } from 'react-redux';
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
  brand: '', sku: '', category: '', images: '', tags: '',
  gstRate: 18, hsn: '',
  published: true, featured: false, displayOrder: 0,
};

export default function VendorProducts() {
  const { user } = useSelector((s) => s.auth);
  const [page, setPage] = useState(1);
  const [rev, setRev] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useFetch(
    ['vendor-products', page, rev],
    () => api.get('/vendors/products', { params: { page, limit: 20 } }).then((r) => r.data)
  );

  const { data: catsData } = useFetch(
    ['categories'],
    () => api.get('/catalog/categories').then((r) => r.data)
  );

  const { mutate: save, isPending: saving } = useAction(
    (d) => editing ? api.put(`/vendors/products/${editing._id}`, d) : api.post('/vendors/products', d),
    {
      onSuccess: () => { setRev((r) => r + 1); setModalOpen(false); toast.success(editing ? 'Updated' : 'Product created'); },
      onError: (err) => toast.error(err.response?.data?.error?.message || 'Failed'),
    }
  );

  const { mutate: del } = useAction(
    (id) => api.delete(`/vendors/products/${id}`),
    { onSuccess: () => { setRev((r) => r + 1); toast.success('Deleted'); }, onError: () => toast.error('Failed') }
  );

  function openNew() { setEditing(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(p) {
    setEditing(p);
    setForm({ ...emptyForm, ...p, images: p.images || [], tags: p.tags?.join(', ') || '' });
    setModalOpen(true);
  }

  function handleSave(e) {
    e.preventDefault();
    const slug = form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    save({
      ...form,
      slug,
      vendorId: user._id,
      price: parseFloat(form.price),
      compareAt: form.compareAt ? parseFloat(form.compareAt) : undefined,
      stock: parseInt(form.stock),
      displayOrder: parseInt(form.displayOrder) || 0,
      gstRate: parseInt(form.gstRate) || 18,
      images: Array.isArray(form.images) ? form.images : [],
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    });
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Products</h1>
        <Button onClick={openNew}><Plus size={16} /> Add Product</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="card overflow-hidden">
          {!data?.products?.length ? (
            <div className="text-center py-16 text-secondary-400">
              <p className="font-medium">No products yet</p>
              <p className="text-sm mt-1">Click "Add Product" to list your first product</p>
            </div>
          ) : (
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
                {data.products.map((p) => (
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
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'Add Product'} size="lg">
        <form onSubmit={handleSave} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Title *" value={form.title} onChange={set('title')} required className="col-span-2" />
            <Input label="Brand" value={form.brand} onChange={set('brand')} />
            <Input label="SKU (auto if blank)" value={form.sku} onChange={set('sku')} />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-secondary-700">Category</label>
              <select className="input" value={form.category} onChange={set('category')}>
                <option value="">Select category</option>
                {catsData?.categories?.map((c) => (
                  <option key={c._id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>
            <Input label="Price (₹) *" type="number" step="0.01" value={form.price} onChange={set('price')} required />
            <Input label="Compare At (₹)" type="number" step="0.01" value={form.compareAt} onChange={set('compareAt')} />
            <Input label="Stock *" type="number" value={form.stock} onChange={set('stock')} required />
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
          <ImageUpload urls={Array.isArray(form.images) ? form.images : []} onChange={(imgs) => setForm((f) => ({ ...f, images: imgs }))} uploadUrl="/vendors/upload/image" />
          <Input label="Tags (comma separated)" value={form.tags} onChange={set('tags')} placeholder="tool, brand, type" />
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.published} onChange={set('published')} className="accent-primary-600" /> Published
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-secondary-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Add Product'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
