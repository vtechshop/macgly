import { useState, useEffect, useCallback } from 'react';
import { Search, Copy, ExternalLink, Link, Plus, Trash2, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../../../utils/api';
import { useFetch } from '../../../../hooks';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

const WHATSAPP_GREEN = '#25D366';

function fmtPrice(p) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isExpired(expiresAt) {
  return new Date(expiresAt) < new Date();
}

function ProductCard({ product }) {
  const productUrl = `${window.location.origin}/product/${product.slug}`;
  const image = product.images?.[0] || product.image;

  function copyLink() {
    navigator.clipboard.writeText(productUrl);
    toast.success('Link copied!');
  }

  function shareWhatsApp() {
    const msg = `*${product.title}*\n${fmtPrice(product.price)}\n\n${productUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function openProduct() {
    window.open(productUrl, '_blank');
  }

  return (
    <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden hover:shadow-md transition-shadow group">
      {/* Image */}
      <div className="relative aspect-square bg-secondary-50 overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={product.title}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-secondary-300">
            <Share2 size={40} />
          </div>
        )}
        <button
          onClick={openProduct}
          className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-sm"
          title="Open product"
        >
          <ExternalLink size={14} className="text-secondary-600" />
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-sm font-semibold text-secondary-800 line-clamp-2 min-h-[2.75rem] leading-snug">{product.title}</p>
        <p className="text-lg font-bold text-orange-600 mt-2">{fmtPrice(product.price)}</p>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={copyLink}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-secondary-200 text-sm font-medium text-secondary-700 hover:bg-secondary-50 transition-colors"
          >
            <Copy size={14} />
            Copy Link
          </button>
          <button
            onClick={shareWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: WHATSAPP_GREEN }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminShareCatalog() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showLinkManager, setShowLinkManager] = useState(false);

  // Share link manager state
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [linksRev, setLinksRev] = useState(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProducts = useCallback(
    () => api.get('/catalog/products', { params: { search: debouncedSearch || undefined, page, limit: 24 } }).then((r) => r.data),
    [debouncedSearch, page]
  );

  const { data: productsData, isLoading: loadingProducts } = useFetch(
    ['share-catalog-products', debouncedSearch, page],
    fetchProducts
  );

  const { data: linksData, isLoading: loadingLinks } = useFetch(
    ['admin-share-catalog-links', linksRev],
    () => api.get('/admin/share-catalog').then((r) => r.data)
  );

  const products = productsData?.products || [];
  const totalPages = productsData?.totalPages || 1;
  const shares = linksData?.shares || [];

  function getPublicUrl(token) {
    return `${window.location.origin}/catalog/${token}`;
  }

  async function createLink(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/share-catalog', { label: label || 'Product Catalog', expiresInDays: parseInt(expiresInDays) || 30 });
      toast.success('Share link created');
      setLabel('');
      setLinksRev((r) => r + 1);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed');
    } finally {
      setCreating(false);
    }
  }

  async function revokeLink(token) {
    if (!confirm('Revoke this share link?')) return;
    try {
      await api.delete(`/admin/share-catalog/${token}`);
      toast.success('Link revoked');
      setLinksRev((r) => r + 1);
    } catch { toast.error('Failed to revoke'); }
  }

  function copyLink(token) {
    navigator.clipboard.writeText(getPublicUrl(token));
    toast.success('Link copied!');
  }

  function shareAllWhatsApp() {
    const active = shares.filter((s) => !isExpired(s.expiresAt));
    if (!active.length) { toast.error('No active catalog links'); return; }
    const msg = `Check out our product catalog:\n${getPublicUrl(active[0].token)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Share Product Catalog</h1>
          <p className="text-secondary-500 text-sm mt-0.5">Copy product links or share directly to WhatsApp with image preview</p>
        </div>
        <div className="flex items-center gap-2">
          {shares.some((s) => !isExpired(s.expiresAt)) && (
            <button
              onClick={shareAllWhatsApp}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: WHATSAPP_GREEN }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Share Catalog
            </button>
          )}
          <button
            onClick={() => setShowLinkManager((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-secondary-100 hover:bg-secondary-200 text-secondary-700 transition-colors"
          >
            <Link size={14} />
            Catalog Links
            {showLinkManager ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Catalog Link Manager — collapsible */}
      {showLinkManager && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-secondary-50 rounded-xl border border-secondary-200">
          {/* Create form */}
          <form onSubmit={createLink} className="bg-white rounded-xl border border-secondary-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm flex items-center gap-2"><Share2 size={14} /> Create Shareable Catalog Link</h2>
            <div>
              <label className="block text-xs font-medium mb-1 text-secondary-600">Label</label>
              <input className="input w-full" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. For Dealer ABC" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-secondary-600">Expires in (days)</label>
              <input className="input w-full" type="number" min="1" max="365" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} />
            </div>
            <button type="submit" disabled={creating} className="btn-primary flex items-center gap-2 w-full justify-center text-sm">
              {creating ? <Spinner size="sm" /> : <Plus size={13} />}
              {creating ? 'Creating…' : 'Generate Link'}
            </button>
          </form>

          {/* Active links */}
          <div className="bg-white rounded-xl border border-secondary-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-secondary-100 font-semibold text-sm flex items-center gap-2">
              <Link size={13} className="text-secondary-400" /> Active Links
              <span className="ml-auto text-xs text-secondary-400">{shares.filter((s) => !isExpired(s.expiresAt)).length} active</span>
            </div>
            {loadingLinks ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : shares.length === 0 ? (
              <p className="text-center py-8 text-secondary-400 text-sm">No links yet</p>
            ) : (
              <div className="divide-y divide-secondary-100 max-h-64 overflow-y-auto">
                {shares.map((s) => {
                  const expired = isExpired(s.expiresAt);
                  return (
                    <div key={s.token} className={`px-4 py-3 ${expired ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{s.label}</p>
                          <p className="text-xs text-secondary-400 mt-0.5 font-mono truncate">{getPublicUrl(s.token)}</p>
                          <p className={`text-xs mt-0.5 ${expired ? 'text-red-500' : 'text-secondary-400'}`}>
                            {expired ? 'Expired' : 'Expires'} {fmtDate(s.expiresAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!expired && (
                            <button onClick={() => copyLink(s.token)} className="p-1.5 hover:bg-secondary-100 rounded-lg" title="Copy link">
                              <Copy size={13} className="text-blue-600" />
                            </button>
                          )}
                          <button onClick={() => revokeLink(s.token)} className="p-1.5 hover:bg-secondary-100 rounded-lg" title="Revoke">
                            <Trash2 size={13} className="text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          className="input w-full pl-9 pr-4"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Product grid */}
      {loadingProducts ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-secondary-400">
          <Share2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No products found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-secondary-200 hover:bg-secondary-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-secondary-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-secondary-200 hover:bg-secondary-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
