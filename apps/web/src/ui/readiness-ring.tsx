import { cn } from "./cn";
import type { StateTone } from "./state-badge";

const RING_COLOR: Record<StateTone, string> = {
  validated: "var(--color-validated)",
  blocked: "var(--color-blocked)",
  missed: "var(--color-missed)",
  approval: "var(--color-approval)",
  fixed: "var(--color-fixed)",
  inconclusive: "var(--color-inconclusive)",
  brand: "var(--color-brand)",
  neutral: "var(--color-muted)"
};

export interface ReadinessRingProps {
  /** 0–100. */
  value: number;
  label?: string;
  size?: number;
  tone?: StateTone;
  className?: string;
}

/**
 * A readiness / coverage ring. Used for CTEM readiness, control coverage, scope
 * verification, etc. Pure SVG (no chart lib) so it renders identically in SSR,
 * jsdom and the browser, and the numeric value is exposed to assistive tech.
 */
export function ReadinessRing({
  value,
  label = "readiness",
  size = 92,
  tone = "brand",
  className
}: ReadinessRingProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={`${label} ${pct}%`}
    >
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={9}
      />
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke={RING_COLOR[tone]}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
      />
      <text
        x={50}
        y={49}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-ink font-mono text-[22px] font-semibold"
      >
        {pct}
      </text>
      <text
        x={50}
        y={66}
        textAnchor="middle"
        className="fill-subtle text-[8px] font-medium uppercase tracking-[0.06em]"
      >
        {label}
      </text>
    </svg>
  );
}
