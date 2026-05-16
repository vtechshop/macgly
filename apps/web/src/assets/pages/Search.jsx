import { useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { SlidersHorizontal, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import ProductGrid from '../components/product/ProductGrid';
import { setCart } from '../../store/slices/cartSlice';
import { useFetch } from '../../hooks';
import { setMeta } from '../../utils/seo';
import toast from 'react-hot-toast';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const dispatch = useDispatch();
  const [showFilters, setShowFilters] = useState(false);

  const page = parseInt(params.get('page') || '1');
  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const featured = params.get('featured') || '';
  const sort = params.get('sort') || 'displayOrder';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';

  useEffect(() => {
    const title = search
      ? `"${search}" — Search Results | Macgly`
      : 'All Products — Tools & Machinery | Macgly';
    setMeta({ title, description: 'Browse genuine tools, machines, spare parts and safety equipment on Macgly. Pan India delivery.' });
  }, [search]);

  const { data, isLoading } = useFetch(
    ['products', { page, search, category, featured, sort, minPrice, maxPrice }],
    () => api.get('/catalog/products', { params: { page, search, category, featured, sort, minPrice, maxPrice } }).then((r) => r.data),
    { keepPrevious: true }
  );

  const { data: categoriesData } = useFetch(
    ['categories'],
    () => api.get('/catalog/categories').then((r) => r.data)
  );

  function set(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setParams(next);
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

  const { products, pagination } = data || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="section-title">
            {search ? `Results for "${search}"` : category ? category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All Products'}
          </h1>
          {pagination && <p className="text-sm text-secondary-500 mt-1">{pagination.total} products found</p>}
        </div>
        <div className="flex items-center gap-3">
          <select className="input w-auto text-sm" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="displayOrder">Featured</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
          <button className="btn-outline flex items-center gap-2" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={16} /> Filters
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {showFilters && (
          <aside className="w-56 shrink-0 space-y-6">
            <div className="card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Filters</h3>
                <button onClick={() => setShowFilters(false)}><X size={14} /></button>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-600 uppercase tracking-wide">Category</label>
                <select className="input mt-1 text-sm" value={category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">All</option>
                  {categoriesData?.categories?.map((c) => (
                    <option key={c._id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-secondary-600 uppercase tracking-wide">Price Range</label>
                <div className="flex gap-2 mt-1">
                  <input className="input text-sm" placeholder="Min" type="number" value={minPrice}
                    onChange={(e) => set('minPrice', e.target.value)} />
                  <input className="input text-sm" placeholder="Max" type="number" value={maxPrice}
                    onChange={(e) => set('maxPrice', e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={featured === 'true'}
                  onChange={(e) => set('featured', e.target.checked ? 'true' : '')} />
                Featured only
              </label>
              <button className="btn-outline w-full text-sm" onClick={() => setParams({})}>Clear all</button>
            </div>
          </aside>
        )}

        <div className="flex-1 min-w-0">
          <ProductGrid products={products} loading={isLoading} onAddToCart={handleAddToCart} />

          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => { const n = new URLSearchParams(params); n.set('page', p); setParams(n); }}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    p === page ? 'bg-primary-600 text-white' : 'btn-outline'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
