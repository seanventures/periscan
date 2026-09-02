import { cn } from "./cn";

export interface DegradedBannerProps {
  /** Human-readable names of rails/resources that failed to load. */
  rails: string[];
  /** Optional retry handler shown as a button. */
  onRetry?: () => void;
  /** Optional last-updated ISO timestamp for partial success honesty. */
  lastUpdatedAt?: string | null;
  className?: string;
  /**
   * Extra context — e.g. "Empty Priority paths is degraded, not proof that
   * nothing needs you."
   */
  detail?: string;
}

/**
 * Standard partial-load honesty banner (P07-22).
 * Multi-fetch boards must never paint empty as calm success when supporting
 * rails failed. Prefer this over silent `.catch(() => [])`.
 */
export function DegradedBanner({
  rails,
  onRetry,
  lastUpdatedAt,
  className,
  detail
}: DegradedBannerProps) {
  if (rails.length === 0) return null;

  const lastUpdated =
    lastUpdatedAt && !Number.isNaN(new Date(lastUpdatedAt).getTime())
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(new Date(lastUpdatedAt))
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="degraded-banner"
      className={cn(
        "rounded-control border border-approval/40 bg-approval/10 px-4 py-3 text-sm text-ink",
        className
      )}
    >
      <p className="font-medium">Partial load — some data unavailable</p>
      <p className="mt-1 text-muted">
        {rails.join(", ")} could not be loaded. Empty sections below may be
        degraded, not proof that nothing needs attention.
        {detail ? ` ${detail}` : ""}
        {lastUpdated ? ` Last successful update: ${lastUpdated}.` : ""}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 font-semibold text-brand hover:text-brand-2"
        >
          Retry failed loads
        </button>
      ) : null}
    </div>
  );
}
