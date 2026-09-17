import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "./cn";

/**
 * Loading placeholder. `rows` shimmer bars sized to hint the real content.
 * Companion live status for screen readers (P16-13); bars stay decorative.
 * `prefers-reduced-motion` disables the pulse.
 * `variant="rows"` uses list-height placeholders so workbench queues (findings)
 * do not jump from thin bars to full rows (UX-W7 / #49).
 */
export function LoadingSkeleton({
  rows = 3,
  className,
  label = "Loading…",
  variant = "bars"
}: {
  rows?: number;
  className?: string;
  /** Accessible status text (not visually shown when bars convey loading). */
  label?: string;
  /** `bars` = thin shimmer lines; `rows` = compact list-row height. */
  variant?: "bars" | "rows";
}) {
  return (
    <div
      className={cn(
        variant === "rows"
          ? "ps-table ps-table--compact"
          : "flex flex-col gap-2 p-4",
        className
      )}
      data-testid="loading-skeleton"
      data-skeleton-variant={variant}
      data-skeleton-rows={rows}
    >
      <p className="sr-only" role="status" aria-live="polite" aria-busy="true">
        {label}
      </p>
      <div
        aria-hidden
        className={
          variant === "rows" ? "flex flex-col" : "flex flex-col gap-2"
        }
      >
        {Array.from({ length: rows }).map((_, i) =>
          variant === "rows" ? (
            <div key={i} className="ps-table__row gap-3">
              <div className="h-3.5 w-3.5 shrink-0 rounded-sm bg-surface-strong motion-safe:animate-pulse" />
              <div
                className="h-3.5 rounded-control bg-surface-strong motion-safe:animate-pulse"
                style={{ width: `${78 - (i % 4) * 10}%` }}
              />
            </div>
          ) : (
            <div
              key={i}
              className="h-3 rounded-control bg-surface-strong motion-safe:animate-pulse"
              style={{ width: `${88 - (i % 3) * 16}%` }}
            />
          )
        )}
      </div>
    </div>
  );
}

/**
 * Error state — says what failed and offers a retry. No apologies, no vagueness.
 */
/**
 * Inline, dismissible feedback for an ACTION (a write that succeeded or failed) —
 * distinct from ErrorState, which is for a failed initial load. Use it right next
 * to the control the user pressed so a failed redact/revoke/kill is never silent.
 * `role=alert` (error) / `role=status` (success) so screen readers announce it.
 */
export function InlineError({
  message,
  tone = "error",
  onDismiss,
  className
}: {
  message: string;
  tone?: "error" | "success";
  onDismiss?: () => void;
  className?: string;
}) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-control border px-3 py-2 text-[13px]",
        isError
          ? "border-missed/40 bg-missed/10 text-missed"
          : "border-fixed/40 bg-fixed/10 text-fixed",
        className
      )}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden className="mt-0.5 shrink-0">
        {isError ? (
          <>
            <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 5v3.5M8 10.6v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : (
          <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <span className="min-w-0 flex-1">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-current/70 hover:text-current"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Partial multi-fetch failure — empty supporting rails must not look like
 * peaceful “nothing to do.” Pair with settled promises; never soft-fail to
 * `[]` without this banner (panel P07-22).
 */
export function PartialLoadBanner({
  rails,
  detail,
  className
}: {
  rails: string[];
  detail?: string;
  className?: string;
}) {
  if (rails.length === 0) {
    return null;
  }
  return (
    <div
      role="status"
      className={cn(
        "rounded-control border border-approval/40 bg-approval/10 px-4 py-3 text-sm text-ink",
        className
      )}
    >
      <p className="font-medium">Partial load — supporting data unavailable</p>
      <p className="mt-1 text-muted">
        {rails.join(", ")} could not be loaded. Empty sections below are
        degraded, not proof that nothing exists.
        {detail ? ` ${detail}` : ""}
      </p>
    </div>
  );
}

export function ErrorState({
  title = "Couldn't load this",
  message,
  onRetry,
  className
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-2 p-6 text-sm text-muted",
        className
      )}
    >
      <div className="flex items-center gap-2 text-missed">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M8 5v3.5M8 10.6v.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="font-semibold text-ink">{title}</span>
      </div>
      {message ? <p className="max-w-prose">{message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-control border border-line px-3 py-1.5 text-xs text-ink transition-colors hover:border-line-strong"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * "Not configured / no signal yet" — the honest empty state that replaces a
 * fabricated value when a capability isn't wired up. Distinct from a normal
 * empty list: this one nudges toward the setup action.
 */
export function NotConfigured({
  title,
  message,
  action,
  className
}: {
  title: string;
  message?: ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-card border border-dashed border-line px-4 py-6 text-sm",
        className
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-inconclusive">
        No signal yet
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {message ? <p className="max-w-prose text-muted">{message}</p> : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-1 inline-flex min-h-9 items-center rounded-control text-xs font-semibold text-brand transition-colors hover:text-brand-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {action.label} <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}

/**
 * MissingSignalCallout — an amber, dashed advisory that a conclusion is
 * weakened because a proof input is absent (e.g. no EDR telemetry). Keeps the UI
 * honest: it names the gap instead of silently over-claiming a verdict.
 */
export function MissingSignalCallout({
  title,
  children,
  action,
  className
}: {
  title: ReactNode;
  children: ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-card border border-dashed border-approval/50 bg-approval/5 p-3.5",
        className
      )}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 16 16"
        fill="none"
        className="mt-0.5 shrink-0 text-approval"
        aria-hidden
      >
        <path
          d="M8 1 1 14h14L8 1Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M8 6v3.5M8 11.4v.1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted">{children}</p>
        {action ? (
          <Link
            href={action.href}
            className="mt-1.5 inline-block text-xs font-semibold text-approval hover:opacity-80"
          >
            {action.label} <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
