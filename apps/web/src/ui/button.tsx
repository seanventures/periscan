import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Hover stays on brand-fill (#2563d4) or darker — brand (#3c96ff) fails AA under white.
  primary:
    "border border-brand-fill bg-brand-fill text-white hover:bg-[#1d4ed8] hover:border-[#1d4ed8] focus-visible:ring-brand disabled:border-line disabled:bg-[#0c1220] disabled:text-subtle disabled:hover:bg-[#0c1220]",
  secondary:
    "border border-line-strong bg-brand/10 text-ink hover:bg-brand/16 focus-visible:ring-brand",
  ghost:
    "bg-transparent text-muted hover:bg-brand/6 hover:text-ink focus-visible:ring-brand",
  // Deep red fill for AA with white labels (#ff5065 alone is too light).
  danger:
    "border border-[#b91c3c] bg-[#b91c3c] text-white hover:bg-danger hover:border-danger focus-visible:ring-danger disabled:bg-danger/30 disabled:hover:bg-danger/30"
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2"
};

// Shared class builder so anchors/links can match button styling
// (e.g. <Link className={buttonClassName({ variant: "secondary" })}>).
export function buttonClassName(
  options: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
  } = {}
): string {
  const { variant = "primary", size = "md", className } = options;
  return cn(
    "inline-flex items-center justify-center rounded-control font-semibold",
    "transition-[background-color,border-color,box-shadow,filter,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:cursor-not-allowed disabled:opacity-70",
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    className
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

// The single Button for the whole app — replaces the per-page
// .primary-button/.secondary-button/.link-button markup + ad-hoc loading labels.
// [P01-1] Legacy globals.css product button classes are deprecated shims only.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className,
      children,
      type = "button",
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonClassName({ className, size, variant })}
        {...rest}
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        {children}
      </button>
    );
  }
);
