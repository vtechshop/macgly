import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import store from './store';
import App from './App';
import { hydrateCache } from './hooks';
import './index.css';

// When this page was prerendered at build time the SSR script embeds the
// fetched data in a <script id="__SSR_DATA__"> tag.  Pre-seeding the
// useFetch cache here means the first client render sees the same data
// as the server render, so hydrateRoot finds no content mismatch.
const ssrDataEl = document.getElementById('__SSR_DATA__');
if (ssrDataEl) {
  try { hydrateCache(JSON.parse(ssrDataEl.textContent)); } catch {}
}

const loader = document.getElementById('initial-loader');
if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 200); }

const container = document.getElementById('root');
const appTree = (
  <React.StrictMode>
    <Provider store={store}>
      <App />
      <Toaster position="top-right" />
    </Provider>
  </React.StrictMode>
);

// data-ssr="1" is stamped onto #root by prerender.mjs for SSR'd pages.
// hydrateRoot reuses the existing server-rendered DOM; createRoot replaces it.
if (container.dataset.ssr === '1') {
  hydrateRoot(container, appTree);
} else {
  createRoot(container).render(appTree);
}
