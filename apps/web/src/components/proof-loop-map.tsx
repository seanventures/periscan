"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { ProductActivationState, ProofLoopStage } from "@periscan/shared";

import { PROOF_LOOP_HELP } from "../lib/product-help";
import { cn } from "../ui/cn";

/** Product proof-loop stages shown on the spatial map (excludes Repeat). */
export type ProofLoopMapStage = (typeof PROOF_LOOP_HELP)[number]["label"];

export type ProofLoopMapNodeState =
  | "Completed"
  | "Current"
  | "Partial"
  | "Upcoming"
  | "Blocked";

export interface ProofLoopMapNode {
  stage: ProofLoopMapStage;
  detail: string;
  href: string;
  state: ProofLoopMapNodeState;
  /** Milestone count completed / total for this stage. */
  completedCount: number;
  totalCount: number;
  /** Primary milestone label when available. */
  milestoneLabel: string | null;
  evidenceBasis: string | null;
}

const STAGE_ORDER = PROOF_LOOP_HELP.map((s) => s.label);

const STATE_RANK: Record<ProofLoopMapNodeState, number> = {
  Blocked: 4,
  Current: 3,
  Partial: 2,
  Completed: 1,
  Upcoming: 0
};

/**
 * Aggregate activation milestones into one node per product proof-loop stage.
 * Real-first: empty / missing activation yields Upcoming nodes with catalog hrefs.
 */
export function buildProofLoopMapNodes(
  activation: ProductActivationState | null | undefined
): ProofLoopMapNode[] {
  const milestones = activation?.milestones ?? [];
  const currentStage = activation?.currentStage;
  const nextAction = activation?.nextAction;

  return PROOF_LOOP_HELP.map((catalog) => {
    const stageMilestones = milestones.filter(
      (m) => m.stage === (catalog.label as ProofLoopStage)
    );
    const totalCount = stageMilestones.length;
    const completedCount = stageMilestones.filter(
      (m) => m.state === "Completed"
    ).length;
    const hasBlocked = stageMilestones.some((m) => m.state === "Blocked");
    const hasCurrent = stageMilestones.some((m) => m.state === "Current");
    const isApiCurrent =
      currentStage === catalog.label && completedCount < Math.max(totalCount, 1);

    let state: ProofLoopMapNodeState = "Upcoming";
    if (hasBlocked) {
      state = "Blocked";
    } else if (totalCount > 0 && completedCount === totalCount) {
      state = "Completed";
    } else if (hasCurrent || isApiCurrent) {
      state = "Current";
    } else if (completedCount > 0 && completedCount < totalCount) {
      state = "Partial";
    }

    const focusMilestone =
      stageMilestones.find((m) => m.state === "Current") ??
      stageMilestones.find(
        (m) => m.state === "Upcoming" || m.state === "Blocked"
      ) ??
      [...stageMilestones]
        .reverse()
        .find((m) => m.state === "Completed") ??
      null;

    const href =
      state === "Current" && nextAction?.href
        ? nextAction.href
        : (focusMilestone?.href ?? catalog.href);

    const evidenceBasis =
      focusMilestone?.evidenceBasis ??
      stageMilestones[stageMilestones.length - 1]?.evidenceBasis ??
      null;

    return {
      stage: catalog.label,
      detail: catalog.detail,
      href,
      state,
      completedCount,
      totalCount,
      milestoneLabel: focusMilestone?.label ?? null,
      evidenceBasis
    };
  });
}

export function proofLoopMapProgress(nodes: ProofLoopMapNode[]): {
  completedStages: number;
  totalStages: number;
  current: ProofLoopMapNode | null;
} {
  const completedStages = nodes.filter((n) => n.state === "Completed").length;
  const current =
    nodes.find((n) => n.state === "Current" || n.state === "Blocked") ??
    nodes.find((n) => n.state === "Partial") ??
    null;
  return {
    completedStages,
    totalStages: nodes.length,
    current
  };
}

function stateLabel(state: ProofLoopMapNodeState): string {
  switch (state) {
    case "Completed":
      return "Done";
    case "Current":
      return "Now";
    case "Partial":
      return "In progress";
    case "Blocked":
      return "Blocked";
    default:
      return "Next";
  }
}

