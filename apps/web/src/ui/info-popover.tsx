"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "./cn";

/**
 * Click-to-toggle disclosure for short product help (not a hover tooltip).
 * Uses aria-expanded + aria-controls; content is not role=tooltip so AT does
 * not treat a sticky panel as ephemeral hover help (P16-19).
 */
export function InfoPopover({
  children,
  label,
  className
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();

  return (
    <span className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-controls={descriptionId}
        aria-expanded={open}
        aria-label={`More information: ${label}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="inline-grid min-h-6 min-w-6 size-6 place-items-center rounded-control border border-line text-[11px] font-semibold text-subtle transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        i
      </button>
      <span
        id={descriptionId}
        role="region"
        aria-label={label}
        hidden={!open}
        className={cn(
          open
            ? "absolute right-0 top-7 z-30 w-72 rounded-card border border-line bg-surface-strong p-3 text-left text-xs font-normal leading-5 text-muted shadow-xl"
            : "sr-only"
        )}
      >
        {children}
      </span>
    </span>
  );
}
