"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Non-overlapping polling: the next request is scheduled only after the previous one settles.
 * Each effect run owns its own cancellation flag and AbortController, so a response that belongs
 * to an old filter (or arrives after unmount) can never overwrite newer state.
 * On failure the last successful snapshot is kept and `error` marks it as stale.
 */
export function usePoll<T>(load: (signal: AbortSignal) => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    const run = async () => {
      controller = new AbortController();
      try {
        const next = await load(controller.signal);
        if (cancelled) return;
        setData(next);
        setError(null);
        setLastSuccess(new Date());
      } catch (reason) {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Refresh failed");
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(run, intervalMs);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [load, intervalMs, revision]);

  return { data, error, loading, lastSuccess, refresh };
}
