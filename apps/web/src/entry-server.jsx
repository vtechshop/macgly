/**
 * Build-time SSR entry point.
 *
 * Built by:   vite build --ssr src/entry-server.jsx --outDir dist-ssr
 * Called by:  apps/web/scripts/prerender.mjs
 *
 * renderRoute(url, seeds) pre-populates the useFetch in-memory cache with
 * data fetched at build time, then runs renderToString so each component
 * sees real data synchronously (no loading state, no network calls).
 * After rendering the cache keys are cleared so they don't bleed between
 * sequential route renders.
 *
 * BlogPost is intentionally excluded — DOMPurify requires a live DOM and
 * would crash in Node.js.  Blog routes use the meta-tag-injection fallback.
 */

// Must be first: set up browser-API stubs before React and component
// modules initialise (Rollup executes side-effect imports in order).
import './ssr-polyfills.js';

import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';

import { makeStore } from './store/index.js';
import { seedCache, clearCacheKey } from './hooks/index.js';

// Direct (non-lazy) imports — lazy() + Suspense produce the fallback
// spinner in renderToString because dynamic imports don't resolve synchronously.
import Home from './assets/pages/Home.jsx';
import Product from './assets/pages/Product.jsx';
import Category from './assets/pages/Category.jsx';
import VendorStore from './assets/pages/VendorStore.jsx';
import GuidePage from './assets/pages/GuidePage.jsx';
import Shipping from './assets/pages/info/Shipping.jsx';
import Returns from './assets/pages/info/Returns.jsx';
import PublicLayout from './assets/components/layout/PublicLayout.jsx';

// Re-export JSON-LD helpers so prerender.mjs can generate head JSON-LD
// from the same single source of truth.
export { productJsonLd, breadcrumbJsonLd, faqJsonLd, guideJsonLd } from './utils/seo.js';
export { GUIDES, getGuide } from './data/guides.js';

function SSRApp({ url }) {
  return (
    <StaticRouter location={url}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/category/:slug" element={<Category />} />
          <Route path="/store/:id" element={<VendorStore />} />
          <Route path="/guides/:slug" element={<GuidePage />} />
          <Route path="/info/shipping" element={<Shipping />} />
          <Route path="/info/returns" element={<Returns />} />
        </Route>
      </Routes>
    </StaticRouter>
  );
}

/**
 * Render a route to an HTML string.
 *
 * @param {string} url      - The full pathname, e.g. "/product/my-drill"
 * @param {Array}  seeds    - [{ key: any[], data: any }, ...] — pre-fetched data
 * @returns {string}        - Server-rendered HTML body
 */
export function renderRoute(url, seeds = []) {
  for (const { key, data } of seeds) seedCache(key, data);
  const store = makeStore();
  try {
    return renderToString(
      <Provider store={store}>
        <SSRApp url={url} />
      </Provider>
    );
  } finally {
    // Always clear, even on error, so sequential renders don't share state.
    for (const { key } of seeds) clearCacheKey(key);
  }
}
