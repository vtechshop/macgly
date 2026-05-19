import { Link } from 'react-router-dom';
import { ShoppingCart, Star, Zap, Plus, Minus } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { useState } from 'react';
import { setCart, openCartDrawer } from '../../../store/slices/cartSlice';
import { formatCurrency, normalizeImageUrl } from '../../../utils/format';
import api from '../../../utils/api';
import toast from 'react-hot-toast';

export default function ProductCard({ product, onAddToCart }) {
  const dispatch = useDispatch();
  const cartItems = useSelector((s) => s.cart.items);
  const cartItem = cartItems.find((i) => i.product?._id === product._id || i.product === product._id);
  const qty = cartItem?.quantity || 0;
  const [loading, setLoading] = useState(false);

  const discount = product.compareAt > product.price
    ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
    : null;

  async function changeQty(newQty) {
    setLoading(true);
    try {
      if (newQty < 1) {
        const { data } = await api.delete(`/cart/items/${cartItem._id}`);
        dispatch(setCart(data.cart));
      } else if (qty === 0) {
        const { data } = await api.post('/cart/items', { productId: product._id, quantity: 1 });
        dispatch(setCart(data.cart));
        dispatch(openCartDrawer(product));
      } else {
        const { data } = await api.put(`/cart/items/${cartItem._id}`, { quantity: newQty });
        dispatch(setCart(data.cart));
      }
    } catch {
      toast.error('Could not update cart');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (onAddToCart) {
      onAddToCart(product);
    } else {
      await changeQty(1);
    }
  }

  return (
    <div className="card group hover:border-primary-300 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {/* Image */}
      <Link to={`/product/${product.slug}`} className="block overflow-hidden bg-secondary-50 rounded-t-xl border-b border-secondary-100 relative" style={{ aspectRatio: '4/3' }}>
        {discount >= 10 && (
          <span className="absolute top-2 left-2 z-10 bg-primary-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            {discount}% OFF
          </span>
        )}
        {product.stock === 0 && (
          <span className="absolute top-2 right-2 z-10 bg-secondary-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            OUT OF STOCK
          </span>
        )}
        {product.images?.[0] ? (
          <img
            src={normalizeImageUrl(product.images[0])}
            alt={product.imageAlts?.[0] || product.title}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-secondary-200">
            <ShoppingCart size={36} />
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        {product.brand && (
          <p className="text-[10px] text-primary-600 font-bold uppercase tracking-wider">{product.brand}</p>
        )}
        <Link to={`/product/${product.slug}`} className="mt-0.5 text-sm font-semibold text-secondary-800 hover:text-primary-600 line-clamp-2 flex-1 leading-snug">
          {product.title}
        </Link>

        {product.rating > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} size={10} className={i < Math.round(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-secondary-200 fill-secondary-200'} />
            ))}
            <span className="text-[10px] text-secondary-400 ml-0.5">({product.reviewCount})</span>
          </div>
        )}

        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-black text-secondary-900">{formatCurrency(product.price)}</span>
            {product.compareAt > product.price && (
              <span className="text-xs text-secondary-400 line-through">{formatCurrency(product.compareAt)}</span>
            )}
          </div>
          {product.stock > 0 && product.stock <= 5 && (
            <p className="text-[10px] text-orange-600 font-semibold flex items-center gap-0.5 mt-0.5">
              <Zap size={10} /> Only {product.stock} left
            </p>
          )}
        </div>

        {/* Cart controls */}
        {product.stock === 0 ? (
          <button disabled className="mt-2 w-full text-xs py-1.5 btn bg-secondary-100 text-secondary-400 cursor-not-allowed">
            Out of Stock
          </button>
        ) : qty > 0 ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              onClick={() => changeQty(qty - 1)}
              disabled={loading}
              className="w-8 h-8 flex items-center justify-center rounded bg-secondary-100 hover:bg-primary-100 hover:text-primary-700 text-secondary-700 transition-colors disabled:opacity-50"
            >
              <Minus size={14} />
            </button>
            <span className="flex-1 text-center text-sm font-bold text-secondary-900 bg-primary-50 rounded py-1">
              {qty}
            </span>
            <button
              onClick={() => changeQty(qty + 1)}
              disabled={loading || qty >= product.stock}
              className="w-8 h-8 flex items-center justify-center rounded bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleAdd}
            disabled={loading}
            className="mt-2 w-full text-xs py-1.5 btn-primary disabled:opacity-50"
          >
            <ShoppingCart size={13} /> Add to Cart
          </button>
        )}
      </div>
    </div>
  );
}
