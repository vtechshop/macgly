import { useState, useEffect, useRef } from 'react';

const cache = new Map();
const CACHE_TTL = 30_000; // 30 seconds

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

/**
 * Simple data-fetching hook with 30s in-memory cache.
 * Re-runs when queryKey changes. keepPrevious shows stale data while loading.
 */
export function useFetch(queryKey, fetcher, { keepPrevious = false, enabled = true } = {}) {
  const active = enabled && queryKey != null;
  const keyStr = active ? JSON.stringify(queryKey) : null;
  const cached = keyStr ? getCached(keyStr) : null;
  const [data, setData] = useState(cached);
  const [isLoading, setIsLoading] = useState(active && !cached);
  const [error, setError] = useState(null);
  const prevRef = useRef(cached);

  useEffect(() => {
    if (!active || !keyStr) { setIsLoading(false); return; }
    let cancelled = false;
    const hit = getCached(keyStr);
    if (hit) {
      setData(hit);
      prevRef.current = hit;
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    fetcher()
      .then((d) => {
        if (cancelled) return;
        cache.set(keyStr, { data: d, ts: Date.now() });
        prevRef.current = d;
        setData(d);
        setIsLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setIsLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr]);

  return {
    data: data ?? (keepPrevious ? prevRef.current : null),
    isLoading,
    error,
  };
}

export function invalidateCache(keyPrefix) {
  for (const k of cache.keys()) {
    if (k.includes(keyPrefix)) cache.delete(k);
  }
}

// ── SSR helpers ──────────────────────────────────────────────────────────────

/**
 * Pre-populate the cache at build time so renderToString returns real data.
 * Called by entry-server.jsx before each renderRoute invocation.
 */
export function seedCache(key, data) {
  cache.set(JSON.stringify(key), { data, ts: Date.now() });
}

export function clearCacheKey(key) {
  cache.delete(JSON.stringify(key));
}

/**
 * Re-hydrate the in-memory cache on the client from data embedded in the
 * page by SSR (the __SSR_DATA__ script tag).  Call this before mounting
 * React so useFetch returns synchronously and hydrateRoot sees matching
 * content instead of a loading spinner.
 */
export function hydrateCache(seeds) {
  for (const { key, data } of (seeds || [])) {
    const ks = JSON.stringify(key);
    if (!cache.has(ks)) cache.set(ks, { data, ts: Date.now() });
  }
}

/**
 * Simple mutation hook.
 */
export function useAction(fn, { onSuccess, onError } = {}) {
  const [isPending, setIsPending] = useState(false);

  async function mutate(variables) {
    setIsPending(true);
    try {
      const result = await fn(variables);
      onSuccess?.(result);
      return result;
    } catch (err) {
      onError?.(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  }

  return { mutate, isPending };
}
