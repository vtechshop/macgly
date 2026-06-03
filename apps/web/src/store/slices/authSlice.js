import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

function loadCached() {
  try {
    const s = localStorage.getItem('macgly_user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveCache(user) {
  try { localStorage.setItem('macgly_user', JSON.stringify(user)); } catch {}
}

function clearCache() {
  try { localStorage.removeItem('macgly_user'); } catch {}
}

// ─── Async thunks ─────────────────────────────────────────────────────────────

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/login', credentials);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error?.message || 'Login failed');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/register', payload);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error?.message || 'Registration failed');
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await api.post('/auth/logout').catch(() => {});
});

export const refreshUser = createAsyncThunk(
  'auth/refreshUser',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/auth/me');
      return data.user;
    } catch (err) {
      return rejectWithValue(null);
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const cachedUser = loadCached();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:          cachedUser,
    isInitialized: !!cachedUser,
    loading:       false,
    error:         null,
  },
  reducers: {
    // Used by App.jsx AuthInit on /auth/me success
    setUser(state, { payload }) {
      state.user          = payload;
      state.isInitialized = true;
      state.error         = null;
      saveCache(payload);
    },
    // Used by App.jsx AuthInit on /auth/me failure + api.js 401 interceptor
    clearUser(state) {
      state.user          = null;
      state.isInitialized = true;
      clearCache();
    },
    setInitialized(state) {
      state.isInitialized = true;
    },
    // Merge partial profile updates (e.g. after profile save)
    updateUserProfile(state, { payload }) {
      if (state.user) {
        state.user = { ...state.user, ...payload };
        saveCache(state.user);
      }
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(login.pending,   (state)          => { state.loading = true;  state.error = null; })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user    = payload;
        state.isInitialized = true;
        saveCache(payload);
      })
      .addCase(login.rejected,  (state, { payload }) => { state.loading = false; state.error = payload; })

      // register
      .addCase(register.pending,   (state)          => { state.loading = true;  state.error = null; })
      .addCase(register.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user    = payload;
        state.isInitialized = true;
        saveCache(payload);
      })
      .addCase(register.rejected,  (state, { payload }) => { state.loading = false; state.error = payload; })

      // logout
      .addCase(logout.fulfilled, (state) => {
        state.user    = null;
        state.loading = false;
        clearCache();
      })

      // refreshUser
      .addCase(refreshUser.fulfilled, (state, { payload }) => {
        state.user          = payload;
        state.isInitialized = true;
        saveCache(payload);
      });
  },
});

export const { setUser, clearUser, setInitialized, updateUserProfile, clearError } = authSlice.actions;
export default authSlice.reducer;
