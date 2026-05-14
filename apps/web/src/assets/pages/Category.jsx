import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, ChevronDown, ChevronUp, X } from 'lucide-react';
import api from '../utils/api';
import { useFetch } from '../hooks';
import Spinner from './components/common/Spinner';
import ProductCard from './components/ProductCard';

function FilterPanel({ filters, onChange, onClear }) {
  const [priceOpen, setPriceOpen] = useState(true);
  const [ratingOpen, setRatingOpen] = useState(true);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-secondary-800">Filters</h2>
        <button onClick={onClear} className="text-xs text-primary-600 hover:underline">Clear all</button>
      </div>

      {/* Price range */}
      <div>
        <button className="flex items-center justify-between w-full font-semibold text-sm mb-2" onClick={() => setPriceOpen((o) => !o)}>
          Price Range {priceOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {priceOpen && (
          <div className="flex gap-2 items-center">
            <input type="number" placeholder="Min" className="input w-full text-sm py-1.5" value={filters.minPrice} onChange={(e) => onChange('minPrice', e.target.value)} />
            <span className="text-secondary-400">–</span>
            <input type="number" placeholder="Max" className="input w-full text-sm py-1.5" value={filters.maxPrice} onChange={(e) => onChange('maxPrice', e.target.value)} />
          </div>
        )}
      </div>

      {/* Rating */}
      <div>
        <button className="flex items-center justify-between w-full font-semibold text-sm mb-2" onClick={() => setRatingOpen((o) => !o)}>
          Min Rating {ratingOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {ratingOpen && (
          <div className="space-y-1">
            {[4, 3, 2, 1].map((r) => (
              <button key={r} onClick={() => onChange('minRating', filters.minRating === String(r) ? '' : String(r))}
                className={`flex items-center gap-2 w-full text-sm px-2 py-1 rounded ${filters.minRating === String(r) ? 'bg-primary-50 text-primary-600' : 'hover:bg-secondary-50'}`}>
                {'★'.repeat(r)}{'☆'.repeat(5 - r)} <span className="text-xs text-secondary-400">& up</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* In stock */}
      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
        <input type="checkbox" className="rounded" checked={filters.inStock === 'true'} onChange={(e) => onChange('inStock', e.target.checked ? 'true' : '')} />
        In Stock Only
      </label>
    </div>
  );
}

export default function Category() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const page = Number(searchParams.get('page') || 1);
  const sort = searchParams.get('sort') || 'newest';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const minRating = searchParams.get('minRating') || '';
  const inStock = searchParams.get('inStock') || '';

  function setParam(key, value) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }

  function clearFilters() {
    setSearchParams({ sort });
  }

  const { data: catData } = useFetch(
    ['category', slug],
    () => api.get(`/catalog/categories/${slug}`).then((r) => r.data)
  );

  const { data, isLoading } = useFetch(
    ['category-products', slug, page, sort, minPrice, maxPrice, minRating, inStock],
    () => api.get('/catalog/products', {
      params: { category: catData?.category?._id, page, limit: 24, sort, minPrice: minPrice || undefined, maxPrice: maxPrice || undefined, minRating: minRating || undefined, inStock: inStock || undefined },
    }).then((r) => r.data),
    { enabled: !!catData?.category?._id }
  );

  const category = catData?.category;
  const products = data?.products || [];
  const pagination = data?.pagination || {};

  const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'rating', label: 'Top Rated' },
    { value: 'popular', label: 'Most Popular' },
  ];

  const activeFilterCount = [minPrice, maxPrice, minRating, inStock].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-secondary-400 mb-4 flex items-center gap-1.5">
        <Link to="/" className="hover:text-secondary-700">Home</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-secondary-700">Products</Link>
        {category && <><span>/</span><span className="text-secondary-700 font-medium">{category.name}</span></>}
      </nav>

      {/* Category header */}
      {category && (
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-secondary-900">{category.name}</h1>
          {category.description && <p className="text-secondary-500 mt-1">{category.description}</p>}
        </div>
      )}

      <div className="flex gap-6">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="card p-4 sticky top-20">
            <FilterPanel
              filters={{ minPrice, maxPrice, minRating, inStock }}
              onChange={setParam}
              onClear={clearFilters}
            />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFilters((o) => !o)} className="lg:hidden flex items-center gap-1.5 text-sm font-medium border border-secondary-200 rounded-lg px-3 py-1.5 hover:bg-secondary-50">
                <SlidersHorizontal size={14} /> Filters
                {activeFilterCount > 0 && <span className="bg-primary-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{activeFilterCount}</span>}
              </button>
              {pagination.total > 0 && <p className="text-sm text-secondary-500">{pagination.total} products</p>}
            </div>
            <select className="input text-sm py-1.5 pr-8 w-auto" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Mobile filter panel */}
          {showFilters && (
            <div className="lg:hidden card p-4 mb-4">
              <FilterPanel filters={{ minPrice, maxPrice, minRating, inStock }} onChange={setParam} onClear={clearFilters} />
            </div>
          )}

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {minPrice && <span className="flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium">Min ₹{minPrice} <button onClick={() => setParam('minPrice', '')}><X size={10} /></button></span>}
              {maxPrice && <span className="flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium">Max ₹{maxPrice} <button onClick={() => setParam('maxPrice', '')}><X size={10} /></button></span>}
              {minRating && <span className="flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium">{'★'.repeat(Number(minRating))}+ <button onClick={() => setParam('minRating', '')}><X size={10} /></button></span>}
              {inStock && <span className="flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium">In Stock <button onClick={() => setParam('inStock', '')}><X size={10} /></button></span>}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : products.length === 0 ? (
            <div className="card p-16 text-center text-secondary-400">
              <p className="font-medium text-lg">No products found</p>
              <button onClick={clearFilters} className="btn-primary mt-4">Clear filters</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>

              {pagination.pages > 1 && (
                <div className="flex justify-center gap-1 mt-8">
                  <button disabled={page <= 1} onClick={() => setParam('page', page - 1)} className="px-3 py-1.5 rounded text-sm font-medium hover:bg-secondary-100 disabled:opacity-40">← Prev</button>
                  {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setParam('page', p)} className={`w-8 h-8 rounded text-sm font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-secondary-100'}`}>{p}</button>
                  ))}
                  <button disabled={page >= pagination.pages} onClick={() => setParam('page', page + 1)} className="px-3 py-1.5 rounded text-sm font-medium hover:bg-secondary-100 disabled:opacity-40">Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
