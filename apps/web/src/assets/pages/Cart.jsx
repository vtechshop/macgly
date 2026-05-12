import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Trash2, ShoppingBag } from 'lucide-react';
import api from '../../utils/api';
import { setCart } from '../../store/slices/cartSlice';
import { formatCurrency, normalizeImageUrl } from '../../utils/format';
import Spinner from '../components/common/Spinner';
import toast from 'react-hot-toast';

export default function Cart() {
  const dispatch = useDispatch();
  const [cart, setLocalCart] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/cart').then((r) => {
      setLocalCart(r.data.cart);
      dispatch(setCart(r.data.cart));
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [dispatch]);

  async function updateQty(itemId, quantity) {
    try {
      const { data } = await api.put(`/cart/items/${itemId}`, { quantity });
      setLocalCart(data.cart);
      dispatch(setCart(data.cart));
    } catch {
      toast.error('Could not update quantity');
    }
  }

  async function removeItem(itemId) {
    try {
      const { data } = await api.delete(`/cart/items/${itemId}`);
      setLocalCart(data.cart);
      dispatch(setCart(data.cart));
    } catch {
      toast.error('Could not remove item');
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const items = cart?.items || [];

  if (!items.length) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={64} className="mx-auto text-secondary-200 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
        <p className="text-secondary-500 mb-6">Add some products to get started.</p>
        <Link to="/products" className="btn-primary">Browse Products</Link>
      </div>
    );
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const gstAmount = parseFloat(
    items.reduce((sum, i) => sum + (i.price * i.quantity * (i.product?.gstRate ?? 18)) / (100 + (i.product?.gstRate ?? 18)), 0).toFixed(2)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold mb-6">Shopping Cart ({items.length} items)</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item._id} className="card p-4 flex gap-4">
              <Link to={`/product/${item.product?.slug}`} className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-secondary-50">
                {item.product?.images?.[0] && (
                  <img src={normalizeImageUrl(item.product.images[0])} alt={item.product.title} className="w-full h-full object-cover" />
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/product/${item.product?.slug}`} className="font-medium hover:text-primary-600 line-clamp-2">
                  {item.product?.title || item.title}
                </Link>
                <p className="text-sm text-secondary-500 mt-0.5">{formatCurrency(item.price)} each</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center border border-secondary-300 rounded-lg">
                    <button className="px-2 py-1 text-secondary-600 hover:bg-secondary-50"
                      onClick={() => item.quantity > 1 ? updateQty(item._id, item.quantity - 1) : removeItem(item._id)}>−</button>
                    <span className="px-3 py-1 text-sm">{item.quantity}</span>
                    <button className="px-2 py-1 text-secondary-600 hover:bg-secondary-50"
                      onClick={() => updateQty(item._id, item.quantity + 1)}>+</button>
                  </div>
                  <button className="text-red-500 hover:text-red-700" onClick={() => removeItem(item._id)}>
                    <Trash2 size={16} />
                  </button>
                  <span className="ml-auto font-semibold">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-5 h-fit space-y-4">
          <h2 className="font-semibold text-lg">Order Summary</h2>
          <div className="flex justify-between text-sm">
            <span className="text-secondary-600">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-secondary-400">
            <span>GST (incl. in price)</span>
            <span>{formatCurrency(gstAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-secondary-600">Shipping</span>
            <span className="text-green-600">Calculated at checkout</span>
          </div>
          <div className="flex justify-between font-semibold text-lg border-t border-secondary-200 pt-3">
            <span>Total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <Link to="/checkout" className="btn-primary w-full text-center block">Proceed to Checkout</Link>
          <Link to="/products" className="btn-outline w-full text-center block text-sm">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
