import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  Plus, Pencil, Trash2, ExternalLink, RefreshCw, Download,
  Search, ChevronUp, ChevronDown, Package, AlertTriangle,
  X, MoreVertical, Copy, Eye, EyeOff, Shield, Globe,
  Truck, Star, Percent,
} from 'lucide-react';
import { useFetch } from '../../../../hooks';
import api from '../../../../utils/api';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import ImageUpload from '../../../components/common/ImageUpload';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const SHIPPING_ZONES = [
  { id: 'tamilnadu', label: 'Tamil Nadu' },
  { id: 'south',     label: 'South India' },
  { id: 'north',     label: 'North India' },
  { id: 'east',      label: 'East India' },
  { id: 'west',      label: 'West India' },
];

const MODAL_TABS = [
  { id: 'basic',    label: 'Basic Info' },
  { id: 'pricing',  label: 'Pricing' },
  { id: 'media',    label: 'Media' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'details',  label: 'Details' },
  { id: 'warranty', label: 'Warranty' },
  { id: 'seo',      label: 'SEO' },
];

const EMPTY_FORM = {
  title: '', description: '', brand: '', sku: '', tags: '',
  categoryId: '', category: '',
  price: '', compareAt: '', stock: '',
  taxable: true, taxRate: 18, taxIncluded: false, hsnCode: '',
  weight: '', shippingCharge: '', delhiveryEnabled: true, shippingZones: [],
  images: [], imageAlts: [], videoUrl: '',
  specifications: [],
  faqs: [],
  hasWarranty: false,
  warranty: { duration: '', durationType: 'months', provider: '', description: '', terms: '', activationRequired: false },
  seo: { title: '', description: '', keywords: '' },
  structuredData: { schemaType: 'Product' },
  published: true, featured: false,
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function StockBadge({ stock }) {
  if (stock === 0)   return <span className="text-red-600 font-semibold text-xs">Out of stock</span>;
  if (stock <= 10)   return <span className="text-amber-600 font-semibold text-xs">{stock} (Low)</span>;
  return <span className="text-secondary-700 text-sm">{stock}</span>;
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-secondary-700 mb-1">
        {label}{hint && <span className="text-secondary-400 font-normal ml-1">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT_CLS = 'w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300';

// ── ProductFormModal ──────────────────────────────────────────────────────────

function ProductFormModal({ open, onClose, editing, cats, onSaved }) {
  const [form,   setForm]   = useState(EMPTY_FORM);
  const [tab,    setTab]    = useState('basic');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('basic');
    if (!editing) { setForm(EMPTY_FORM); return; }
    const p = editing;
    setForm({
      ...EMPTY_FORM,
      title:            p.title || '',
      description:      p.description || '',
      brand:            p.brand || '',
      sku:              p.sku || '',
      tags:             (p.tags || []).join(', '),
      categoryId:       p.categoryIds?.[0]?.toString() || '',
      category:         p.category || '',
      price:            p.price ?? '',
      compareAt:        p.compareAt ?? '',
      stock:            p.stock ?? '',
      taxable:          p.taxable ?? true,
      taxRate:          p.taxRate ?? 18,
      taxIncluded:      p.taxIncluded ?? false,
      hsnCode:          p.hsnCode || '',
      weight:           p.weight ?? '',
      shippingCharge:   p.shippingCharge ?? '',
      delhiveryEnabled: p.delhiveryEnabled ?? true,
      shippingZones:    p.shippingZones || [],
      images:           p.images || [],
      imageAlts:        p.imageAlts || [],
      videoUrl:         p.videoUrl || '',
      specifications:   p.specifications || [],
      faqs:             p.faqs || [],
      hasWarranty:      p.hasWarranty ?? false,
      warranty:         { ...EMPTY_FORM.warranty, ...(p.warranty || {}) },
      seo:              { title: p.seo?.title || '', description: p.seo?.description || '', keywords: (p.seo?.keywords || []).join(', ') },
      structuredData:   { schemaType: p.structuredData?.schemaType || 'Product' },
      published:        p.published ?? true,
      featured:         p.featured ?? false,
    });
  }, [open, editing?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generic setter — supports dot-path "warranty.duration"
  function set(path, value) {
    const [k1, k2] = path.split('.');
    setForm((f) => k2
      ? { ...f, [k1]: { ...f[k1], [k2]: value } }
      : { ...f, [k1]: value }
    );
  }
  const e = (path) => (ev) => set(path, ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value);

  // Specifications
  const addSpec  = () => setForm((f) => ({ ...f, specifications: [...f.specifications, { label: '', value: '' }] }));
  const delSpec  = (i) => setForm((f) => ({ ...f, specifications: f.specifications.filter((_, j) => j !== i) }));
  const upSpec   = (i, field, val) => setForm((f) => ({
    ...f, specifications: f.specifications.map((s, j) => j === i ? { ...s, [field]: val } : s),
  }));

  // FAQs
  const addFaq  = () => setForm((f) => ({ ...f, faqs: [...f.faqs, { question: '', answer: '' }] }));
  const delFaq  = (i) => setForm((f) => ({ ...f, faqs: f.faqs.filter((_, j) => j !== i) }));
  const upFaq   = (i, field, val) => setForm((f) => ({
    ...f, faqs: f.faqs.map((q, j) => j === i ? { ...q, [field]: val } : q),
  }));

  // Zone charges
  const getZone = (id) => form.shippingZones.find((z) => z.zone === id)?.charge ?? '';
  const setZone = (id, charge) => setForm((f) => {
    const exists = f.shippingZones.find((z) => z.zone === id);
    const v = parseFloat(charge) || 0;
    return {
      ...f,
      shippingZones: exists
        ? f.shippingZones.map((z) => z.zone === id ? { ...z, charge: v } : z)
        : [...f.shippingZones, { zone: id, charge: v }],
    };
  });

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!form.title.trim())       return toast.error('Title is required');
    if (!form.description.trim()) return toast.error('Description is required');
    if (form.price === '' || isNaN(parseFloat(form.price))) return toast.error('Valid price required');
    if (form.stock === '' || isNaN(parseInt(form.stock)))   return toast.error('Valid stock required');

    setSaving(true);
    try {
      const payload = {
        title:            form.title.trim(),
        description:      form.description.trim(),
        brand:            form.brand.trim() || undefined,
        sku:              form.sku.trim() || undefined,
        tags:             form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        categoryIds:      form.categoryId ? [form.categoryId] : [],
        category:         form.category || undefined,
        price:            parseFloat(form.price),
        compareAt:        form.compareAt !== '' ? parseFloat(form.compareAt) : undefined,
        stock:            parseInt(form.stock),
        taxable:          form.taxable,
        taxRate:          parseFloat(form.taxRate) || 0,
        taxIncluded:      form.taxIncluded,
        hsnCode:          form.hsnCode.trim() || undefined,
        weight:           form.weight !== '' ? parseFloat(form.weight) : undefined,
        shippingCharge:   form.shippingCharge !== '' ? parseFloat(form.shippingCharge) : 0,
        delhiveryEnabled: form.delhiveryEnabled,
        shippingZones:    form.shippingZones.filter((z) => z.charge > 0),
        images:           form.images,
        imageAlts:        form.imageAlts,
        videoUrl:         form.videoUrl.trim() || undefined,
        specifications:   form.specifications.filter((s) => s.label.trim() && s.value.trim()),
        faqs:             form.faqs.filter((f) => f.question.trim() && f.answer.trim()),
        hasWarranty:      form.hasWarranty,
        warranty:         form.hasWarranty ? {
          duration:            parseInt(form.warranty.duration) || undefined,
          durationType:        form.warranty.durationType,
          provider:            form.warranty.provider.trim() || undefined,
          description:         form.warranty.description.trim() || undefined,
          terms:               form.warranty.terms.trim() || undefined,
          activationRequired:  form.warranty.activationRequired,
        } : undefined,
        seo: {
          title:       form.seo.title.trim() || undefined,
          description: form.seo.description.trim() || undefined,
          keywords:    form.seo.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        },
        structuredData: { schemaType: form.structuredData.schemaType },
        published: form.published,
        featured:  form.featured,
      };

      if (editing) {
        await api.put(`/vendors/products/${editing._id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/vendors/products', payload);
        toast.success('Product created');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100 shrink-0">
          <h2 className="font-bold text-secondary-900 text-lg">
            {editing ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-secondary-100 overflow-x-auto shrink-0 px-2">
          {MODAL_TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:text-secondary-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6">

            {/* ── BASIC INFO ─────────────────────────────────────────────── */}
            {tab === 'basic' && (
              <div className="space-y-4">
                <Field label="Title *">
                  <input value={form.title} onChange={e('title')} required
                    placeholder="Product name" className={INPUT_CLS} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Brand">
                    <input value={form.brand} onChange={e('brand')} placeholder="Brand name" className={INPUT_CLS} />
                  </Field>
                  <Field label="SKU" hint="(auto-generated if blank)">
                    <input value={form.sku} onChange={e('sku')} placeholder="e.g. VND-001" className={INPUT_CLS} />
                  </Field>
                </div>
                <Field label="Category">
                  <select value={form.categoryId} onChange={(ev) => {
                    const cat = cats?.find((c) => c._id === ev.target.value);
                    setForm((f) => ({ ...f, categoryId: ev.target.value, category: cat?.slug || '' }));
                  }} className={INPUT_CLS + ' bg-white'}>
                    <option value="">Select a category</option>
                    {cats?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Tags" hint="(comma-separated)">
                  <input value={form.tags} onChange={e('tags')} placeholder="tool, brand, type" className={INPUT_CLS} />
                </Field>
                <div className="flex gap-6 pt-1">
                  {[['published', 'Published'], ['featured', 'Featured']].map(([field, label]) => (
                    <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form[field]} onChange={e(field)} className="w-4 h-4 accent-primary-600" />
                      <span className="font-medium text-secondary-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── PRICING ────────────────────────────────────────────────── */}
            {tab === 'pricing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Price (₹) *">
                    <input type="number" min="0" step="0.01" value={form.price} onChange={e('price')} required className={INPUT_CLS} />
                  </Field>
                  <Field label="Compare At (₹)" hint="(MRP)">
                    <input type="number" min="0" step="0.01" value={form.compareAt} onChange={e('compareAt')} placeholder="Original price" className={INPUT_CLS} />
                  </Field>
                  <Field label="Stock *">
                    <input type="number" min="0" value={form.stock} onChange={e('stock')} required className={INPUT_CLS} />
                  </Field>
                </div>
                <div className="bg-secondary-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-secondary-700">GST / Tax Settings</p>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.taxable} onChange={e('taxable')} className="w-4 h-4 accent-primary-600" />
                    Taxable product
                  </label>
                  {form.taxable && (
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-secondary-600 mb-1">GST Rate</label>
                        <select value={form.taxRate} onChange={e('taxRate')} className="w-full border border-secondary-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
                          {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-secondary-600 mb-1">HSN Code</label>
                        <input value={form.hsnCode} onChange={e('hsnCode')} placeholder="e.g. 8467"
                          className="w-full border border-secondary-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={form.taxIncluded} onChange={e('taxIncluded')} className="w-4 h-4 accent-primary-600" />
                          <span className="text-secondary-600">Tax included in price</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── MEDIA ──────────────────────────────────────────────────── */}
            {tab === 'media' && (
              <div className="space-y-5">
                <Field label="Product Images">
                  <ImageUpload urls={form.images} onChange={(imgs) => setForm((f) => ({ ...f, images: imgs }))} uploadUrl="/vendors/upload/image" />
                </Field>
                {form.images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-secondary-700">
                      Image Alt Tags <span className="text-secondary-400 font-normal">(for SEO)</span>
                    </p>
                    {form.images.map((img, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <img src={normalizeImageUrl(img)} alt="" className="w-10 h-10 rounded object-cover bg-secondary-100 shrink-0" />
                        <input
                          value={form.imageAlts[i] || ''}
                          onChange={(ev) => {
                            const alts = [...(form.imageAlts || [])];
                            alts[i] = ev.target.value;
                            setForm((f) => ({ ...f, imageAlts: alts }));
                          }}
                          placeholder={`Alt text for image ${i + 1}`}
                          className="flex-1 border border-secondary-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <Field label="YouTube Video URL">
                  <input value={form.videoUrl} onChange={e('videoUrl')} type="url"
                    placeholder="https://www.youtube.com/watch?v=..." className={INPUT_CLS} />
                </Field>
              </div>
            )}

            {/* ── SHIPPING ───────────────────────────────────────────────── */}
            {tab === 'shipping' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Weight (kg)">
                    <input type="number" min="0" step="0.01" value={form.weight} onChange={e('weight')} placeholder="e.g. 1.5" className={INPUT_CLS} />
                  </Field>
                  <Field label="Flat Shipping Charge (₹)">
                    <input type="number" min="0" step="0.01" value={form.shippingCharge} onChange={e('shippingCharge')} placeholder="0 = free" className={INPUT_CLS} />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.delhiveryEnabled} onChange={e('delhiveryEnabled')} className="w-4 h-4 accent-primary-600" />
                  <Truck size={14} className="text-secondary-400" />
                  <span className="font-medium text-secondary-700">Enable Delhivery shipping</span>
                </label>
                <div className="bg-secondary-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-secondary-700 mb-3">Zone-Based Shipping Charges (₹)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SHIPPING_ZONES.map((zone) => (
                      <div key={zone.id}>
                        <label className="block text-xs font-medium text-secondary-600 mb-1">{zone.label}</label>
                        <div className="flex items-center gap-1 border border-secondary-200 rounded-lg px-2 py-1.5 bg-white">
                          <span className="text-secondary-400 text-xs">₹</span>
                          <input type="number" min="0" step="0.01" value={getZone(zone.id)}
                            onChange={(ev) => setZone(zone.id, ev.target.value)}
                            placeholder="0" className="flex-1 text-sm focus:outline-none" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-secondary-400 mt-2">Highest zone charge applies at checkout</p>
                </div>
              </div>
            )}

            {/* ── DETAILS ────────────────────────────────────────────────── */}
            {tab === 'details' && (
              <div className="space-y-5">
                <Field label="Description *">
                  <textarea value={form.description} onChange={e('description')} required rows={6}
                    placeholder="Describe your product…"
                    className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-y" />
                </Field>

                {/* Specifications */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-secondary-700">Specifications</p>
                    <button type="button" onClick={addSpec} className="text-xs text-primary-600 hover:text-primary-700 font-semibold">+ Add Row</button>
                  </div>
                  {form.specifications.length === 0
                    ? <p className="text-xs text-secondary-400">No specifications. Click "+ Add Row" to add.</p>
                    : (
                      <div className="space-y-2">
                        {form.specifications.map((spec, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input value={spec.label} onChange={(ev) => upSpec(i, 'label', ev.target.value)}
                              placeholder="Label (e.g. Weight)"
                              className="flex-1 border border-secondary-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                            <input value={spec.value} onChange={(ev) => upSpec(i, 'value', ev.target.value)}
                              placeholder="Value (e.g. 2.5 kg)"
                              className="flex-1 border border-secondary-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                            <button type="button" onClick={() => delSpec(i)} className="p-1 text-secondary-300 hover:text-red-500 shrink-0"><X size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>

                {/* FAQs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-secondary-700">FAQs</p>
                    <button type="button" onClick={addFaq} className="text-xs text-primary-600 hover:text-primary-700 font-semibold">+ Add FAQ</button>
                  </div>
                  {form.faqs.length === 0
                    ? <p className="text-xs text-secondary-400">No FAQs. Click "+ Add FAQ" to add.</p>
                    : (
                      <div className="space-y-3">
                        {form.faqs.map((faq, i) => (
                          <div key={i} className="bg-secondary-50 rounded-xl p-3">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 space-y-2">
                                <input value={faq.question} onChange={(ev) => upFaq(i, 'question', ev.target.value)}
                                  placeholder="Question"
                                  className="w-full border border-secondary-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
                                <textarea value={faq.answer} onChange={(ev) => upFaq(i, 'answer', ev.target.value)}
                                  placeholder="Answer" rows={2}
                                  className="w-full border border-secondary-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
                              </div>
                              <button type="button" onClick={() => delFaq(i)} className="p-1 text-secondary-300 hover:text-red-500 shrink-0 mt-1"><X size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }
                </div>
              </div>
            )}

            {/* ── WARRANTY ───────────────────────────────────────────────── */}
            {tab === 'warranty' && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.hasWarranty} onChange={e('hasWarranty')} className="w-4 h-4 accent-primary-600" />
                  <Shield size={14} className="text-secondary-400" />
                  <span className="font-medium text-secondary-700">Product has a warranty</span>
                </label>
                {form.hasWarranty && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Duration">
                        <input type="number" min="1" value={form.warranty.duration}
                          onChange={(ev) => set('warranty.duration', ev.target.value)} className={INPUT_CLS} />
                      </Field>
                      <Field label="Duration Type">
                        <select value={form.warranty.durationType} onChange={(ev) => set('warranty.durationType', ev.target.value)}
                          className={INPUT_CLS + ' bg-white'}>
                          <option value="months">Months</option>
                          <option value="years">Years</option>
                          <option value="lifetime">Lifetime</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Provider">
                      <input value={form.warranty.provider} onChange={(ev) => set('warranty.provider', ev.target.value)}
                        placeholder="e.g. Manufacturer, In-house" className={INPUT_CLS} />
                    </Field>
                    <Field label="Warranty Description">
                      <textarea value={form.warranty.description} onChange={(ev) => set('warranty.description', ev.target.value)}
                        rows={3} placeholder="What does the warranty cover?"
                        className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
                    </Field>
                    <Field label="Terms & Conditions">
                      <textarea value={form.warranty.terms} onChange={(ev) => set('warranty.terms', ev.target.value)}
                        rows={3} placeholder="Warranty terms and conditions…"
                        className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
                    </Field>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.warranty.activationRequired}
                        onChange={(ev) => set('warranty.activationRequired', ev.target.checked)} className="w-4 h-4 accent-primary-600" />
                      <span className="text-secondary-700">Activation required</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* ── SEO ────────────────────────────────────────────────────── */}
            {tab === 'seo' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-secondary-700">Meta Title</label>
                    <span className={`text-xs ${form.seo.title.length > 60 ? 'text-red-500' : 'text-secondary-400'}`}>
                      {form.seo.title.length}/60
                    </span>
                  </div>
                  <input value={form.seo.title} onChange={(ev) => set('seo.title', ev.target.value)} maxLength={70}
                    placeholder={form.title || 'SEO title (defaults to product title)'}
                    className={INPUT_CLS} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-secondary-700">Meta Description</label>
                    <span className={`text-xs ${form.seo.description.length > 160 ? 'text-red-500' : 'text-secondary-400'}`}>
                      {form.seo.description.length}/160
                    </span>
                  </div>
                  <textarea value={form.seo.description} onChange={(ev) => set('seo.description', ev.target.value)}
                    maxLength={180} rows={3} placeholder="Brief description for search engines…"
                    className="w-full border border-secondary-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none" />
                </div>
                <Field label="Keywords" hint="(comma-separated)">
                  <input value={form.seo.keywords} onChange={(ev) => set('seo.keywords', ev.target.value)}
                    placeholder="e.g. power drill, cordless, tools" className={INPUT_CLS} />
                </Field>
                {/* Google preview */}
                <div className="bg-white border border-secondary-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wide mb-3">Google Preview</p>
                  <div className="space-y-0.5">
                    <p className="text-[#1a0dab] text-base hover:underline cursor-pointer line-clamp-1">
                      {form.seo.title || form.title || 'Product Title'}
                    </p>
                    <p className="text-[#006621] text-xs">
                      macgly.com › product › {(form.title || 'product').toLowerCase().replace(/\s+/g, '-')}
                    </p>
                    <p className="text-secondary-600 text-sm line-clamp-2">
                      {form.seo.description || form.description || 'Product description will appear here…'}
                    </p>
                  </div>
                </div>
                <Field label="Schema Type">
                  <select value={form.structuredData.schemaType}
                    onChange={(ev) => setForm((f) => ({ ...f, structuredData: { ...f.structuredData, schemaType: ev.target.value } }))}
                    className={INPUT_CLS + ' bg-white'}>
                    {['Product', 'Book', 'Movie', 'MusicAlbum', 'Recipe', 'SoftwareApplication', 'VideoGame', 'Event', 'Course'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-secondary-100 shrink-0 bg-secondary-50 rounded-b-2xl">
            <div className="flex items-center gap-5 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.published} onChange={e('published')} className="w-4 h-4 accent-primary-600" />
                <Eye size={14} className="text-secondary-400" />
                <span className="font-medium text-secondary-700">Published</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={e('featured')} className="w-4 h-4 accent-primary-600" />
                <Star size={14} className="text-secondary-400" />
                <span className="font-medium text-secondary-700">Featured</span>
              </label>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 border border-secondary-200 rounded-lg text-sm font-medium text-secondary-700 hover:bg-secondary-100 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors min-w-[120px]">
                {saving ? 'Saving…' : editing ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── BulkPriceModal ─────────────────────────────────────────────────────────────

function BulkPriceModal({ open, onClose, count, onConfirm }) {
  const [pct,  setPct]  = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const val = parseFloat(pct);
    if (isNaN(val)) return toast.error('Enter a valid percentage');
    setBusy(true);
    try { await onConfirm(val); onClose(); setPct(''); }
    catch {} finally { setBusy(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-bold text-secondary-900 mb-1">Bulk Price Update</h3>
        <p className="text-sm text-secondary-500 mb-4">{count} product{count !== 1 ? 's' : ''} selected</p>
        <div className="flex items-center gap-2 border border-secondary-200 rounded-lg px-3 py-2 bg-secondary-50 mb-1">
          <input type="number" step="0.1" value={pct} onChange={(ev) => setPct(ev.target.value)} autoFocus
            placeholder="e.g. 10 or -5"
            className="flex-1 bg-transparent text-sm focus:outline-none" />
          <span className="text-secondary-500 font-semibold text-sm">%</span>
        </div>
        <p className="text-xs text-secondary-400 mb-5">Positive = price increase · Negative = discount · Min price ₹1</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => { onClose(); setPct(''); }}
            className="px-4 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50">Cancel</button>
          <button onClick={submit} disabled={busy || !pct}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
            {busy ? 'Updating…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProductRow ─────────────────────────────────────────────────────────────────

function ProductRow({ product: p, selected, onSelect, onEdit, onDelete, onCopyId }) {
  const [menu, setMenu] = useState(false);

  return (
    <tr className={`hover:bg-secondary-50 transition-colors ${selected ? 'bg-primary-50/50' : ''}`}>
      <td className="px-4 py-3">
        <input type="checkbox" checked={selected} onChange={() => onSelect(p._id)}
          className="w-4 h-4 accent-primary-600 cursor-pointer" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {p.images?.[0] ? (
            <img src={normalizeImageUrl(p.images[0])} alt={p.imageAlts?.[0] || p.title}
              className="w-10 h-10 rounded-lg object-cover bg-secondary-100 shrink-0"
              onError={(ev) => { ev.target.style.display = 'none'; }} />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0">
              <Package size={16} className="text-secondary-300" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-secondary-900 text-sm leading-tight line-clamp-1">{p.title}</p>
            {p.brand && <p className="text-xs text-secondary-400 mt-0.5">{p.brand}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-mono text-secondary-400">{p.sku || '—'}</td>
      <td className="px-4 py-3">
        <p className="font-semibold text-secondary-900 text-sm">{formatCurrency(p.price)}</p>
        {p.compareAt > p.price && (
          <p className="text-xs text-secondary-400 line-through">{formatCurrency(p.compareAt)}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            p.stock === 0 ? 'bg-red-500' : p.stock <= 10 ? 'bg-amber-400' : 'bg-green-500'
          }`} />
          <StockBadge stock={p.stock} />
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
          p.published ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'
        }`}>
          {p.published ? <Eye size={10} /> : <EyeOff size={10} />}
          {p.published ? 'Published' : 'Draft'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-0.5 justify-end">
          {p.published && p.slug && (
            <a href={`/product/${p.slug}`} target="_blank" rel="noopener noreferrer"
              className="p-1.5 text-secondary-300 hover:text-secondary-600 hover:bg-secondary-100 rounded-lg transition-colors" title="View on storefront">
              <ExternalLink size={13} />
            </a>
          )}
          <button onClick={() => onEdit(p)}
            className="p-1.5 text-secondary-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
            <Pencil size={13} />
          </button>
          <div className="relative">
            <button onClick={() => setMenu((v) => !v)}
              className="p-1.5 text-secondary-300 hover:text-secondary-600 hover:bg-secondary-100 rounded-lg transition-colors">
              <MoreVertical size={13} />
            </button>
            {menu && (
              <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-secondary-100 py-1 min-w-36"
                onMouseLeave={() => setMenu(false)}>
                <button onClick={() => { onCopyId(p._id); setMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50">
                  <Copy size={12} /> Copy ID
                </button>
                <button onClick={() => { onDelete(p); setMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function VendorProducts() {
  const { user } = useSelector((s) => s.auth);
  const [rev, setRev] = useState(0);

  // Data fetching
  const { data: statsRaw } = useFetch(
    ['vendor-product-stats', user?._id, rev],
    () => api.get('/vendors/products/stats').then((r) => r.data),
  );
  const { data: rawData, isLoading } = useFetch(
    ['vendor-products', user?._id, rev],
    () => api.get('/vendors/products', { params: { page: 1, limit: 100 } }).then((r) => r.data),
  );
  const { data: catsData } = useFetch(
    ['cats'],
    () => api.get('/catalog/categories').then((r) => r.data),
  );

  const allProducts = rawData?.products || [];
  const cats        = catsData?.categories || [];
  const stats       = statsRaw || {};

  // Filters + sort + pagination
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stockFilter,  setStockFilter]  = useState('');
  const [sortField,    setSortField]    = useState('createdAt');
  const [sortDir,      setSortDir]      = useState('desc');
  const [page,         setPage]         = useState(1);

  // Bulk
  const [selected,      setSelected]      = useState([]);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);

  // Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editing,  setEditing]  = useState(null);

  // Client-side filter → sort → paginate
  const filtered = useMemo(() => {
    let list = allProducts;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        (p.sku  || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter === 'published') list = list.filter((p) => p.published);
    if (statusFilter === 'draft')     list = list.filter((p) => !p.published);
    if (stockFilter  === 'out')       list = list.filter((p) => p.stock === 0);
    if (stockFilter  === 'low')       list = list.filter((p) => p.stock > 0 && p.stock <= 10);
    if (stockFilter  === 'in')        list = list.filter((p) => p.stock > 10);

    return [...list].sort((a, b) => {
      const av = a[sortField]; const bv = b[sortField];
      const cmp = typeof av === 'string' ? (av || '').localeCompare(bv || '') : (av ?? 0) - (bv ?? 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [allProducts, search, statusFilter, stockFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(field) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  }

  const allPageSelected = paged.length > 0 && paged.every((p) => selected.includes(p._id));
  function toggleAll() {
    if (allPageSelected) setSelected((s) => s.filter((id) => !paged.find((p) => p._id === id)));
    else setSelected((s) => [...new Set([...s, ...paged.map((p) => p._id)])]);
  }
  function toggleOne(id) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  // Handlers
  async function handleDelete(product) {
    if (!confirm(`Delete "${product.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/vendors/products/${product._id}`);
      toast.success('Product deleted');
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Delete failed');
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Permanently delete ${selected.length} selected products?`)) return;
    try {
      const { data } = await api.post('/vendors/products/bulk-delete', { productIds: selected });
      toast.success(`${data.deleted} product${data.deleted !== 1 ? 's' : ''} deleted`);
      setSelected([]);
      setRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Bulk delete failed');
    }
  }

  async function handleBulkPrice(pct) {
    const { data } = await api.post('/vendors/products/bulk-price-update', { productIds: selected, percentageChange: pct });
    toast.success(`${data.updated} product${data.updated !== 1 ? 's' : ''} updated (${pct > 0 ? '+' : ''}${pct}%)`);
    setSelected([]);
    setRev((r) => r + 1);
  }

  async function handleExport() {
    try {
      const res = await api.get('/vendors/products/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  }

  function openAdd()    { setEditing(null); setFormOpen(true); }
  function openEdit(p)  { setEditing(p);    setFormOpen(true); }
  function refresh()    { setRev((r) => r + 1); }
  function copyId(id)   { navigator.clipboard.writeText(id).then(() => toast.success('ID copied')); }

  // Reset page when filters change
  function applySearch(val)  { setSearch(val);  setPage(1); }
  function applyStatus(val)  { setStatusFilter(val); setPage(1); }
  function applyStock(val)   { setStockFilter(val);  setPage(1); }
  function clearFilters()    { setSearch(''); setStatusFilter(''); setStockFilter(''); setPage(1); }

  const hasFilters      = search || statusFilter || stockFilter;
  const needsAttention  = (stats.outOfStock || 0);

  const SortTh = ({ field, children }) => (
    <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide whitespace-nowrap">
      <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-secondary-900 transition-colors">
        {children}
        {sortField === field && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-secondary-900">My Products</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-secondary-200 rounded-lg text-sm text-secondary-700 hover:bg-secondary-50 transition-colors">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors">
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Products',  value: stats.total ?? allProducts.length,  cls: 'text-secondary-900' },
          { label: 'Published',       value: stats.published ?? 0,               cls: 'text-green-700' },
          { label: 'Draft',           value: stats.draft ?? 0,                   cls: 'text-secondary-500' },
          { label: 'Low Stock',       value: stats.lowStock ?? 0,                cls: 'text-amber-600' },
          { label: 'Out of Stock',    value: stats.outOfStock ?? 0,              cls: 'text-red-600' },
          { label: 'Inventory Value', value: formatCurrency(stats.inventoryValue ?? 0), cls: 'text-primary-700 text-sm leading-tight' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white border border-secondary-200 rounded-xl px-4 py-3">
            <p className={`text-xl font-black leading-tight truncate ${cls}`}>{value}</p>
            <p className="text-xs text-secondary-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Alert banner */}
      {needsAttention > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            <p className="text-sm font-medium text-amber-800">
              <strong>{needsAttention} product{needsAttention !== 1 ? 's' : ''} need attention:</strong>{' '}
              {stats.outOfStock > 0 && `${stats.outOfStock} out of stock`}
              {stats.outOfStock > 0 && stats.lowStock > 0 && ', '}
              {stats.lowStock > 0 && `${stats.lowStock} low stock`}
            </p>
          </div>
          <button onClick={() => { applyStock('out'); }}
            className="text-xs font-bold text-amber-700 hover:text-amber-900 px-3 py-1 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors whitespace-nowrap">
            View Items →
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input value={search} onChange={(ev) => applySearch(ev.target.value)}
            placeholder="Search by title, SKU, or brand…"
            className="w-full pl-9 pr-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
        </div>
        <select value={statusFilter} onChange={(ev) => applyStatus(ev.target.value)}
          className="border border-secondary-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
          <option value="">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select value={stockFilter} onChange={(ev) => applyStock(ev.target.value)}
          className="border border-secondary-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
          <option value="">All Stock Levels</option>
          <option value="in">In Stock (&gt;10)</option>
          <option value="low">Low Stock (≤10)</option>
          <option value="out">Out of Stock</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters}
            className="text-sm text-secondary-500 hover:text-secondary-700 px-3 py-2 border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Count + bulk bar */}
      <div className="flex items-center justify-between gap-3 min-h-[32px]">
        <p className="text-sm text-secondary-500">
          {isLoading
            ? 'Loading…'
            : filtered.length > 0
              ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} products`
              : 'No products found'
          }
        </p>
        {selected.length > 0 && (
          <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-2">
            <span className="font-semibold text-primary-700 text-sm">{selected.length} selected</span>
            <button onClick={handleBulkDelete}
              className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={() => setBulkPriceOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:bg-primary-100 px-2 py-1 rounded-lg transition-colors">
              <Percent size={12} /> Update Prices
            </button>
            <button onClick={() => setSelected([])} className="text-secondary-400 hover:text-secondary-600 transition-colors">
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary-50 border-b border-secondary-200">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                    className="w-4 h-4 accent-primary-600 cursor-pointer" />
                </th>
                <SortTh field="title">Product</SortTh>
                <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">SKU</th>
                <SortTh field="price">Price</SortTh>
                <SortTh field="stock">Stock</SortTh>
                <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Spinner />
                    <p className="text-secondary-400 text-sm mt-2">Loading products…</p>
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <Package size={36} className="mx-auto text-secondary-300 mb-2" />
                    <p className="text-secondary-500 font-medium">
                      {hasFilters ? 'No products match your filters' : 'No products yet'}
                    </p>
                    {!hasFilters && (
                      <p className="text-secondary-400 text-xs mt-1">Click "Add Product" to list your first product</p>
                    )}
                  </td>
                </tr>
              ) : paged.map((p) => (
                <ProductRow
                  key={p._id}
                  product={p}
                  selected={selected.includes(p._id)}
                  onSelect={toggleOne}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onCopyId={copyId}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 border border-secondary-200 rounded-lg text-sm font-medium text-secondary-600 hover:bg-secondary-50 disabled:opacity-40 transition-colors">
              Previous
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) {
                    return [
                      <span key={`ellipsis-${p}`} className="w-8 h-8 flex items-center justify-center text-secondary-400 text-xs">…</span>,
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100 text-secondary-600'}`}>
                        {p}
                      </button>,
                    ];
                  }
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100 text-secondary-600'}`}>
                      {p}
                    </button>
                  );
                })
              }
            </div>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 border border-secondary-200 rounded-lg text-sm font-medium text-secondary-600 hover:bg-secondary-50 disabled:opacity-40 transition-colors">
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        cats={cats}
        onSaved={refresh}
      />
      <BulkPriceModal
        open={bulkPriceOpen}
        onClose={() => setBulkPriceOpen(false)}
        count={selected.length}
        onConfirm={handleBulkPrice}
      />
    </div>
  );
}
