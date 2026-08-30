import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export function Card({ elevated, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full rounded-card border border-line-panel p-5",
        elevated ? "bg-[#0c1428]" : "bg-surface",
        className
      )}
      {...rest}
    />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  description,
  actions,
  className
}: CardHeaderProps) {
  return (
    <div
      className={cn("mb-4 flex items-start justify-between gap-4", className)}
    >
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-ink">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