function nodeClasses(state: ProofLoopMapNodeState, compact: boolean): string {
  const base = compact
    ? "grid size-7 place-items-center rounded-full border text-[10px] font-semibold transition-colors"
    : "grid size-10 place-items-center rounded-full border-2 text-xs font-semibold transition-colors";
  switch (state) {
    case "Completed":
      return cn(base, "border-fixed/50 bg-fixed text-bg");
    case "Current":
      return cn(
        base,
        "border-brand-fill bg-brand-fill text-white"
      );
    case "Partial":
      return cn(base, "border-approval/60 bg-approval/15 text-approval");
    case "Blocked":
      return cn(base, "border-missed/50 bg-missed/15 text-missed");
    default:
      return cn(base, "border-line bg-surface-strong text-muted");
  }
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Arc layout positions for hero map (clockwise from top-left of loop). */
function heroPositions(count: number, cx: number, cy: number, r: number) {
  // Start near 8 o'clock and sweep clockwise so Connect → Prove reads left→right-ish.
  const start = Math.PI * 0.85;
  const sweep = Math.PI * 1.55;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const angle = start + sweep * t;
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r
    };
  });
}

function HeroMap({
  nodes,
  nextAction
}: {
  nodes: ProofLoopMapNode[];
  nextAction?: ProductActivationState["nextAction"] | null;
}) {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const r = 108;
  const positions = heroPositions(nodes.length, cx, cy, r);
  const progress = proofLoopMapProgress(nodes);

  // Connector path through nodes.
  const pathD = positions
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <div
      className="relative mx-auto w-full max-w-[320px]"
      style={{ aspectRatio: "1" }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <circle
          cx={cx}
          cy={cy}
          r={r + 28}
          fill="none"
          stroke="currentColor"
          className="text-line"
          strokeWidth="1"
          strokeDasharray="3 5"
          opacity={0.55}
        />
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          className="text-brand/35"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Progress stroke over completed segments */}
        {positions.slice(0, Math.max(progress.completedStages, 0)).length >
          1 && (
          <path
            d={positions
              .slice(0, Math.max(progress.completedStages, 1))
              .map(
                (p, i) =>
                  `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
              )
              .join(" ")}
            fill="none"
            stroke="currentColor"
            className="text-fixed/70"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto max-w-[9.5rem] rounded-card border border-line bg-elevated px-3 py-2 text-center">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-2">
            Proof loop
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-subtle">
            {progress.completedStages}/{progress.totalStages} stages
          </p>
          {nextAction ? (
            <Link
              href={nextAction.href}
              className="mt-1.5 inline-flex text-[11px] font-semibold text-brand hover:text-brand-2"
            >
              {nextAction.label} →
            </Link>
          ) : null}
        </div>
      </div>

      {nodes.map((node, index) => {
        const pos = positions[index]!;
        const left = (pos.x / size) * 100;
        const top = (pos.y / size) * 100;
        return (
          <Link
            key={node.stage}
            href={node.href}
            title={`${node.stage}: ${node.evidenceBasis ?? node.detail}`}
            aria-label={`${node.stage} — ${stateLabel(node.state)}. ${node.milestoneLabel ?? node.detail}`}
            aria-current={node.state === "Current" ? "step" : undefined}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <span className={nodeClasses(node.state, false)}>
              {node.state === "Completed" ? (
                <CheckIcon />
              ) : (
                <span className="font-mono text-[10px]">{index + 1}</span>
              )}
            </span>
            <span
              className={cn(
                "mt-1 block max-w-[4.75rem] font-display text-[10px] font-semibold leading-tight",
                node.state === "Current" ? "text-ink" : "text-muted"
              )}
            >
              {node.stage}
            </span>
            <span className="sr-only">{stateLabel(node.state)}</span>
          </Link>
        );
      })}
    </div>
  );
}

function PanelMap({
  nodes,
  nextAction
}: {
  nodes: ProofLoopMapNode[];
  nextAction?: ProductActivationState["nextAction"] | null;
}) {
  const progress = proofLoopMapProgress(nodes);
  return (
    <div className="rounded-card border border-line bg-elevated p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-2">
            Product proof loop
          </p>
          <h2 className="mt-1 text-base font-semibold text-ink">
            Connect → Authorize → Validate → Understand → Act → Verify → Prove
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
            Stages light from persisted activation milestones — not decorative
            progress. Click a stage to open its real workspace route.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs text-subtle">
            {progress.completedStages} of {progress.totalStages} stages complete
          </p>
          {nextAction ? (
            <Link
              href={nextAction.href}
              className="mt-1 inline-flex text-xs font-semibold text-brand hover:text-brand-2"
            >
              {nextAction.label} →
            </Link>
          ) : null}
        </div>
      </div>

      <ol
        className="mt-4 flex list-none flex-wrap items-stretch gap-0 sm:flex-nowrap"
        aria-label="Proof-loop stage map"
      >
        {nodes.map((node, index) => (
          <li
            key={node.stage}
            className="relative flex min-w-[5.5rem] flex-1 flex-col items-center px-1"
          >
            {index < nodes.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[calc(50%+1.1rem)] right-[calc(-50%+1.1rem)] top-5 h-0.5",
                  STATE_RANK[node.state] >= STATE_RANK.Completed &&
                    nodes[index + 1] &&
                    STATE_RANK[nodes[index + 1]!.state] >= STATE_RANK.Partial
                    ? "bg-fixed/50"
                    : node.state === "Completed"
                      ? "bg-fixed/40"
                      : "bg-line"
                )}
              />
            ) : null}
            <Link
              href={node.href}
              aria-current={node.state === "Current" ? "step" : undefined}
              title={node.evidenceBasis ?? node.detail}
              className="group relative z-[1] flex w-full flex-col items-center gap-1.5 rounded-control px-1 py-1 text-center transition-colors hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className={nodeClasses(node.state, false)}>
                {node.state === "Completed" ? (
                  <CheckIcon />
                ) : (
                  <span className="font-mono text-[10px]">{index + 1}</span>
                )}
              </span>
              <span
                className={cn(
                  "font-display text-[12px] font-semibold",
                  node.state === "Current" ? "text-ink" : "text-muted"
                )}
              >
                {node.stage}
              </span>
              <span
                className={cn(
                  "font-mono text-[9px] uppercase tracking-wide",
                  node.state === "Completed" && "text-fixed",
                  node.state === "Current" && "text-brand-2",
                  node.state === "Partial" && "text-approval",
                  node.state === "Blocked" && "text-missed",
                  node.state === "Upcoming" && "text-subtle"
                )}
              >
                {stateLabel(node.state)}
                {node.totalCount > 0
                  ? ` · ${node.completedCount}/${node.totalCount}`
                  : ""}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RailMap({
  nodes,
  nextAction
}: {
  nodes: ProofLoopMapNode[];
  nextAction?: ProductActivationState["nextAction"] | null;
}) {
  const progress = proofLoopMapProgress(nodes);
  const current = progress.current;
  return (
    <div className="border-t border-line px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-display text-[9px] font-semibold uppercase tracking-[0.14em] text-subtle">
          Proof loop
        </p>
        <span className="font-mono text-[9px] text-subtle">
          {progress.completedStages}/{progress.totalStages}
        </span>
      </div>
      <ol
        className="flex list-none items-center justify-between gap-0.5"
        aria-label="Proof-loop stages"
      >
        {nodes.map((node, index) => {
          const short = node.stage.slice(0, 1);
          return (
            <li key={node.stage} className="flex min-w-0 flex-1 items-center">
              <Link
                href={node.href}
                title={`${node.stage} — ${stateLabel(node.state)}`}
                aria-label={`${node.stage}: ${stateLabel(node.state)}`}
                aria-current={node.state === "Current" ? "step" : undefined}
                className={cn(
                  nodeClasses(node.state, true),
                  "mx-auto shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                )}
              >
                {node.state === "Completed" ? (
                  <CheckIcon size={11} />
                ) : (
                  <span className="font-mono text-[9px]">{short}</span>
                )}
              </Link>
              {index < nodes.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mx-0.5 h-px min-w-[4px] flex-1",
                    node.state === "Completed" ? "bg-fixed/45" : "bg-line"
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {current || nextAction ? (
        <Link
          href={nextAction?.href ?? current?.href ?? "/getting-started"}
          className="mt-2 block truncate font-mono text-[10px] font-medium text-brand hover:text-brand-2"
        >
          {nextAction?.label ??
            (current ? `${current.stage}: continue` : "Open checklist")}{" "}
          →
        </Link>
      ) : (
        <Link
          href="/getting-started"
          className="mt-2 block font-mono text-[10px] text-subtle hover:text-brand"
        >
          Full checklist →
        </Link>
      )}
    </div>
  );
}

export type ProofLoopMapVariant = "hero" | "panel" | "rail";

/**
 * Spatial product map of the proof loop (P02-18).
 * Driven by real `getProductActivationState` milestones when provided.
 * Variants: hero (first-run), panel (getting-started / dashboard), rail (nav footer).
 */
export function ProofLoopMap({
  activation,
  variant = "panel",
  className,
  loading = false
}: {
  activation?: ProductActivationState | null;
  variant?: ProofLoopMapVariant;
  className?: string;
  /** When true, still render structure with upcoming stages (no fake completion). */
  loading?: boolean;
}) {
  const nodes = useMemo(
    () => buildProofLoopMapNodes(loading ? null : activation),
    [activation, loading]
  );
  const nextAction = loading ? null : (activation?.nextAction ?? null);

  return (
    <section
      data-testid={`proof-loop-map-${variant}`}
      aria-label="Proof loop product map"
      className={cn(className)}
    >
      {variant === "hero" ? (
        <HeroMap nodes={nodes} nextAction={nextAction} />
      ) : variant === "rail" ? (
        <RailMap nodes={nodes} nextAction={nextAction} />
      ) : (
        <PanelMap nodes={nodes} nextAction={nextAction} />
      )}
    </section>
  );
}

export { STAGE_ORDER };
