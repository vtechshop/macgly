import toast from 'react-hot-toast';
import api from './api';
import store from '../store';
import { setCart } from '../store/slices/cartSlice';

// Quantity buttons update the store optimistically, then call syncCartItem().
// Changes are sent one at a time, each carrying the item's latest quantity, and
// the server cart is only written back to the store once nothing is pending.
// Sending a request per click let responses arrive out of order (the count
// jumped backwards) and a + pressed before the first add finished POSTed again,
// which the server adds to the existing quantity (1 + 2 = 3).

const pending = new Set();
let running = false;

const keyOf = (productId, variantId) => `${productId}:${variantId || ''}`;
const itemKey = (i) => keyOf(i.product?._id ?? i.product, i.variantId);
const isServerId = (id) => id && !String(id).startsWith('opt-');

export function syncCartItem(productId, variantId) {
  pending.add(keyOf(productId, variantId));
  if (!running) run();
}

async function run() {
  running = true;
  let serverCart = null;
  try {
    await new Promise((r) => setTimeout(r, 250)); // coalesce rapid clicks
    while (pending.size) {
      const key = pending.values().next().value;
      pending.delete(key);
      const [productId, variantId] = key.split(':');

      const local = store.getState().cart.items.find((i) => itemKey(i) === key);
      const desired = local?.quantity || 0;
      const known = (serverCart?.items || store.getState().cart.items)
        .find((i) => itemKey(i) === key && isServerId(i._id));

      let res;
      if (known && desired < 1) res = await api.delete(`/cart/items/${known._id}`);
      else if (known) res = await api.put(`/cart/items/${known._id}`, { quantity: desired });
      else if (desired >= 1) res = await api.post('/cart/items', { productId, variantId: variantId || undefined, quantity: desired });
      if (res) serverCart = res.data.cart;
    }
    if (serverCart) store.dispatch(setCart(serverCart));
  } catch (err) {
    pending.clear();
    toast.error(err.response?.data?.error?.message || 'Could not update cart');
    try {
      const { data } = await api.get('/cart');
      if (data.cart) store.dispatch(setCart(data.cart));
    } catch { /* keep the optimistic state */ }
  } finally {
    running = false;
    if (pending.size) run();
  }
}
