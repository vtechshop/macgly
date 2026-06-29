import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { SlidersHorizontal, X, Star, Search as SearchIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import ProductGrid from '../components/product/ProductGrid';
import { setCart } from '../../store/slices/cartSlice';
import { useFetch } from '../../hooks';
import { setMeta } from '../../utils/seo';
import toast from 'react-hot-toast';

const RATING_OPTIONS = [
  { label: '4★ & above', value: '4' },
  { label: '3★ & above', value: '3' },
  { label: '2★ & above', value: '2' },
];

function StarRating({ value }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={12} className={n <= value ? 'fill-yellow-400 text-yellow-400' : 'fill-secondary-200 text-secondary-200'} />
      ))}
    </div>
  );
}

function FilterPanel({ params, set, setParams, categoriesData, onClose }) {
  const category  = params.get('category')  || '';
  const minPrice  = params.get('minPrice')  || '';
  const maxPrice  = params.get('maxPrice')  || '';
  const brand     = params.get('brand')     || '';
  const minRating = params.get('minRating') || '';
  const featured  = params.get('featured')  || '';

  const [brandInput, setBrandInput] = useState(brand);

  function applyBrand() {
    set('brand', brandInput.trim());
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Filters</h3>
        <div className="flex items-center gap-3">
          <button className="text-xs text-primary-600 hover:underline"
            onClick={() => { setBrandInput(''); set('', ''); }}>
            Clear all
          </button>
          {onClose && <button onClick={onClose}><X size={14} /></button>}
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Category</label>
        <select className="input mt-1.5 text-sm w-full" value={category} onChange={(e) => set('category', e.target.value)}>
          <option value="">All Categories</option>
          {categoriesData?.categories?.filter((c) => !c.parentId).map((c) => (
            <option key={c._id} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Brand */}
      <div>
        <label className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Brand</label>
        <div className="flex gap-2 mt-1.5">
          <input
            className="input text-sm flex-1"
            placeholder="Enter brand name"
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyBrand()}
          />
          <button onClick={applyBrand} className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shrink-0">
            <SearchIcon size={14} />
          </button>
        </div>
        {brand && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              {brand}
              <button onClick={() => { setBrandInput(''); set('brand', ''); }} className="hover:text-primary-900">
                <X size={10} />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Price Range */}
      <div>
        <label className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Price Range</label>
        <div className="flex gap-2 mt-1.5">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-400 text-xs">₹</span>
            <input
              className="input text-sm pl-6 w-full"
              placeholder="Min"
              type="number"
              min="0"
              value={minPrice}
              onChange={(e) => set('minPrice', e.target.value)}
            />
          </div>
          <span className="self-center text-secondary-400 text-xs">–</span>
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary-400 text-xs">₹</span>
            <input
              className="input text-sm pl-6 w-full"
              placeholder="Max"
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => set('maxPrice', e.target.value)}
            />
          </div>
        </div>
        {/* Quick price presets */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[['Under ₹500', '', '500'], ['₹500–2000', '500', '2000'], ['₹2000–10000', '2000', '10000'], ['₹10000+', '10000', '']].map(([label, min, max]) => {
            const active = minPrice === min && maxPrice === max;
            return (
              <button
                key={label}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  if (min) next.set('minPrice', min); else next.delete('minPrice');
                  if (max) next.set('maxPrice', max); else next.delete('maxPrice');
                  next.delete('page');
                  setParams(next);
                }}
                className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                  active ? 'bg-primary-600 text-white border-primary-600' : 'border-secondary-200 text-secondary-600 hover:border-primary-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rating */}
      <div>
        <label className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">Min Rating</label>
        <div className="space-y-1.5 mt-1.5">
          {RATING_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => set('minRating', minRating === value ? '' : value)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm transition-colors ${
                minRating === value
                  ? 'bg-yellow-50 border-yellow-400 text-yellow-700 font-semibold'
                  : 'border-secondary-200 hover:border-yellow-300 text-secondary-600'
              }`}
            >
              <StarRating value={parseInt(value)} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="rounded"
          checked={featured === 'true'}
          onChange={(e) => set('featured', e.target.checked ? 'true' : '')}
        />
        <span className="text-secondary-700">Featured only</span>
      </label>
    </div>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const dispatch = useDispatch();
  const [showFilters, setShowFilters] = useState(false);

  const page      = parseInt(params.get('page')      || '1');
  const search    = params.get('search')    || '';
  const category  = params.get('category')  || '';
  const featured  = params.get('featured')  || '';
  const sort      = params.get('sort')      || 'displayOrder';
  const minPrice  = params.get('minPrice')  || '';
  const maxPrice  = params.get('maxPrice')  || '';
  const brand     = params.get('brand')     || '';
  const minRating = params.get('minRating') || '';

  const activeFilterCount = [category, minPrice, maxPrice, brand, minRating, featured === 'true' ? 'f' : ''].filter(Boolean).length;

  useEffect(() => {
    const title = search
      ? `"${search}" — Search Results | Macgly`
      : 'All Products — Tools & Machinery | Macgly';
    setMeta({ title, description: 'Browse genuine tools, machines, spare parts and safety equipment on Macgly. Pan India delivery.' });
  }, [search]);

  const { data, isLoading } = useFetch(
    ['products', { page, search, category, featured, sort, minPrice, maxPrice, brand, minRating }],
    () => api.get('/catalog/products', { params: { page, search, category, featured, sort, minPrice, maxPrice, brand, minRating } }).then((r) => r.data),
    { keepPrevious: true }
  );

  const { data: categoriesData } = useFetch(
    ['categories'],
    () => api.get('/catalog/categories').then((r) => r.data)
  );

  function set(key, value) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      next.delete('page');
      return next;
    });
  }

  async function handleAddToCart(product) {
    try {
      const { data: cartData } = await api.post('/cart/items', { productId: product._id, quantity: 1 });
      dispatch(setCart(cartData.cart));
      toast.success(`${product.title} added to cart`);
    } catch {
      toast.error('Could not add to cart');
    }
  }

  function goToPage(p) {
    const n = new URLSearchParams(params);
    n.set('page', p);
    setParams(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, total, current, current - 1, current + 1].filter((p) => p >= 1 && p <= total));
    const sorted = [...set].sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…');
      result.push(sorted[i]);
    }
    return result;
  }

  const { products, pagination } = data || {};

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">
            {search
              ? `Results for "${search}"`
              : featured === 'true'
              ? 'New Arrivals'
              : category
              ? (categoriesData?.categories?.find((c) => c.slug === category)?.name || category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
              : 'All Products'}
          </h1>
          {pagination && (
            <p className="text-sm text-secondary-500 mt-1">
              {pagination.total} {pagination.total === 1 ? 'product' : 'products'} found
              {search && <span className="text-secondary-400"> for "{search}"</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select className="input w-auto text-sm" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="displayOrder">Featured</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
          <button
            className={`btn-outline flex items-center gap-2 relative ${activeFilterCount > 0 ? 'border-primary-400 text-primary-600' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={16} /> Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block w-60 shrink-0">
          <div className="card p-4 sticky top-20">
            <FilterPanel params={params} set={set} setParams={setParams} categoriesData={categoriesData} />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Mobile filter panel */}
          {showFilters && (
            <div className="lg:hidden card p-4 mb-4">
              <FilterPanel params={params} set={set} setParams={setParams} categoriesData={categoriesData} onClose={() => setShowFilters(false)} />
            </div>
          )}

          <ProductGrid products={products} loading={isLoading} onAddToCart={handleAddToCart} />

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-8">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 h-9 rounded-lg text-sm font-medium border border-secondary-200 text-secondary-600 hover:bg-secondary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={15} /> Prev
              </button>
              {getPageNumbers(page, pagination.pages).map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="w-9 text-center text-secondary-400 text-sm">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      p === page ? 'bg-primary-600 text-white shadow-sm' : 'border border-secondary-200 text-secondary-600 hover:bg-secondary-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= pagination.pages}
                className="flex items-center gap-1 px-3 h-9 rounded-lg text-sm font-medium border border-secondary-200 text-secondary-600 hover:bg-secondary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
