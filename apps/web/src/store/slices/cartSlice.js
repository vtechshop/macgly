import { createSlice } from '@reduxjs/toolkit';

function recalc(state) {
  state.count = state.items.reduce((s, i) => s + i.quantity, 0);
  state.total = state.items.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0);
}

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    total: 0,
    count: 0,
    drawerOpen: false,
    lastAdded: null,
  },
  reducers: {
    setCart(state, { payload }) {
      state.items = payload.items || [];
      state.total = payload.total || 0;
      state.count = state.items.reduce((sum, i) => sum + i.quantity, 0);
    },
    clearCart(state) {
      state.items = [];
      state.total = 0;
      state.count = 0;
    },
    openCartDrawer(state, { payload }) {
      state.drawerOpen = true;
      state.lastAdded = payload || null;
    },
    closeCartDrawer(state) {
      state.drawerOpen = false;
      state.lastAdded = null;
    },

    // Optimistic: instantly add/update before server responds
    addItemOptimistic(state, { payload: { product, quantity = 1 } }) {
      const existing = state.items.find(
        (i) => (i.product?._id ?? i.product) === product._id
      );
      if (existing) {
        existing.quantity += quantity;
      } else {
        state.items.push({
          _id: `opt-${product._id}`,
          product: {
            _id: product._id,
            title: product.title,
            price: product.price,
            images: product.images,
            slug: product.slug,
          },
          quantity,
        });
      }
      recalc(state);
    },
    updateItemOptimistic(state, { payload: { itemId, newQty } }) {
      if (newQty < 1) {
        state.items = state.items.filter((i) => i._id !== itemId);
      } else {
        const item = state.items.find((i) => i._id === itemId);
        if (item) item.quantity = newQty;
      }
      recalc(state);
    },
  },
});

export const {
  setCart, clearCart,
  openCartDrawer, closeCartDrawer,
  addItemOptimistic, updateItemOptimistic,
} = cartSlice.actions;
export default cartSlice.reducer;
