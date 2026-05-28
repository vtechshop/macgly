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

const ZONE_LABELS = [
  { key: 'tamilnadu', label: 'Tamil Nadu' },
  { key: 'south',     label: 'South India (AP, KA, KL, TS)' },
  { key: 'north',     label: 'North India (Delhi, UP, HR…)' },
  { key: 'east',      label: 'East India (WB, Odisha, Bihar…)' },
  { key: 'west',      label: 'West India (MH, GJ, RJ…)' },
];

// shippingZones stored as [{zone, charge}] — helper to convert to/from flat object for the form
function zonesToFlat(zones = []) {
  const flat = { tamilnadu: '', south: '', north: '', east: '', west: '' };
  (zones || []).forEach(({ zone, charge }) => { if (zone) flat[zone] = charge ?? ''; });
  return flat;
}
function flatToZones(flat = {}) {
  return ZONE_LABELS
    .filter(({ key }) => flat[key] !== '' && flat[key] != null)
    .map(({ key }) => ({ zone: key, charge: parseFloat(flat[key]) || 0 }));
}

const emptyForm = {
  // Basic
  title: '', slug: '', description: '', brand: '', sku: '', tags: '',
  videoUrl: '', published: true, featured: false, displayOrder: 0,
  // Pricing
  price: '', compareAt: '', cost: '', stock: '',
  // Tax
  taxable: true, taxRate: 18, taxIncluded: false, hsnCode: '',
  // Inventory
  trackInventory: true, lowStockThreshold: 10,
  // Shipping
  weight: '', shippingCharge: '', delhiveryEnabled: true,
  _shippingZonesFlat: { tamilnadu: '', south: '', north: '', east: '', west: '' },
  dimensions: { length: '', width: '', height: '', unit: 'in' },
  // Categorisation
  category: '', categoryIds: [],
  // Images
  images: [], imageAlts: [],
  // Vendor / Commission
  vendorId: '',
  vendorCommissionPercentage: '', affiliateCommissionPercentage: '',
  // Warranty
  hasWarranty: false,
  warranty: { duration: '', durationType: 'months', provider: '', description: '', terms: '', activationRequired: false },
  // Content
  specifications: [], faqs: [],
  // SEO
  seo: { title: '', description: '', keywords: '' },
  // Structured Data
  structuredData: { schemaType: 'Product', properties: '{}', customSnippets: [] },
  // Variants
  hasVariants: false, variantOptions: [], variants: [],
};

