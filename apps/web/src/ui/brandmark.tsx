import { cn } from "./cn";

export interface BrandmarkProps {
  /** Approximate wordmark cap height. The official lockup includes radar rings. */
  size?: number;
  /** Retained for API compatibility. The official lockup is always preferred. */
  showWordmark?: boolean;
  className?: string;
  title?: string;
}

/**
 * The canonical Periscan logo supplied with the product design system.
 *
 * The source asset is preserved byte-for-byte inside the public SVG wrapper so
 * every product surface uses the real wordmark and radar lockup rather than a
 * reconstructed approximation.
 */
export function Brandmark({
  size = 24,
  showWordmark = true,
  className,
  title = "Periscan"
}: BrandmarkProps) {
  const width = showWordmark ? Math.round(size * 6.5) : Math.round(size * 1.85);

  return (
    <span className={cn("inline-flex items-center", className)}>
      <img
        src="/brand/periscan-logo-light.svg"
        alt={title}
        width={width}
        height={Math.round(width * (271 / 500))}
        className={cn(
          "block h-auto max-w-full object-contain",
          !showWordmark && "object-right"
        )}
        style={{ width }}
      />
    </span>
  );
}
