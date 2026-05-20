import axios from 'axios';

// In production: always use /api (Vercel proxy → Render). No CORS needed.
// In dev: use VITE_API_URL or localhost.
const BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
  : '/api';

const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
});

let csrfToken = null;
let refreshPromise = null;

async function fetchCsrfToken() {
  const { data } = await axios.get(`${BASE}/csrf-token`, { withCredentials: true });
  csrfToken = data.csrfToken;
}

api.interceptors.request.use(async (config) => {
  const mutating = ['post', 'put', 'patch', 'delete'];
  if (mutating.includes(config.method)) {
    if (!csrfToken) await fetchCsrfToken();
    config.headers['x-csrf-token'] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const is401 = error.response?.status === 401;
    const isAuthUrl = ['/auth/login', '/auth/register', '/auth/refresh'].some(p => original?.url?.includes(p));

    if (is401 && !isAuthUrl && !original._retry) {
      original._retry = true;
      try {
        // Deduplicate concurrent refresh calls — only one token rotation at a time
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${BASE}/auth/refresh`, {}, { withCredentials: true })
            .finally(() => { refreshPromise = null; });
        }
        await refreshPromise;
        csrfToken = null;
        return api(original);
      } catch {
        // let the caller handle it — AuthInit will clearUser(), router redirects
      }
    }
    return Promise.reject(error);
  }
);

export default api;
