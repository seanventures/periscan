"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PeriscanApiClientError } from "../lib/periscan-api-client";

export interface ApiResource<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedAt: string | null;
  refetch: () => Promise<void>;
}

export interface ApiResourceOptions {
  refetchIntervalMs?: number;
}

// Replaces the ~12 hand-copied `useEffect(() => { let active = true; ... })`
// load patterns. Handles the load lifecycle (loading vs refreshing vs error),
// race-safe cancellation on unmount, and re-fetch.
export function useApiResource<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
  options: ApiResourceOptions = {}
): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const refetchIntervalMs = options.refetchIntervalMs;

  const stableLoader = useCallback(loader, deps);

  const load = useCallback(
    async (mode: "initial" | "refresh", isActive: () => boolean) => {
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const next = await stableLoader();
        if (isActive()) {
          hasLoadedRef.current = true;
          setData(next);
          setError(null);
          setLastUpdatedAt(new Date().toISOString());
        }
      } catch (caught) {
        if (isActive()) {
          setError(
            caught instanceof PeriscanApiClientError
              ? caught.message
              : caught instanceof Error
                ? caught.message
                : "Unable to load."
          );
        }
      } finally {
        if (isActive()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [stableLoader]
  );

  useEffect(() => {
    let active = true;
    // When loader deps change, refresh in place so filter/query changes do not
    // flash the empty loading skeleton over a still-valid prior page.
    void load(hasLoadedRef.current ? "refresh" : "initial", () => active);
    return () => {
      active = false;
    };
  }, [load]);

  const refetch = useCallback(async () => {
    await load("refresh", () => true);
  }, [load]);

  useEffect(() => {
    if (!refetchIntervalMs || refetchIntervalMs < 1) return;
    let active = true;
    let inFlight = false;
    const refreshWhenVisible = async () => {
      if (
        !active ||
        inFlight ||
        (typeof document !== "undefined" && document.visibilityState !== "visible")
      ) {
        return;
      }
      inFlight = true;
      try {
        await load("refresh", () => active);
      } finally {
        inFlight = false;
      }
    };
    const interval = window.setInterval(() => {
      void refreshWhenVisible();
    }, refetchIntervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshWhenVisible();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [load, refetchIntervalMs]);

  return { data, error, lastUpdatedAt, loading, refetch, refreshing };
}
