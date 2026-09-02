import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type PageShellWidth = "default" | "narrow" | "full";

export interface PageShellProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /**
   * Content max-width. Use the default (7xl) for workbenches so chrome,
   * breadcrumbs, and body align. `narrow` for forms/checklists; `full` only
   * when a surface intentionally breaks the common column.
   */
  width?: PageShellWidth;
}

const WIDTH_CLASS: Record<PageShellWidth, string> = {
  default: "max-w-7xl",
  narrow: "max-w-5xl",
  full: "max-w-none"
};

// Consistent page container (max-width + vertical rhythm). Uses a div rather
// than <main> so AppShell can own the single page main landmark.
export function PageShell({
  className,
  children,
  width = "default",
  ...rest
}: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto box-border w-full min-w-0 px-4 py-6 sm:px-5 lg:px-6",
        WIDTH_CLASS[width],
        className
      )}
      {...rest}
    >
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </div>
  );
}

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Optional status strip (e.g. LiveUpdatePill) under the description. */
  meta?: ReactNode;
}

// The one page-intro primitive. Replaces the per-page
// .hero/.eyebrow/.headline/.subcopy/.action-row block duplicated across ~14
// pages.
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  meta
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm text-muted">{description}</p>
          ) : null}
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
