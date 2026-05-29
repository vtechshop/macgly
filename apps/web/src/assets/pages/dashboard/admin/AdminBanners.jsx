import { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Image } from 'lucide-react';
import api from '../../../../utils/api';
import { normalizeImageUrl } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function platformMatch(banner, filter) {
  if (!filter) return true;
  const p = banner.platform || 'website';
  if (filter === 'website') return p === 'website' || p === 'both' || p === 'web' || !p;
  if (filter === 'mobile')  return p === 'mobile' || p === 'both';
  return true;
}

const PLATFORM_CONFIG = {
  website: { label: 'Website', class: 'bg-blue-100 text-blue-700' },
  mobile:  { label: 'Mobile',  class: 'bg-green-100 text-green-700' },
  both:    { label: 'Both',    class: 'bg-purple-100 text-purple-700' },
  web:     { label: 'Website', class: 'bg-blue-100 text-blue-700' },
};

// ─── Link URL Input (smart grouped dropdown) ──────────────────────────────────
const STATIC_PAGES = [
  { label: 'All Products',  href: '/products' },
  { label: 'All Categories',href: '/categories' },
  { label: 'Blog',          href: '/blog' },
  { label: 'About Us',      href: '/page/about' },
  { label: 'Contact',       href: '/page/contact' },
];

