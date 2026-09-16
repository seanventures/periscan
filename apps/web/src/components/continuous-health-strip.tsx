"use client";

import Link from "next/link";
import { useMemo } from "react";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import { StateBadge, buttonClassName } from "../ui";

/**
 * ICP-P1-7: compact continuous-program health for Shift / Schedules headers.
 * Deep-links to /continuous — keeps Operate rail lean (no /continuous peer).
 */
export function ContinuousHealthStrip({
  className = ""
}: {
  className?: string;
}) {
  const schedules = useApiResource(
    async () => (await api.listSchedules()).items,
    []
  );

  const summary = useMemo(() => {
    const items = schedules.data ?? [];
    const active = items.filter((s) => s.status === "Active").length;
    const paused = items.filter((s) => s.status === "Paused").length;
    return { total: items.length, active, paused };
  }, [schedules.data]);

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-control border border-line bg-elevated/40 px-3 py-2 text-sm ${className}`}
      data-testid="continuous-health-strip"
      aria-label="Continuous validation health"
    >
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
        Continuous
      </span>
      {schedules.loading ? (
        <span className="text-xs text-subtle">Loading schedules…</span>
      ) : schedules.error ? (
        <span className="text-xs text-missed">Health unavailable</span>
      ) : summary.total === 0 ? (
        <span className="text-xs text-muted">No schedules yet</span>
      ) : (
        <>
          <StateBadge tone="fixed" dot={false}>
            {summary.active} active
          </StateBadge>
          {summary.paused > 0 ? (
            <StateBadge tone="approval" dot={false}>
              {summary.paused} paused
            </StateBadge>
          ) : null}
          <span className="font-mono text-[11px] text-subtle">
            {summary.total} total
          </span>
        </>
      )}
      <Link
        href="/continuous"
        className={
          buttonClassName({ size: "sm", variant: "secondary" }) + " ml-auto"
        }
      >
        Continuous hub →
      </Link>
    </div>
  );
}
