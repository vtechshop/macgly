import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isInitialized: false,
  },
  reducers: {
    setUser(state, { payload }) {
      state.user = payload;
      state.isInitialized = true;
    },
    clearUser(state) {
      state.user = null;
      state.isInitialized = true;
    },
    setInitialized(state) {
      state.isInitialized = true;
    },
  },
});

export const { setUser, clearUser, setInitialized } = authSlice.actions;
export default authSlice.reducer;
