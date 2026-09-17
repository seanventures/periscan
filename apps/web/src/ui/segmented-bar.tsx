"use client";

import { useEffect, useState } from "react";

import { cn } from "./cn";
import type { StateTone } from "./state-badge";

export interface SegmentedBarSegment {
  label: string;
  value: number;
  tone: StateTone;
}

const TONE_VAR: Record<StateTone, string> = {
  validated: "var(--color-validated)",
  blocked: "var(--color-blocked)",
  missed: "var(--color-missed)",
  approval: "var(--color-approval)",
  fixed: "var(--color-fixed)",
  inconclusive: "var(--color-inconclusive)",
  brand: "var(--color-brand)",
  neutral: "var(--color-muted)"
};

/**
 * A single proportional bar split into semantic segments — used for funnels like
 * remediation velocity. Segments animate up on mount (respecting
 * prefers-reduced-motion), sit on a 2px surface gap, and expose their counts in a
 * legend so identity/quantity are never color-alone.
 */
export function SegmentedBar({
  segments,
  ariaLabel,
  height = 14,
  className
}: {
  segments: SegmentedBarSegment[];
  ariaLabel: string;
  height?: number;
  className?: string;
}) {
  const [on, setOn] = useState(false);
  const [reduce, setReduce] = useState(true);

  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    setReduce(!!m?.matches);
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className="flex w-full overflow-hidden rounded-control bg-surface-strong"
        style={{ height, gap: 2 }}
        role="img"
        aria-label={`${ariaLabel}: ${segments
          .map((s) => `${s.label} ${s.value}`)
          .join(", ")}`}
      >
        {segments.map((seg) =>
          seg.value > 0 ? (
            <span
              key={seg.label}
              title={`${seg.label}: ${seg.value}`}
              className="h-full first:rounded-l-control last:rounded-r-control"
              style={{
                width: `${on ? (seg.value / total) * 100 : 0}%`,
                background: TONE_VAR[seg.tone],
                transition: reduce ? undefined : "width 700ms cubic-bezier(.22,1,.36,1)"
              }}
            />
          ) : null
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-1.5 text-[11.5px]">
            <span
              aria-hidden
              className="size-2 rounded-[3px]"
              style={{ background: TONE_VAR[seg.tone] }}
            />
            <span className="text-muted">{seg.label}</span>
            <span className="font-mono tabular-nums text-ink">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
