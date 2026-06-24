import { createSlice } from '@reduxjs/toolkit';

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: { ids: [] },
  reducers: {
    setWishlistIds(state, { payload }) {
      state.ids = payload;
    },
    addWishlistId(state, { payload }) {
      if (!state.ids.includes(payload)) state.ids.push(payload);
    },
    removeWishlistId(state, { payload }) {
      state.ids = state.ids.filter((id) => id !== payload);
    },
  },
});

export const { setWishlistIds, addWishlistId, removeWishlistId } = wishlistSlice.actions;
export default wishlistSlice.reducer;
