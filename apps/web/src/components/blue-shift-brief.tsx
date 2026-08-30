"use client";

import Link from "next/link";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import { Panel, PanelHeader, buttonClassName } from "../ui";
import { ContinuousHealthStrip } from "./continuous-health-strip";

const URGENCY_CLASS: Record<string, string> = {
  Clear: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Now: "text-rose-800 bg-rose-50 border-rose-200",
  Soon: "text-amber-800 bg-amber-50 border-amber-200",
  Watch: "text-slate-700 bg-slate-50 border-slate-200"
};

/**
 * P06-18: single morning brief for validated program health.
 * Deep links only — not a SIEM wall or Validation Ops dump.
 * ICP-P1-7: continuous health strip + /continuous deep-link (not Operate peer).
 * ICP 5.0 residual: one primary "Start triage" CTA → Active findings queue.
 */
export function BlueShiftBriefPanel() {
  const brief = useApiResource(() => api.getBlueShiftBrief(), [], {
    refetchIntervalMs: 60_000
  });

  if (brief.error) {
    return (
      <div className="space-y-4">
        <ContinuousHealthStrip />
        <Panel>
          <PanelHeader title="Blue shift" />
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-danger">{brief.error}</p>
            <Link
              href="/findings"
              data-testid="shift-start-triage"
              className={buttonClassName({
                size: "md",
                variant: "primary",
                // P09 mid-market phone: ≥44px touch target
                className: "min-h-11 min-w-[7rem] px-4 py-2.5"
              })}
            >
              Start triage
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  const data = brief.data;
  if (!data) {
    return (
      <div className="space-y-4">
        <ContinuousHealthStrip />
        <Panel>
          <PanelHeader title="Blue shift" />
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">Loading program health…</p>
            <Link
              href="/findings"
              data-testid="shift-start-triage"
              className={buttonClassName({
                size: "md",
                variant: "primary",
                className: "min-h-11 min-w-[7rem] px-4 py-2.5"
              })}
            >
              Start triage
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  // P02: Active finding count from shift-brief buckets when present
  // (new-findings / Active queue href). Omit when the API has no such bucket.
  const activeFindingBucket = data.buckets.find(
    (bucket) =>
      bucket.id === "new-findings" || bucket.href.includes("view=active")
  );
  const activeFindingCount =
    activeFindingBucket != null ? activeFindingBucket.count : null;

  return (
    <div className="space-y-4">
      <ContinuousHealthStrip />
      <Panel>
        <PanelHeader title="Blue shift pack" />
        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-slate-600">{data.programNote}</p>
              <p className="mt-1 text-xs text-slate-500">
                Generated {new Date(data.generatedAt).toLocaleString()} ·{" "}
                <strong>{data.totalActionable}</strong> actionable items
                {activeFindingCount != null ? (
                  <>
                    {" "}
                    ·{" "}
                    <span data-testid="shift-active-finding-count">
                      <strong>{activeFindingCount}</strong> Active finding
                      {activeFindingCount === 1 ? "" : "s"}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <Link
              href="/findings"
              data-testid="shift-start-triage"
              className={buttonClassName({
                size: "md",
                variant: "primary",
                className: "min-h-11 min-w-[7rem] shrink-0 px-4 py-2.5"
              })}
            >
              Start triage
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.buckets.map((bucket) => (
              <li key={bucket.id}>
                <Link
                  href={bucket.href}
                  className={`block rounded-lg border p-3 transition hover:shadow-sm ${URGENCY_CLASS[bucket.urgency] ?? URGENCY_CLASS.Watch}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{bucket.title}</span>
                    <span className="text-lg font-bold tabular-nums">
                      {bucket.count}
                    </span>
                  </div>
                  <p className="mt-1 text-xs opacity-90">{bucket.detail}</p>
                  <p className="mt-2 text-[10px] font-medium uppercase tracking-wide">
                    {bucket.urgency}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      {data.falsePositiveByReason.length > 0 ? (
        <Panel>
          <PanelHeader title="Detection-eng feedback (FP / Suppressed)" />
          <div className="space-y-2 p-4">
            <p className="text-sm text-slate-600">
              Reason codes from disposition notes — tune modules and correlators.
              Not a bi-directional SIEM case close path.
            </p>
            <ul className="flex flex-wrap gap-2">
              {data.falsePositiveByReason.map((row) => (
                <li
                  key={row.reasonCode}
                  className="rounded-control border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                >
                  <span className="font-medium">{row.reasonCode}</span>
                  <span className="ml-1 tabular-nums text-slate-500">
                    ×{row.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
