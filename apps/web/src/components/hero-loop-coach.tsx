"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PROOF_LOOP_HELP } from "../lib/product-help";
import { cn } from "../ui/cn";

/**
 * Post-first-mission hero loop coach (P07-15 / P02-2 residual).
 * Overlay on the seven hero screens — no new nav items.
 * Stage labels + hrefs come from product-help PROOF_LOOP_HELP so coach and
 * help share one vocabulary (Understand → Act → Verify → Prove).
 * Operator steps: Open top path → Assign fix → Verify → Export proof.
 * Completion is never self-reported (PERISCAN-550): no Mark done / Undo, and
 * localStorage only records dismiss. Fixed remains verify-only elsewhere.
 */

const STORAGE_KEY = "periscan.hero-loop.coach";

/** Post-Validate product stages the coach teaches (same labels as PROOF_LOOP_HELP). */
export const HERO_LOOP_STAGE_LABELS = [
  "Understand",
  "Act",
  "Verify",
  "Prove"
] as const;

export type HeroLoopStageLabel = (typeof HERO_LOOP_STAGE_LABELS)[number];

export type HeroLoopStepId =
  | "open-path"
  | "disposition-finding"
  | "verify-fix"
  | "export-proof";

export interface HeroLoopStep {
  id: HeroLoopStepId;
  /** Canonical ProofLoop stage label from product-help. */
  stage: HeroLoopStageLabel;
  title: string;
  description: string;
  href: string;
  cta: string;
}

function helpFor(stage: HeroLoopStageLabel) {
  return PROOF_LOOP_HELP.find((entry) => entry.label === stage)!;
}

/**
 * Operator-facing steps bound 1:1 to product ProofLoop stages.
 * Hrefs prefer product-help destinations; open-path may deep-link to a concrete path.
 */
export const HERO_LOOP_STEPS: readonly HeroLoopStep[] = [
  {
    id: "open-path",
    stage: "Understand",
    title: "Open your top path",
    description: `${helpFor("Understand").detail} Start with the weakest hop — break the cheapest link first.`,
    // Prefer paths workbench for hop inspection; product-help Understand defaults to /findings.
    href: "/attack-paths",
    cta: "Open paths"
  },
  {
    id: "disposition-finding",
    stage: "Act",
    title: "Assign the smallest fix",
    description: helpFor("Act").detail,
    href: helpFor("Act").href,
    cta: "Open remediation"
  },
  {
    id: "verify-fix",
    stage: "Verify",
    title: "Verify the fix",
    description: helpFor("Verify").detail,
    href: helpFor("Verify").href,
    cta: "Open ready-to-verify"
  },
  {
    id: "export-proof",
    stage: "Prove",
    title: "Export proof",
    description: helpFor("Prove").detail,
    href: helpFor("Prove").href,
    cta: "Open reports"
  }
] as const;

export interface HeroLoopProgress {
  dismissed: boolean;
  updatedAt: string;
}

function readProgress(): HeroLoopProgress {
  if (typeof window === "undefined") {
    return { dismissed: false, updatedAt: "" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dismissed: false, updatedAt: "" };
    const parsed = JSON.parse(raw) as Partial<HeroLoopProgress>;
    return {
      dismissed: Boolean(parsed.dismissed),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : ""
    };
  } catch {
    return { dismissed: false, updatedAt: "" };
  }
}

function writeProgress(next: HeroLoopProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

export interface HeroLoopCoachProps {
  /** When false, coach stays hidden (e.g. first-run GetStarted still active). */
  enabled?: boolean;
  /** Prefer linking the first step to a concrete top path when known. */
  topPathId?: string | null;
  /**
   * When true (unmeasured hops + verified scope), primary open-path CTA is
   * "Measure path hops" — flagship multi-hop journey (P04-3 residual).
   */
  measurePathHopsReady?: boolean;
  className?: string;
}

export function HeroLoopCoach({
  enabled = true,
  topPathId = null,
  measurePathHopsReady = false,
  className
}: HeroLoopCoachProps) {
  const [progress, setProgress] = useState<HeroLoopProgress>({
    dismissed: false,
    updatedAt: ""
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setProgress(readProgress());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: HeroLoopProgress) => {
    setProgress(next);
    writeProgress(next);
  }, []);

  const steps = useMemo(
    () =>
      HERO_LOOP_STEPS.map((step) => {
        if (step.id !== "open-path") return step;
        if (topPathId) {
          return {
            ...step,
            title: measurePathHopsReady
              ? "Measure path hops"
              : step.title,
            description: measurePathHopsReady
              ? "Open the top path, Measure hop (safe) on Eligible edges, and confirm edge receipts — FullyMeasured only with evidence IDs."
              : step.description,
            href: `/attack-paths/${topPathId}#hop-measurement`,
            cta: measurePathHopsReady
              ? "Measure path hops"
              : "Inspect weakest hop"
          };
        }
        return step;
      }),
    [topPathId, measurePathHopsReady]
  );

  const stageStrip = HERO_LOOP_STAGE_LABELS.join(" → ");

  if (!enabled || !hydrated || progress.dismissed) {
    return null;
  }

  return (
    <section
      aria-label="Hero proof loop coach"
      data-testid="hero-loop-coach"
      className={cn(
        "rounded-card border border-brand/35 bg-brand/[0.06] px-4 py-4",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
            Guided proof loop
          </p>
          <h2 className="mt-1 text-base font-semibold text-ink">{stageStrip}</h2>
          <p className="mt-1 max-w-xl text-[13px] text-muted">
            After your first validation, finish the product proof loop on the
            screens you already have — same stages as Help (Connect → Prove).
          </p>
        </div>
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle hover:text-ink"
          onClick={() =>
            persist({
              dismissed: true,
              updatedAt: new Date().toISOString()
            })
          }
        >
          Dismiss
        </button>
      </div>

      <ol className="mt-4 grid list-none gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const active = index === 0;
          return (
            <li
              key={step.id}
              className={cn(
                "flex flex-col gap-2 rounded-control border px-3 py-3",
                active && "border-brand/50 bg-surface shadow-sm",
                !active && "border-line bg-surface/50"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full font-mono text-[11px] font-semibold",
                    active
                      ? "bg-brand-fill text-white"
                      : "bg-surface-strong text-muted"
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p
                    className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-2"
                    data-testid={`hero-loop-stage-${step.id}`}
                  >
                    {step.stage}
                  </p>
                  <span className="block text-[13px] font-semibold text-ink">
                    {step.title}
                  </span>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-muted">
                {step.description}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href={step.href}
                  className={cn(
                    "text-[12px] font-semibold",
                    active ? "text-brand" : "text-brand-2"
                  )}
                >
                  {step.cta}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
