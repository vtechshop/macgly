import { createSlice } from '@reduxjs/toolkit';

function loadCached() {
  try {
    const s = localStorage.getItem('macgly_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

const cachedUser = loadCached();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: cachedUser,
    isInitialized: !!cachedUser,
  },
  reducers: {
    setUser(state, { payload }) {
      state.user = payload;
      state.isInitialized = true;
      try { localStorage.setItem('macgly_user', JSON.stringify(payload)); } catch {}
    },
    clearUser(state) {
      state.user = null;
      state.isInitialized = true;
      try { localStorage.removeItem('macgly_user'); } catch {}
    },
    setInitialized(state) {
      state.isInitialized = true;
    },
  },
});

export const { setUser, clearUser, setInitialized } = authSlice.actions;
export default authSlice.reducer;
