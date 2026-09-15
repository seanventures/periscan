import type { ReactNode } from "react";

import { cn } from "./cn";
import type { StateTone } from "./state-badge";

const ACCENT: Record<StateTone, string> = {
  validated: "var(--color-validated)",
  blocked: "var(--color-blocked)",
  missed: "var(--color-missed)",
  approval: "var(--color-approval)",
  fixed: "var(--color-fixed)",
  inconclusive: "var(--color-inconclusive)",
  brand: "var(--color-brand)",
  neutral: "var(--color-muted)"
};

export interface ProofMetricCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StateTone;
  /** Optional trend series (oldest → newest). Rendered as a small sparkline. */
  spark?: number[];
  href?: string;
  className?: string;
}

/**
 * A single command-center metric: a big tabular number with a semantic accent
 * rail and an optional sparkline. Summary-before-detail — the number reads first,
 * the trend second.
 */
export function ProofMetricCard({
  label,
  value,
  sub,
  tone = "neutral",
  spark,
  href,
  className
}: ProofMetricCardProps) {
  const accent = ACCENT[tone];
  const body = (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border border-line bg-[#0a1226] p-4",
        href && "transition-colors hover:border-line-strong",
        className
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: accent }}
      />
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
        {label}
      </p>
      <p
        className="mt-2 text-3xl font-semibold tracking-tight tabular-nums"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
      {spark && spark.length > 1 ? (
        <Sparkline points={spark} color={accent} className="mt-3" />
      ) : null}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {body}
      </a>
    );
  }
  return body;
}

export function Sparkline({
  points,
  color,
  className
}: {
  points: number[];
  color: string;
  className?: string;
}) {
  const w = 120;
  const h = 26;
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = h - 3 - ((p - min) / span) * (h - 6);
    return [x, y] as const;
  });
  const d = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1] ?? [w, h / 2];
  const [lastX, lastY] = last;
  return (
    <svg
      className={cn("block w-full", className)}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="presentation"
    >
      <polyline points={d} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={lastX} cy={lastY} r={2.4} fill={color} />
    </svg>
  );
}
