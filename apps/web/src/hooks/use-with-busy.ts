"use client";

import { useCallback, useState } from "react";

import { PeriscanApiClientError } from "../lib/periscan-api-client";

export interface UseWithBusy {
  busy: boolean;
  error: string | null;
  clearError: () => void;
  // Runs an async task with busy + error handling. Returns true on success.
  run: (
    task: () => Promise<void>,
    fallbackMessage?: string
  ) => Promise<boolean>;
}

// Replaces the ~12 hand-copied `withBusy` closures across the workbenches.
// Centralizes busy state, error capture, and message extraction.
export function useWithBusy(): UseWithBusy {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(
    async (
      task: () => Promise<void>,
      fallbackMessage = "Request failed."
    ): Promise<boolean> => {
      setError(null);
      setBusy(true);
      try {
        await task();
        return true;
      } catch (caught) {
        setError(
          caught instanceof PeriscanApiClientError
            ? caught.message
            : caught instanceof Error
              ? caught.message
              : fallbackMessage
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return { busy, clearError, error, run };
}
