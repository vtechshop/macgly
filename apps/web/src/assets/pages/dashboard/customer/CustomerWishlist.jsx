import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, Package } from 'lucide-react';
import api from '../../../../utils/api';
import { formatCurrency, normalizeImageUrl } from '../../../../utils/format';
import { useFetch } from '../../../../hooks';
import { useDispatch } from 'react-redux';
import { setCart } from '../../../../store/slices/cartSlice';
import Spinner from '../../../components/common/Spinner';
import toast from 'react-hot-toast';

function WishlistCard({ product, onRemoved }) {
  const dispatch = useDispatch();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function addToCart() {
    setAdding(true);
    try {
      const { data } = await api.post('/cart/items', { productId: product._id, quantity: 1 });
      dispatch(setCart(data.cart));
      toast.success('Added to cart');
    } catch { toast.error('Could not add to cart'); }
    finally { setAdding(false); }
  }

  async function remove() {
    setRemoving(true);
    try {
      await api.delete(`/users/wishlist/${product._id}`);
      onRemoved(product._id);
      toast.success('Removed from wishlist');
    } catch { toast.error('Could not remove'); }
    finally { setRemoving(false); }
  }

  const discount = product.compareAt > product.price
    ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
    : null;

  return (
    <div className="bg-white border border-secondary-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
      <Link to={`/product/${product.slug}`} className="block relative">
        <div className="aspect-square bg-secondary-50 overflow-hidden">
          {product.images?.[0] ? (
            <img
              src={normalizeImageUrl(product.images[0])}
              alt={product.title}
              className="w-full h-full object-contain p-4"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={40} className="text-secondary-200" />
            </div>
          )}
        </div>
        {discount && (
          <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {discount}% off
          </span>
        )}
      </Link>

      <div className="p-4 space-y-3">
        <div>
          <Link to={`/product/${product.slug}`} className="text-sm font-semibold text-secondary-800 line-clamp-2 hover:text-primary-600 leading-snug">
            {product.title}
          </Link>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-base font-bold text-secondary-900">{formatCurrency(product.price)}</span>
            {product.compareAt > product.price && (
              <span className="text-xs text-secondary-400 line-through">{formatCurrency(product.compareAt)}</span>
            )}
          </div>
          {product.stock <= 0 && (
            <p className="text-xs text-red-500 font-medium mt-1">Out of stock</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={addToCart}
            disabled={adding || product.stock <= 0}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            {adding ? <Spinner size="sm" /> : <ShoppingCart size={14} />}
            {product.stock <= 0 ? 'Out of stock' : 'Add to Cart'}
          </button>
          <button
            onClick={remove}
            disabled={removing}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 border border-secondary-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerWishlist() {
  const [rev, setRev] = useState(0);
  const { data, isLoading } = useFetch(
    ['customer-wishlist', rev],
    () => api.get('/users/wishlist').then((r) => r.data)
  );

  const wishlist = data?.wishlist || [];

  function onRemoved(productId) {
    setRev((r) => r + 1);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Heart size={22} className="text-red-500" />
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">My Wishlist</h1>
          {wishlist.length > 0 && <p className="text-sm text-secondary-500 mt-0.5">{wishlist.length} saved item{wishlist.length !== 1 ? 's' : ''}</p>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : wishlist.length === 0 ? (
        <div className="bg-white border border-secondary-200 rounded-xl text-center py-16 space-y-3">
          <Heart size={44} className="mx-auto text-secondary-200" />
          <p className="font-semibold text-secondary-500">Your wishlist is empty</p>
          <p className="text-sm text-secondary-400">Save items you love to your wishlist</p>
          <Link to="/products" className="inline-block mt-1 text-sm text-primary-600 font-semibold hover:underline">Browse Products →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {wishlist.map((product) => (
            <WishlistCard key={product._id} product={product} onRemoved={onRemoved} />
          ))}
        </div>
      )}
    </div>
  );
}
