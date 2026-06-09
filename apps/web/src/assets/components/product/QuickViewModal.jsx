import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ShoppingCart, Zap, Star, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { addItemOptimistic, openCartDrawer, setCart } from '../../../store/slices/cartSlice';
import { formatCurrency, normalizeImageUrl } from '../../../utils/format';
import api from '../../../utils/api';
import toast from 'react-hot-toast';
import Spinner from '../common/Spinner';

export default function QuickViewModal({ product, onClose }) {
  const dispatch = useDispatch();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [buying, setBuying] = useState(false);

  const discount = product.compareAt > product.price
    ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
    : null;

  function addToCart() {
    dispatch(addItemOptimistic({ product, quantity: qty }));
    dispatch(openCartDrawer(product));
    toast.success('Added to cart');
    api.post('/cart/items', { productId: product._id, quantity: qty })
      .then(({ data }) => dispatch(setCart(data.cart)))
      .catch(() => {
        toast.error('Could not sync cart');
        api.get('/cart').then(({ data }) => { if (data.cart) dispatch(setCart(data.cart)); }).catch(() => {});
      });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-10">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-secondary-100 hover:bg-secondary-200 text-secondary-600 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
          {/* Image */}
          <div className="bg-secondary-50 rounded-tl-2xl rounded-bl-2xl p-6 flex flex-col gap-3">
            <div className="aspect-square flex items-center justify-center relative">
              {product.images?.[activeImg] && (
                <img
                  src={normalizeImageUrl(product.images[activeImg])}
                  alt={product.title}
                  className="absolute inset-0 w-full h-full object-contain"
                  onError={(e) => e.currentTarget.remove()}
                />
              )}
              <ShoppingCart size={48} className="text-secondary-200" />
            </div>
            {product.images?.length > 1 && (
              <div className="flex gap-1.5 flex-wrap justify-center">
                {product.images.slice(0, 5).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`w-10 h-10 rounded-lg overflow-hidden border-2 bg-white transition-colors ${i === activeImg ? 'border-primary-500' : 'border-secondary-200 hover:border-secondary-400'}`}
                  >
                    <img src={normalizeImageUrl(img)} alt="" className="w-full h-full object-contain p-0.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-5 flex flex-col gap-3">
            {product.brand && (
              <p className="text-xs font-bold uppercase tracking-widest text-primary-600 bg-primary-50 px-2 py-0.5 rounded w-fit">{product.brand}</p>
            )}
            <h2 className="text-base font-bold text-secondary-900 leading-snug">{product.title}</h2>

            {product.rating > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={13} className={i < Math.round(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-secondary-200 fill-secondary-200'} />
                  ))}
                </div>
                <span className="text-xs text-secondary-400">({product.reviewCount})</span>
              </div>
            )}

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-secondary-900">{formatCurrency(product.price)}</span>
              {product.compareAt > product.price && (
                <>
                  <span className="text-sm text-secondary-400 line-through">{formatCurrency(product.compareAt)}</span>
                  <span className="bg-green-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">{discount}% OFF</span>
                </>
              )}
            </div>

            {product.stock > 0 ? (
              <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <CheckCircle size={13} /> In Stock
                {product.stock <= 5 && <span className="text-orange-500 ml-1">— Only {product.stock} left</span>}
              </p>
            ) : (
              <p className="text-xs text-red-500 font-semibold flex items-center gap-1"><XCircle size={13} /> Out of Stock</p>
            )}

            {product.description && (
              <p className="text-xs text-secondary-500 leading-relaxed line-clamp-3">{product.description}</p>
            )}

            {product.stock > 0 && (
              <div className="space-y-2 mt-auto pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-secondary-600 font-medium">Qty:</span>
                  <div className="flex items-center border border-secondary-300 rounded-lg overflow-hidden">
                    <button className="w-7 h-7 flex items-center justify-center text-secondary-600 hover:bg-secondary-100 disabled:opacity-40 transition-colors"
                      onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}>−</button>
                    <span className="w-8 text-center text-sm font-bold border-x border-secondary-200">{qty}</span>
                    <button className="w-7 h-7 flex items-center justify-center text-secondary-600 hover:bg-secondary-100 disabled:opacity-40 transition-colors"
                      onClick={() => setQty(Math.min(product.stock, qty + 1))} disabled={qty >= product.stock}>+</button>
                  </div>
                </div>
                <button
                  onClick={addToCart}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  <ShoppingCart size={15} /> Add to Cart
                </button>
              </div>
            )}

            <Link
              to={`/product/${product.slug}`}
              onClick={onClose}
              className="flex items-center justify-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-semibold"
            >
              View full details <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