export default function AdminProducts() {
  const [page, setPage] = useState(1);
  const [rev, setRev] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewProduct, setViewProduct] = useState(null);

  // Debounce search
  useState(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  });

  const { data, isLoading } = useFetch(
    ['admin-products', page, rev, debouncedSearch, statusFilter],
    () => api.get('/admin/products', {
      params: {
        page, limit: 20,
        search: debouncedSearch || undefined,
        published: statusFilter === 'published' ? true : statusFilter === 'draft' ? false : undefined,
      }
    }).then((r) => r.data)
  );

  const { data: catsData } = useFetch(
    ['categories'],
    () => api.get('/catalog/categories').then((r) => r.data)
  );

  const { data: vendorsData } = useFetch(
    ['admin-vendors-list'],
    () => api.get('/admin/users', { params: { role: 'vendor', limit: 100 } }).then((r) => r.data)
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
      imageAlts: p.imageAlts || [],
      tags: (p.tags || []).join(', '),
      hasWarranty: p.hasWarranty || !!(p.warranty?.duration),
      warranty: { ...emptyForm.warranty, ...(p.warranty || {}) },
      specifications: p.specifications || [],
      faqs: p.faqs || [],
      seo: { ...emptyForm.seo, ...p.seo, keywords: Array.isArray(p.seo?.keywords) ? p.seo.keywords.join(', ') : (p.seo?.keywords || '') },
      structuredData: {
        ...emptyForm.structuredData,
        ...(p.structuredData || {}),
        properties: p.structuredData?.properties ? JSON.stringify(p.structuredData.properties, null, 2) : '{}',
        customSnippets: p.structuredData?.customSnippets || [],
      },
      _shippingZonesFlat: zonesToFlat(p.shippingZones),
      dimensions: { ...emptyForm.dimensions, ...(p.dimensions || {}) },
      vendorId: p.vendorId?._id?.toString() || p.vendorId?.toString() || '',
      videoUrl: p.videoUrl || '',
      cost: p.cost ?? '',
      vendorCommissionPercentage:    p.vendorCommissionPercentage ?? '',
      affiliateCommissionPercentage: p.affiliateCommissionPercentage ?? '',
      weight: p.weight ?? '',
      shippingCharge: p.shippingCharge ?? '',
      delhiveryEnabled: p.delhiveryEnabled !== false,
      taxRate:     p.taxRate ?? p.gstRate ?? 18,
      taxIncluded: p.taxIncluded ?? p.gstIncluded ?? false,
      taxable:     p.taxable !== false,
      hsnCode:     p.hsnCode || p.hsn || '',
      trackInventory: p.trackInventory !== false,
      lowStockThreshold: p.lowStockThreshold ?? 10,
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

    // Parse structured data properties safely
    let sdProperties = {};
    try { sdProperties = JSON.parse(form.structuredData?.properties || '{}'); } catch {}

    save({
      title: form.title,
      slug,
      description: form.description,
      brand: form.brand || undefined,
      sku: form.sku || undefined,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      videoUrl: form.videoUrl || undefined,
      published: form.published,
      featured: form.featured,
      displayOrder: parseInt(form.displayOrder) || 0,
      // Pricing
      price: parseFloat(form.price),
      compareAt: form.compareAt ? parseFloat(form.compareAt) : undefined,
      cost: form.cost ? parseFloat(form.cost) : undefined,
      stock: form.hasVariants ? form.variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0) : parseInt(form.stock),
      lowStockThreshold: parseInt(form.lowStockThreshold) || 10,
      trackInventory: form.trackInventory,
      // Tax
      taxable: form.taxable,
      taxRate: parseFloat(form.taxRate) || 0,
      taxIncluded: form.taxIncluded,
      hsnCode: form.hsnCode || undefined,
      // Shipping
      weight: form.weight ? parseFloat(form.weight) : undefined,
      shippingCharge: parseFloat(form.shippingCharge) || 0,
      delhiveryEnabled: form.delhiveryEnabled,
      shippingZones: flatToZones(form._shippingZonesFlat),
      dimensions: (form.dimensions?.length || form.dimensions?.width || form.dimensions?.height)
        ? { length: parseFloat(form.dimensions.length) || 0, width: parseFloat(form.dimensions.width) || 0, height: parseFloat(form.dimensions.height) || 0, unit: form.dimensions.unit || 'in' }
        : undefined,
      // Category
      category: finalCategory,
      categoryIds: finalCategoryIds,
      // Images
      images: Array.isArray(form.images) ? form.images : [],
      imageAlts: Array.isArray(form.imageAlts) ? form.imageAlts : [],
      // Vendor
      vendorId: form.vendorId || undefined,
      vendorCommissionPercentage:    form.vendorCommissionPercentage !== '' ? parseFloat(form.vendorCommissionPercentage) : undefined,
      affiliateCommissionPercentage: form.affiliateCommissionPercentage !== '' ? parseFloat(form.affiliateCommissionPercentage) : undefined,
      // Warranty
      hasWarranty: form.hasWarranty,
      warranty: form.hasWarranty && form.warranty.duration ? {
        duration:           parseInt(form.warranty.duration),
        durationType:       form.warranty.durationType,
        provider:           form.warranty.provider || undefined,
        description:        form.warranty.description || undefined,
        terms:              form.warranty.terms || undefined,
        activationRequired: form.warranty.activationRequired,
      } : undefined,
      // Content
      specifications: form.specifications.filter((s) => s.label?.trim()),
      faqs: form.faqs.filter((f) => f.question?.trim()),
      // SEO
      seo: {
        title: form.seo.title || undefined,
        description: form.seo.description || undefined,
        keywords: form.seo.keywords ? form.seo.keywords.split(',').map((k) => k.trim()).filter(Boolean) : [],
      },
      // Structured Data
      structuredData: {
        schemaType: form.structuredData.schemaType || 'Product',
        properties: sdProperties,
        customSnippets: (form.structuredData.customSnippets || []).filter((s) => s.name?.trim()),
      },
      // Variants
      hasVariants: form.hasVariants,
      variantOptions: form.hasVariants ? form.variantOptions : [],
      variants: form.hasVariants ? form.variants.map((v) => ({
        name: v.name || undefined,
        sku: v.sku || undefined,
        price: parseFloat(v.price) || parseFloat(form.price),
        compareAt: v.compareAt ? parseFloat(v.compareAt) : undefined,
        stock: parseInt(v.stock) || 0,
        attributes: v.attributes || {},
        images: v.images || [],
      })) : [],
    });
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setW = (k) => (e) => setForm((f) => ({ ...f, warranty: { ...f.warranty, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } }));
  const setSeo = (k) => (e) => setForm((f) => ({ ...f, seo: { ...f.seo, [k]: e.target.value } }));
  const setZone = (k) => (e) => setForm((f) => ({ ...f, _shippingZonesFlat: { ...f._shippingZonesFlat, [k]: e.target.value } }));
  const setDim = (k) => (e) => setForm((f) => ({ ...f, dimensions: { ...f.dimensions, [k]: e.target.value } }));
  const setSd = (k) => (e) => setForm((f) => ({ ...f, structuredData: { ...f.structuredData, [k]: e.target.value } }));
  const vendors = vendorsData?.users || [];

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Product Management</h1>
          {data?.pagination?.total != null && (
            <p className="text-sm text-secondary-500 mt-0.5">
              Total Products: <span className="font-bold text-orange-500">{data.pagination.total}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRev((r) => r + 1)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          <button
            onClick={() => csvRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 transition-colors disabled:opacity-50"
          >
            {importing ? <Spinner size="xs" /> : <Upload size={14} />} Import CSV
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            <Plus size={14} /> Add Product
          </button>
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input pl-9 text-sm w-full"
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-44 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Products</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        {(search || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-secondary-200 rounded-lg hover:bg-secondary-50 text-secondary-600 transition-colors"
          >
            <X size={13} /> Clear Filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50 border-b border-blue-100">
                  <th className="w-10 px-4 py-3" />
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Vendor</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Stock</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Created</th>
                  <th className="text-right px-4 py-3 font-semibold text-secondary-600 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {!data?.products?.length ? (
                  <tr><td colSpan={8} className="text-center py-16 text-secondary-400">No products found</td></tr>
                ) : data.products.map((p) => (
                  <tr key={p._id} className="hover:bg-secondary-50 transition-colors">
                    {/* Thumb */}
                    <td className="px-4 py-3">
                      {p.images?.[0] ? (
                        <img
                          src={normalizeImageUrl(p.images[0])}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover bg-secondary-100 border border-secondary-100"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-secondary-100 flex items-center justify-center text-secondary-300">
                          <Eye size={16} />
                        </div>
                      )}
                    </td>
                    {/* Product info */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-secondary-900 line-clamp-1 max-w-[240px]">{p.title}</p>
                      {p.brand && <p className="text-xs text-secondary-400 mt-0.5">{p.brand}</p>}
                      {p.sku && <p className="text-xs text-secondary-400 font-mono">SKU: {p.sku}</p>}
                    </td>
                    {/* Vendor */}
                    <td className="px-4 py-3 text-sm text-secondary-600">
                      {p.vendor?.name || p.vendorId?.businessName || '—'}
                    </td>
                    {/* Price */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-secondary-900">{formatCurrency(p.price)}</p>
                      {p.compareAt > p.price && (
                        <p className="text-xs text-secondary-400 line-through">{formatCurrency(p.compareAt)}</p>
                      )}
                    </td>
                    {/* Stock */}
                    <td className="px-4 py-3">
                      <p className={`font-semibold ${p.stock <= 5 ? 'text-red-500' : p.stock <= 20 ? 'text-amber-500' : 'text-green-600'}`}>
                        {p.stock}
                      </p>
                      <p className="text-xs text-secondary-400">units</p>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${p.published ? 'bg-green-100 text-green-700' : 'bg-secondary-100 text-secondary-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.published ? 'bg-green-500' : 'bg-secondary-400'}`} />
                        {p.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    {/* Created */}
                    <td className="px-4 py-3 text-xs text-secondary-500">
                      {new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewProduct(p)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-400 hover:bg-blue-50 transition-colors"
                          title="View details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-secondary-500 hover:bg-secondary-100 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { if (confirm('Delete this product?')) del(p._id); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data?.pagination && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-secondary-100 text-sm text-secondary-500">
              <span className="text-xs">{data.pagination.total} products · Page {page} of {data.pagination.pages || 1}</span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40">← Prev</button>
                {Array.from({ length: Math.min(data.pagination.pages || 1, 7) }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-xs font-medium ${p === page ? 'bg-orange-500 text-white' : 'hover:bg-secondary-100'}`}>{p}</button>
                ))}
                <button disabled={page === (data.pagination.pages || 1)} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary-100 disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Product Details View Modal ────────────────────── */}
      {viewProduct && (() => {
        const vp = viewProduct;
        const vendorName = vp.vendorId?.name || vp.vendor?.name || '';
        const vendorEmail = vp.vendorId?.email || vp.vendor?.email || '';
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setViewProduct(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

              {/* Sticky Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100 shrink-0">
                <h3 className="font-bold text-lg text-secondary-900">Product Details</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setViewProduct(null); openEdit(vp); }}
                    className="px-3 py-1.5 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  {vp.slug && (
                    <a
                      href={`/product/${vp.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 text-sm font-semibold border border-secondary-200 hover:bg-secondary-50 text-secondary-700 rounded-lg transition-colors"
                    >
                      View in Store ↗
                    </a>
                  )}
                  <button onClick={() => setViewProduct(null)} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-500">
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 p-6 space-y-5">

                {/* Images strip */}
                {vp.images?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {vp.images.map((img, i) => (
                      <img
                        key={i}
                        src={normalizeImageUrl(img)}
                        alt={vp.imageAlts?.[i] || vp.title}
                        className="w-20 h-20 rounded-xl object-cover border border-secondary-200"
                      />
                    ))}
                  </div>
                )}

                {/* Title + Brand */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-secondary-700">Title</label>
                    <div className="input bg-secondary-50 text-secondary-900 text-sm">{vp.title || '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-secondary-700">Brand</label>
                    <div className="input bg-secondary-50 text-secondary-900 text-sm">{vp.brand || '—'}</div>
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-secondary-700">Tags <span className="font-normal text-secondary-400 text-xs">(comma-separated)</span></label>
                  {vp.tags?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-secondary-50 rounded-lg border border-secondary-200 min-h-[38px]">
                      {vp.tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 bg-white border border-secondary-200 text-secondary-700 text-xs px-2.5 py-1 rounded-full shadow-sm">{t}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="input bg-secondary-50 text-secondary-400 text-sm">—</div>
                  )}
                  <p className="text-[11px] text-secondary-400">Add tags to help customers find this product. Separate multiple tags with commas.</p>
                </div>

                {/* Categories */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-secondary-700">Categories</label>
                  {vp.categoryIds?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-secondary-50 rounded-lg border border-secondary-200 min-h-[38px]">
                      {vp.categoryIds.map((id) => {
                        const cid = id?._id || id;
                        return (
                          <span key={cid?.toString()} className="inline-flex items-center gap-1 bg-primary-50 border border-primary-200 text-primary-700 text-xs px-2.5 py-1 rounded-full">
                            {getCatPath(cid?.toString())}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="input bg-secondary-50 text-secondary-400 text-sm">{vp.category || '—'}</div>
                  )}
                </div>

                {/* Vendor */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-secondary-700">Assign to Vendor</label>
                  <div className="input bg-secondary-50 text-secondary-900 text-sm">
                    {vendorName ? `${vendorName}${vendorEmail ? ` (${vendorEmail})` : ''}` : 'No vendor assigned (admin product)'}
                  </div>
                </div>

                {/* Price + Compare Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-secondary-700">Price</label>
                    <div className="input bg-secondary-50 text-secondary-900 text-sm font-semibold">{vp.price != null ? formatCurrency(vp.price) : '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-secondary-700">Compare Price</label>
                    <div className="input bg-secondary-50 text-sm">
                      {vp.compareAt ? <span className="line-through text-secondary-400">{formatCurrency(vp.compareAt)}</span> : <span className="text-secondary-400">—</span>}
                    </div>
                  </div>
                </div>

                {/* Stock + SKU */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-secondary-700">Stock</label>
                    <div className={`input bg-secondary-50 text-sm font-semibold ${(vp.stock ?? 0) <= 5 ? 'text-red-500' : (vp.stock ?? 0) <= 20 ? 'text-amber-500' : 'text-green-600'}`}>
                      {vp.stock ?? 0} units
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-secondary-700">SKU</label>
                    <div className="input bg-secondary-50 text-secondary-900 text-sm font-mono">{vp.sku || '—'}</div>
                  </div>
                </div>

                {/* Display Order + Slug */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-secondary-700">Display Order <span className="font-normal text-secondary-400 text-xs">(higher = appears first)</span></label>
                    <div className="input bg-secondary-50 text-secondary-900 text-sm">{vp.displayOrder ?? 0}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-secondary-700">Slug <span className="font-normal text-secondary-400 text-xs">(URL)</span></label>
                    <div className="input bg-secondary-50 text-secondary-500 text-sm font-mono">{vp.slug || '—'}</div>
                  </div>
                </div>

                {/* Commissions */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-secondary-700">Vendor Commission % <span className="font-normal text-secondary-400 text-xs">(leave empty for default)</span></label>
                    <div className="input bg-secondary-50 text-secondary-900 text-sm">{vp.vendorCommissionPercentage != null ? `${vp.vendorCommissionPercentage}%` : '—'}</div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-secondary-700">Affiliate Commission % <span className="font-normal text-secondary-400 text-xs">(leave empty for default)</span></label>
                    <div className="input bg-secondary-50 text-secondary-900 text-sm">{vp.affiliateCommissionPercentage != null ? `${vp.affiliateCommissionPercentage}%` : '—'}</div>
                  </div>
                </div>

                {/* GST / Tax */}
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">GST / Tax Information</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-secondary-700">GST / Tax Rate (%)</label>
                      <div className="input bg-white text-secondary-900 text-sm">{vp.taxRate ?? 0}%</div>
                      <p className="text-[11px] text-secondary-400">Common GST rates: 0%, 5%, 12%, 18%, 28%</p>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-secondary-700">HSN / SAC Code</label>
                      <div className="input bg-white text-secondary-900 text-sm font-mono">{vp.hsnCode || '—'}</div>
                      <p className="text-[11px] text-secondary-400">Required for GST invoicing (8-digit HSN @ &gt; ₹5 Cr turnover)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 flex-wrap">
                    <label className="flex items-center gap-2 cursor-default select-none">
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-white text-xs ${vp.taxable !== false ? 'bg-primary-600 border-primary-600' : 'border-secondary-300'}`}>
                        {vp.taxable !== false && '✓'}
                      </span>
                      <span className="text-sm text-secondary-700">Product is taxable</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-default select-none">
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-white text-xs ${vp.taxIncluded ? 'bg-primary-600 border-primary-600' : 'border-secondary-300'}`}>
                        {vp.taxIncluded && '✓'}
                      </span>
                      <span className="text-sm text-secondary-700">Tax included in price</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-secondary-500">
                    {vp.taxIncluded ? 'Tax is already included in the listed price.' : 'Tax will be added at checkout.'}
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-secondary-700">Description</label>
                  <div className="min-h-[80px] p-3 bg-secondary-50 border border-secondary-200 rounded-lg text-sm text-secondary-800 whitespace-pre-line leading-relaxed">
                    {vp.description || '—'}
                  </div>
                </div>

                {/* Specifications */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-secondary-700">Product Specifications <span className="font-normal text-secondary-400 text-xs">(Optional)</span></label>
                  <p className="text-[11px] text-secondary-400">Add technical details like weight, dimensions, material, color, power etc.</p>
                  {vp.specifications?.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {vp.specifications.map((s, i) => (
                        <div key={i} className="border border-orange-200 rounded-lg p-3 bg-white space-y-2">
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-wide">Label</p>
                            <div className="input bg-secondary-50 text-secondary-900 text-sm py-1.5">{s.label || '—'}</div>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-secondary-400 uppercase tracking-wide">Value</p>
                            <div className="input bg-secondary-50 text-secondary-900 text-sm py-1.5">{s.value || '—'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-secondary-400 bg-secondary-50 rounded-lg px-3 py-3 border border-dashed border-secondary-200">No specifications added</div>
                  )}
                </div>

                {/* Warranty */}
                {vp.hasWarranty && (
                  <div className="space-y-3 border border-secondary-200 rounded-xl p-4 bg-secondary-50">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={15} className="text-green-600" />
                      <p className="text-sm font-semibold text-secondary-700">Warranty</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-secondary-500">Duration</label>
                        <div className="input bg-white text-sm">{vp.warranty?.duration || '—'} {vp.warranty?.durationType || ''}</div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-secondary-500">Provider</label>
                        <div className="input bg-white text-sm">{vp.warranty?.provider || '—'}</div>
                      </div>
                    </div>
                    {vp.warranty?.description && (
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-secondary-500">Description</label>
                        <div className="p-2 bg-white border border-secondary-200 rounded-lg text-sm">{vp.warranty.description}</div>
                      </div>
                    )}
                    {vp.warranty?.terms && (
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-secondary-500">Terms</label>
                        <div className="p-2 bg-white border border-secondary-200 rounded-lg text-sm">{vp.warranty.terms}</div>
                      </div>
                    )}
                    {vp.warranty?.activationRequired && (
                      <p className="text-xs text-amber-600 font-medium">⚠ Activation required</p>
                    )}
                  </div>
                )}

                {/* FAQs */}
                {vp.faqs?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <HelpCircle size={15} className="text-secondary-500" />
                      <label className="block text-sm font-medium text-secondary-700">FAQs</label>
                    </div>
                    <div className="space-y-2">
                      {vp.faqs.map((f, i) => (
                        <div key={i} className="border border-secondary-200 rounded-lg p-3 bg-secondary-50 space-y-1.5">
                          <p className="text-xs font-bold text-secondary-500 uppercase tracking-wide">Q{i + 1}</p>
                          <p className="text-sm font-medium text-secondary-800">{f.question}</p>
                          <p className="text-sm text-secondary-600">{f.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-6 pt-2 border-t border-secondary-100">
                  <label className="flex items-center gap-2 cursor-default select-none">
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-white text-xs ${vp.published ? 'bg-primary-600 border-primary-600' : 'border-secondary-300'}`}>
                      {vp.published && '✓'}
                    </span>
                    <span className="text-sm font-medium text-secondary-700">Published</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-default select-none">
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-white text-xs ${vp.featured ? 'bg-primary-600 border-primary-600' : 'border-secondary-300'}`}>
                      {vp.featured && '✓'}
                    </span>
                    <span className="text-sm font-medium text-secondary-700">Featured</span>
                  </label>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'New Product'} size="lg">
        <form onSubmit={handleSave} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Title *" value={form.title} onChange={set('title')} required />
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
            {/* Assign to Vendor */}
            <div className="col-span-2 space-y-1">
              <label className="block text-sm font-medium text-secondary-700">Assign to Vendor</label>
              <select className="input w-full" value={form.vendorId} onChange={set('vendorId')}>
                <option value="">— No Vendor (Admin Product)</option>
                {vendors.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.vendorProfile?.businessName || v.name} ({v.email})
                  </option>
                ))}
              </select>
            </div>

            <Input label="Price (₹) *" type="number" step="0.01" value={form.price} onChange={set('price')} required />
            <Input label="Compare Price (₹)" type="number" step="0.01" value={form.compareAt} onChange={set('compareAt')} />
            <Input label="Stock *" type="number" value={form.stock} onChange={set('stock')} required />
            <Input label="SKU (auto if blank)" value={form.sku} onChange={set('sku')} placeholder="e.g. VCMPROMAX-HD" />
            <Input label="Display Order (higher = appears first)" type="number" value={form.displayOrder} onChange={set('displayOrder')} />
            <Input label="Slug (auto if blank)" value={form.slug} onChange={set('slug')} />
          </div>


          {/* Commissions */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Vendor Commission % (blank = default)" type="number" step="0.01" value={form.vendorCommissionPercentage} onChange={set('vendorCommissionPercentage')} placeholder="e.g. 10" />
            <Input label="Affiliate Commission % (blank = default)" type="number" step="0.01" value={form.affiliateCommissionPercentage} onChange={set('affiliateCommissionPercentage')} placeholder="e.g. 5" />
          </div>

          {/* Tax / GST */}
          <div className="border border-secondary-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-secondary-50 border-b border-secondary-200">
              <p className="text-sm font-semibold text-secondary-700">Tax / GST</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-secondary-600">Tax Rate (%)</label>
                <select className="input text-sm" value={form.taxRate} onChange={set('taxRate')}>
                  {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <Input label="HSN / SAC Code" value={form.hsnCode} onChange={set('hsnCode')} placeholder="e.g. 84360000" />
              <Input label="Cost Price (₹) — internal only" type="number" step="0.01" value={form.cost} onChange={set('cost')} placeholder="e.g. 800" />
              <div className="flex flex-col gap-2 justify-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.taxable} onChange={set('taxable')} className="accent-primary-600" /> Taxable
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.taxIncluded} onChange={set('taxIncluded')} className="accent-primary-600" /> Tax included in price
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-secondary-700">Description *</label>
            <textarea className="input h-28 resize-none" value={form.description} onChange={set('description')} required />
          </div>

          {/* Specifications */}
          <div className="border border-secondary-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-secondary-50 border-b border-secondary-200">
              <p className="text-sm font-semibold text-secondary-700">Product Specifications (Optional)</p>
              <button type="button" onClick={addSpec} className="flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={12} /> Add Spec
              </button>
            </div>
            <div className="p-4 space-y-2">
              {form.specifications.length === 0 ? (
                <p className="text-xs text-secondary-400 text-center py-2">No specifications. Click "+ Add Spec" to add product details.</p>
              ) : (
                form.specifications.map((s, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 items-start">
                    <div className="space-y-0.5">
                      <label className="text-[10px] text-secondary-500 font-medium uppercase">Label</label>
                      <input className="input text-sm" placeholder="e.g. Motor Type" value={s.label} onChange={(e) => setSpec(i, 'label', e.target.value)} />
                    </div>
                    <div className="space-y-0.5 relative">
                      <label className="text-[10px] text-secondary-500 font-medium uppercase">Value</label>
                      <div className="flex gap-1">
                        <input className="input text-sm flex-1" placeholder="e.g. Single Phase" value={s.value} onChange={(e) => setSpec(i, 'value', e.target.value)} />
                        <button type="button" onClick={() => removeSpec(i)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Product Images + Video */}
          <div className="border border-secondary-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-secondary-50 border-b border-secondary-200">
              <p className="text-sm font-semibold text-secondary-700">Product Images & Video</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-secondary-600">YouTube / Video URL (optional)</label>
                <input
                  className="input text-sm"
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  value={form.videoUrl}
                  onChange={set('videoUrl')}
                />
                <p className="text-[11px] text-secondary-400">Add a YouTube URL to showcase your product (will be displayed on product page)</p>
              </div>
              <ImageUpload
                urls={Array.isArray(form.images) ? form.images : []}
                onChange={(imgs) => setForm((f) => ({ ...f, images: imgs }))}
              />
            </div>
          </div>

          <Input label="Tags (comma separated)" value={form.tags} onChange={set('tags')} placeholder="drill, bosch, power-tool" />

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
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-secondary-600">Warranty Duration</label>
                    <input type="number" min="1" className="input text-sm" placeholder="e.g. 1" value={form.warranty.duration} onChange={setW('duration')} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-secondary-600">Duration Type</label>
                    <select className="input text-sm" value={form.warranty.durationType} onChange={setW('durationType')}>
                      <option value="years">Years</option>
                      <option value="months">Months</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-secondary-600">Warranty Provider</label>
                  <input className="input text-sm" placeholder="e.g. Manufacturer" value={form.warranty.description} onChange={setW('description')} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="reqInvoice" checked={form.warranty.requiresInvoice || false} onChange={setW('requiresInvoice')} className="accent-primary-600" />
                  <label htmlFor="reqInvoice" className="text-sm text-secondary-700 cursor-pointer">Requires Invoice</label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-secondary-600">Warranty Description</label>
                  <textarea className="input text-sm resize-none h-20" placeholder="e.g. This product comes with a 1-year complete warranty covering motor coil failures, electrical component failures..." value={form.warranty.terms || ''} onChange={setW('terms')} />
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

          {/* Structured Data (Schema.org) */}
          <div className="border border-secondary-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-secondary-50 border-b border-secondary-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-secondary-700">Schema & Snippets <span className="text-secondary-400 font-normal">(Optional)</span></p>
                <p className="text-[11px] text-secondary-400 mt-0.5">Add structured data to boost rich results visibility</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-secondary-600">Schema Type</label>
                <select className="input text-sm" value={form.structuredData?.schemaType || 'Product'} onChange={setSd('schemaType')}>
                  {['Product','Book','Movie','MusicAlbum','Recipe','SoftwareApplication','VideoGame','Event','Course'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-secondary-600">Properties (JSON) — brand, model, color, gtin, mpn…</label>
                <textarea
                  className="input text-xs font-mono resize-none h-20"
                  placeholder={'{\n  "brand": "Macgly",\n  "model": "MG-500"\n}'}
                  value={form.structuredData?.properties || '{}'}
                  onChange={setSd('properties')}
                />
              </div>
            </div>
          </div>

          {/* Published + Featured */}
          <div className="flex items-center gap-6 px-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
              <input type="checkbox" checked={form.published} onChange={set('published')} className="accent-orange-500 w-4 h-4" />
              Published
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
              <input type="checkbox" checked={form.featured} onChange={set('featured')} className="accent-orange-500 w-4 h-4" />
              Featured
            </label>
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
