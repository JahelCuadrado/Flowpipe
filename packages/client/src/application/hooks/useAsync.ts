import { useState, useEffect, useCallback, useRef } from "react";

interface AsyncState<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
}

interface UseAsyncResult<T> extends AsyncState<T> {
  refetch: () => void;
}

/**
 * Generic async data fetcher hook with loading/error state management.
 * Handles race conditions, cleanup, and auto-refetch when deps change.
 */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[] = []
): UseAsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const execute = useCallback(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetcherRef.current()
      .then((data) => {
        if (!cancelled) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "An error occurred";
          setState({ data: null, error: message, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const cleanup = execute();
    return cleanup;
  }, [execute]);

  const refetch = useCallback(() => {
    execute();
  }, [execute]);

  return { ...state, refetch };
}
