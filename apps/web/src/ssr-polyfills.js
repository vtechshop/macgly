/**
 * Minimal browser-API stubs for the Node.js SSR build.
 *
 * React's renderToString does NOT run useEffect callbacks, so the vast
 * majority of window/document access (event listeners, localStorage,
 * IntersectionObserver) is safe without stubs.  These stubs exist only for
 * the rare case where a module accesses a global at import time or at
 * synchronous render time rather than inside an effect.
 *
 * This file must be the FIRST import in entry-server.jsx.  Rollup/Vite
 * executes side-effect imports in order, so these globals are in place
 * before React and component modules initialise.
 */

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: {
      href: 'https://www.macgly.com',
      origin: 'https://www.macgly.com',
      pathname: '/',
      search: '',
    },
    history: { replaceState: () => {} },
    scrollTo: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    open: () => null,
  };
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    createElement: (tag) => ({
      tagName: (tag || '').toUpperCase(),
      style: {},
      appendChild: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
    }),
    createElementNS: () => ({
      style: {},
      appendChild: () => {},
      setAttribute: () => {},
    }),
    body: { appendChild: () => {}, removeChild: () => {} },
    head: { appendChild: () => {} },
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = {
    clipboard: { writeText: () => Promise.resolve() },
    userAgent: '',
  };
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.MutationObserver === 'undefined') {
  globalThis.MutationObserver = class {
    constructor() {}
    observe() {}
    disconnect() {}
  };
}
