"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  RemediationTask,
  TenantThreatAlert,
  ValidatedFinding
} from "@periscan/shared";
import {
  deriveAttackPathClaim,
  formatRiskBandDisplayLabel
} from "@periscan/shared";

import { projectFindingClaimDisplay } from "../lib/claim-safe-display";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  MULTI_HOP_OPERATOR_JOURNEY,
  resolveMultiHopMeasureCta
} from "../lib/multi-hop-journey";
import { useApiResource } from "../hooks/use-api-resource";
import {
  AttackPathClaimBadge,
  DegradedBanner,
  DistributionChart,
  EvidenceBasisBadge,
  ErrorState,
  LoadingSkeleton,
  LiveUpdatePill,
  MissingSignalCallout,
  NotConfigured,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  ProofMetricCard,
  ReadinessRing,
  SegmentedBar,
  StateBadge,
  ValidationStateBadge,
  buttonClassName,
  riskBandChartColor,
  riskBandTone,
  severityChartColor,
  type ChartDatum,
  type StateTone
} from "../ui";
import { GetStarted } from "./get-started";
import { HeroLoopCoach } from "./hero-loop-coach";
import { ProofLoopMap } from "./proof-loop-map";
import { relTime as formatAge } from "./remediation-lib";

/** Monday mode: collapse Home chrome to Needs-you + primary CTA + top path (UX-W5 / 198). */
export const MONDAY_MODE_STORAGE_KEY = "periscan-monday-mode";

/**
 * UX-W17: read Monday preference.
 * - "1" = on (explicit or defaulted)
 * - "0" = explicit off (must not re-default)
 * - null = unset (Operating maturity defaults ON on first visit)
 */
export function readMondayModePref(): "1" | "0" | null {
  try {
    const raw = localStorage.getItem(MONDAY_MODE_STORAGE_KEY);
    if (raw === "1") return "1";
    if (raw === "0") return "0";
    return null;
  } catch {
    return null;
  }
}

export function writeMondayModePref(on: boolean): void {
  try {
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, on ? "1" : "0");
  } catch {
    // ignore unwritable storage
  }
}

/**
 * UX-W17: resolve Monday mode for Home.
 * Default ON only when maturity is Operating and pref is unset.
 * Never force for New/Activating/Measured/unknown (GetStarted stays first-run).
 */
export function resolveMondayModeDefault(
  maturity: string | null | undefined,
  pref: "1" | "0" | null
): { on: boolean; shouldPersistDefault: boolean } {
  if (pref === "1") return { on: true, shouldPersistDefault: false };
  if (pref === "0") return { on: false, shouldPersistDefault: false };
  if (maturity === "Operating") {
    return { on: true, shouldPersistDefault: true };
  }
  return { on: false, shouldPersistDefault: false };
}

const STAGE_STATUS_TONE: Record<string, StateTone> = {
  OnTrack: "fixed",
  NeedsAttention: "approval",
  NotStarted: "inconclusive"
};

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

const SETTLED_REMEDIATION = new Set([
  "Fixed",
  "Mitigated",
  "ClosedWithoutEvidence"
]);

export function summarizeNeedsYou(input: {
  alerts: TenantThreatAlert[];
  findings: ValidatedFinding[];
  remediations: RemediationTask[];
}) {
  const newFindings = input.findings.filter(
    (finding) => finding.status === "New" && !finding.disposition
  ).length;
  const pendingApprovals = input.findings.filter(
    (finding) => finding.disposition?.approvalState === "Pending"
  ).length;
  const newAlerts = input.alerts.filter(
    (alert) => alert.status === "New"
  ).length;
  const readyToVerify = input.remediations.filter(
    (remediation) => remediation.status === "VerificationPending"
  ).length;
  // Local fallback categories that mirror getProductWorkQueue SLA rows.
  const overdueRemediations = input.remediations.filter(
    (remediation) =>
      Boolean(remediation.dueAt && Date.parse(remediation.dueAt) < Date.now()) &&
      !SETTLED_REMEDIATION.has(remediation.status) &&
      ["Open", "InProgress", "Reopened", "StillExposed"].includes(
        remediation.status
      )
  ).length;
  const priorityUnowned = input.findings.filter((finding) => {
    if (finding.priorityScore < 70) return false;
    const disposition = finding.disposition?.disposition;
    if (disposition === "FalsePositive" || disposition === "Suppressed") {
      return false;
    }
    if (finding.ownerId || finding.ownerDisplay?.trim()) return false;
    // Escalated (non-AR) assignee counts; AcceptedRisk acceptor does not.
    if (
      finding.disposition?.ownerId &&
      disposition !== "AcceptedRisk"
    ) {
      return false;
    }
    return true;
  }).length;

  const workUnits =
    newAlerts +
    newFindings +
    pendingApprovals +
    readyToVerify +
    overdueRemediations +
    priorityUnowned;
  // P14-16: total = non-empty queue categories; workUnits = raw item sum.
  const categoryCount = [
    newAlerts,
    newFindings,
    pendingApprovals,
    readyToVerify,
    overdueRemediations,
    priorityUnowned
  ].filter((count) => count > 0).length;

  return {
    newAlerts,
    newFindings,
    pendingApprovals,
    readyToVerify,
    overdueRemediations,
    priorityUnowned,
    total: categoryCount,
    workUnits
  };
}

