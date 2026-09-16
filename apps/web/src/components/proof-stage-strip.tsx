import Link from "next/link";

import type { ProofLoopStage } from "@periscan/shared";

import { PROOF_STAGE_LABELS } from "../lib/product-help";
import { cn, EvidenceBasisBadge } from "../ui";

/**
 * Compact claim-language strip for proof-loop detail pages (P01-19 / UX-W8).
 * Stage chips use PROOF_STAGE_LABELS (product-help vocabulary) so path detail,
 * findings workbench header, and help stay on one clock.
 *
 * Claim safety: only the exact EvidenceBasis value "Measured" (or explicit
 * fully-measured claim labels) get the solid Measured pill. Partial labels such
 * as "Partially measured hypothesis" must never upgrade to Measured.
 */
function isFullyMeasuredBasisLabel(basisLabel: string): boolean {
  const normalized = basisLabel.trim();
  if (normalized === "Measured") {
    return true;
  }
  // Claim-language display labels for fully-measured paths only.
  return (
    normalized === "Measured path" ||
    normalized === "Measured validated path" ||
    normalized === "Measured reachable path" ||
    normalized === "Measured exploitable path"
  );
}

export function ProofStageStrip({
  stage,
  basis,
  owner,
  nextCta,
  className,
  showOwner = true
}: {
  stage: ProofLoopStage;
  basis?: string | null;
  owner?: string | null;
  nextCta?: { href: string; label: string } | null;
  className?: string;
  /** When false, hide owner meta (list headers). Default true. */
  showOwner?: boolean;
}) {
  const basisLabel = basis?.trim() ? basis.trim() : null;

  return (
    <div
      data-testid="proof-stage-strip"
      role="region"
      aria-label="Proof stage"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-control border border-line bg-elevated/90 px-3 py-2 text-xs backdrop-blur sm:gap-3",
        className
      )}
    >
      <ol
        className="flex min-w-0 flex-1 list-none flex-wrap items-center gap-1"
        aria-label="Proof-loop stages"
        data-testid="proof-stage-chips"
      >
        {PROOF_STAGE_LABELS.map((label) => {
          const current = label === stage;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={cn(
                "rounded-pill border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em]",
                current
                  ? "border-brand bg-brand/10 font-semibold text-ink"
                  : "border-line text-subtle"
              )}
            >
              {label}
            </li>
          );
        })}
        {/* Domain allows Repeat; product chrome keeps the 7-stage operator loop. */}
        {stage === "Repeat" ? (
          <li
            aria-current="step"
            className="rounded-pill border border-brand bg-brand/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-ink"
          >
            Repeat
          </li>
        ) : null}
      </ol>

      {basisLabel && isFullyMeasuredBasisLabel(basisLabel) ? (
        <span data-testid="proof-stage-basis" title={basisLabel}>
          <EvidenceBasisBadge basis="Measured" dot={false} />
        </span>
      ) : basisLabel === "Imported" ? (
        <span data-testid="proof-stage-basis" title={basisLabel}>
          <EvidenceBasisBadge basis="Imported" dot={false} />
        </span>
      ) : basisLabel === "Heuristic" ? (
        <span data-testid="proof-stage-basis" title={basisLabel}>
          <EvidenceBasisBadge basis="Heuristic" dot={false} />
        </span>
      ) : (
        <span
          className="rounded-pill border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted"
          data-testid="proof-stage-basis"
          title={basisLabel ?? "Not recorded"}
        >
          {basisLabel ?? "Not recorded"}
        </span>
      )}

      {showOwner ? (
        <span className="text-muted">
          Owner: <span className="text-ink">{owner ?? "Unassigned"}</span>
        </span>
      ) : null}

      {nextCta ? (
        <Link
          href={nextCta.href}
          className="ml-auto inline-flex min-h-9 items-center rounded-control bg-brand-fill px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {nextCta.label} →
        </Link>
      ) : null}
    </div>
  );
}
