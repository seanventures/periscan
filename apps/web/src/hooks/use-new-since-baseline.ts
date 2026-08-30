"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Track IDs that appeared after the operator's baseline visit (first successful
 * load). Polling remains non-streaming; this only surfaces a delta chip so
 * mid-shift arrivals are not silent (P18-19).
 */
export function useNewSinceBaseline(ids: readonly string[]): {
  newCount: number;
  baselineAt: string | null;
  acknowledge: () => void;
} {
  const baselineRef = useRef<Set<string> | null>(null);
  const [baselineAt, setBaselineAt] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    if (ids.length === 0 && baselineRef.current === null) {
      return;
    }
    if (baselineRef.current === null) {
      baselineRef.current = new Set(ids);
      setBaselineAt(new Date().toISOString());
      setNewCount(0);
      return;
    }
    let count = 0;
    for (const id of ids) {
      if (!baselineRef.current.has(id)) count += 1;
    }
    setNewCount(count);
  }, [ids]);

  function acknowledge() {
    baselineRef.current = new Set(ids);
    setBaselineAt(new Date().toISOString());
    setNewCount(0);
  }

  return { newCount, baselineAt, acknowledge };
}
