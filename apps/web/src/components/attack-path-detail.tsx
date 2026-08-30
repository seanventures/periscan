"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DynamicPathMissionRecommendation } from "@periscan/operators";
import {
  buildAttackPathRiskSummary,
  formatRiskBandDisplayLabel,
  projectPathValidationState,
  type AttackPathAssessment,
  type AttackPathEdgePlanItem,
  type AttackPathMeasurementState,
  type AttackPathValidationPlan,
  type AttackPathVerificationRequest,
  type PathEdgeReceipt,
  type PathEdgeValidationEligibility,
  type PathEdgeValidationLaunchResult,
  type Scope
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { resolvePathDetailMeasureCta } from "../lib/multi-hop-journey";
import { useApiResource } from "../hooks/use-api-resource";
import {
  AttackPathClaimBadge,
  AttackPathGraph,
  EmptyState,
  ErrorState,
  EvidenceBasisBadge,
  InlineError,
  LoadingSkeleton,
  PageShell,
  Panel,
  PanelHeader,
  PolicyGateBadge,
  RiskBandBadge,
  SafetyLevelBadge,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import { RiskFactorBreakdown } from "./risk-factor-breakdown";
import { ProofStageStrip } from "./proof-stage-strip";

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}` : id;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

const REDACTION_TONE: Record<string, StateTone> = {
  NotRequired: "neutral",
  Redacted: "fixed",
  Blocked: "missed"
};

const SENSITIVITY_TONE: Record<string, StateTone> = {
  Low: "neutral",
  Moderate: "approval",
  High: "missed",
  Restricted: "missed"
};

const ELIGIBILITY_TONE: Record<PathEdgeValidationEligibility, StateTone> = {
  Eligible: "validated",
  NeedsApproval: "approval",
  AlreadyMeasured: "fixed",
  NeedsScope: "missed",
  NeedsRunner: "missed",
  NeedsIntegration: "missed",
  NoSafeModule: "inconclusive",
  HeuristicOnly: "inconclusive"
};

const PLAN_STATUS_TONE: Record<string, StateTone> = {
  Ready: "validated",
  PartiallyReady: "approval",
  Blocked: "missed",
  FullyMeasured: "fixed"
};

// Operators may request hop measurement for Eligible / NeedsApproval, and
// HeuristicOnly identity graph re-import (never claims Measured).
const LAUNCHABLE_ELIGIBILITY = new Set<PathEdgeValidationEligibility>([
  "Eligible",
  "NeedsApproval",
  "HeuristicOnly"
]);

function eligibilityBlockedHint(
  eligibility: PathEdgeValidationEligibility
): { message: string; href?: string; label?: string } | null {
  switch (eligibility) {
    case "HeuristicOnly":
      return {
        message:
          "Identity hops use BloodHound-compatible graph import only. Re-import re-verifies Heuristic edges — never Measured path proof or live credential abuse."
      };
    case "NeedsScope":
      return {
        message:
          "A verified scope is required before this hop can be measured.",
        // ICP-P1-16: authorize on Scopes — not Missions (missions only for run).
        href: "/scopes",
        label: "Verify scope"
      };
    case "NeedsRunner":
      return {
        message:
          "An enrolled internal runner is required for this hop probe.",
        href: "/runners",
        label: "Open runners"
      };
    case "NeedsIntegration":
      return {
        message:
          "Connect the required integration before control or identity hops can be measured.",
        href: "/integrations",
        label: "Open integrations"
      };
    case "NeedsApproval":
      // Launch remains available for NeedsApproval (see LAUNCHABLE_ELIGIBILITY);
      // this hint is only shown when modules are missing so the button is off.
      return {
        message:
          "Tenant policy may require approval above PassiveReadOnly. You can still request Measure hop (safe); launch returns RequiresApproval honestly and never marks the hop Measured."
      };
    case "NoSafeModule":
      return {
        message:
          "No first-customer safe hop-probe module is mapped for this relationship."
      };
    case "AlreadyMeasured":
      return {
        message:
          "This hop already has Measured evidence. Re-measure only via a new receipt with evidence IDs."
      };
    default:
      return null;
  }
}

export function AttackPathDetail({ id }: { id: string }) {
  const path = useApiResource(() => api.getAttackPath(id), [id]);
  // Sibling path list: sticky "Up next" strip + desktop dual-pane (UX-W12/W14).
  const siblingPaths = useApiResource(() => api.listAttackPaths(), []);
  const evidence = useApiResource(() => api.listAttackPathEvidence(id), [id]);
  const scopes = useApiResource(() => api.listScopes(), []);
  const validationPlan = useApiResource(
    () => api.getAttackPathValidationPlan(id),
    [id]
  );
  const measurementState = useApiResource(
    () => api.getAttackPathMeasurementState(id),
    [id]
  );
  const edgeReceipts = useApiResource(
    () => api.listAttackPathEdgeReceipts(id),
    [id]
  );
  const nextMission = useApiResource(
    () => api.getAttackPathNextMission(id),
    [id]
  );

  const [showVerification, setShowVerification] = useState(false);
  const [nextMissionBusy, setNextMissionBusy] = useState(false);
  const [nextMissionError, setNextMissionError] = useState<string | null>(null);
  const [approvedNextMission, setApprovedNextMission] =
    useState<DynamicPathMissionRecommendation | null>(null);
  const [approvedMissionId, setApprovedMissionId] = useState<string | null>(
    null
  );
  const [scopeId, setScopeId] = useState("");
  const [hopMeasureScopeId, setHopMeasureScopeId] = useState("");
  const [reason, setReason] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const [verificationRequest, setVerificationRequest] =
    useState<AttackPathVerificationRequest | null>(null);

  const [launchBusyEdgeId, setLaunchBusyEdgeId] = useState<string | null>(null);
  const [launchErrorByEdge, setLaunchErrorByEdge] = useState<
    Record<string, string>
  >({});
  const [launchResultByEdge, setLaunchResultByEdge] = useState<
    Record<string, PathEdgeValidationLaunchResult>
  >({});
  const [focusResultEdgeId, setFocusResultEdgeId] = useState<string | null>(
    null
  );

  // Move keyboard/AT focus to the launch outcome so operators hear the result
  // without hunting the status region (P16-15).
  // ICP 5.0 residual: honor prefers-reduced-motion (instant scroll, no smooth).
  useEffect(() => {
    if (!focusResultEdgeId) return;
    const el = document.querySelector<HTMLElement>(
      `[data-testid="hop-launch-result-${focusResultEdgeId}"]`
    );
    if (!el) return;
    el.focus();
    if (typeof el.scrollIntoView === "function") {
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({
        block: "nearest",
        behavior: prefersReduced ? "auto" : "smooth"
      });
    }
  }, [focusResultEdgeId, launchResultByEdge]);

  if (path.loading) {
    return (
      <PageShell>
        <LoadingSkeleton rows={8} />
      </PageShell>
    );
  }

  if (path.error || !path.data) {
    return (
      <PageShell>
        <BackLink />
        <Panel className="mt-4">
          <ErrorState
            title="Couldn't load this attack path"
            message={path.error ?? "It may not exist for this tenant."}
            onRetry={path.refetch}
          />
        </Panel>
      </PageShell>
    );
  }

  const { attackPath, financialExposure, risk } = path.data;
  // UX-W1 claim-safe path hero: project certainty through claim language first.
  const pathProjection = projectPathValidationState(attackPath);
  const pathClaim = pathProjection.claim;
  const riskBandLabel = formatRiskBandDisplayLabel(risk.band);
  const riskSummary = buildAttackPathRiskSummary(attackPath, risk.band);
  const nodeById = new Map(
    attackPath.pathNodes.map((n) => [n.pathNodeId, n.label])
  );
  const orderedEdges = attackPath.pathEdges;
  const planByEdgeId = new Map(
    (validationPlan.data?.items ?? []).map((item) => [item.pathEdgeId, item])
  );
  const edgeStateById = new Map(
    (measurementState.data?.edgeStates ?? []).map((state) => [
      state.pathEdgeId,
      state
    ])
  );

  // Honesty: prefer server measurement-state; fall back to claim language so we
  // never count Measured edges without evidence IDs (launch is not measurement).
  const measuredEdgeCount =
    measurementState.data?.measuredEdgeCount ?? pathClaim.measuredEdgeCount;
  const totalEdgeCount =
    measurementState.data?.totalEdgeCount ?? pathClaim.totalEdgeCount;
  // FullyMeasured only when API says so, or claim language (path basis Measured +
  // every hop Measured with evidence). Count equality alone never upgrades.
  const pathFullyMeasured =
    measurementState.data?.fullyMeasured ?? pathClaim.fullyMeasured;

  const breakers = [...attackPath.pathBreakers].sort(
    (a, b) => a.priority - b.priority
  );
  // Weakest link: first unmeasured hop (cheapest path-breaker target), else
  // the highest-priority path breaker when every hop is already measured.
  const weakestEdgeIndex = orderedEdges.findIndex((edge) => {
    const edgeState = edgeStateById.get(edge.pathEdgeId);
    const basis = edgeState?.evidenceBasis ?? edge.evidenceBasis;
    const evidenceIds = edgeState?.evidenceIds ?? edge.evidenceIds;
    return !(
      basis === "Measured" &&
      Array.isArray(evidenceIds) &&
      evidenceIds.length > 0
    );
  });
  const weakestEdge =
    weakestEdgeIndex >= 0 ? orderedEdges[weakestEdgeIndex]! : null;
  const primaryBreaker = breakers[0] ?? null;
  const verifiedScopes = (scopes.data ?? []).filter(
    (scope) => scope.verificationStatus === "Verified"
  );
  const scopeVerified = verifiedScopes.length > 0;
  const effectiveHopScopeId =
    hopMeasureScopeId ||
    (verifiedScopes.length === 1 ? verifiedScopes[0]!.scopeId : "");

  async function requestVerification() {
    if (verifiedScopes.length > 1 && !scopeId) {
      setVerificationError("Choose the verified scope this path belongs to.");
      return;
    }

    setVerificationBusy(true);
    setVerificationError(null);
    try {
      setVerificationRequest(
        await api.requestAttackPathVerification(attackPath.pathId, {
          reason: reason.trim() || undefined,
          scopeId: scopeId || verifiedScopes[0]?.scopeId
        })
      );
    } catch (caught) {
      setVerificationError(
        caught instanceof Error
          ? caught.message
          : "Couldn't request attack path verification."
      );
    } finally {
      setVerificationBusy(false);
    }
  }

  async function measureHop(planItem: AttackPathEdgePlanItem) {
    const edgeId = planItem.pathEdgeId;
    const moduleId = planItem.recommendedModuleIds[0];

    if (!moduleId) {
      setLaunchErrorByEdge((current) => ({
        ...current,
        [edgeId]:
          "No safe hop-probe module is recommended for this edge; cannot launch."
      }));
      return;
    }

    if (!effectiveHopScopeId) {
      setLaunchErrorByEdge((current) => ({
        ...current,
        [edgeId]:
          verifiedScopes.length === 0
            ? "A verified scope is required before measuring a hop."
            : "Choose a verified scope for hop measurement."
      }));
      return;
    }

    setLaunchBusyEdgeId(edgeId);
    setLaunchErrorByEdge((current) => {
      const next = { ...current };
      delete next[edgeId];
      return next;
    });

    try {
      const result = await api.launchPathEdgeValidation(
        attackPath.pathId,
        edgeId,
        {
          moduleId,
          scopeId: effectiveHopScopeId,
          missionType: planItem.missionType,
          safetyLevel: planItem.safetyLevel,
          reason: reason.trim() || undefined
        }
      );
      setLaunchResultByEdge((current) => ({
        ...current,
        [edgeId]: result
      }));
      setFocusResultEdgeId(edgeId);
      // Launch never upgrades measurement — only receipts do. Refresh plan and
      // receipts so any concurrent apply is visible, without inventing Measured.
      void validationPlan.refetch();
      void measurementState.refetch();
      void edgeReceipts.refetch();
    } catch (caught) {
      setLaunchErrorByEdge((current) => ({
        ...current,
        [edgeId]:
          caught instanceof Error
            ? caught.message
            : "Couldn't launch hop measurement."
      }));
    } finally {
      setLaunchBusyEdgeId(null);
    }
  }

  function exportPath() {
    const content = JSON.stringify(
      {
        attackPath,
        evidence: evidence.data ?? [],
        edgeReceipts: edgeReceipts.data ?? [],
        measurementState: measurementState.data ?? null,
        validationPlan: validationPlan.data ?? null,
        exportedAt: new Date().toISOString(),
        risk: {
          ...risk,
          summary: riskSummary
        }
      },
      null,
      2
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `periscan-attack-path-${attackPath.pathId.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // P01-15 / P01-19 / UX-W1+W8: sticky strip — stage chips + claim-safe Measure CTA.
  // Measure path hops only when unmeasured hops exist and verified scope is ready.
  // Never label the primary action "Validated" from launch alone.
  const pathPrimaryCta = resolvePathDetailMeasureCta({
    fullyMeasured: pathFullyMeasured,
    totalEdgeCount,
    measuredEdgeCount,
    scopeVerified,
    hasBreakers: breakers.length > 0
  });

  // Top sibling paths by risk (exclude current) for mobile "Up next" strip.
  const upNextSiblings = [...(siblingPaths.data ?? [])]
    .filter((item) => item.attackPath.pathId !== attackPath.pathId)
    .sort((a, b) => b.risk.score - a.risk.score)
    .slice(0, 5);

  return (
    <PageShell width="full">
      <div
        data-testid="paths-dual-pane"
        className="grid gap-5 md:grid-cols-[minmax(20rem,23.75rem)_minmax(0,1fr)] md:items-start"
      >
        <PathsSidebar
          currentPathId={attackPath.pathId}
          loading={siblingPaths.loading}
          error={siblingPaths.error}
          onRetry={siblingPaths.refetch}
          assessments={siblingPaths.data ?? []}
        />
        <div className="flex min-w-0 flex-col gap-5">
      <div className="sticky top-0 z-20 -mx-1 flex flex-col gap-2 bg-bg/95 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <BackLink sticky />
          {upNextSiblings.length > 0 ? (
            <nav
              aria-label="Sibling attack paths"
              data-testid="path-siblings-strip"
              className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 md:hidden"
            >
              <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Up next
              </span>
              {upNextSiblings.map(({ attackPath: sibling, risk }) => (
                <Link
                  key={sibling.pathId}
                  href={`/attack-paths/${sibling.pathId}`}
                  className="inline-flex max-w-[11rem] items-center gap-1 rounded-control border border-line bg-surface px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-brand hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  title={sibling.name}
                >
                  <span className="min-w-0 truncate">{sibling.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-subtle">
                    {risk.band}
                  </span>
                </Link>
              ))}
              <Link
                href="/attack-paths"
                className="shrink-0 text-[11px] font-semibold text-brand hover:text-brand-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                All paths →
              </Link>
            </nav>
          ) : null}
        </div>
        <ProofStageStrip
          stage="Understand"
          // Claim display label — never raw evidenceBasis alone so partial
          // labels cannot render as a solid Measured pill.
          basis={pathClaim.displayLabel}
          owner={null}
          nextCta={pathPrimaryCta}
        />
      </div>
      <div
        className="flex flex-col gap-3"
        data-testid="path-claim-hero"
        data-claim-kind={pathClaim.kind}
        data-claim-safe-state={pathProjection.claimSafeValidationState}
        data-risk-band-display={riskBandLabel}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              {attackPath.name}
            </h1>
            <p className="mt-1 font-mono text-xs text-subtle">
              path·{attackPath.pathId} · {measuredEdgeCount}/{totalEdgeCount}{" "}
              hops measured · {pathClaim.displayLabel}
              {pathFullyMeasured ? " · fully measured" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Fixed → Closed (risk); never conflate with remediation Fixed */}
            <RiskBandBadge band={risk.band} dot={false} />
            <AttackPathClaimBadge attackPath={attackPath} />
            <details className="rounded-control border border-line px-2 py-1 text-xs text-muted">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wide text-subtle">
                Score & basis
              </summary>
              <div className="mt-2 flex flex-col gap-1.5 pb-1">
                <span className="font-mono text-xs text-muted">
                  score {risk.score} · conf {attackPath.confidence.toFixed(2)}
                </span>
                <EvidenceBasisBadge
                  basis={attackPath.evidenceBasis}
                  dot={false}
                />
                {pathProjection.remapped ? (
                  <span
                    className="max-w-xs text-[11px] leading-4 text-muted"
                    data-testid="path-claim-remap-note"
                    title={pathProjection.remapReason ?? undefined}
                  >
                    Recorded workflow: {pathProjection.recordedValidationState}{" "}
                    → claim-safe {pathProjection.claimSafeValidationState}.{" "}
                    {pathProjection.remapReason}
                  </span>
                ) : null}
              </div>
            </details>
          </div>
        </div>
        <p className="max-w-3xl text-sm text-muted">{riskSummary}</p>
        {pathProjection.remapped ? (
          <p
            className="max-w-3xl text-[12px] text-muted"
            data-testid="path-claim-remap-banner"
            role="status"
          >
            Path certainty stays {pathClaim.displayLabel.toLowerCase()} — hop
            measurement does not support recorded{" "}
            {pathProjection.recordedValidationState}. Severity alone never
            validates a path.
          </p>
        ) : null}
        {attackPath.methodology ? (
          <details className="max-w-3xl text-[12px] text-subtle">
            <summary className="cursor-pointer font-display font-semibold uppercase tracking-[0.08em]">
              Methodology
            </summary>
            <p className="mt-1 leading-5">{attackPath.methodology}</p>
          </details>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {/* ICP-P1-15: primary = Measure hops; demote whole-path mission. */}
          <a
            href={pathPrimaryCta.href}
            className={buttonClassName({ variant: "primary" })}
            data-testid="path-measure-primary-cta"
          >
            {pathPrimaryCta.label}
          </a>
          <button
            type="button"
            onClick={() => setShowVerification((current) => !current)}
            className={buttonClassName({ variant: "secondary" })}
            data-testid="path-policy-mission-cta"
          >
            Policy-gated path mission
          </button>
          <button
            type="button"
            onClick={exportPath}
            className={buttonClassName({ variant: "ghost" })}
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* P08 / P01-15: single primary proof chrome — sticky ProofStageStrip only.
          Full ProofLoopContext (8-stage soup + duplicate CTA) is intentionally
          omitted on path detail to avoid dual proof chrome. */}

      <MeasurementStateSummary
        loading={measurementState.loading}
        error={measurementState.error}
        onRetry={measurementState.refetch}
        state={measurementState.data}
        fallbackMeasured={measuredEdgeCount}
        fallbackTotal={totalEdgeCount}
        fallbackFullyMeasured={pathFullyMeasured}
        pathEvidenceBasis={attackPath.evidenceBasis}
        plan={validationPlan.data}
      />

      <Panel data-testid="path-next-mission-panel">
        <PanelHeader title="Next recommended mission" />
        <div className="space-y-3 p-4">
          <p className="text-xs leading-5 text-muted">
            Signal-driven and hop-measurement advisory only. Human approval
            creates a <strong className="font-medium text-ink">Draft</strong>{" "}
            mission — never autonomous replan or auto-queue.
          </p>
          {nextMission.loading ? (
            <LoadingSkeleton rows={2} />
          ) : nextMission.error ? (
            <ErrorState
              message={nextMission.error}
              onRetry={nextMission.refetch}
            />
          ) : !(approvedNextMission ?? nextMission.data) ? (
            <EmptyState
              title="No next mission yet"
              description="When this path has evidence and hop/signal drivers, Periscan will propose a human-gated next mission here."
            />
          ) : (
            (() => {
              const rec = approvedNextMission ?? nextMission.data!;
              const actionable =
                rec.status === "Proposed" &&
                Boolean(rec.missionPlan.scopeId) &&
                rec.approvalRequired;
              return (
                <div className="space-y-3" data-testid="path-next-mission-body">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {rec.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        {rec.rationale}
                      </p>
                    </div>
                    <StateBadge
                      tone={
                        rec.status === "Approved"
                          ? "fixed"
                          : rec.status === "NotActionable"
                            ? "missed"
                            : "approval"
                      }
                      dot={false}
                    >
                      {rec.status}
                    </StateBadge>
                  </div>
                  <dl className="grid gap-2 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-subtle">Mission type</dt>
                      <dd className="mt-0.5 font-mono text-ink">
                        {rec.missionPlan.missionType}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Hops measured</dt>
                      <dd className="mt-0.5 font-mono text-ink">
                        {rec.measuredEdgeCount}/{rec.totalEdgeCount}
                        {rec.unmeasuredEdgeCount > 0
                          ? ` · ${rec.unmeasuredEdgeCount} open`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Drivers</dt>
                      <dd className="mt-0.5 flex flex-wrap gap-1">
                        {rec.drivers.map((driver) => (
                          <span
                            key={driver}
                            className="rounded-control border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted"
                          >
                            {driver}
                          </span>
                        ))}
                      </dd>
                    </div>
                  </dl>
                  {rec.missionPlan.moduleIds.length > 0 ? (
                    <p className="font-mono text-[11px] text-subtle">
                      modules · {rec.missionPlan.moduleIds.join(" · ")}
                    </p>
                  ) : null}
                  {rec.matchedTriggerIds.length > 0 ? (
                    <p className="text-[11px] text-muted">
                      Signal triggers: {rec.matchedTriggerIds.join(", ")}
                    </p>
                  ) : null}
                  <details className="text-[11px] text-subtle">
                    <summary className="cursor-pointer text-muted">
                      Honesty notes
                    </summary>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {rec.honestyNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </details>
                  {nextMissionError ? (
                    <InlineError message={nextMissionError} />
                  ) : null}
                  {approvedMissionId ? (
                    <p
                      className="text-xs text-muted"
                      data-testid="path-next-mission-approved"
                      role="status"
                    >
                      Draft mission created (not queued).{" "}
                      <Link
                        href="/missions"
                        className="font-semibold text-brand hover:text-brand-2"
                      >
                        Open missions →
                      </Link>{" "}
                      <span className="font-mono text-[10px] text-subtle">
                        {approvedMissionId}
                      </span>
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!actionable || nextMissionBusy}
                      className={buttonClassName({ variant: "primary" })}
                      data-testid="path-next-mission-approve"
                      onClick={() => {
                        void (async () => {
                          setNextMissionBusy(true);
                          setNextMissionError(null);
                          try {
                            const result =
                              await api.approveAttackPathNextMission(id);
                            setApprovedNextMission(result.recommendation);
                            const missionId =
                              result.mission &&
                              typeof result.mission === "object" &&
                              "missionId" in result.mission
                                ? String(
                                    (result.mission as { missionId: string })
                                      .missionId
                                  )
                                : null;
                            setApprovedMissionId(missionId);
                            await nextMission.refetch();
                          } catch (caught) {
                            setNextMissionError(
                              caught instanceof Error
                                ? caught.message
                                : "Unable to approve next mission."
                            );
                          } finally {
                            setNextMissionBusy(false);
                          }
                        })();
                      }}
                    >
                      {nextMissionBusy
                        ? "Applying…"
                        : rec.status === "Approved"
                          ? "Applied"
                          : rec.status === "NotActionable"
                            ? "Needs verified scope"
                            : "Apply recommendation"}
                    </button>
                    {rec.status === "NotActionable" ? (
                      <Link
                        href="/scopes"
                        className={buttonClassName({ variant: "secondary" })}
                      >
                        Verify scope
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </Panel>

      {financialExposure ? (
        <Panel>
          <PanelHeader title="Financial exposure · assumption-based" />
          <div className="grid gap-4 p-4 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="font-display text-3xl font-semibold tracking-tight text-ink">
                {formatUsd(financialExposure.annualizedLossExposureUsd)}
              </p>
              <p className="mt-1 text-xs text-muted">
                annualized loss exposure for{" "}
                {financialExposure.businessServiceName}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-subtle">Planning range</dt>
                  <dd className="mt-0.5 text-ink">
                    {formatUsd(financialExposure.lowerBoundUsd)}–
                    {formatUsd(financialExposure.upperBoundUsd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">Confidence</dt>
                  <dd className="mt-0.5 text-ink">
                    {financialExposure.confidence}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">Expected frequency</dt>
                  <dd className="mt-0.5 text-ink">
                    {financialExposure.expectedLossEventFrequencyPerYear}/year
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">Expected magnitude</dt>
                  <dd className="mt-0.5 text-ink">
                    {formatUsd(financialExposure.expectedLossMagnitudeUsd)}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="border-l-0 border-line lg:border-l lg:pl-4">
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">
                Method and assumptions
              </p>
              <p className="mt-1 text-sm text-muted">
                {financialExposure.methodology}. PERT mean frequency × PERT mean
                magnitude; no simulated precision is added beyond the supplied
                ranges.
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-subtle">
                {financialExposure.assumptions.map((assumption) => (
                  <li key={assumption}>• {assumption}</li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">
                Financial exposure not estimated
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Add explicit ranges to a discovered path asset; Periscan will
                not invent a dollar value.
              </p>
            </div>
            <Link
              href="/attack-paths"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Add assumptions
            </Link>
          </div>
        </Panel>
      )}

      {showVerification ? (
        <Panel id="safe-verification">
          <PanelHeader title="Request controlled path validation" />
          <div className="space-y-3 p-4">
            <p className="max-w-3xl text-sm text-muted">
              This creates a policy decision and an approval-required mission.
              It does not queue or execute validation until an authorized
              operator approves and starts it.
            </p>
            {scopes.loading ? (
              <LoadingSkeleton rows={2} />
            ) : scopes.error ? (
              <ErrorState message={scopes.error} onRetry={scopes.refetch} />
            ) : verifiedScopes.length === 0 ? (
              <p className="text-sm text-muted">
                A verified scope is required.{" "}
                <Link href="/scopes" className="text-brand hover:text-brand-2">
                  Verify a scope first
                </Link>
                .
              </p>
            ) : verificationRequest ? (
              <div className="rounded-card border border-fixed/40 bg-fixed/8 p-3 text-sm">
                <p className="font-medium text-ink">Approval request created</p>
                <p className="mt-1 text-muted">
                  {verificationRequest.verificationPlan.nextStep}
                </p>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-subtle">Mission</dt>
                    <dd className="font-mono text-ink">
                      {verificationRequest.mission.missionId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-subtle">Policy decision</dt>
                    <dd className="font-mono text-ink">
                      {verificationRequest.policyDecision.policyDecisionId}
                    </dd>
                  </div>
                </dl>
                <Link
                  href="/missions"
                  className={
                    buttonClassName({ size: "sm", variant: "secondary" }) +
                    " mt-3"
                  }
                >
                  Open Validation Snapshot
                </Link>
              </div>
            ) : (
              <>
                {verifiedScopes.length > 1 ? (
                  <label className="flex max-w-md flex-col gap-1 text-xs text-muted">
                    Verified scope
                    <select
                      value={scopeId}
                      onChange={(event) => setScopeId(event.target.value)}
                      className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
                    >
                      <option value="">Choose scope…</option>
                      {verifiedScopes.map((scope) => (
                        <option key={scope.scopeId} value={scope.scopeId}>
                          {scope.value}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <ScopeSummary scope={verifiedScopes[0]!} />
                )}
                <label className="flex max-w-2xl flex-col gap-1 text-xs text-muted">
                  Reason (optional)
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                    maxLength={1024}
                    placeholder="Why this path needs fresh measured proof"
                    className="resize-y rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
                  />
                </label>
                {verificationError ? (
                  <InlineError
                    message={verificationError}
                    onDismiss={() => setVerificationError(null)}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={requestVerification}
                  disabled={verificationBusy}
                  className={buttonClassName({ variant: "primary" })}
                >
                  {verificationBusy
                    ? "Creating request…"
                    : "Create approval request"}
                </button>
              </>
            )}
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: graph + hop measurement */}
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Path graph" />
            <div className="p-4">
              {attackPath.pathNodes.length > 0 ? (
                <AttackPathGraph
                  attackPath={attackPath}
                  title=""
                  height={300}
                />
              ) : (
                <p className="py-6 text-center text-sm text-subtle">
                  This path has no resolved nodes to graph.
                </p>
              )}
            </div>
          </Panel>

          {/* UX-W5 / 190: primary visual emphasis on first path breaker / cheapest link */}
          {(weakestEdge || primaryBreaker) && (
            <Panel
              id="weakest-link"
              data-testid="weakest-link-spotlight"
              className="border-brand/40 ring-1 ring-brand/25"
            >
              <div className="border-b border-brand/25 bg-brand/[0.06] px-4 py-3">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
                  Weakest link
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Break the cheapest unmeasured hop first — path claim follows
                  weakest-edge certainty, never launch status alone.
                </p>
              </div>
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  {weakestEdge ? (
                    <>
                      <p className="text-[13px] font-medium text-ink">
                        Hop {(weakestEdgeIndex >= 0 ? weakestEdgeIndex : 0) + 1}
                        {": "}
                        {nodeById.get(weakestEdge.sourceNodeId) ?? "?"}{" "}
                        <span className="text-subtle">→</span>{" "}
                        {nodeById.get(weakestEdge.targetNodeId) ?? "?"}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-brand">
                        {weakestEdge.relationship}
                      </p>
                    </>
                  ) : primaryBreaker ? (
                    <>
                      <p className="text-[13px] font-medium text-ink">
                        {primaryBreaker.title}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {primaryBreaker.description}
                      </p>
                    </>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {weakestEdge ? (
                    <a
                      href={`#hop-card-anchor-${weakestEdge.pathEdgeId}`}
                      className={buttonClassName({
                        size: "sm",
                        variant: "primary"
                      })}
                      data-testid="weakest-link-measure-cta"
                    >
                      Inspect weakest hop
                    </a>
                  ) : null}
                  {primaryBreaker ? (
                    <a
                      href="#path-breakers"
                      className={buttonClassName({
                        size: "sm",
                        variant: weakestEdge ? "secondary" : "primary"
                      })}
                    >
                      Choose path breaker
                    </a>
                  ) : null}
                </div>
              </div>
            </Panel>
          )}

          <Panel id="hop-measurement">
            <PanelHeader
              title={`Hop measurement (${orderedEdges.length})`}
            />
            {validationPlan.loading && !validationPlan.data ? (
              <LoadingSkeleton rows={4} />
            ) : validationPlan.error && !validationPlan.data ? (
              <ErrorState
                title="Couldn't load hop validation plan"
                message={validationPlan.error}
                onRetry={validationPlan.refetch}
              />
            ) : orderedEdges.length === 0 ? (
              <EmptyState
                className="m-3 py-8"
                title="No edges recorded"
                description="Nothing to measure on this path until edges are linked from validation."
              />
            ) : (
              <>
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-subtle px-4 py-3"
                  role="status"
                  aria-label={`${measuredEdgeCount} of ${totalEdgeCount} path edges measured`}
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                      Weakest-edge certainty
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      A path is Measured only when every hop is independently
                      measured with evidence. Launch alone never upgrades a hop.
                    </p>
                    {validationPlan.data?.claimSummary ? (
                      <p className="mt-1 text-[12px] text-ink">
                        {validationPlan.data.claimSummary}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono text-[12px] text-ink">
                      {measuredEdgeCount}/{totalEdgeCount} measured
                    </span>
                    {validationPlan.data ? (
                      <StateBadge
                        tone={
                          PLAN_STATUS_TONE[validationPlan.data.overallStatus] ??
                          "neutral"
                        }
                        dot={false}
                      >
                        {validationPlan.data.overallStatus}
                      </StateBadge>
                    ) : null}
                  </div>
                </div>

                {verifiedScopes.length > 1 ? (
                  <div className="border-b border-line px-4 py-3">
                    <label className="flex max-w-md flex-col gap-1 text-xs text-muted">
                      Verified scope for hop measurement
                      <select
                        value={hopMeasureScopeId}
                        onChange={(event) =>
                          setHopMeasureScopeId(event.target.value)
                        }
                        className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
                      >
                        <option value="">Choose scope…</option>
                        {verifiedScopes.map((scope) => (
                          <option key={scope.scopeId} value={scope.scopeId}>
                            {scope.value}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                <ol aria-label="Path hop measurement plan">
                  {orderedEdges.map((edge, index) => {
                    const planItem = planByEdgeId.get(edge.pathEdgeId);
                    const edgeState = edgeStateById.get(edge.pathEdgeId);
                    const evidenceBasis =
                      edgeState?.evidenceBasis ?? edge.evidenceBasis;
                    const eligibility = planItem?.eligibility;
                    const canMeasure =
                      eligibility != null &&
                      LAUNCHABLE_ELIGIBILITY.has(eligibility) &&
                      (planItem?.recommendedModuleIds.length ?? 0) > 0;
                    const blocked = eligibility
                      ? eligibilityBlockedHint(eligibility)
                      : null;
                    const launchResult = launchResultByEdge[edge.pathEdgeId];
                    const launchError = launchErrorByEdge[edge.pathEdgeId];
                    const busy = launchBusyEdgeId === edge.pathEdgeId;

                    const isWeakest =
                      weakestEdge?.pathEdgeId === edge.pathEdgeId;
                    const hopEvidenceCount = (
                      edgeState?.evidenceIds ?? edge.evidenceIds
                    ).length;

                    return (
                      <li
                        key={edge.pathEdgeId}
                        id={`hop-card-anchor-${edge.pathEdgeId}`}
                        className={
                          isWeakest
                            ? "scroll-mt-24 border-b border-brand/30 bg-brand/[0.04] px-4 py-4 last:border-b-0 ring-1 ring-inset ring-brand/20"
                            : "border-b border-line px-4 py-4 last:border-b-0"
                        }
                        data-testid={`hop-card-${edge.pathEdgeId}`}
                        data-weakest-link={isWeakest ? "true" : undefined}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2.5">
                            {/* UX-W9 / #194 — hop index badge weight encodes evidence count, not severity. */}
                            <span
                              data-testid={`hop-index-badge-${edge.pathEdgeId}`}
                              data-evidence-count={hopEvidenceCount}
                              title={`${hopEvidenceCount} evidence reference${hopEvidenceCount === 1 ? "" : "s"}`}
                              aria-label={`Hop ${index + 1}, ${hopEvidenceCount} evidence reference${hopEvidenceCount === 1 ? "" : "s"}`}
                              className={cn(
                                "mt-0.5 inline-flex shrink-0 items-center justify-center rounded-control border border-line bg-elevated font-mono text-ink",
                                hopEvidenceCount === 0 &&
                                  "size-5 text-[10px] font-medium opacity-70",
                                hopEvidenceCount === 1 &&
                                  "size-6 text-[11px] font-semibold",
                                hopEvidenceCount >= 2 &&
                                  "size-7 text-[12px] font-bold ring-1 ring-brand/35"
                              )}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
                                Hop {index + 1}
                                {planItem != null
                                  ? ` · seq ${planItem.sequence}`
                                  : ""}
                              </p>
                              <p className="mt-0.5 text-[13px] text-ink">
                                {nodeById.get(edge.sourceNodeId) ?? "?"}{" "}
                                <span className="text-subtle">→</span>{" "}
                                {nodeById.get(edge.targetNodeId) ?? "?"}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <EvidenceBasisBadge
                              basis={evidenceBasis}
                              dot={false}
                            />
                            {eligibility ? (
                              <StateBadge
                                tone={ELIGIBILITY_TONE[eligibility] ?? "neutral"}
                                dot={false}
                                aria-label={`Hop eligibility: ${eligibility}`}
                              >
                                {eligibility}
                              </StateBadge>
                            ) : validationPlan.loading ? (
                              <span className="font-mono text-[10px] text-subtle">
                                plan loading…
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <p className="mt-1 font-mono text-[11px] text-brand">
                          {edge.relationship}
                          {edge.measurementMethod || edgeState?.measurementMethod
                            ? ` · ${edge.measurementMethod ?? edgeState?.measurementMethod}`
                            : ""}
                        </p>
                        {edge.rationale ? (
                          <p className="mt-1 text-[12px] text-muted">
                            {edge.rationale}
                          </p>
                        ) : null}

                        {planItem ? (
                          <div className="mt-3 space-y-2 rounded-control border border-line bg-elevated/40 px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <SafetyLevelBadge
                                level={planItem.safetyLevel}
                                dot={false}
                              />
                              <span className="font-mono text-[10px] text-subtle">
                                {planItem.missionType}
                                {planItem.requiresInternalRunner
                                  ? " · runner required"
                                  : ""}
                              </span>
                            </div>

                            {planItem.recommendedModuleIds.length > 0 ? (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">
                                  Recommended modules
                                </p>
                                <ul className="mt-1 flex flex-wrap gap-1.5">
                                  {planItem.recommendedModuleIds.map(
                                    (moduleId) => (
                                      <li
                                        key={moduleId}
                                        className="rounded-control border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink"
                                      >
                                        {moduleId}
                                      </li>
                                    )
                                  )}
                                </ul>
                              </div>
                            ) : (
                              <p className="text-[12px] text-muted">
                                No safe hop-probe modules recommended for this
                                relationship.
                              </p>
                            )}

                            {planItem.prerequisites.length > 0 ? (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">
                                  Prerequisites
                                </p>
                                <ul className="mt-1 space-y-0.5 text-[12px] text-muted">
                                  {planItem.prerequisites.map((item) => (
                                    <li key={item}>• {item}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {planItem.missingTelemetry.length > 0 ? (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">
                                  Missing telemetry
                                </p>
                                <ul className="mt-1 flex flex-wrap gap-1.5">
                                  {planItem.missingTelemetry.map((signal) => (
                                    <li
                                      key={signal}
                                      className="rounded-control border border-dashed border-inconclusive/50 px-1.5 py-0.5 font-mono text-[10px] text-inconclusive-text"
                                    >
                                      {signal}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {planItem.requiredScopeTypes.length > 0 ? (
                              <p className="font-mono text-[10px] text-subtle">
                                scope types:{" "}
                                {planItem.requiredScopeTypes.join(", ")}
                              </p>
                            ) : null}
                          </div>
                        ) : validationPlan.error ? (
                          <p className="mt-2 text-[12px] text-muted">
                            Hop plan unavailable — {validationPlan.error}
                          </p>
                        ) : null}

                        <p className="mt-2 font-mono text-[10px] text-subtle">
                          {(edgeState?.evidenceIds ?? edge.evidenceIds).length}{" "}
                          evidence reference
                          {(edgeState?.evidenceIds ?? edge.evidenceIds)
                            .length === 1
                            ? ""
                            : "s"}
                          {edgeState?.latestReceiptId
                            ? ` · receipt ${shortId(edgeState.latestReceiptId)}`
                            : ""}
                        </p>

                        {canMeasure ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {(() => {
                              const measureDisabled = busy || scopes.loading;
                              const disabledReasonId = `hop-measure-disabled-${edge.pathEdgeId}`;
                              const helpId = `hop-measure-help-${edge.pathEdgeId}`;
                              return (
                                <>
                                  <button
                                    type="button"
                                    data-testid={`measure-hop-${edge.pathEdgeId}`}
                                    onClick={() =>
                                      planItem
                                        ? void measureHop(planItem)
                                        : undefined
                                    }
                                    disabled={measureDisabled}
                                    aria-busy={busy || undefined}
                                    aria-disabled={
                                      measureDisabled ? true : undefined
                                    }
                                    aria-describedby={
                                      measureDisabled
                                        ? `${helpId} ${disabledReasonId}`
                                        : helpId
                                    }
                                    className={buttonClassName({
                                      size: "sm",
                                      variant: "primary",
                                      // ICP 5.0 residual: explicit focus ring on hop measure CTAs
                                      className:
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                                    })}
                                    aria-label={
                                      planItem?.eligibility === "HeuristicOnly"
                                        ? `Re-import graph for hop ${index + 1} (heuristic only)`
                                        : `Measure hop ${index + 1} (safe)`
                                    }
                                  >
                                    {busy
                                      ? "Requesting…"
                                      : planItem?.eligibility ===
                                          "HeuristicOnly"
                                        ? "Re-import graph (heuristic)"
                                        : "Measure hop (safe)"}
                                  </button>
                                  <p
                                    id={helpId}
                                    className="text-[11px] text-subtle"
                                  >
                                    {planItem?.eligibility === "HeuristicOnly"
                                      ? "Imports an approved BloodHound-compatible graph for Heuristic re-check. Never mints Measured path proof."
                                      : "Creates a policy decision and may queue a safe hop probe. Does not mark this hop Measured until a receipt with evidence is applied."}
                                  </p>
                                  {measureDisabled ? (
                                    <span
                                      id={disabledReasonId}
                                      className="sr-only"
                                    >
                                      {scopes.loading
                                        ? "Disabled while verified scopes load."
                                        : "Hop measurement request in progress."}
                                    </span>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>
                        ) : blocked ? (
                          <div className="mt-3 rounded-control border border-dashed border-line px-3 py-2 text-[12px] text-muted">
                            <p>{blocked.message}</p>
                            {blocked.href && blocked.label ? (
                              <Link
                                href={blocked.href}
                                className="mt-1 inline-block text-brand hover:text-brand-2"
                              >
                                {blocked.label} →
                              </Link>
                            ) : null}
                          </div>
                        ) : null}

                        {launchError ? (
                          <div className="mt-2">
                            <InlineError
                              message={launchError}
                              onDismiss={() =>
                                setLaunchErrorByEdge((current) => {
                                  const next = { ...current };
                                  delete next[edge.pathEdgeId];
                                  return next;
                                })
                              }
                            />
                          </div>
                        ) : null}

                        {launchResult ? (
                          <HopLaunchResultCard
                            result={launchResult}
                            onReceiptApplied={() => {
                              void path.refetch();
                              void validationPlan.refetch();
                              void measurementState.refetch();
                              void edgeReceipts.refetch();
                            }}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </Panel>
        </div>

        {/* Right: risk factors + breakers + receipts */}
        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Risk factors" />
            <RiskFactorBreakdown
              factors={risk.factors}
              formula="Risk = clamp(sum of atomic factor contributions, 0, 100)."
              score={risk.score}
            />
          </Panel>

          <Panel id="path-breakers">
            <PanelHeader title={`Path breakers (${breakers.length})`} />
            {breakers.length === 0 ? (
              <p className="px-4 py-6 text-sm text-subtle">
                No path breakers identified yet.
              </p>
            ) : (
              <ul>
                {breakers.map((breaker) => (
                  <li
                    key={breaker.pathBreakerId}
                    className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0"
                  >
                    <span className="mt-0.5 rounded-control bg-fixed/14 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-fixed">
                      P{breaker.priority}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink">{breaker.title}</p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {breaker.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* UX-W9 / #195 / P08 — counterfactual is estimate-only; red-team grade
              copy refuses residual risk math and Fixed claims without remeasure. */}
          <details
            data-testid="counterfactual-drawer"
            className="overflow-hidden rounded-card border border-[#1e3568] bg-surface shadow-[0_18px_48px_rgba(0,0,0,0.16)]"
          >
            <summary className="cursor-pointer list-none border-b border-brand/40 bg-[linear-gradient(180deg,#1a2f7a,#13245c)] px-4 py-3 font-display text-[15px] font-semibold tracking-[-0.01em] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              If measured fixed… (estimate only)
            </summary>
            <div className="space-y-3 px-4 py-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-approval">
                Estimate / heuristic only · not a residual risk score
              </p>
              <p className="text-[12px] leading-5 text-muted">
                Red-team counterfactual: narrative outline of recorded path
                breakers <em>if</em> remediation were later measured fixed.
                This is not a scored risk delta, residual probability, ALE
                projection, or min-cut residual. It does not claim the path is
                closed — Fixed is only via re-measurement with evidence IDs.
              </p>
              {breakers.length === 0 ? (
                <p className="text-sm text-subtle">
                  No path breakers recorded yet. Counterfactual guidance appears
                  when breakers are identified from evidence — still estimate
                  only, never invented residual scores.
                </p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {breakers.map((breaker) => (
                    <li
                      key={`cf-${breaker.pathBreakerId}`}
                      className="rounded-control border border-line bg-elevated/50 px-3 py-2"
                    >
                      <p className="text-[13px] text-ink">
                        <span className="mr-1.5 font-mono text-[10px] font-semibold text-fixed">
                          P{breaker.priority}
                        </span>
                        {breaker.title}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {breaker.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          <EdgeReceiptsTimeline
            loading={edgeReceipts.loading}
            error={edgeReceipts.error}
            onRetry={edgeReceipts.refetch}
            receipts={edgeReceipts.data ?? []}
            nodeById={nodeById}
            orderedEdges={orderedEdges}
          />
        </div>
      </div>

      {/* Evidence chain */}
      <Panel>
        <PanelHeader
          title="Evidence"
          link={{ href: "/evidence", label: "Evidence ledger" }}
        />
        {evidence.loading ? (
          <LoadingSkeleton rows={3} />
        ) : evidence.error ? (
          <ErrorState message={evidence.error} onRetry={evidence.refetch} />
        ) : (evidence.data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-subtle">
            No evidence artifacts are linked to this path.
          </p>
        ) : (
          <ul>
            {(evidence.data ?? []).map((artifact) => (
              <li
                key={artifact.evidenceId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0"
              >
                <Link
                  href={`/evidence?evidenceId=${encodeURIComponent(artifact.evidenceId)}`}
                  className="font-mono text-[11px] text-brand hover:text-brand-2"
                >
                  ev·{artifact.evidenceId.slice(0, 8)}
                </Link>
                <span className="text-[12.5px] text-ink">
                  {artifact.artifactType}
                </span>
                <StateBadge
                  tone={
                    SENSITIVITY_TONE[artifact.sensitivityLevel] ?? "neutral"
                  }
                  dot={false}
                >
                  {artifact.sensitivityLevel}
                </StateBadge>
                <StateBadge
                  tone={REDACTION_TONE[artifact.redactionStatus] ?? "neutral"}
                  dot={false}
                >
                  {artifact.redactionStatus}
                </StateBadge>
                <span className="ml-auto font-mono text-[11px] text-subtle">
                  sha256 {shortHash(artifact.sha256)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
        </div>
      </div>
    </PageShell>
  );
}

function PathsSidebar({
  currentPathId,
  assessments,
  loading,
  error,
  onRetry
}: {
  currentPathId: string;
  assessments: AttackPathAssessment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const sorted = useMemo(
    () => [...assessments].sort((a, b) => b.risk.score - a.risk.score),
    [assessments]
  );

  return (
    <aside
      aria-label="Attack path list"
      className="hidden min-h-0 md:sticky md:top-4 md:flex md:max-h-[calc(100vh-5.5rem)] md:flex-col md:overflow-hidden md:rounded-card md:border md:border-line md:bg-elevated"
    >
      <div className="shrink-0 border-b border-line px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
            Paths
          </p>
          <Link
            href="/attack-paths"
            className="text-[11px] font-semibold text-brand hover:text-brand-2"
          >
            All paths
          </Link>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Select a path to inspect hop certainty and path breakers.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && sorted.length === 0 ? (
          <div className="p-3">
            <LoadingSkeleton rows={5} />
          </div>
        ) : error && sorted.length === 0 ? (
          <div className="p-3">
            <ErrorState message={error} onRetry={onRetry} />
          </div>
        ) : sorted.length === 0 ? (
          <p className="p-3 text-xs text-muted">No attack paths recorded yet.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {sorted.map(({ attackPath, risk }) => {
              const claim = projectPathValidationState(attackPath).claim;
              const selected = attackPath.pathId === currentPathId;
              const hopLabel =
                claim.totalEdgeCount === 0
                  ? "no hops"
                  : `${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops`;
              return (
                <li
                  key={attackPath.pathId}
                  className="border-b border-line last:border-b-0"
                >
                  <Link
                    href={`/attack-paths/${attackPath.pathId}`}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "flex flex-col gap-1.5 px-3 py-2.5 transition-colors hover:bg-surface",
                      selected && "border-l-2 border-l-brand bg-brand/[0.07]"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <RiskBandBadge band={risk.band} dot={false} />
                      <span className="font-mono text-[10px] text-subtle">
                        {hopLabel}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "line-clamp-2 text-[13px] leading-snug text-ink",
                        selected && "font-semibold"
                      )}
                    >
                      {attackPath.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AttackPathClaimBadge attackPath={attackPath} />
                      <EvidenceBasisBadge
                        basis={attackPath.evidenceBasis}
                        dot={false}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function MeasurementStateSummary({
  loading,
  error,
  onRetry,
  state,
  fallbackMeasured,
  fallbackTotal,
  fallbackFullyMeasured,
  pathEvidenceBasis,
  plan
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  state: AttackPathMeasurementState | null;
  fallbackMeasured: number;
  fallbackTotal: number;
  /** Claim-safe fullyMeasured (never invent from hop-count equality alone). */
  fallbackFullyMeasured: boolean;
  pathEvidenceBasis: string;
  plan: AttackPathValidationPlan | null;
}) {
  const measured = state?.measuredEdgeCount ?? fallbackMeasured;
  const total = state?.totalEdgeCount ?? fallbackTotal;
  // API fullyMeasured is authoritative when present; otherwise claim language.
  // Never upgrade Heuristic → FullyMeasured from measured===total alone.
  const fullyMeasured = state?.fullyMeasured ?? fallbackFullyMeasured;
  const basis = state?.pathEvidenceBasis ?? pathEvidenceBasis;

  return (
    <Panel>
      <PanelHeader title="Path measurement state" />
      {loading && !state ? (
        <LoadingSkeleton rows={2} />
      ) : error && !state ? (
        <ErrorState
          title="Couldn't load measurement state"
          message={error}
          onRetry={onRetry}
        />
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
          <div>
            {/* UX-W13: claim-safe complete status when every hop has receipt evidence. */}
            {fullyMeasured && total > 0 ? (
              <div
                role="status"
                data-testid="path-measure-complete-status"
                className="rounded-control border border-fixed/25 bg-fixed/[0.04] px-3 py-2"
              >
                <p className="text-sm text-ink">
                  All {total} hops have Measured receipts with evidence.
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  FullyMeasured reflects edge receipts only — launch status never
                  upgrades path certainty.
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink">
                {total === 0
                  ? "This path has no hops to measure."
                  : `${measured} of ${total} hops measured with evidence. Path claim stays governed by weakest-edge basis.`}
              </p>
            )}
            {plan?.claimSummary ? (
              <p className="mt-1 text-[12px] text-muted">{plan.claimSummary}</p>
            ) : !fullyMeasured ? (
              <p className="mt-1 text-[12px] text-muted">
                Measured edge ratio is derived from path edge receipts — not from
                launch status alone. FullyMeasured requires every hop Measured
                with evidence IDs — hop count equality alone never upgrades.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <span
              className="font-mono text-sm text-ink"
              aria-label={`Measured edge ratio ${measured} of ${total}`}
            >
              {measured}/{total} measured
            </span>
            <EvidenceBasisBadge basis={basis} dot={false} />
            {fullyMeasured ? (
              <StateBadge tone="fixed" dot={false}>
                FullyMeasured
              </StateBadge>
            ) : null}
          </div>
        </div>
      )}
    </Panel>
  );
}

function HopLaunchResultCard({
  result,
  onReceiptApplied
}: {
  result: PathEdgeValidationLaunchResult;
  onReceiptApplied?: () => void;
}) {
  const isDenied = result.status === "Denied";
  const isQueued = result.status === "Queued" || result.queued;
  const isApproval = result.status === "RequiresApproval";
  const missionId = result.mission?.missionId ?? null;
  const pathId = result.attackPath.attackPath.pathId;
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyOk, setApplyOk] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [evidenceCount, setEvidenceCount] = useState(0);
  // Stable callback ref so poll effect does not re-subscribe every parent render.
  const onReceiptAppliedRef = useRef(onReceiptApplied);
  onReceiptAppliedRef.current = onReceiptApplied;

  // P05-1: poll hop-bound mission runs so operators can apply a receipt without
  // raw API access once the probe completes with evidence. Also detect system
  // auto-apply (runner / control-plane) so Measure hop is not API-only theater.
  useEffect(() => {
    if (!missionId || isDenied) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let receiptRefreshNotified = false;

    async function detectAutoAppliedReceipt(): Promise<boolean> {
      try {
        const receipts = await api.listAttackPathEdgeReceipts(pathId);
        if (cancelled) return false;
        const match = receipts.find(
          (receipt) =>
            receipt.pathEdgeId === result.pathEdgeId ||
            receipt.hopKey === result.hopKey
        );
        if (!match) {
          return false;
        }
        setApplyOk(true);
        setAutoApplied(
          match.measurementMethod === "hop-probe-auto" ||
            match.actor === "system:auto-apply" ||
            (typeof match.actor === "string" &&
              match.actor.startsWith("runner:"))
        );
        if (!receiptRefreshNotified) {
          receiptRefreshNotified = true;
          onReceiptAppliedRef.current?.();
        }
        return true;
      } catch {
        return false;
      }
    }

    async function poll() {
      try {
        const runs = await api.listMissionRuns(missionId!);
        if (cancelled) return;
        const hopRun =
          runs.find((run) => {
            const target = run.target as Record<string, unknown> | null;
            return (
              target?.pathEdgeId === result.pathEdgeId ||
              target?.hopKey === result.hopKey
            );
          }) ?? runs[0];
        if (!hopRun) {
          setRunStatus("Waiting for run…");
          timer = setTimeout(poll, 4_000);
          return;
        }
        setRunStatus(hopRun.status);
        setEvidenceCount(hopRun.evidenceIds?.length ?? 0);
        if (hopRun.status === "Completed") {
          // Control-plane / runner may have auto-applied; surface honesty without
          // forcing a second manual apply when a receipt already exists.
          const found = await detectAutoAppliedReceipt();
          if (!found && !receiptRefreshNotified) {
            receiptRefreshNotified = true;
            onReceiptAppliedRef.current?.();
          }
          return;
        }
        if (hopRun.status !== "Failed" && hopRun.status !== "Cancelled") {
          timer = setTimeout(poll, 4_000);
        }
      } catch {
        if (!cancelled) {
          setRunStatus("Unable to poll run status");
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [missionId, isDenied, result.pathEdgeId, result.hopKey, pathId]);

  async function applyReceiptFromMission() {
    if (!missionId) return;
    setApplyBusy(true);
    setApplyError(null);
    try {
      const runs = await api.listMissionRuns(missionId);
      const hopRun =
        runs.find((run) => {
          const target = run.target as Record<string, unknown> | null;
          return (
            target?.pathEdgeId === result.pathEdgeId ||
            target?.hopKey === result.hopKey
          );
        }) ?? runs[0];
      if (!hopRun) {
        throw new Error("No validation run found for this hop mission yet.");
      }
      if (hopRun.status !== "Completed") {
        throw new Error(
          `Run is ${hopRun.status}; wait for Completed before applying a Measured receipt.`
        );
      }
      const evidenceIds = hopRun.evidenceIds ?? [];
      if (evidenceIds.length === 0) {
        throw new Error(
          "Completed run has no evidence IDs — cannot mint a Measured receipt (real-first)."
        );
      }
      await api.applyPathEdgeReceipt(
        result.attackPath.attackPath.pathId,
        result.pathEdgeId,
        {
          evidenceIds,
          hopKey: result.hopKey,
          measurementMethod: "hop-probe",
          missionId,
          moduleId: hopRun.moduleId || result.moduleId,
          outcome: hopRun.outcome ?? "hop_probe_completed",
          policyDecisionId: result.policyDecision.policyDecisionId,
          validationRunId: hopRun.runId,
          validationState: hopRun.validationState ?? "Inconclusive"
        }
      );
      setApplyOk(true);
      setAutoApplied(false);
      onReceiptApplied?.();
    } catch (caught) {
      setApplyError(
        caught instanceof Error
          ? caught.message
          : "Couldn't apply hop receipt from mission."
      );
    } finally {
      setApplyBusy(false);
    }
  }

  return (
    <div
      className={
        isDenied
          ? "mt-3 rounded-card border border-missed/40 bg-missed/8 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
          : isQueued
            ? "mt-3 rounded-card border border-validated/40 bg-validated/8 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
            : "mt-3 rounded-card border border-approval/40 bg-approval/8 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
      }
      role="status"
      aria-live="polite"
      tabIndex={-1}
      data-testid={`hop-launch-result-${result.pathEdgeId}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-ink">
          {isDenied
            ? "Hop measurement denied by policy"
            : isQueued
              ? "Measure hop request accepted — queued"
              : "Measure hop request accepted — needs approval"}
        </p>
        <PolicyGateBadge outcome={result.status} dot={false} />
      </div>
      <p className="mt-1 text-[12px] text-muted">
        {isQueued
          ? "Safe hop-probe mission queued. Hop stays unmeasured until a receipt with evidence IDs is applied."
          : isApproval
            ? "Policy decision created. Not queued. Not Measured until approval and a receipt with evidence."
            : "Denied tasks are never queued. Hop stays unmeasured until a permitted validation yields a receipt with evidence."}
      </p>
      {result.verificationPlan?.nextStep ? (
        <p className="mt-2 text-[12px] text-ink">
          {result.verificationPlan.nextStep}
        </p>
      ) : null}
      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-subtle">Module</dt>
          <dd className="font-mono text-ink">{result.moduleId}</dd>
        </div>
        <div>
          <dt className="text-subtle">Hop key</dt>
          <dd className="font-mono text-ink">{result.hopKey}</dd>
        </div>
        {result.mission ? (
          <div>
            <dt className="text-subtle">Mission</dt>
            <dd className="font-mono text-ink">
              {result.mission.missionId}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-subtle">Policy decision</dt>
          <dd className="font-mono text-ink">
            {result.policyDecision.policyDecisionId}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">Queued</dt>
          <dd className="font-mono text-ink">
            {result.queued ? "true" : "false"}
          </dd>
        </div>
        {runStatus ? (
          <div>
            <dt className="text-subtle">Run status</dt>
            <dd className="font-mono text-ink">
              {runStatus}
              {evidenceCount > 0 ? ` · ${evidenceCount} evidence` : ""}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isApproval && result.mission ? (
          <Link
            href="/missions"
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Open Validation Snapshot
          </Link>
        ) : null}
        {missionId && !applyOk ? (
          <button
            type="button"
            onClick={applyReceiptFromMission}
            disabled={applyBusy || runStatus !== "Completed" || evidenceCount < 1}
            className={buttonClassName({ size: "sm", variant: "primary" })}
            data-testid={`apply-hop-receipt-${result.pathEdgeId}`}
          >
            {applyBusy
              ? "Applying receipt…"
              : runStatus === "Completed" && evidenceCount > 0
                ? "Apply hop receipt from mission"
                : "Waiting for completed run + evidence"}
          </button>
        ) : null}
        {applyOk ? (
          <p
            className="text-xs font-medium text-validated"
            data-testid={`hop-receipt-applied-${result.pathEdgeId}`}
          >
            {autoApplied
              ? "Hop receipt auto-applied from completed probe — measurement state refreshed. Launch never upgrades certainty by itself."
              : "Hop receipt applied — measurement state refreshed."}
          </p>
        ) : null}
      </div>
      {applyError ? (
        <p role="alert" className="mt-2 text-xs text-missed">
          {applyError}
        </p>
      ) : null}
    </div>
  );
}

function EdgeReceiptsTimeline({
  loading,
  error,
  onRetry,
  receipts,
  nodeById,
  orderedEdges
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  receipts: PathEdgeReceipt[];
  nodeById: Map<string, string>;
  orderedEdges: { pathEdgeId: string; sourceNodeId: string; targetNodeId: string }[];
}) {
  const edgeLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const edge of orderedEdges) {
      map.set(
        edge.pathEdgeId,
        `${nodeById.get(edge.sourceNodeId) ?? "?"} → ${nodeById.get(edge.targetNodeId) ?? "?"}`
      );
    }
    return map;
  }, [nodeById, orderedEdges]);

  // Newest measured events first — only real receipt timestamps (UX-W5 / 189).
  const orderedReceipts = useMemo(
    () =>
      [...receipts].sort(
        (a, b) =>
          new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
      ),
    [receipts]
  );

  return (
    <Panel data-testid="proof-timeline">
      <PanelHeader title="Proof Timeline" />
      {loading && receipts.length === 0 ? (
        <LoadingSkeleton rows={3} />
      ) : error && receipts.length === 0 ? (
        <ErrorState
          title="Couldn't load measured events"
          message={error}
          onRetry={onRetry}
        />
      ) : orderedReceipts.length === 0 ? (
        <div className="px-4 py-6" data-testid="proof-timeline-empty">
          <p className="text-sm text-subtle">No measured events yet</p>
          <p className="mt-1 text-[12px] text-subtle">
            Measured claims require a hop receipt with tenant-owned evidence IDs
            — launch alone is not enough.
          </p>
        </div>
      ) : (
        <ol aria-label="Proof timeline of measured events">
          {orderedReceipts.map((receipt) => (
            <li
              key={receipt.receiptId}
              className="border-b border-line px-4 py-3 last:border-b-0"
              data-testid={`edge-receipt-${receipt.receiptId}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <time
                    dateTime={receipt.measuredAt}
                    className="font-mono text-[10px] text-subtle"
                  >
                    {new Date(receipt.measuredAt).toLocaleString()}
                  </time>
                  <p className="mt-0.5 font-mono text-[11px] text-brand">
                    {receipt.moduleId}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink">
                    {edgeLabel.get(receipt.pathEdgeId) ?? receipt.hopKey}
                  </p>
                </div>
                <StateBadge tone="validated" variant="outline" dot={false}>
                  {receipt.validationState}
                </StateBadge>
              </div>
              <p className="mt-1 text-[12px] text-muted">
                outcome · {receipt.outcome}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-subtle">
                {receipt.evidenceIds.length} evidence · method{" "}
                {receipt.measurementMethod}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function ScopeSummary({ scope }: { scope: Scope }) {
  return (
    <div className="max-w-md rounded-control border border-line bg-elevated px-3 py-2 text-xs">
      <p className="text-subtle">Verified scope</p>
      <p className="mt-0.5 font-medium text-ink">{scope.value}</p>
    </div>
  );
}

function BackLink({ sticky = false }: { sticky?: boolean } = {}) {
  return (
    <Link
      href="/attack-paths"
      data-testid="attack-path-back-link"
      className={
        sticky
          ? "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          : "inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      }
    >
      <span aria-hidden>←</span> All attack paths
    </Link>
  );
}
