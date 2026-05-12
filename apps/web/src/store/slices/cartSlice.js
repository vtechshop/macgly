import { createSlice } from '@reduxjs/toolkit';

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
  },
});

export const { setCart, clearCart, openCartDrawer, closeCartDrawer } = cartSlice.actions;
export default cartSlice.reducer;
