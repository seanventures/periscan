"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

import type { SupportedLocale } from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";

const ProductLocaleContext = createContext<SupportedLocale>("en-US");

export function ProductLocalizationProvider({
  children
}: {
  children: ReactNode;
}) {
  const localization = useApiResource(() => api.getTenantLocalization(), []);
  const locale = localization.data?.preferredLocale ?? "en-US";

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const refresh = () => void localization.refetch();
    window.addEventListener("periscan:localization-updated", refresh);
    return () =>
      window.removeEventListener("periscan:localization-updated", refresh);
  }, [localization.refetch]);

  return (
    <ProductLocaleContext.Provider value={locale}>
      {children}
    </ProductLocaleContext.Provider>
  );
}

export function useProductLocale() {
  return useContext(ProductLocaleContext);
}
