import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "brand";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-strong text-muted",
  success: "border-success/35 bg-success/8 text-success",
  warning: "border-warning/35 bg-warning/8 text-warning",
  danger: "border-danger/35 bg-danger/8 text-danger",
  info: "border-info/35 bg-info/8 text-info",
  brand: "border-brand/35 bg-brand/8 text-brand"
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-control border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.04em]",
        TONE_CLASSES[tone],
        className
      )}
      {...rest}
    />
  );
}
