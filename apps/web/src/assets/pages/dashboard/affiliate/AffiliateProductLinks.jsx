import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy, Check, Search, Package, Shield, RefreshCw, Filter, X,
  LayoutList, LayoutGrid, Percent, DollarSign, ShoppingBag, Download,
  Lightbulb, ArrowLeft, ChevronDown,
} from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch, invalidateCache } from '../../../../hooks';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVendorName(vendorId) {
  if (!vendorId || typeof vendorId !== 'object') return '';
  return vendorId.vendorProfile?.storeName || vendorId.name || '';
}

function getCategoryName(p) {
  if (Array.isArray(p.categoryIds) && p.categoryIds.length && typeof p.categoryIds[0] === 'object') {
    return p.categoryIds[0]?.name || p.category || '';
  }
  return p.category || '';
}

function getVendorId(vendorId) {
  if (!vendorId) return '';
  if (typeof vendorId === 'object') return vendorId._id?.toString() || '';
  return vendorId.toString();
}

function getCategoryId(p) {
  if (Array.isArray(p.categoryIds) && p.categoryIds.length) {
    const c = p.categoryIds[0];
    return typeof c === 'object' ? c._id?.toString() : c?.toString();
  }
  return p.category || '';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsCard({ icon: Icon, label, value, sub, iconBg, iconColor, valColor }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
        <div>
          <p className="text-xs text-secondary-400">{label}</p>
          <p className={`font-bold text-lg leading-tight ${valColor}`}>{value}</p>
          {sub && <p className="text-xs text-secondary-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function ProductImg({ src, title }) {
  return (
    <div className="w-10 h-10 rounded-lg bg-secondary-50 border border-secondary-100 flex items-center justify-center shrink-0 overflow-hidden">
      {src
        ? <img src={normalizeImageUrl(src)} alt={title} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
        : <Package size={16} className="text-secondary-300" />
      }
    </div>
  );
}

function FilterBadge({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-100 text-primary-700 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-primary-900"><X size={11} /></button>
    </span>
  );
}

// ─── KYC gate ─────────────────────────────────────────────────────────────────

function KYCGate({ kycStatus }) {
  return (
    <div className="card p-14 flex flex-col items-center text-center gap-4">
      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
        <Shield size={28} className="text-amber-400" />
      </div>
      <div>
        <p className="text-lg font-bold">KYC Verification Required</p>
        <p className="text-sm text-secondary-500 mt-1 max-w-sm">
          Complete KYC verification to access affiliate product links.
          {kycStatus === 'pending' && ' Your KYC is currently under review.'}
        </p>
      </div>
      <Link to="/dashboard/affiliate/kyc" className="btn-primary px-6">
        {kycStatus === 'pending' ? 'View KYC Status →' : 'Complete KYC →'}
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AffiliateProductLinks() {
  const [rev, setRev] = useState(0);

  // Filters
  const [searchQuery,    setSearchQuery]    = useState('');
  const [vendorFilter,   setVendorFilter]   = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priceRange,     setPriceRange]     = useState({ min: '', max: '' });
  const [sortBy,         setSortBy]         = useState('default');
  const [showFilters,    setShowFilters]    = useState(false);

  // UI state
  const [copiedId,  setCopiedId]  = useState(null);
  const [showLinks, setShowLinks] = useState(true);
  const [viewMode,  setViewMode]  = useState('table'); // 'table'|'grid'

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: affiliateData, isLoading: affLoading, error: affError } = useFetch(
    ['affiliate-links', rev],
    () => api.get('/affiliates/links').then((r) => r.data)
  );

  const { data: productsData, isLoading: prodLoading } = useFetch(
    ['all-products-for-affiliate'],
    () => api.get('/catalog/products', { params: { limit: 1000, status: 'active' } }).then((r) => r.data)
  );

  // product stats — fetched but reserved for future UI use
  useFetch(
    ['affiliate-product-stats', rev],
    () => api.get('/affiliates/products/stats').then((r) => r.data),
    { enabled: affError?.response?.status !== 403 }
  );

  // ── Error handling ────────────────────────────────────────────────────────

  const affStatus = affError?.response?.status;

  if (affLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  if (affStatus === 403) {
    const kycStatus = affError?.response?.data?.error?.kycStatus || 'not_submitted';
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">All Product Links</h1>
        <KYCGate kycStatus={kycStatus} />
      </div>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const code             = affiliateData?.code || '';
  const defaultCommission = affiliateData?.commissionPercentage ?? 5;
  const allProducts      = productsData?.products || [];
  const origin           = window.location.origin;

  function affiliateLink(slug) {
    return `${origin}/product/${slug}?affId=${code}`;
  }

  function getCommission(p) {
    return p.affiliateCommissionPercentage ?? defaultCommission;
  }

  function getEarning(p) {
    return (p.price * getCommission(p)) / 100;
  }

  // ── Dynamic filter options ────────────────────────────────────────────────

  const vendorOptions = useMemo(() => {
    const seen = new Map();
    allProducts.forEach((p) => {
      const vid  = getVendorId(p.vendorId);
      const name = getVendorName(p.vendorId);
      if (vid && name && !seen.has(vid)) seen.set(vid, name);
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [allProducts]);

  const categoryOptions = useMemo(() => {
    const seen = new Map();
    allProducts.forEach((p) => {
      const cid  = getCategoryId(p);
      const name = getCategoryName(p);
      if (cid && name && !seen.has(cid)) seen.set(cid, name);
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [allProducts]);

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let list = [...allProducts];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        p.title?.toLowerCase().includes(q) ||
        p.slug?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        getVendorName(p.vendorId)?.toLowerCase().includes(q)
      );
    }

    if (vendorFilter)   list = list.filter((p) => getVendorId(p.vendorId) === vendorFilter);
    if (categoryFilter) list = list.filter((p) => getCategoryId(p) === categoryFilter);
    if (priceRange.min) list = list.filter((p) => p.price >= parseFloat(priceRange.min));
    if (priceRange.max) list = list.filter((p) => p.price <= parseFloat(priceRange.max));

    switch (sortBy) {
      case 'name':            list.sort((a, b) => a.title?.localeCompare(b.title)); break;
      case 'price-low':       list.sort((a, b) => a.price - b.price); break;
      case 'price-high':      list.sort((a, b) => b.price - a.price); break;
      case 'commission-high': list.sort((a, b) => getCommission(b) - getCommission(a)); break;
      case 'earning-high':    list.sort((a, b) => getEarning(b) - getEarning(a)); break;
      default: break;
    }

    return list;
  }, [allProducts, searchQuery, vendorFilter, categoryFilter, priceRange, sortBy]);

  // ── Client-side stats ─────────────────────────────────────────────────────

  const pageStats = useMemo(() => {
    if (!filteredProducts.length) return { totalProducts: 0, avgCommission: 0, totalPotentialEarning: 0, vendors: 0 };
    const commissions = filteredProducts.map((p) => getCommission(p));
    const avgCommission = commissions.reduce((s, c) => s + c, 0) / commissions.length;
    const totalPotentialEarning = filteredProducts.reduce((s, p) => s + getEarning(p), 0);
    const vendors = new Set(filteredProducts.map((p) => getVendorId(p.vendorId)).filter(Boolean)).size;
    return {
      totalProducts: filteredProducts.length,
      avgCommission: parseFloat(avgCommission.toFixed(1)),
      totalPotentialEarning: parseFloat(totalPotentialEarning.toFixed(2)),
      vendors,
    };
  }, [filteredProducts]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function refresh() {
    invalidateCache('affiliate-links');
    invalidateCache('all-products-for-affiliate');
    invalidateCache('affiliate-product-stats');
    setRev((r) => r + 1);
  }

  function copy(id, text) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    toast.success('Copied!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleCopyAll() {
    const text = filteredProducts
      .map((p) => `${p.title}: ${affiliateLink(p.slug)}`)
      .join('\n\n');
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success(`Copied ${filteredProducts.length} affiliate links!`);
  }

  function handleExportCSV() {
    const headers = ['Product Name', 'Vendor', 'Category', 'SKU', 'Price', 'Commission %', 'Your Earning', 'Slug', 'Affiliate Link'];
    const rows = filteredProducts.map((p) => {
      const comm    = getCommission(p);
      const earning = getEarning(p).toFixed(2);
      const link    = affiliateLink(p.slug);
      const vendor  = getVendorName(p.vendorId);
      const cat     = getCategoryName(p);
      return [
        `"${(p.title || '').replace(/"/g, '""')}"`,
        `"${vendor}"`,
        `"${cat}"`,
        p.sku || '',
        (p.price || 0).toFixed(2),
        `${comm}%`,
        earning,
        p.slug || '',
        link,
      ].join(',');
    });
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `affiliate-links-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredProducts.length} rows`);
  }

  function clearFilters() {
    setSearchQuery('');
    setVendorFilter('');
    setCategoryFilter('');
    setPriceRange({ min: '', max: '' });
    setSortBy('default');
  }

  const activeFilters = [
    vendorFilter   && { label: `Vendor: ${vendorOptions.find((v) => v.id === vendorFilter)?.name || vendorFilter}`, clear: () => setVendorFilter('') },
    categoryFilter && { label: `Category: ${categoryOptions.find((c) => c.id === categoryFilter)?.name || categoryFilter}`, clear: () => setCategoryFilter('') },
    priceRange.min && { label: `Min ₹${priceRange.min}`, clear: () => setPriceRange((p) => ({ ...p, min: '' })) },
    priceRange.max && { label: `Max ₹${priceRange.max}`, clear: () => setPriceRange((p) => ({ ...p, max: '' })) },
    sortBy !== 'default' && { label: `Sort: ${sortBy}`, clear: () => setSortBy('default') },
  ].filter(Boolean);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">All Product Links</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Generate affiliate links for {allProducts.length} products</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/dashboard/affiliate/links" className="btn-secondary flex items-center gap-1.5 text-sm">
            <ArrowLeft size={14} /> Back to Links
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard icon={Package}     label="Products Available" value={pageStats.totalProducts}                   iconBg="bg-blue-100"   iconColor="text-blue-600"   valColor="text-secondary-900" />
        <StatsCard icon={Percent}     label="Avg Commission"     value={`${pageStats.avgCommission}%`}             iconBg="bg-green-100"  iconColor="text-green-600"  valColor="text-green-600" />
        <StatsCard icon={DollarSign}  label="Max Potential"      value={formatCurrency(pageStats.totalPotentialEarning)} sub="per sale" iconBg="bg-purple-100" iconColor="text-purple-600" valColor="text-purple-600" />
        <StatsCard icon={ShoppingBag} label="Vendors"            value={pageStats.vendors}                          iconBg="bg-orange-100" iconColor="text-orange-500" valColor="text-secondary-900" />
      </div>

      {/* Affiliate code card */}
      <div className="rounded-xl bg-gradient-to-r from-primary-600 to-indigo-700 text-white p-4 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-primary-200 mb-1">Your Affiliate Code</p>
          <p className="text-2xl font-bold tracking-widest font-mono">{code || '—'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {code && (
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Copy size={14} /> Copy All ({filteredProducts.length})
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white text-primary-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
            <input
              className="input w-full pl-9"
              placeholder="Search products by name, vendor, slug, or SKU…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400">
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`btn-secondary flex items-center gap-1.5 text-sm shrink-0 ${activeFilters.length ? 'border-primary-400 text-primary-600' : ''}`}
          >
            <Filter size={14} /> Filters
            {activeFilters.length > 0 && (
              <span className="w-4 h-4 bg-primary-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                {activeFilters.length}
              </span>
            )}
          </button>
          {/* View toggle — desktop only */}
          <div className="hidden lg:flex items-center border border-secondary-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('table')} className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-primary-100 text-primary-600' : 'hover:bg-secondary-50'}`}>
              <LayoutList size={15} />
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'hover:bg-secondary-50'}`}>
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="card p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-secondary-500">Vendor</label>
                <select className="input w-full text-sm" value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
                  <option value="">All Vendors</option>
                  {vendorOptions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-secondary-500">Category</label>
                <select className="input w-full text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All Categories</option>
                  {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-secondary-500">Price Range (₹)</label>
                <div className="flex gap-1">
                  <input className="input w-full text-sm" type="number" placeholder="Min" value={priceRange.min} onChange={(e) => setPriceRange((p) => ({ ...p, min: e.target.value }))} />
                  <input className="input w-full text-sm" type="number" placeholder="Max" value={priceRange.max} onChange={(e) => setPriceRange((p) => ({ ...p, max: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-secondary-500">Sort By</label>
                <select className="input w-full text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="default">Default</option>
                  <option value="name">Name A–Z</option>
                  <option value="price-low">Price: Low–High</option>
                  <option value="price-high">Price: High–Low</option>
                  <option value="commission-high">Commission: High–Low</option>
                  <option value="earning-high">Earning: High–Low</option>
                </select>
              </div>
            </div>
            {activeFilters.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {activeFilters.map((f, i) => <FilterBadge key={i} label={f.label} onRemove={f.clear} />)}
                <button onClick={clearFilters} className="text-xs text-secondary-400 hover:text-red-500 underline">Clear All</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results count + hide links toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary-500">
          Showing <strong>{filteredProducts.length}</strong> of <strong>{allProducts.length}</strong> products
        </p>
        <button
          onClick={() => setShowLinks((v) => !v)}
          className="text-xs text-secondary-400 hover:text-secondary-600 flex items-center gap-1"
        >
          {showLinks ? 'Hide Links' : 'Show Links'}
        </button>
      </div>

      {/* Product list */}
      {prodLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filteredProducts.length === 0 ? (
        <div className="card p-12 text-center text-secondary-400">
          <Package size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products found</p>
          {activeFilters.length > 0 && (
            <button onClick={clearFilters} className="text-sm text-primary-600 hover:underline mt-2">Clear filters</button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredProducts.map((p) => {
              const link     = affiliateLink(p.slug);
              const comm     = getCommission(p);
              const earning  = getEarning(p);
              const vendor   = getVendorName(p.vendorId);
              const isCopied = copiedId === p._id;
              return (
                <div key={p._id} className="card p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <ProductImg src={p.images?.[0]} title={p.title} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold line-clamp-2">{p.title}</p>
                      {vendor && <p className="text-xs text-primary-600">{vendor}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">{formatCurrency(p.price)}</span>
                    <span className="text-green-600 font-semibold">{comm}% = {formatCurrency(earning)}</span>
                  </div>
                  {showLinks && (
                    <div className="text-xs text-secondary-400 font-mono truncate bg-secondary-50 rounded px-2 py-1">{link}</div>
                  )}
                  <button
                    onClick={() => copy(p._id, link)}
                    className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg border transition-colors ${
                      isCopied ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-secondary-200 hover:border-primary-300'
                    }`}
                  >
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                    {isCopied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          {viewMode === 'table' && (
            <div className="hidden lg:block card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary-50 border-b border-secondary-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Vendor</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Commission</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Your Earning</th>
                    {showLinks && <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Affiliate Link</th>}
                    <th className="text-center px-4 py-3 text-xs font-semibold text-secondary-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100">
                  {filteredProducts.map((p) => {
                    const link    = affiliateLink(p.slug);
                    const comm    = getCommission(p);
                    const earning = getEarning(p);
                    const vendor  = getVendorName(p.vendorId);
                    return (
                      <tr key={p._id} className="hover:bg-secondary-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ProductImg src={p.images?.[0]} title={p.title} />
                            <div>
                              <p className="font-medium line-clamp-1 max-w-xs">{p.title}</p>
                              <p className="text-xs text-secondary-400 font-mono">{p.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-primary-600 text-sm">{vendor || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.price)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-green-600 font-semibold">{comm}%</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-purple-600 font-semibold">{formatCurrency(earning)}</span>
                        </td>
                        {showLinks && (
                          <td className="px-4 py-3 max-w-xs">
                            <p className="text-xs text-secondary-400 font-mono truncate">{link}</p>
                          </td>
                        )}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => copy(p._id, link)}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors mx-auto ${
                              copiedId === p._id
                                ? 'bg-green-50 border-green-300 text-green-700'
                                : 'bg-white border-secondary-200 hover:border-primary-300'
                            }`}
                          >
                            {copiedId === p._id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedId === p._id ? 'Copied' : 'Copy'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Desktop grid */}
          {viewMode === 'grid' && (
            <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map((p) => {
                const link    = affiliateLink(p.slug);
                const comm    = getCommission(p);
                const earning = getEarning(p);
                const vendor  = getVendorName(p.vendorId);
                return (
                  <div key={p._id} className="card p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <ProductImg src={p.images?.[0]} title={p.title} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-2">{p.title}</p>
                        {vendor && <p className="text-xs text-primary-600 mt-0.5">{vendor}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold">{formatCurrency(p.price)}</span>
                      <span className="text-green-600 font-semibold text-xs">{comm}% = {formatCurrency(earning)}</span>
                    </div>
                    {showLinks && (
                      <div className="text-xs text-secondary-400 font-mono truncate bg-secondary-50 rounded px-2 py-1.5">{link}</div>
                    )}
                    <button
                      onClick={() => copy(p._id, link)}
                      className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg border transition-colors ${
                        copiedId === p._id ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-secondary-200 hover:border-primary-300'
                      }`}
                    >
                      {copiedId === p._id ? <Check size={12} /> : <Copy size={12} />}
                      {copiedId === p._id ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Pro tips */}
      <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-700">
          <Lightbulb size={15} />
          <p className="text-sm font-semibold">Pro Tips</p>
        </div>
        <ul className="space-y-1.5 text-xs text-amber-700">
          <li className="flex gap-2"><span className="font-bold shrink-0">→</span> Sort by "Earning: High–Low" to promote the most profitable products first</li>
          <li className="flex gap-2"><span className="font-bold shrink-0">→</span> Higher priced products mean bigger commissions — even at the same commission %</li>
          <li className="flex gap-2"><span className="font-bold shrink-0">→</span> Export CSV and upload to your website or email marketing tool for bulk promotion</li>
          <li className="flex gap-2"><span className="font-bold shrink-0">→</span> 30-day cookie window — buyers clicking your link are tracked for a full month</li>
        </ul>
      </div>

    </div>
  );
}
