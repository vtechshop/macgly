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
export function useFetch(queryKey, fetcher, { keepPrevious = false } = {}) {
  const keyStr = JSON.stringify(queryKey);
  const cached = getCached(keyStr);
  const [data, setData] = useState(cached);
  const [isLoading, setIsLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const prevRef = useRef(cached);

  useEffect(() => {
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
