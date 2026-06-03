import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, ShoppingCart, Package, Search,
  RefreshCw, LayoutGrid, List, CheckCircle, XCircle,
} from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import { useFetch, invalidateCache } from '../../../../hooks';
import { useDispatch } from 'react-redux';
import { setCart } from '../../../../store/slices/cartSlice';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({ product, viewMode, onRemove }) {
  const dispatch = useDispatch();
  const [adding,   setAdding]   = useState(false);
  const [removing, setRemoving] = useState(false);

  const inStock = product.stock > 0;

  async function handleAddToCart() {
    setAdding(true);
    try {
      const { data } = await api.post('/cart/items', { productId: product._id, quantity: 1 });
      dispatch(setCart(data.cart));
      toast.success('Added to cart');
    } catch {
      toast.error('Could not add to cart');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await api.delete(`/users/wishlist/${product._id}`);
      onRemove(product._id);
      toast.success('Removed from wishlist');
    } catch {
      toast.error('Could not remove');
    } finally {
      setRemoving(false);
    }
  }

  if (viewMode === 'list') {
    return (
      <div className="card flex items-center gap-4 p-4">
        <Link to={`/product/${product.slug}`} className="shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-secondary-50 flex items-center justify-center border border-secondary-100">
          {product.images?.[0]
            ? <img src={normalizeImageUrl(product.images[0])} alt={product.title} className="w-full h-full object-contain p-2" onError={(e) => { e.target.style.display = 'none'; }} />
            : <Package size={28} className="text-secondary-200" />
          }
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/product/${product.slug}`} className="text-sm font-semibold line-clamp-2 hover:text-primary-600 transition-colors">
            {product.title}
          </Link>
          <div className="flex items-center gap-1.5 mt-1">
            {inStock
              ? <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle size={11} /> In Stock</span>
              : <span className="flex items-center gap-1 text-xs font-medium text-red-500"><XCircle size={11} /> Out of Stock</span>
            }
          </div>
          <p className="text-base font-bold text-primary-600 mt-1">{formatCurrency(product.price)}</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={handleAddToCart}
            disabled={adding || !inStock}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {adding ? <Spinner size="sm" /> : <ShoppingCart size={13} />}
            Add to Cart
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-secondary-200 text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {removing ? <Spinner size="sm" /> : <Heart size={13} fill="currentColor" />}
            Remove
          </button>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="card overflow-hidden group">
      {/* Image */}
      <Link to={`/product/${product.slug}`} className="block relative aspect-square bg-secondary-50 overflow-hidden">
        {product.images?.[0]
          ? <img src={normalizeImageUrl(product.images[0])} alt={product.title} className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300" onError={(e) => { e.target.style.display = 'none'; }} />
          : <div className="w-full h-full flex items-center justify-center"><Package size={40} className="text-secondary-200" /></div>
        }
        {/* Out of stock overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">Out of Stock</span>
          </div>
        )}
        {/* Quick remove button */}
        <button
          onClick={handleRemove}
          disabled={removing}
          className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
          aria-label="Remove from wishlist"
        >
          {removing ? <Spinner size="sm" /> : <Heart size={14} fill="currentColor" />}
        </button>
      </Link>

      {/* Details */}
      <div className="p-4 space-y-2">
        <Link to={`/product/${product.slug}`} className="text-sm font-semibold line-clamp-2 leading-snug hover:text-primary-600 transition-colors">
          {product.title}
        </Link>
        <div className="flex items-center gap-1">
          {inStock
            ? <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle size={11} /> In Stock</span>
            : <span className="flex items-center gap-1 text-xs font-medium text-red-500"><XCircle size={11} /> Out of Stock</span>
          }
        </div>
        <p className="text-base font-bold text-primary-600">{formatCurrency(product.price)}</p>

        <button
          onClick={inStock ? handleAddToCart : handleRemove}
          disabled={adding || removing}
          className={`w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-50 ${
            inStock
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'
          }`}
        >
          {(adding || removing) ? <Spinner size="sm" /> : inStock ? <ShoppingCart size={14} /> : <Heart size={14} />}
          {inStock ? 'Add to Cart' : 'Remove'}
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="aspect-square bg-secondary-100" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-secondary-100 rounded w-3/4" />
        <div className="h-3 bg-secondary-100 rounded w-1/4" />
        <div className="h-5 bg-secondary-100 rounded w-1/3" />
        <div className="h-9 bg-secondary-100 rounded" />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CustomerWishlist() {
  const [rev,         setRev]         = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode,    setViewMode]    = useState('grid');

  const { data, isLoading } = useFetch(
    ['customer-wishlist', rev],
    () => api.get('/users/wishlist').then((r) => r.data)
  );

  const wishlist = data?.wishlist || [];

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return wishlist;
    const q = searchQuery.toLowerCase();
    return wishlist.filter((p) => p.title?.toLowerCase().includes(q));
  }, [wishlist, searchQuery]);

  function handleRemove(productId) {
    invalidateCache('customer-wishlist');
    invalidateCache('customer-stats');
    setRev((r) => r + 1);
  }

  function refresh() {
    invalidateCache('customer-wishlist');
    invalidateCache('customer-stats');
    setRev((r) => r + 1);
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Wishlist</h1>
          <p className="text-sm text-secondary-500 mt-0.5">
            {wishlist.length} item{wishlist.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          {wishlist.length > 0 && (
            <div className="flex items-center border border-secondary-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'text-secondary-500 hover:bg-secondary-50'}`}
                aria-label="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-secondary-500 hover:bg-secondary-50'}`}
                aria-label="List view"
              >
                <List size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      {wishlist.length > 0 && (
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary-400" />
          <input
            className="input w-full pl-10"
            placeholder="Search your wishlist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Content */}
      {isLoading && !wishlist.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => <GridSkeleton key={i} />)}
        </div>
      ) : wishlist.length === 0 ? (
        <div className="card p-16 text-center space-y-3">
          <Heart size={44} className="mx-auto text-secondary-200" />
          <p className="font-semibold text-secondary-500">Your wishlist is empty</p>
          <p className="text-sm text-secondary-400">Save items you love and find them here later.</p>
          <Link to="/products" className="btn-primary inline-flex mx-auto">Explore Products</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <Search size={36} className="mx-auto text-secondary-200" />
          <p className="font-semibold text-secondary-500">No matching items</p>
          <button onClick={() => setSearchQuery('')} className="btn-secondary text-sm mx-auto">Clear search</button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <ProductCard key={p._id} product={p} viewMode="grid" onRemove={handleRemove} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <ProductCard key={p._id} product={p} viewMode="list" onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
