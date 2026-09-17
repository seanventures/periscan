import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";

import { cn } from "./cn";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

/**
 * A bordered content panel — the workhorse container of the command center.
 * Flush by default so rows/tables can draw their own dividers edge-to-edge; wrap
 * free content in a padded child.
 *
 * [P01-1] Prefer this over legacy globals.css `.panel` / `.panel-header`.
 */
export function Panel({ className, children, ...rest }: PanelProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-card border border-line-panel bg-surface",
        className
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

export interface PanelHeaderProps {
  title: ReactNode;
  /** Stable id for the heading — pair with Panel `aria-labelledby` (P07 a11y). */
  titleId?: string;
  /** A trailing link — renders as a quiet "→" affordance. */
  link?: { href: string; label: ReactNode };
  actions?: ReactNode;
  className?: string;
}

export function PanelHeader({
  title,
  titleId,
  link,
  actions,
  className
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-line-panel bg-surface-strong px-4 py-2.5",
        className
      )}
    >
      <h3 id={titleId} className="text-[15px] font-semibold text-ink">
        {title}
      </h3>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : link ? (
        <Link
          href={link.href}
          className="text-[12px] font-medium text-muted transition-colors hover:text-ink"
        >
          {link.label} <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}