export function DashboardCommandCenter() {
  const liveOptions = { refetchIntervalMs: 60_000 };
  const paths = useApiResource(() => api.listAttackPaths(), [], liveOptions);
  const findings = useApiResource(() => api.listFindings(), [], liveOptions);
  const remediations = useApiResource(
    () => api.listRemediations(),
    [],
    liveOptions
  );
  const ctem = useApiResource(() => api.getCTEMProgram(), [], liveOptions);
  const activity = useApiResource(
    () => api.listSignalTriggerActivity(),
    [],
    liveOptions
  );
  const snapshots = useApiResource(() => api.listSnapshots(), [], liveOptions);
  const alerts = useApiResource(() => api.listThreatAlerts(), [], liveOptions);
  const workQueue = useApiResource(
    () => api.getProductWorkQueue(),
    [],
    liveOptions
  );
  const activation = useApiResource(
    () => api.getProductActivationState(),
    [],
    liveOptions
  );
  const session = useApiResource(() => api.getMe(), []);
  // SSR-safe: start off; hydrate from storage / Operating default in effects.
  const [mondayMode, setMondayMode] = useState(false);

  // UX-W17: hydrate Monday mode once.
  // Explicit "1"/"0" apply immediately; unset defaults ON only for Operating.
  // Never re-sync after hydrate so Exit Monday (write "0") is not stomped.
  const mondayHydratedRef = useRef(false);
  useEffect(() => {
    if (mondayHydratedRef.current) {
      return;
    }
    const pref = readMondayModePref();
    if (pref === "1") {
      setMondayMode(true);
      mondayHydratedRef.current = true;
      return;
    }
    if (pref === "0") {
      setMondayMode(false);
      mondayHydratedRef.current = true;
      return;
    }
    // Unset: wait for activation so New/GetStarted never inherit Operating default.
    if (activation.loading && !activation.data) {
      return;
    }
    const maturity = activation.data?.maturity ?? null;
    const resolved = resolveMondayModeDefault(maturity, null);
    if (resolved.shouldPersistDefault) {
      writeMondayModePref(true);
    }
    setMondayMode(resolved.on);
    mondayHydratedRef.current = true;
  }, [activation.loading, activation.data]);

  const toggleMondayMode = useCallback(() => {
    setMondayMode((prev) => {
      const next = !prev;
      // Explicit on/off — exit writes "0" so Operating default does not re-arm.
      writeMondayModePref(next);
      return next;
    });
  }, []);

  const metrics = useMemo(() => {
    const p = paths.data ?? [];
    const f = findings.data ?? [];
    const r = remediations.data ?? [];
    const pathClaims = p.map((assessment) =>
      deriveAttackPathClaim(assessment.attackPath)
    );
    return {
      paths: {
        total: p.length,
        exploitable: pathClaims.filter((claim) => claim.canClaimExploitable)
          .length,
        reachable: pathClaims.filter(
          (claim) => claim.canClaimReachable && !claim.canClaimExploitable
        ).length
      },
      missed: f.filter((x) => x.validationState === "Missed").length,
      recordedFixed: r.filter((x) => x.status === "Fixed").length,
      proven: r.filter(
        (x) =>
          x.status === "Fixed" &&
          x.latestVerification?.measuredRevalidation &&
          x.latestVerification.outcome === "Fixed"
      ).length
    };
  }, [paths.data, findings.data, remediations.data]);
  const needsYou = useMemo(
    () =>
      summarizeNeedsYou({
        alerts: alerts.data ?? [],
        findings: findings.data ?? [],
        remediations: remediations.data ?? []
      }),
    [alerts.data, findings.data, remediations.data]
  );

  const topPaths = useMemo(
    () =>
      [...(paths.data ?? [])]
        .sort((a, b) => b.risk.score - a.risk.score)
        .slice(0, 5),
    [paths.data]
  );
  const scopeVerified =
    activation.data?.milestones.some(
      (milestone) =>
        milestone.key === "ScopeVerified" && milestone.state === "Completed"
    ) ?? false;
  const multiHopCta = useMemo(
    () =>
      resolveMultiHopMeasureCta({
        paths: paths.data ?? [],
        scopeVerified
      }),
    [paths.data, scopeVerified]
  );

  const ctemReadiness = useMemo(() => {
    const stages = ctem.data?.stages ?? [];
    if (!stages.length) return 0;
    const sum = stages.reduce(
      (acc, s) =>
        acc +
        (s.status === "OnTrack" ? 1 : s.status === "NeedsAttention" ? 0.5 : 0),
      0
    );
    return Math.round((sum / stages.length) * 100);
  }, [ctem.data]);

  const missingSignalFindings = (findings.data ?? []).filter(
    (f) => f.missingSignalImpact
  );

  const bandData = useMemo<ChartDatum[]>(() => {
    const order = [
      "Critical",
      "High",
      "Medium",
      "Low",
      "Informational",
      "Fixed"
    ];
    const counts = new Map<string, number>();
    for (const a of paths.data ?? [])
      counts.set(a.risk.band, (counts.get(a.risk.band) ?? 0) + 1);
    return order
      .filter((b) => counts.has(b))
      .map((b) => ({
        id: b,
        // P09-3: Fixed wire token → "Closed (risk)" on charts
        label: formatRiskBandDisplayLabel(b),
        value: counts.get(b)!,
        color: riskBandChartColor(b)
      }));
  }, [paths.data]);

  const severityData = useMemo<ChartDatum[]>(() => {
    const order = ["Critical", "High", "Medium", "Low", "Informational"];
    const counts = new Map<string, number>();
    for (const f of findings.data ?? [])
      counts.set(f.severity, (counts.get(f.severity) ?? 0) + 1);
    return order
      .filter((s) => counts.has(s))
      .map((s) => ({
        id: s,
        value: counts.get(s)!,
        color: severityChartColor(s)
      }));
  }, [findings.data]);

  const velocity = useMemo(() => {
    const r = remediations.data ?? [];
    const has = (set: string[]) =>
      r.filter((x) => set.includes(x.status)).length;
    return [
      {
        label: "Open",
        value: has(["Open", "InProgress"]),
        tone: "approval" as StateTone
      },
      {
        label: "Ready to verify",
        value: has(["VerificationPending"]),
        tone: "blocked" as StateTone
      },
      {
        label: "Fixed",
        value: has(["Fixed", "Mitigated"]),
        tone: "fixed" as StateTone
      },
      {
        label: "Reopened",
        value: has(["Reopened", "StillExposed"]),
        tone: "missed" as StateTone
      }
    ];
  }, [remediations.data]);
  const changeLens = useMemo(() => {
    const orderedSnapshots = [...(snapshots.data ?? [])].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
    const baseline = orderedSnapshots[1];
    if (!baseline) return null;
    const since = new Date(baseline.createdAt).getTime();
    const changedAfter = (value: string) => new Date(value).getTime() > since;
    const recentFindings = (findings.data ?? []).filter((item) =>
      changedAfter(item.updatedAt)
    );
    const recentRemediations = (remediations.data ?? []).filter((item) =>
      changedAfter(item.updatedAt)
    );
    const recentPaths = (paths.data ?? []).filter((item) =>
      changedAfter(item.attackPath.updatedAt)
    );
    return {
      baselineAt: baseline.createdAt,
      missingInputs: recentFindings.filter((item) => item.missingSignalImpact)
        .length,
      newFindings: recentFindings.filter((item) => item.status === "New")
        .length,
      newlyBlocked: recentPaths.filter(
        (item) => item.attackPath.validationState === "Blocked"
      ).length,
      reopened:
        recentFindings.filter((item) => item.status === "Reopened").length +
        recentRemediations.filter((item) => item.status === "Reopened").length,
      verifiedFixed: recentRemediations.filter(
        (item) =>
          item.status === "Fixed" &&
          item.latestVerification?.measuredRevalidation === true
      ).length
    };
  }, [findings.data, paths.data, remediations.data, snapshots.data]);

  const metricsLoading =
    paths.loading || findings.loading || remediations.loading || alerts.loading;

  // P07-22: partial multi-fetch failures must not look like empty peace.
  const degradedRails = useMemo(() => {
    const rails: string[] = [];
    if (paths.error) rails.push("Attack paths");
    if (findings.error) rails.push("Findings");
    if (remediations.error) rails.push("Remediation");
    if (alerts.error) rails.push("Threat alerts");
    if (ctem.error) rails.push("CTEM program");
    if (activity.error) rails.push("Signal activity");
    if (snapshots.error) rails.push("Snapshots");
    if (workQueue.error) rails.push("Work queue");
    return rails;
  }, [
    paths.error,
    findings.error,
    remediations.error,
    alerts.error,
    ctem.error,
    activity.error,
    snapshots.error,
    workQueue.error
  ]);
  const lastSuccessfulUpdate = useMemo(() => {
    const stamps = [
      paths.lastUpdatedAt,
      findings.lastUpdatedAt,
      remediations.lastUpdatedAt,
      workQueue.lastUpdatedAt
    ].filter(Boolean) as string[];
    if (stamps.length === 0) return null;
    return stamps.sort().at(-1) ?? null;
  }, [
    paths.lastUpdatedAt,
    findings.lastUpdatedAt,
    remediations.lastUpdatedAt,
    workQueue.lastUpdatedAt
  ]);
  // Fallback taxonomy MUST match getProductWorkQueue kinds (P14-1). Prefer the
  // server queue whenever it loads; this client path only runs on API failure.
  const queueItems =
    workQueue.data?.items ??
    [
      {
        count: needsYou.pendingApprovals,
        detail:
          "Accepted-risk dispositions wait for a second authorized reviewer before they settle.",
        href: "/findings?disposition=AcceptedRisk",
        itemId: "risk-approvals",
        kind: "Approval" as const,
        stage: "Authorize" as const,
        title: "Risk approvals waiting",
        urgency: "Now" as const,
        oldestAt: null as string | null
      },
      {
        count: needsYou.newFindings,
        detail:
          "Validated findings without a disposition need triage before they age out of the Active queue.",
        href: "/findings?view=active",
        itemId: "new-findings",
        kind: "NewFinding" as const,
        stage: "Understand" as const,
        title: "New findings need disposition",
        urgency: "Soon" as const,
        oldestAt: null as string | null
      },
      {
        count: needsYou.newAlerts,
        detail:
          "Correlated tenant threat alerts still marked New need acknowledgement or investigation.",
        href: "/threat-feed?status=New",
        itemId: "threat-alerts",
        kind: "ThreatAlert" as const,
        stage: "Understand" as const,
        title: "Threat alerts need acknowledgement",
        urgency: "Soon" as const,
        oldestAt: null as string | null
      },
      {
        count: needsYou.overdueRemediations,
        detail:
          "Open remediations passed their target date without a fresh fixed verification.",
        href: "/remediation?view=overdue",
        itemId: "overdue-remediation",
        kind: "OverdueRemediation" as const,
        stage: "Act" as const,
        title: "Remediation is overdue",
        urgency: "Now" as const,
        oldestAt: null as string | null
      },
      {
        count: needsYou.priorityUnowned,
        detail:
          "High-priority findings have no recorded operational owner (ownerId / ownerDisplay).",
        href: "/findings?view=priority-unowned",
        itemId: "priority-unowned",
        kind: "UnownedFinding" as const,
        stage: "Understand" as const,
        title: "Priority findings need an owner",
        urgency: "Soon" as const,
        oldestAt: null as string | null
      },
      {
        count: needsYou.readyToVerify,
        detail:
          "The implementation is marked ready; only fresh measured evidence can move it to fixed.",
        href: "/remediation?status=VerificationPending",
        itemId: "ready-for-retest",
        kind: "ReadyForRetest" as const,
        stage: "Verify" as const,
        title: "Fixes ready for re-test",
        urgency: "Soon" as const,
        oldestAt: null as string | null
      }
    ].filter((item) => item.count > 0);
  // Server total is work-unit sum; local fallback uses category count for the
  // metric card only when the API queue is unavailable (degraded honesty).
  const queueTotal =
    workQueue.data?.total ?? needsYou.workUnits ?? needsYou.total;

  // P02-1 / GA-4: single first-run surface on Home = GetStarted only.
  // /getting-started redirects here. Do not mount GettingStartedGuide.
  // Show GetStarted until a snapshot/path/finding exists. Waiting for the
  // three list fetches used to paint Command Center skeletons first (Layer 1
  // 2026-08-15 desktop screenshot). A brief GetStarted flash for a returning
  // tenant is better than a first-run zoo.
  const programStarted =
    (snapshots.data?.length ?? 0) > 0 ||
    (paths.data?.length ?? 0) > 0 ||
    (findings.data?.length ?? 0) > 0;
  if (!session.error && !programStarted) {
    return <GetStarted userName={session.data?.user?.name} />;
  }

  const topPathId = topPaths[0]?.attackPath.pathId ?? null;

  const topFinding = (findings.data ?? [])[0] ?? null;

  return (
    <PageShell data-monday-mode={mondayMode ? "1" : "0"}>
      <PageHeader
        eyebrow="Command center"
        title={
          mondayMode ? "Monday mode" : "The proof loop, at a glance"
        }
        description={
          mondayMode
            ? "Needs you, primary next action, and the top path or finding — nothing else."
            : "What's measured, what controls were observed to miss, what's waiting on you, and where proof is missing. Every number links to its evidence certainty."
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="monday-mode-toggle"
              aria-pressed={mondayMode}
              onClick={toggleMondayMode}
              className={buttonClassName({
                size: "sm",
                variant: mondayMode ? "primary" : "secondary"
              })}
            >
              {/* ICP-P1-3: triage-first label — collapsed chrome = Show program context */}
              {mondayMode ? "Show program context" : "Hide program context"}
            </button>
            {!mondayMode ? (
              <LiveUpdatePill
                lastUpdatedAt={findings.lastUpdatedAt}
                refreshing={
                  paths.refreshing ||
                  findings.refreshing ||
                  remediations.refreshing ||
                  ctem.refreshing ||
                  activity.refreshing ||
                  snapshots.refreshing ||
                  workQueue.refreshing
                }
              />
            ) : null}
          </div>
        }
      />

      {degradedRails.length > 0 ? (
        <DegradedBanner
          rails={degradedRails}
          lastUpdatedAt={lastSuccessfulUpdate}
          detail="Needs you and empty boards may undercount until loads succeed."
          onRetry={() => {
            void paths.refetch();
            void findings.refetch();
            void remediations.refetch();
            void alerts.refetch();
            void ctem.refetch();
            void activity.refetch();
            void snapshots.refetch();
            void workQueue.refetch();
          }}
        />
      ) : null}

      {/*
        ICP-P1-3: after program started, pin primary path/finding CTA + Needs you
        above the fold. Ceremony (ProofLoopMap / HeroLoopCoach / multi-hop banner /
        metrics / charts) stays behind "Show program context" (mondayMode collapsed).
      */}
      {multiHopCta.measureReady ? (
        <Panel data-testid="dashboard-primary-cta">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
                Primary next action
              </p>
              <h2 className="mt-1 text-base font-semibold text-ink">
                Measure hops on your top unmeasured path
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                {multiHopCta.hopsMeasured}/{multiHopCta.hopsTotal} hops measured
                · FullyMeasured only after edge receipts with evidence IDs —
                never from launch alone.
              </p>
            </div>
            <Link
              href={multiHopCta.href}
              className={buttonClassName({ size: "sm", variant: "primary" })}
              data-testid="dashboard-measure-path-hops"
            >
              Measure hops
            </Link>
          </div>
        </Panel>
      ) : topPathId ? (
        <Panel data-testid="dashboard-primary-cta">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
                Primary next action
              </p>
              <h2 className="mt-1 text-base font-semibold text-ink">
                Inspect your top attack path
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Open the highest-risk path and break the weakest hop first.
              </p>
            </div>
            <Link
              href={`/attack-paths/${topPathId}#weakest-link`}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              Open top path
            </Link>
          </div>
        </Panel>
      ) : null}

      <Panel data-print-hide="needs-you">
        <div
          id="needs-you"
          data-testid="needs-you"
          className="flex flex-col gap-2.5 p-3.5 scroll-mt-6 sm:p-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
                Needs you
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-ink sm:text-lg">
                One triage inbox
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/shift"
                className="text-[12px] font-semibold text-brand hover:text-brand-2 hover:underline"
              >
                Open blue shift
              </Link>
              <span className="font-mono text-xs text-muted">
                {workQueue.loading ? "Loading queues…" : `${queueTotal} open`}
              </span>
            </div>
          </div>
          {/*
            ICP 5.0 residual (P01/P02/P09): top path + top finding always
            one-click from Needs you — not only behind Monday focus panels.
          */}
          {topPathId || topFinding ? (
            <div
              data-testid="needs-you-top-work"
              className="grid gap-1.5 sm:grid-cols-2 sm:gap-2"
            >
              {topPathId ? (
                <Link
                  href={`/attack-paths/${topPathId}#weakest-link`}
                  data-testid="needs-you-top-path"
                  className="group flex min-h-11 items-center gap-3 rounded-control border border-brand/35 bg-brand/[0.06] px-3 py-2.5 hover:border-brand"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-brand">
                      Top path
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-ink group-hover:text-brand">
                      {topPaths[0]?.attackPath.name ?? "Inspect weakest hop"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-brand">
                    Open →
                  </span>
                </Link>
              ) : null}
              {topFinding ? (
                <Link
                  href="/findings"
                  data-testid="needs-you-top-finding"
                  className="group flex min-h-11 items-center gap-3 rounded-control border border-brand/35 bg-brand/[0.06] px-3 py-2.5 hover:border-brand"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-brand">
                      Top finding
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-ink group-hover:text-brand">
                      {topFinding.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-brand">
                    Triage →
                  </span>
                </Link>
              ) : null}
            </div>
          ) : null}
          {workQueue.error ? (
            <div className="rounded-control border border-missed/30 bg-missed/[0.04] px-3 py-2 text-xs text-muted">
              The cross-workflow queue could not be refreshed. Showing the local
              finding and remediation fallback.{" "}
              <button
                type="button"
                onClick={workQueue.refetch}
                className="font-semibold text-brand"
              >
                Retry
              </button>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {queueItems.map((queue) => (
              <Link
                key={queue.itemId}
                href={queue.href}
                className="group flex items-center gap-3 rounded-control border border-line bg-elevated px-3 py-2.5 hover:border-line-strong"
              >
                <span className="min-w-8 font-mono text-lg font-semibold text-ink">
                  {workQueue.loading ? "—" : queue.count}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink group-hover:text-brand">
                    {queue.title}
                    <span className="font-mono text-[9px] uppercase tracking-wide text-subtle">
                      {queue.stage} · {queue.urgency}
                    </span>
                  </span>
                  <span className="block truncate text-[11px] text-subtle">
                    {queue.detail}
                    {"oldestAt" in queue && queue.oldestAt
                      ? ` · oldest ${formatAge(queue.oldestAt)}`
                      : ""}
                  </span>
                </span>
              </Link>
            ))}
            {!workQueue.loading && queueItems.length === 0 ? (
              <p className="col-span-full rounded-control border border-line px-3 py-4 text-sm text-subtle">
                No approval, prerequisite, ownership, overdue, failed-run,
                re-test, or evidence-integrity work is waiting.
              </p>
            ) : null}
          </div>
          {/* P18-3: mixed urgency case feed (entity rows, not category cards). */}
          {workQueue.data?.feed && workQueue.data.feed.length > 0 ? (
            <div className="mt-2 border-t border-line pt-3">
              <div className="mb-2 flex items-end justify-between gap-2">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  Case feed
                </p>
                <Link
                  href="/shift"
                  className="text-[11px] font-medium text-brand hover:underline"
                >
                  Open blue shift
                </Link>
              </div>
              <ul className="flex flex-col gap-1.5">
                {workQueue.data.feed.map((row) => (
                  <li key={row.feedId}>
                    <Link
                      href={row.href}
                      className="group flex items-start gap-3 rounded-control border border-line/80 bg-canvas px-3 py-2 hover:border-line-strong"
                    >
                      <span
                        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide ${
                          row.urgency === "Now"
                            ? "bg-missed/10 text-missed"
                            : row.urgency === "Soon"
                              ? "bg-amber-500/10 text-amber-800"
                              : "bg-elevated text-subtle"
                        }`}
                      >
                        {row.urgency}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink group-hover:text-brand">
                          {row.title}
                        </span>
                        <span className="block truncate text-[11px] text-subtle">
                          {row.kind}
                          {row.severity ? ` · ${row.severity}` : ""}
                          {row.at ? ` · ${formatAge(row.at)}` : ""}
                          {" · "}
                          {row.detail}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Panel>

      {/* Monday / triage: top path + top finding only (no charts / CTEM / activity) */}
      {mondayMode ? (
        <div
          className="grid gap-4 lg:grid-cols-2"
          data-testid="monday-mode-focus"
        >
          <Panel>
            <PanelHeader
              title="Top path"
              link={{ href: "/attack-paths", label: "All paths" }}
            />
            {paths.loading ? (
              <LoadingSkeleton rows={2} />
            ) : paths.error ? (
              <ErrorState message={paths.error} onRetry={paths.refetch} />
            ) : topPaths[0] ? (
              (() => {
                const { attackPath, risk } = topPaths[0]!;
                const claim = deriveAttackPathClaim(attackPath);
                return (
                  <div className="flex flex-col gap-3 p-4">
                    <p className="text-[13px] font-medium text-ink">
                      {attackPath.name}
                    </p>
                    <p className="font-mono text-[11px] text-subtle">
                      score {risk.score} · path·{shortId(attackPath.pathId)}
                      {claim.totalEdgeCount > 0
                        ? ` · ${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops`
                        : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <EvidenceBasisBadge
                        basis={attackPath.evidenceBasis}
                        dot={false}
                      />
                      <AttackPathClaimBadge attackPath={attackPath} />
                      <Link
                        href={`/attack-paths/${attackPath.pathId}#weakest-link`}
                        className={buttonClassName({
                          size: "sm",
                          variant: "primary"
                        })}
                      >
                        Inspect weakest hop
                      </Link>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-4" data-testid="dashboard-paths-empty">
                <NotConfigured
                  title="No priority attack paths yet"
                  message="Connect a signal source and run a Validation Snapshot to correlate your first path."
                  action={{ href: "/integrations", label: "Connect a source" }}
                />
              </div>
            )}
          </Panel>
          <Panel>
            <PanelHeader
              title="Top finding"
              link={{ href: "/findings", label: "All findings" }}
            />
            {findings.loading ? (
              <LoadingSkeleton rows={2} />
            ) : findings.error ? (
              <ErrorState message={findings.error} onRetry={findings.refetch} />
            ) : topFinding ? (
              <div className="flex flex-col gap-3 p-4">
                <p className="text-[13px] font-medium text-ink">
                  {topFinding.title}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <ValidationStateBadge state={topFinding.validationState} />
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: severityChartColor(topFinding.severity) }}
                  >
                    {topFinding.severity}
                  </span>
                  <Link
                    href="/findings"
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    Open findings
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <NotConfigured
                  title="No findings yet"
                  message="Findings appear once a validation run correlates evidence."
                  action={{ href: "/missions", label: "Run a snapshot" }}
                />
              </div>
            )}
          </Panel>
        </div>
      ) : (
        <div
          className="flex flex-col gap-4"
          data-testid="dashboard-program-context"
        >
      {/* P07-15: post-first-mission guided path overlay (no new nav). */}
      <HeroLoopCoach
        enabled={programStarted}
        topPathId={multiHopCta.firstPathId ?? topPathId}
        measurePathHopsReady={multiHopCta.measureReady}
      />

      {/* Flagship multi-hop banner — program context only (not above-fold triage). */}
      {multiHopCta.measureReady ? (
        <Panel data-testid="dashboard-multihop-cta">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
                Flagship · measured multi-hop
              </p>
              <h2 className="mt-1 text-base font-semibold text-ink">
                Measure path hops on your top unmeasured path
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                {multiHopCta.hopsMeasured}/{multiHopCta.hopsTotal} hops measured
                across paths · FullyMeasured only after edge receipts with
                evidence IDs — never from launch alone.{" "}
                <Link
                  href={MULTI_HOP_OPERATOR_JOURNEY.gettingStartedHref}
                  className="font-semibold text-brand hover:text-brand-2"
                >
                  {MULTI_HOP_OPERATOR_JOURNEY.label}
                </Link>
              </p>
            </div>
            <Link
              href={multiHopCta.href}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              Measure path hops
            </Link>
          </div>
        </Panel>
      ) : null}

      {/* P02-18: spatial product map of the proof loop with live activation state. */}
      <ProofLoopMap
        activation={activation.data}
        loading={activation.loading}
        variant="panel"
      />

      {changeLens ? (
        <Panel>
          <div className="p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
                  Change is the default lens
                </p>
                <h2 className="mt-1 text-base font-semibold text-ink">
                  Since the previous stored snapshot
                </h2>
              </div>
              <span className="font-mono text-[11px] text-subtle">
                baseline {new Date(changeLens.baselineAt).toLocaleString()}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ["New", changeLens.newFindings, "/findings?status=New"],
                ["Reopened", changeLens.reopened, "/findings?view=reopened"],
                [
                  "Newly blocked",
                  changeLens.newlyBlocked,
                  "/attack-paths?state=Blocked"
                ],
                [
                  "Verified fixed",
                  changeLens.verifiedFixed,
                  "/remediation?status=Fixed"
                ],
                [
                  "Missing inputs",
                  changeLens.missingInputs,
                  "/findings?q=missing"
                ]
              ].map(([label, value, href]) => (
                <Link
                  key={String(label)}
                  href={String(href)}
                  className="rounded-control border border-line px-3 py-2 transition-colors hover:border-line-strong"
                >
                  <span className="block font-mono text-lg font-semibold text-ink">
                    {value}
                  </span>
                  <span className="text-[11px] text-subtle">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </Panel>
      ) : null}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ProofMetricCard
          label="Priority paths"
          tone="validated"
          value={metricsLoading ? "—" : metrics.paths.total}
          sub={
            metricsLoading
              ? "loading"
              : `${metrics.paths.exploitable} measured exploitable · ${metrics.paths.reachable} other measured reachable`
          }
          href="/attack-paths"
        />
        <ProofMetricCard
          label="Observed control misses"
          tone="missed"
          value={metricsLoading ? "—" : metrics.missed}
          sub={
            metricsLoading
              ? "loading"
              : "untested techniques are not counted as passes"
          }
          href="/findings"
        />
        <ProofMetricCard
          label="Needs you"
          tone="approval"
          value={metricsLoading || workQueue.loading ? "—" : queueTotal}
          sub={
            metricsLoading || workQueue.loading
              ? "loading"
              : "across the proof loop"
          }
          href="#needs-you"
        />
        <ProofMetricCard
          label="Fixes proven"
          tone="fixed"
          value={metricsLoading ? "—" : metrics.proven}
          sub={
            metricsLoading
              ? "loading"
              : `${metrics.recordedFixed} recorded fixed · measured re-tests only`
          }
          href="/remediation"
        />
      </div>

      {/* Charts — risk & severity distribution + remediation velocity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <div className="p-4">
            {paths.loading ? (
              <LoadingSkeleton rows={3} />
            ) : (
              <DistributionChart
                title="Attack paths by risk band"
                ariaLabel="Attack paths by risk band"
                data={bandData}
                variant="bar"
                height={180}
                emptyLabel="No paths to chart yet."
              />
            )}
          </div>
        </Panel>
        <Panel>
          <div className="p-4">
            {findings.loading ? (
              <LoadingSkeleton rows={3} />
            ) : (
              <DistributionChart
                title="Findings by severity"
                ariaLabel="Findings by severity"
                data={severityData}
                variant="bar"
                height={180}
                emptyLabel="No findings to chart yet."
              />
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Remediation velocity" />
          <div className="p-4">
            {remediations.loading ? (
              <LoadingSkeleton rows={2} />
            ) : velocity.every((v) => v.value === 0) ? (
              <p className="text-sm text-subtle">
                No remediation activity yet.
              </p>
            ) : (
              <SegmentedBar
                ariaLabel="Remediation velocity"
                segments={velocity}
              />
            )}
          </div>
        </Panel>
      </div>

      {/* Board 1 — paths + CTEM */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader
            title="Priority attack paths"
            link={{ href: "/attack-paths", label: "View all" }}
          />
          {paths.loading ? (
            <LoadingSkeleton rows={4} />
          ) : paths.error ? (
            <ErrorState message={paths.error} onRetry={paths.refetch} />
          ) : topPaths.length === 0 ? (
            <div className="p-4" data-testid="dashboard-paths-empty">
              <NotConfigured
                title="No priority attack paths yet"
                message="Connect a signal source and run a Validation Snapshot to correlate your first path. Multi-hop FullyMeasured requires hop receipts — empty is honest, not a fake Measured path."
                action={{ href: "/integrations", label: "Connect a source" }}
              />
            </div>
          ) : (
            <ul className="list-none">
              {topPaths.map(({ attackPath, risk }, index) => {
                const isTop = index === 0;
                const claim = deriveAttackPathClaim(attackPath);
                const rowNeedsMeasure =
                  !claim.fullyMeasured && claim.totalEdgeCount > 0;
                const topMeasureCta =
                  isTop && multiHopCta.measureReady && rowNeedsMeasure;
                return (
                  <li
                    key={attackPath.pathId}
                    className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink">
                        {attackPath.name}
                      </p>
                      <p
                        className="mt-0.5 font-mono text-[11px] text-subtle"
                        data-testid={
                          isTop ? "dashboard-top-path-claim-snippet" : undefined
                        }
                      >
                        score {risk.score} · path·{shortId(attackPath.pathId)}
                        {attackPath.evidenceIds[0]
                          ? ` · ev·${shortId(attackPath.evidenceIds[0])}`
                          : ""}
                        {claim.totalEdgeCount > 0
                          ? ` · ${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops`
                          : ""}
                        {` · ${claim.displayLabel}`}
                      </p>
                    </div>
                    <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-muted">
                        {attackPath.confidence.toFixed(2)}
                      </span>
                      <EvidenceBasisBadge
                        basis={attackPath.evidenceBasis}
                        dot={false}
                      />
                      <AttackPathClaimBadge attackPath={attackPath} />
                      {/* Flagship: Measure path hops when unmeasured + verified scope */}
                      <Link
                        href={`/attack-paths/${attackPath.pathId}#hop-measurement`}
                        className={buttonClassName({
                          size: "sm",
                          variant: isTop ? "primary" : "secondary"
                        })}
                      >
                        {topMeasureCta
                          ? "Measure path hops"
                          : rowNeedsMeasure
                            ? isTop
                              ? multiHopCta.label
                              : "Measure hops"
                            : isTop
                              ? "Inspect weakest hop"
                              : "Break cheapest link"}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="CTEM stage"
            link={{ href: "/threat-center", label: "Program" }}
          />
          {ctem.loading ? (
            <LoadingSkeleton rows={5} />
          ) : ctem.error ? (
            <ErrorState message={ctem.error} onRetry={ctem.refetch} />
          ) : ctem.data ? (
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-4">
                <ReadinessRing
                  value={ctemReadiness}
                  tone={riskBandTone(ctem.data.topRiskBand)}
                />
                <ul className="flex flex-1 list-none flex-col gap-1.5">
                  {ctem.data.stages.map((s) => (
                    <li
                      key={s.stage}
                      className="flex items-center gap-2.5 text-[12.5px]"
                    >
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-[3px]"
                        style={{
                          background: `var(--color-${STAGE_STATUS_TONE[s.status] ?? "inconclusive"})`
                        }}
                      />
                      <span className="text-muted">{s.stage}</span>
                      <span className="ml-auto font-mono text-[11px] text-subtle">
                        {s.openItemCount > 0
                          ? `${s.openItemCount} open`
                          : "clear"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {missingSignalFindings.length > 0 ? (
                <MissingSignalCallout
                  title="Missing proof signal"
                  action={{ href: "/integrations", label: "Connect a source" }}
                >
                  {missingSignalFindings.length} finding
                  {missingSignalFindings.length === 1 ? "" : "s"} are weakened
                  by a missing input.{" "}
                  {
                    missingSignalFindings[0]?.missingSignalImpact
                      ?.recommendation
                  }
                </MissingSignalCallout>
              ) : null}
            </div>
          ) : (
            <div className="p-4">
              <NotConfigured
                title="No CTEM program yet"
                message="Run a Validation Snapshot to establish your first program baseline."
                action={{ href: "/missions", label: "Run a snapshot" }}
              />
            </div>
          )}
        </Panel>
      </div>

      {/* Board 2 — findings + activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Findings queue"
            link={{ href: "/findings", label: "All findings" }}
          />
          {findings.loading ? (
            <LoadingSkeleton rows={5} />
          ) : findings.error ? (
            <ErrorState message={findings.error} onRetry={findings.refetch} />
          ) : (findings.data ?? []).length === 0 ? (
            <div className="p-4">
              <NotConfigured
                title="No findings yet"
                message="Findings appear here once a validation run correlates evidence."
                action={{ href: "/missions", label: "Run a snapshot" }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-line font-display text-[10px] uppercase tracking-[0.06em] text-subtle">
                    <th className="px-4 py-2 font-semibold">Finding</th>
                    <th className="px-2 py-2 font-semibold">State</th>
                    <th className="px-2 py-2 font-semibold">Sev</th>
                    <th className="px-4 py-2 font-semibold">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {(findings.data ?? []).slice(0, 6).map((f) => {
                    // UX-W11: path-linked findings never show raw Validated without claim-safe projection.
                    const claimDisplay = projectFindingClaimDisplay(f);
                    return (
                    <tr
                      key={f.findingId}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className="max-w-0 truncate px-4 py-2.5 text-ink">
                        {f.title}
                      </td>
                      <td className="px-2 py-2.5">
                        <ValidationStateBadge
                          state={claimDisplay.displayValidationState}
                          title={claimDisplay.ariaLabel}
                          aria-label={claimDisplay.ariaLabel}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className="font-mono"
                          style={{
                            color: severityChartColor(f.severity)
                          }}
                        >
                          {f.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-subtle">
                        {f.evidenceIds[0]
                          ? `ev·${shortId(f.evidenceIds[0])}`
                          : "—"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Recent validation activity"
            link={{ href: "/signal-activity", label: "Activity stream" }}
          />
          {activity.loading ? (
            <LoadingSkeleton rows={5} />
          ) : activity.error ? (
            <ErrorState message={activity.error} onRetry={activity.refetch} />
          ) : (activity.data ?? []).length === 0 ? (
            <div className="p-4">
              <NotConfigured
                title="No activity yet"
                message="Signal-driven triggers — CVE, asset-change, missed-detection — show up here as they fire."
              />
            </div>
          ) : (
            <ul className="list-none">
              {(activity.data ?? []).slice(0, 6).map((a) => (
                <li
                  key={a.activityId}
                  className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-ink">{a.title}</p>
                    <p className="mt-0.5 truncate text-[12px] text-muted">
                      {a.summary}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-[11px] text-subtle">
                      {relTime(a.createdAt)}
                    </span>
                    <StateBadge
                      tone="neutral"
                      dot={false}
                      className="lowercase"
                    >
                      {a.recommendedMissionType}
                    </StateBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
        </div>
      )}
    </PageShell>
  );
}
