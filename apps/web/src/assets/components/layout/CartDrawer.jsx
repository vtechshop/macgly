import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { X, ShoppingCart, Minus, Plus, Trash2, Check } from 'lucide-react';
import { setCart, clearCart, closeCartDrawer } from '../../../store/slices/cartSlice';
import { formatCurrency, normalizeImageUrl } from '../../../utils/format';
import api from '../../../utils/api';
import toast from 'react-hot-toast';

export default function CartDrawer() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, count, drawerOpen, lastAdded } = useSelector((s) => s.cart);
  const [loadingId, setLoadingId] = useState(null);
  const [clearing, setClearing] = useState(false);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  function close() { dispatch(closeCartDrawer()); }

  async function changeQty(item, newQty) {
    setLoadingId(item._id);
    try {
      if (newQty < 1) {
        const { data } = await api.delete(`/cart/items/${item._id}`);
        dispatch(setCart(data.cart));
      } else {
        const { data } = await api.put(`/cart/items/${item._id}`, { quantity: newQty });
        dispatch(setCart(data.cart));
      }
    } catch { toast.error('Could not update cart'); }
    finally { setLoadingId(null); }
  }

  async function handleClearCart() {
    if (!confirm('Remove all items from cart?')) return;
    setClearing(true);
    try {
      await api.delete('/cart');
      dispatch(clearCart());
    } catch { toast.error('Could not clear cart'); }
    finally { setClearing(false); }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={close}
      />

      {/* Drawer */}
      <div className={`fixed right-0 top-0 h-full w-full max-w-[420px] bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={20} className="text-secondary-700" />
            <span className="font-bold text-secondary-800 text-lg">Shopping Cart</span>
            <span className="bg-primary-600 text-white text-xs font-bold min-w-5 h-5 px-1 rounded-full flex items-center justify-center">
              {count}
            </span>
          </div>
          <button onClick={close} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Added to Cart banner */}
        {lastAdded && items.length > 0 && (
          <div className="bg-green-50 border-b border-green-100 px-5 py-3 shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                <Check size={11} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-green-700">Added to Cart</span>
            </div>
            <div className="flex items-center gap-3">
              {lastAdded.images?.[0] && (
                <img
                  src={normalizeImageUrl(lastAdded.images[0])}
                  alt=""
                  className="w-12 h-12 rounded-lg object-contain bg-white border border-green-100 shrink-0"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-secondary-800 line-clamp-1">{lastAdded.title}</p>
                <p className="text-xs text-secondary-500 mt-0.5">Qty: 1 &middot; {formatCurrency(lastAdded.price)}</p>
              </div>
            </div>
            <p className="text-xs font-semibold text-green-700 mt-2">
              Cart subtotal ({count} item{count !== 1 ? 's' : ''}): {formatCurrency(subtotal)}
            </p>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 space-y-3 text-center">
              <ShoppingCart size={52} className="text-secondary-200" />
              <p className="font-semibold text-secondary-500">Your cart is empty</p>
              <button onClick={close} className="text-sm text-blue-600 hover:underline font-medium">
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item._id} className="flex items-center gap-3 border border-secondary-200 rounded-xl p-3 bg-white">
                <div className="w-16 h-16 shrink-0 bg-secondary-50 rounded-lg overflow-hidden border border-secondary-100">
                  {item.product?.images?.[0] ? (
                    <img
                      src={normalizeImageUrl(item.product.images[0])}
                      alt=""
                      className="w-full h-full object-contain p-1"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingCart size={18} className="text-secondary-300" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-secondary-800 line-clamp-1">
                    {item.product?.title || item.title}
                  </p>
                  <p className="text-sm font-bold text-secondary-900 mt-0.5">
                    {formatCurrency(item.price * item.quantity)}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => changeQty(item, item.quantity - 1)}
                      disabled={loadingId === item._id}
                      className="w-6 h-6 flex items-center justify-center rounded bg-secondary-100 hover:bg-secondary-200 text-secondary-700 transition-colors disabled:opacity-40"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-secondary-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => changeQty(item, item.quantity + 1)}
                      disabled={loadingId === item._id}
                      className="w-6 h-6 flex items-center justify-center rounded bg-secondary-900 hover:bg-secondary-700 text-white transition-colors disabled:opacity-40"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => changeQty(item, 0)}
                  disabled={loadingId === item._id}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-secondary-200 px-5 py-4 space-y-3 shrink-0">
            <button
              onClick={handleClearCart}
              disabled={clearing}
              className="text-red-500 text-sm font-medium hover:underline w-full text-center disabled:opacity-50"
            >
              {clearing ? 'Clearing…' : 'Clear Cart'}
            </button>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-secondary-600">
                <span>Subtotal ({count} item{count !== 1 ? 's' : ''})</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-secondary-400 text-xs">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-secondary-100 pt-2 mt-1">
                <span>Total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            </div>

            <button
              onClick={() => { close(); navigate('/checkout'); }}
              className="w-full bg-primary-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              Proceed to Checkout
            </button>
            <button
              onClick={close}
              className="w-full border border-secondary-200 text-secondary-700 font-semibold py-2.5 rounded-xl hover:bg-secondary-50 transition-colors text-sm"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
