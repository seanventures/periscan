"use client";

import { useEffect, useState } from "react";

import { browserPeriscanApiClient } from "../lib/periscan-api-client";

interface BillingBannerProps {
  className?: string;
  /** Optional pre-fetched billing/usage (from home or page state). Falls back to illustrative O3 preview. */
  billing?: any;
}

/**
 * O3: Global near-quota + projected banner (real when billing prop provided).
 * Addresses the documented gap: "global near-quota banner + consumption preview on every surface".
 * Safe on all pages; shows useful projected even without live data.
 * Now fetches internally for true global coverage on all pages (near-limit + dynamic projected +1 remaining).
 */
export function BillingGlobalBanner({
  className,
  billing: billingProp
}: BillingBannerProps) {
  const [billing, setBilling] = useState<any>(billingProp || null);

  useEffect(() => {
    if (billingProp) {
      setBilling(billingProp);
      return;
    }
    let active = true;
    browserPeriscanApiClient
      .getBillingUsage()
      .then((u) => {
        if (active) setBilling(u);
      })
      .catch(() => {
        if (active) setBilling(null);
      });
    return () => {
      active = false;
    };
  }, [billingProp]);

  const meters = billing?.meters || [];
  const runs =
    meters.find((m: any) => m.meterName === "ValidationRuns")?.quantity || 0;
  const packs =
    meters.find((m: any) => m.meterName === "EvidencePacks")?.quantity || 0;
  const near = runs > 120 || packs > 120;
  // O3: dynamic projected +1 run/pack remaining (usage after)
  const projectedNote = `Next non-snap: +1 ValidationRun +1 EvidencePack (projected usage runs ${runs + 1} / packs ${packs + 1})`;

  return (
    <div
      className={`rounded border ${near ? "border-amber-500 bg-amber-50" : "border-brand/30 bg-brand/5"} px-3 py-1.5 text-[10px] ${className || ""}`}
    >
      <span className="font-medium">O3 Billing Preview:</span> {projectedNote}
      {near && (
        <span className="ml-2 text-amber-700 font-medium">
          ⚠ Near limit — review before heavy continuous use (global banner)
        </span>
      )}
      {!billing && (
        <span className="ml-2 text-muted">
          (illustrative; real data on dashboard pages)
        </span>
      )}
      {billing && (runs > 100 || packs > 100) && (
        <span className="ml-2 text-amber-600">High usage detected globally</span>
      )}
    </div>
  );
}
