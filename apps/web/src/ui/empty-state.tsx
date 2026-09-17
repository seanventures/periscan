import type { ReactNode } from "react";

import { cn } from "./cn";

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * True empty list — never configured / no rows yet.
 * Distinct from NotConfigured ("no signal yet" setup nudge) and FilterEmpty
 * (filters hide every row).
 */
export function EmptyState({
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line px-6 py-10 text-center",
        className
      )}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Filters / views hid every row. Lighter than EmptyState so operators know
 * data may exist under a different view — not a first-run setup gap.
 */
export function FilterEmpty({
  title = "No matches for this view",
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn("px-4 py-8 text-center", className)}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
