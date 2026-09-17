"use client";

import { useId, useState } from "react";

import { cn } from "../ui/cn";

export const CLAIM_GUARD_COPY = {
  measured:
    "Measured — hop or control outcome backed by tenant-owned evidence IDs and receipts.",
  heuristic:
    "Heuristic — correlated or modeled reachability; not independent hop measurement.",
  imported:
    "Imported — third-party or scan import signal; prioritization input only, never Measured proof."
} as const;

/**
 * Persistent claim-language chip for product shell / path headers (UX-W5 / 191).
 * Explains Measured / Heuristic / Imported without inventing certification claims.
 */
export function ClaimGuardHud({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        type="button"
        data-testid="claim-guard-hud"
        aria-controls={panelId}
        aria-expanded={open}
        aria-label="Claim-safe language"
        title="Claim-safe language: Measured, Heuristic, Imported"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-elevated/90 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:border-brand hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-fixed ring-2 ring-fixed/20"
        />
        Claim-safe language
      </button>
      <span
        id={panelId}
        role="region"
        aria-label="Claim-safe language glossary"
        hidden={!open}
        className={cn(
          open
            ? "absolute right-0 top-8 z-40 w-72 rounded-card border border-line bg-surface-strong p-3 text-left text-xs font-normal leading-5 text-muted shadow-xl normal-case tracking-normal"
            : "sr-only"
        )}
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">
          Claim-safe language
        </p>
        <ul className="mt-2 space-y-2">
          <li>{CLAIM_GUARD_COPY.measured}</li>
          <li>{CLAIM_GUARD_COPY.heuristic}</li>
          <li>{CLAIM_GUARD_COPY.imported}</li>
        </ul>
      </span>
    </span>
  );
}
