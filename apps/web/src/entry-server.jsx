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

import React, { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import { Toaster } from 'react-hot-toast';
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
import Shipping from './assets/pages/info/Shipping.jsx';
import Returns from './assets/pages/info/Returns.jsx';
import Search from './assets/pages/Search.jsx';
import AllCategories from './assets/pages/AllCategories.jsx';
import Blog from './assets/pages/Blog.jsx';
import TrackOrder from './assets/pages/TrackOrder.jsx';
import WarrantyCheck from './assets/pages/WarrantyCheck.jsx';
import VendorRegister from './assets/pages/VendorRegister.jsx';
import AffiliateRegister from './assets/pages/AffiliateRegister.jsx';
import About from './assets/pages/info/About.jsx';
import Contact from './assets/pages/info/Contact.jsx';
import Faq from './assets/pages/info/Faq.jsx';
import BuyerGuide from './assets/pages/info/BuyerGuide.jsx';
import SellerGuide from './assets/pages/info/SellerGuide.jsx';
import Privacy from './assets/pages/info/Privacy.jsx';
import Terms from './assets/pages/info/Terms.jsx';
import PublicLayout from './assets/components/layout/PublicLayout.jsx';

// Re-export JSON-LD helpers so prerender.mjs can generate head JSON-LD
// from the same single source of truth.
export { productJsonLd, breadcrumbJsonLd } from './utils/seo.js';

// The element tree must mirror main.jsx + App.jsx exactly (Suspense boundary
// around Routes, Toaster after the app). Any structural difference makes
// hydrateRoot throw away the prerendered DOM and re-render behind a spinner.
function SSRApp({ url }) {
  return (
    <StaticRouter location={url}>
      <Suspense fallback={null}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/category/:slug" element={<Category />} />
          <Route path="/store/:id" element={<VendorStore />} />
          <Route path="/info/shipping" element={<Shipping />} />
          <Route path="/info/returns" element={<Returns />} />
          <Route path="/products" element={<Search />} />
          <Route path="/categories" element={<AllCategories />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/track-order" element={<TrackOrder />} />
          <Route path="/warranty-check" element={<WarrantyCheck />} />
          <Route path="/sell" element={<VendorRegister />} />
          <Route path="/affiliate" element={<AffiliateRegister />} />
          <Route path="/info/about" element={<About />} />
          <Route path="/info/contact" element={<Contact />} />
          <Route path="/info/faq" element={<Faq />} />
          <Route path="/info/buyer-guide" element={<BuyerGuide />} />
          <Route path="/info/seller-guide" element={<SellerGuide />} />
          <Route path="/info/privacy" element={<Privacy />} />
          <Route path="/info/terms" element={<Terms />} />
        </Route>
      </Routes>
      </Suspense>
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
        <Toaster position="top-right" />
      </Provider>
    );
  } finally {
    // Always clear, even on error, so sequential renders don't share state.
    for (const { key } of seeds) clearCacheKey(key);
  }
}
