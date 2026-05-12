import { useState, useEffect, useRef } from 'react';

/**
 * Simple data-fetching hook. Re-runs when queryKey changes.
 * keepPrevious: show stale data while new data loads (avoids empty flash).
 */
export function useFetch(queryKey, fetcher, { keepPrevious = false } = {}) {
  const keyStr = JSON.stringify(queryKey);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const prevRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetcher()
      .then((d) => {
        if (cancelled) return;
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

/**
 * Simple mutation hook.
 * Returns { mutate, isPending }.
 * mutate() returns the result so callers can await it.
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
