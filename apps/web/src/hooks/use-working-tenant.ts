"use client";

import { useCallback, useEffect, useState } from "react";

import {
  WORKING_TENANT_CHANGE_EVENT,
  clearWorkingTenant,
  readWorkingTenant,
  setWorkingTenant,
  type WorkingTenantContext
} from "../lib/working-tenant";

/**
 * Reactive working-tenant context for shell chrome and portfolio open actions.
 */
export function useWorkingTenant() {
  const [working, setWorking] = useState<WorkingTenantContext | null>(() =>
    typeof window === "undefined" ? null : readWorkingTenant()
  );

  useEffect(() => {
    setWorking(readWorkingTenant());
    function onChange() {
      setWorking(readWorkingTenant());
    }
    window.addEventListener(WORKING_TENANT_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(WORKING_TENANT_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const enter = useCallback((ctx: WorkingTenantContext) => {
    setWorkingTenant(ctx);
    setWorking(readWorkingTenant());
  }, []);

  const leave = useCallback(() => {
    clearWorkingTenant();
    setWorking(null);
  }, []);

  return { working, enter, leave };
}
