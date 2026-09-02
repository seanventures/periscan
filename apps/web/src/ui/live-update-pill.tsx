"use client";

import { useEffect, useState } from "react";

import { cn } from "./cn";

/**
 * Human-readable age for last successful poll (UX-W3 data-age honesty).
 * Keeps operators honest about stale boards without implying live push / SIEM stream.
 */
export function formatDataAge(
  lastUpdatedAt: string | null,
  nowMs: number = Date.now()
): string {
  if (!lastUpdatedAt) return "waiting for data";
  const updatedAt = new Date(lastUpdatedAt).getTime();
  if (Number.isNaN(updatedAt)) return "waiting for data";
  const seconds = Math.max(0, Math.floor((nowMs - updatedAt) / 1_000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function LiveUpdatePill({
  lastUpdatedAt,
  refreshing = false,
  className
}: {
  lastUpdatedAt: string | null;
  refreshing?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!lastUpdatedAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [lastUpdatedAt]);

  const age = formatDataAge(lastUpdatedAt, now);
  // ICP 5.0 residual: "polled" honesty — never claim Live / real-time SIEM.
  const label = refreshing
    ? "Polled · refreshing"
    : lastUpdatedAt
      ? `Polled ${age}`
      : "Polled · waiting for data";

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      title={
        lastUpdatedAt
          ? `Last successful poll: ${new Date(lastUpdatedAt).toLocaleString()}`
          : "No successful poll yet"
      }
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-control border border-line px-2 py-0.5 font-mono text-[10px] text-muted",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-sm bg-fixed",
          refreshing && "motion-safe:animate-pulse"
        )}
      />
      {label}
    </span>
  );
}