function LinkUrlInput({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [fetching, setFetching] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    Promise.all([
      api.get('/catalog/categories', { params: { limit: 100 } }).catch(() => ({ data: {} })),
      api.get('/products', { params: { limit: 30, published: true } }).catch(() => ({ data: {} })),
    ]).then(([catRes, prodRes]) => {
      setCategories(catRes.data?.categories || catRes.data?.data || []);
      setProducts(prodRes.data?.products || prodRes.data?.data || []);
    }).finally(() => setFetching(false));
  }, [open]);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fl = filter.toLowerCase();
  const filteredStatic = STATIC_PAGES.filter((p) => !fl || p.label.toLowerCase().includes(fl));
  const filteredCats = categories.filter((c) => !fl || (c.name || '').toLowerCase().includes(fl)).slice(0, 8);
  const filteredProds = products.filter((p) => !fl || (p.title || p.name || '').toLowerCase().includes(fl)).slice(0, 8);

  function select(href) {
    onChange(href);
    setOpen(false);
    setFilter('');
  }

  return (
    <div ref={ref} className="relative">
      <input
        className="input w-full"
        placeholder="/products or /category/mixers"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-secondary-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
          <div className="p-2 border-b border-secondary-100 sticky top-0 bg-white">
            <input
              className="input text-sm w-full"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
            />
          </div>
          {fetching && <div className="py-4 flex justify-center"><Spinner size="sm" /></div>}
          {filteredStatic.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-semibold text-secondary-400 bg-secondary-50">Pages</p>
              {filteredStatic.map((p) => (
                <button key={p.href} onClick={() => select(p.href)} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 flex items-center justify-between">
                  <span>{p.label}</span>
                  <span className="text-xs text-secondary-400 font-mono">{p.href}</span>
                </button>
              ))}
            </div>
          )}
          {filteredCats.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-semibold text-secondary-400 bg-secondary-50">Categories</p>
              {filteredCats.map((c) => (
                <button key={c._id} onClick={() => select(`/category/${c.slug}`)} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 flex items-center justify-between">
                  <span>{c.name}</span>
                  <span className="text-xs text-secondary-400 font-mono">/category/{c.slug}</span>
                </button>
              ))}
            </div>
          )}
          {filteredProds.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-semibold text-secondary-400 bg-secondary-50">Products</p>
              {filteredProds.map((p) => (
                <button key={p._id} onClick={() => select(`/product/${p.slug}`)} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary-50 flex items-center justify-between">
                  <span className="line-clamp-1">{p.title || p.name}</span>
                  <span className="text-xs text-secondary-400 font-mono shrink-0 ml-2">/product/{p.slug}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Banner Modal ─────────────────────────────────────────────────────────────
const EMPTY = { title: '', subtitle: '', link: '', order: 0, isActive: true, imagePosition: '50', startDate: '', endDate: '' };

function BannerModal({ banner, platformFilter, onClose, onSave }) {
  const isEdit = !!banner?._id;
  const [form, setForm] = useState({
    title:         banner?.title || '',
    subtitle:      banner?.subtitle || '',
    link:          banner?.link || '',
    order:         banner?.displayOrder ?? 0,
    isActive:      banner?.isActive ?? true,
    imagePosition: banner?.imagePosition || '50',
    startDate:     banner?.startsAt ? banner.startsAt.slice(0, 10) : '',
    endDate:       banner?.endsAt   ? banner.endsAt.slice(0, 10)   : '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(banner?.image ? normalizeImageUrl(banner.image) : '');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!imagePreview && !isEdit) return toast.error('Banner image is required');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title.trim());
      fd.append('subtitle', form.subtitle || '');
      fd.append('link', form.link || '');
      fd.append('order', String(form.order));
      fd.append('isActive', String(form.isActive));
      fd.append('imagePosition', form.imagePosition);
      fd.append('platform', platformFilter || 'website');
      if (form.startDate) fd.append('startDate', form.startDate);
      if (form.endDate)   fd.append('endDate', form.endDate);
      if (imageFile)        fd.append('image', imageFile);
      else if (banner?.image) fd.append('image', banner.image);

      if (isEdit) await api.put(`/admin/banners/${banner._id}`, fd);
      else        await api.post('/admin/banners', fd);

      toast.success(isEdit ? 'Banner updated' : 'Banner created');
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
          <h2 className="font-bold text-lg">{isEdit ? 'Edit Banner' : 'Add Banner'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary-100 rounded-lg"><X size={18} className="text-secondary-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Live Preview */}
          <div
            className="relative rounded-xl overflow-hidden bg-secondary-200"
            style={{ height: '200px' }}
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: `center ${form.imagePosition}%` }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-secondary-400">
                <Image size={36} className="opacity-30 mb-2" />
                <p className="text-sm">Upload image to preview</p>
              </div>
            )}
            {imagePreview && (
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }}
              />
            )}
            <div className="absolute inset-0 flex flex-col justify-center px-8 text-white">
              {form.title && <h2 className="text-xl font-bold drop-shadow">{form.title}</h2>}
              {form.subtitle && <p className="text-sm mt-1 opacity-80 drop-shadow">{form.subtitle}</p>}
              {form.link && (
                <div className="mt-3 px-4 py-1.5 bg-white text-black text-sm font-semibold rounded w-fit">
                  Shop Now →
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input className="input w-full" value={form.title} onChange={(e) => set('title', e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subtitle</label>
                <input className="input w-full" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Link URL</label>
                <LinkUrlInput value={form.link} onChange={(v) => set('link', v)} />
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Banner Image {!isEdit && '*'}
                </label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn w-full flex items-center justify-center gap-2 text-sm"
                >
                  <Image size={13} /> {imageFile ? imageFile.name : 'Choose Image'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <p className="text-xs text-secondary-400 mt-1">Recommended: 1400×500px, max 2MB</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Image Position — {form.imagePosition === '0' ? 'Top' : form.imagePosition === '100' ? 'Bottom' : form.imagePosition === '50' ? 'Center' : `${form.imagePosition}%`}
                </label>
                <input
                  type="range" min="0" max="100" step="5"
                  className="w-full accent-blue-600"
                  value={form.imagePosition}
                  onChange={(e) => set('imagePosition', e.target.value)}
                />
                <div className="flex justify-between text-xs text-secondary-400 mt-0.5">
                  <span>Top</span><span>Center</span><span>Bottom</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Order</label>
                  <input type="number" className="input w-full" min="0" value={form.order} onChange={(e) => set('order', Number(e.target.value))} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 rounded" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
                    Active
                  </label>
                </div>
              </div>

              <div className="bg-secondary-50 rounded-lg px-3 py-2 text-xs text-secondary-600">
                Show On: <span className="font-semibold">{platformFilter === 'mobile' ? '📱 Mobile App only' : '🖥 Website only'}</span>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date (optional)</label>
              <input type="date" className="input w-full" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date (optional)</label>
              <input type="date" className="input w-full" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-secondary-100">
          <button onClick={onClose} className="btn text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
            {saving && <Spinner size="sm" />}
            {saving ? 'Saving…' : isEdit ? 'Update Banner' : 'Add Banner'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminBanners({ platformFilter }) {
  const [rev, setRev] = useState(0);
  const [modal, setModal] = useState(null); // null | { banner?: object }

  const { data, isLoading } = useFetch(
    ['admin-banners', rev],
    () => api.get('/admin/banners').then((r) => r.data)
  );

  const allBanners = data?.data || data?.banners || [];
  const banners = allBanners.filter((b) => platformMatch(b, platformFilter));

  async function toggleActive(b) {
    try {
      const fd = new FormData();
      fd.append('isActive', String(!b.isActive));
      fd.append('image', b.image);
      await api.put(`/admin/banners/${b._id}`, fd);
      setRev((r) => r + 1);
    } catch { toast.error('Failed to toggle status'); }
  }

  async function deleteBanner(id) {
    if (!confirm('Delete this banner?')) return;
    try { await api.delete(`/admin/banners/${id}`); toast.success('Deleted'); setRev((r) => r + 1); }
    catch { toast.error('Delete failed'); }
  }

  async function fixPlatform() {
    try {
      const r = await api.post('/admin/banners/fix-platform');
      toast.success(`Fixed ${r.data.fixed} banner${r.data.fixed !== 1 ? 's' : ''} → set to Website`);
      setRev((v) => v + 1);
    } catch { toast.error('Failed'); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Banner Management</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Homepage hero slideshow banners</p>
        </div>
        <div className="flex items-center gap-2">
          {(!platformFilter || platformFilter === 'website') && (
            <button onClick={fixPlatform} className="btn text-sm">Fix Old Banners</button>
          )}
          <button onClick={() => setModal({})} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Add Banner
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : banners.length === 0 ? (
        <div className="card p-14 text-center text-secondary-400">
          <Image size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No banners yet. Add your first hero banner.</p>
          <button onClick={() => setModal({})} className="btn-primary mt-4 text-sm">Add Banner</button>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => {
            const pc = PLATFORM_CONFIG[b.platform] || PLATFORM_CONFIG.website;
            const startFmt = fmtDate(b.startsAt);
            const endFmt   = fmtDate(b.endsAt);
            return (
              <div key={b._id} className="card p-4 flex items-center gap-4">
                {/* Thumbnail */}
                <div className="w-24 h-14 rounded-lg overflow-hidden bg-secondary-100 shrink-0">
                  {b.image ? (
                    <img
                      src={normalizeImageUrl(b.image)}
                      alt={b.title}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: `center ${b.imagePosition || 50}%` }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image size={16} className="text-secondary-300" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold line-clamp-1">{b.title}</p>
                  {b.subtitle && <p className="text-sm text-secondary-400 line-clamp-1">{b.subtitle}</p>}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pc.class}`}>{pc.label}</span>
                    <span className="text-xs text-secondary-400">Order: {b.displayOrder}</span>
                    {b.link && <span className="text-xs text-secondary-400 font-mono truncate max-w-[160px]">{b.link}</span>}
                    <span className="text-xs text-secondary-400">
                      {startFmt ? `From: ${startFmt}` : endFmt ? `To: ${endFmt}` : 'Always'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(b)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${b.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-secondary-100 text-secondary-500 hover:bg-secondary-200'}`}
                  >
                    {b.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => setModal({ banner: b })} className="p-1.5 hover:bg-secondary-100 rounded-lg" title="Edit">
                    <Pencil size={14} className="text-secondary-500" />
                  </button>
                  <button onClick={() => deleteBanner(b._id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <BannerModal
          banner={modal.banner}
          platformFilter={platformFilter}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); setRev((r) => r + 1); }}
        />
      )}
    </div>
  );
}
