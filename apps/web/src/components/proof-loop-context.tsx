import Link from "next/link";

import type { ProofLoopStage } from "@periscan/shared";

import { PROOF_STAGE_LABELS } from "../lib/product-help";
import { cn } from "../ui";

/**
 * Shared claim-language panel for proof-loop entity pages (path / finding /
 * remediation / mission / snapshot). Stage chips share PROOF_STAGE_LABELS with
 * the compact `ProofStageStrip` (same product-help vocabulary).
 */
export function ProofLoopContext({
  entityLabel,
  evidenceBasis,
  freshness,
  nextAction,
  owner,
  stage,
  status
}: {
  entityLabel: string;
  evidenceBasis?: string | null;
  freshness?: string | null;
  nextAction: { href: string; label: string };
  owner?: string | null;
  stage: ProofLoopStage;
  status?: string | null;
}) {
  return (
    <section
      aria-label="Proof loop context"
      className="rounded-card border border-line bg-elevated"
    >
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
        <div className="min-w-40">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Proof-loop context
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{entityLabel}</p>
        </div>
        <ol
          className="flex min-w-0 flex-1 list-none flex-wrap gap-1"
          aria-label="Proof-loop stages"
          data-testid="proof-loop-context-stages"
        >
          {PROOF_STAGE_LABELS.map((item) => (
            <li
              key={item}
              aria-current={item === stage ? "step" : undefined}
              className={cn(
                "rounded-pill border px-2 py-1 font-mono text-[9px] uppercase tracking-wide",
                item === stage
                  ? "border-brand bg-brand/10 text-ink"
                  : "border-line text-subtle"
              )}
            >
              {item}
            </li>
          ))}
          {stage === "Repeat" ? (
            <li
              aria-current="step"
              className="rounded-pill border border-brand bg-brand/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-ink"
            >
              Repeat
            </li>
          ) : null}
        </ol>
        <dl className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4 lg:max-w-xl">
          <ContextFact label="Basis" value={evidenceBasis ?? "Not recorded"} />
          <ContextFact label="Owner" value={owner ?? "Unassigned"} />
          <ContextFact label="Freshness" value={freshness ?? "Not recorded"} />
          <ContextFact label="State" value={status ?? stage} />
        </dl>
        <Link
          href={nextAction.href}
          className="inline-flex shrink-0 items-center justify-center rounded-control bg-brand-fill px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {nextAction.label} →
        </Link>
      </div>
    </section>
  );
}

function ContextFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-display text-[9px] font-semibold uppercase tracking-wide text-subtle">
        {label}
      </dt>
      <dd className="truncate text-muted" title={value}>
        {value}
      </dd>
    </div>
  );
}

/** Compact sticky-header strip lives in `./proof-stage-strip` (UX-W8 kit). */
export { ProofStageStrip } from "./proof-stage-strip";
