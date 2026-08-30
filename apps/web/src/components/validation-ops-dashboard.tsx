"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";

import type {
  AIApplication,
  AttackPathAssessment,
  BillingPackage,
  BillingUsage,
  CTEMProgramSummary,
  ControlRuleCoverageSummary,
  ControlSource,
  DetectionRuleCoverageStatus,
  EvidenceArtifact,
  EvidencePack,
  ExecutiveTrendSummary,
  RemediationTask,
  RunnerRecord,
  TenantOperationalMetrics,
  UsageMeterDefinition,
  ValidationSnapshot,
  VerificationEvent
} from "@periscan/shared";
import {
  buildAttackPathRiskSummary,
  deriveAttackPathClaim,
  SETTLED_REMEDIATION_STATUSES
} from "@periscan/shared";

import {
  browserPeriscanApiClient,
  PeriscanApiClientError,
  type AuthSessionPayload
} from "../lib/periscan-api-client";
import {
  AttackPathClaimBadge,
  AttackPathGraph,
  Badge,
  Button,
  Card,
  DistributionChart,
  StatusPill,
  buttonClassName,
  riskBandChartColor,
  type BadgeTone
} from "../ui";
import { AttackPathDepth } from "./attack-path-depth";
import { StatusPanel } from "./status-panel";

// P01-3: priority-path risk-band chart uses canonical severity-visual fills.
const RISK_BANDS: Array<{ band: string; color: string }> = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational"
].map((band) => ({ band, color: riskBandChartColor(band) }));

interface ValidationOpsState {
  aiApplications: AIApplication[];
  activeBillingPackage: BillingPackage | null;
  attackPaths: AttackPathAssessment[];
  billingMeters: UsageMeterDefinition[];
  billingPackages: BillingPackage[];
  billingUsage: BillingUsage;
  controlSources: ControlSource[];
  ctemProgram: CTEMProgramSummary;
  evidence: EvidenceArtifact[];
  ruleCoverage: ControlRuleCoverageSummary;
  executiveTrends: ExecutiveTrendSummary;
  operationalMetrics: TenantOperationalMetrics;
  remediations: RemediationTask[];
  reports: EvidencePack[];
  runners: RunnerRecord[];
  snapshots: ValidationSnapshot[];
}

async function loadValidationOpsState(): Promise<ValidationOpsState> {
  const [
    attackPaths,
    remediations,
    evidence,
    reports,
    aiApplications,
    controlSources,
    runners,
    ctemProgram,
    billingMeters,
    billingPackages,
    billingUsage,
    activeBillingPackage,
    executiveTrends,
    operationalMetrics,
    ruleCoverage,
    snapshots
  ] = await Promise.all([
    browserPeriscanApiClient.listAttackPaths(),
    browserPeriscanApiClient.listRemediations(),
    browserPeriscanApiClient.listEvidence(),
    browserPeriscanApiClient.listReports(),
    browserPeriscanApiClient.listAIApplications(),
    browserPeriscanApiClient.listControlSources(),
    browserPeriscanApiClient.listRunners(),
    browserPeriscanApiClient.getCTEMProgram(),
    browserPeriscanApiClient.getBillingMeters(),
    browserPeriscanApiClient.getBillingPackages(),
    browserPeriscanApiClient.getBillingUsage(),
    browserPeriscanApiClient.getActiveBillingPackage(),
    browserPeriscanApiClient.getExecutiveTrends(),
    browserPeriscanApiClient.getOperationalMetrics(),
    browserPeriscanApiClient.getControlRuleCoverage(),
    browserPeriscanApiClient.listSnapshots()
  ]);

  return {
    aiApplications,
    activeBillingPackage,
    attackPaths,
    billingMeters,
    billingPackages,
    billingUsage,
    controlSources,
    ctemProgram,
    evidence,
    executiveTrends,
    operationalMetrics,
    remediations,
    reports,
    ruleCoverage,
    runners,
    snapshots
  };
}

// Truthful coverage tones (kit Badge): only active Detected (Covered) or
// Prevented (Blocked) is success; a logged-only SIEM hit / needs-tuning /
// stale / untested is warning (never promoted to active-detection green);
// Missed / NoEvidence is danger. Domain map is local — shared statusTone
// would mis-map Covered/Blocked.
function coverageStatusTone(status: DetectionRuleCoverageStatus): BadgeTone {
  if (status === "Covered" || status === "Blocked") {
    return "success";
  }

  if (status === "Missed" || status === "NoEvidence") {
    return "danger";
  }

  return "warning";
}

function coverageStatusLabel(status: DetectionRuleCoverageStatus) {
  return status === "LoggedOnly" ? "Logged only" : status;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function countByStatus<T extends { status: string }>(
  items: T[],
  status: string
) {
  return items.filter((item) => item.status === status).length;
}

function EmptyLine(props: { children: string }) {
  return <p className="text-sm text-muted">{props.children}</p>;
}

const sectionClass =
  "flex flex-col gap-3 rounded-card border border-line bg-surface p-5";
const itemClass =
  "flex flex-col gap-2 rounded-control border border-line bg-bg p-3";
const chip = "rounded-pill bg-surface-strong px-2 py-0.5 text-xs text-muted";

export function ValidationOpsDashboard() {
  const [auth, setAuth] = useState<AuthSessionPayload | null>(null);
  const [opsState, setOpsState] = useState<ValidationOpsState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<
    Record<string, { outcome: string; measured: boolean }>
  >({});
  const [historyById, setHistoryById] = useState<
    Record<string, VerificationEvent[]>
  >({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [pathEvidenceFilter, setPathEvidenceFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;

    void browserPeriscanApiClient
      .getMe()
      .then(async (nextAuth) => {
        if (!active) {
          return;
        }

        setAuth(nextAuth);

        const nextOpsState = await loadValidationOpsState();

        if (active) {
          setOpsState(nextOpsState);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof PeriscanApiClientError && error.status === 401) {
          setAuth(null);
          setIsLoading(false);
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load validation operations."
        );
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Re-verify a settled fix on demand: a fresh re-validation either re-proves
  // "Fixed" (with measured provenance) or reopens it. Refreshes ops state after.
  async function reVerify(remediationId: string) {
    setErrorMessage(null);
    setVerifyingId(remediationId);

    try {
      const result =
        await browserPeriscanApiClient.verifyRemediation(remediationId);
      setVerifyResults((current) => ({
        ...current,
        [remediationId]: {
          measured: result.verificationEvent.measuredRevalidation,
          outcome: result.verificationEvent.outcome
        }
      }));
      setOpsState(await loadValidationOpsState());
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to re-verify the remediation."
      );
    } finally {
      setVerifyingId(null);
    }
  }

  // Fetch the full verification trail for a fix on demand so an operator can see
  // how its "Fixed" claim has held (each event's outcome + measured provenance).
  async function loadVerificationHistory(remediationId: string) {
    setErrorMessage(null);
    setHistoryLoadingId(remediationId);

    try {
      const events =
        await browserPeriscanApiClient.listVerificationEvents(remediationId);
      setHistoryById((current) => ({ ...current, [remediationId]: events }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load verification history."
      );
    } finally {
      setHistoryLoadingId(null);
    }
  }

  async function refreshOpsState() {
    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      setOpsState(await loadValidationOpsState());
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to refresh validation operations."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  const openRemediations = useMemo(
    () =>
      opsState
        ? opsState.remediations.filter(
            (remediation) =>
              !["Fixed", "Mitigated", "ClosedWithoutEvidence"].includes(
                remediation.status
              )
          ).length
        : 0,
    [opsState]
  );

  if (isLoading) {
    return (
      <StatusPanel
        body="Periscan is reading tenant-scoped validation, proof, remediation, runner, CTEM, and billing data from the public API."
        eyebrow="Validation operations"
        kind="loading"
        title="Loading operational proof state."
      />
    );
  }

  if (!auth) {
    return (
      <StatusPanel
        actions={
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            href="/"
          >
            Back to workspace
          </Link>
        }
        body="Validation Ops is tenant-scoped. Authenticate from the workspace to review live validation, evidence, remediation, runner, and reporting state."
        eyebrow="Validation operations"
        kind="info"
        title="Sign in to review validation operations."
      />
    );
  }

  if (!opsState) {
    return (
      <StatusPanel
        actions={
          <Button
            variant="secondary"
            onClick={() => startTransition(() => void refreshOpsState())}
          >
            Retry
          </Button>
        }
        body={errorMessage ?? "Validation operations are unavailable."}
        eyebrow="Validation operations"
        kind="error"
        title="Unable to load validation operations."
      />
    );
  }

  const readyReports = countByStatus(opsState.reports, "Ready");
  const activeRunners = countByStatus(opsState.runners, "Active");
  const healthyControls = opsState.controlSources.filter(
    (source) => source.healthStatus === "Healthy"
  ).length;
  const riskBandDistribution = RISK_BANDS.map(({ band, color }) => ({
    color,
    id: band,
    label: band,
    value: opsState.attackPaths.filter(
      (assessment) => assessment.risk.band === band
    ).length
  })).filter((datum) => datum.value > 0);

  // Validation integrity is based on the weakest hop, not the path-level flag.
  // Every edge must be measured before a path enters the measured count.
  const measuredPathCount = opsState.attackPaths.filter(
    (assessment) => deriveAttackPathClaim(assessment.attackPath).fullyMeasured
  ).length;
  const heuristicPathCount = opsState.attackPaths.length - measuredPathCount;
  const measuredSharePct =
    opsState.attackPaths.length > 0
      ? Math.round((measuredPathCount / opsState.attackPaths.length) * 100)
      : 0;
  // The priority-path list applies the operator's evidence-basis filter, so
  // its own empty-state + truncation notice must reflect the FILTERED set, not
  // the raw count.
  const filteredAttackPaths = opsState.attackPaths.filter(
    (assessment) =>
      pathEvidenceFilter === "all" ||
      (pathEvidenceFilter === "Measured"
        ? deriveAttackPathClaim(assessment.attackPath).fullyMeasured
        : !deriveAttackPathClaim(assessment.attackPath).fullyMeasured)
  );
  const evidenceBasisDistribution = [
    {
      color: "var(--color-success)",
      id: "Measured",
      label: "Measured",
      value: measuredPathCount
    },
    {
      color: "var(--color-warning)",
      id: "Heuristic",
      label: "Heuristic",
      value: heuristicPathCount
    }
  ].filter((datum) => datum.value > 0);

  // Prove-it-fixed: settled fixes whose scheduled re-verification is overdue.
  // Their "Fixed" claim is stale until a fresh re-validation runs — surface them
  // so an operator can re-prove (and see whether the last check was MEASURED).
  const nowMs = Date.now();
  const overdueReverifications = opsState.remediations.filter(
    (remediation) =>
      SETTLED_REMEDIATION_STATUSES.has(remediation.status) &&
      remediation.nextVerificationAt != null &&
      new Date(remediation.nextVerificationAt).getTime() <= nowMs
  );
  const controlsNeedingProof =
    opsState.ruleCoverage.missedTechniques +
    opsState.ruleCoverage.noEvidenceTechniques;
  const aiAppsWithFailedChecks = opsState.snapshots.reduce(
    (total, snapshot) => total + snapshot.aiAppRisks.length,
    0
  );
  const fixesAwaitingRetest =
    opsState.executiveTrends.remediationVelocity.readyForVerification +
    overdueReverifications.length;
  const verifiedFixesMetric =
    opsState.executiveTrends.metrics.find(
      (metric) => metric.metricId === "verified_fixes"
    ) ?? null;
  const prdDashboardCards: Array<{
    description: string;
    label: string;
    value: string | number;
  }> = [
    {
      description:
        "Priority path assessments from /api/v1/attack-paths; certainty is shown per path.",
      label: "Priority exposure paths",
      value: opsState.attackPaths.length
    },
    {
      description:
        "Missed or no-evidence control techniques from rule coverage.",
      label: "Controls needing proof",
      value: controlsNeedingProof
    },
    {
      description: "AI risk signals attached to current Snapshot payloads.",
      label: "AI apps with failed checks",
      value: aiAppsWithFailedChecks
    },
    {
      description:
        "Ready-for-verification fixes plus settled fixes overdue for re-test.",
      label: "Fixes awaiting re-test",
      value: fixesAwaitingRetest
    },
    {
      description:
        "Verified fixes in the executive trend window, backed by evidence IDs.",
      label: "Risk reduced this month",
      value: verifiedFixesMetric?.value ?? 0
    },
    {
      description: "Ready evidence packs from report and proof-delivery APIs.",
      label: "Evidence packs ready",
      value: opsState.executiveTrends.proofDelivery.evidencePacksReady
    }
  ];

  const metrics: Array<{ label: string; value: string | number }> = [
    { label: "Priority paths", value: opsState.attackPaths.length },
    { label: "Open remediation tasks", value: openRemediations },
    { label: "Evidence artifacts", value: opsState.evidence.length },
    { label: "Ready evidence packs", value: readyReports },
    {
      label: "Healthy controls",
      value: `${healthyControls}/${opsState.controlSources.length}`
    },
    {
      label: "Active runners",
      value: `${activeRunners}/${opsState.runners.length}`
    },
    {
      label: "Policy denial rate",
      value: `${Math.round(
        opsState.operationalMetrics.policyDenials.denialRate * 100
      )}%`
    },
    {
      label: "Report exports",
      value: opsState.executiveTrends.proofDelivery.reportExports
    }
  ];

  return (
    <section className="flex flex-col gap-4">
      <Card
        elevated
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand">
            Validation operations
          </span>
          <h2 className="mt-1 text-xl font-semibold text-ink">
            API-backed validation, proof, and remediation status.
          </h2>
          <p className="mt-2 text-sm text-muted">
            Signed in as {auth.user.email} for {auth.tenant.name}. This surface
            consumes the same /api/v1 endpoints available to customers and
            replacement UIs; it does not create UI-only operational data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={isRefreshing}
            onClick={() => startTransition(() => void refreshOpsState())}
          >
            {isRefreshing ? "Refreshing..." : "Refresh API state"}
          </Button>
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            href="/api-reference"
          >
            View API reference
          </Link>
        </div>
      </Card>

      {errorMessage ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-danger">{errorMessage}</p>
          <Button
            variant="secondary"
            size="sm"
            disabled={isRefreshing}
            onClick={() => startTransition(() => void refreshOpsState())}
          >
            {isRefreshing ? "Reloading..." : "Reload validation operations"}
          </Button>
          <button
            aria-label="Dismiss validation operations error"
            className="text-xs text-muted underline"
            onClick={() => setErrorMessage(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <dl
        className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6"
        aria-label="PRD dashboard cards"
      >
        {prdDashboardCards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
          >
            <dt className="text-sm text-muted">{card.label}</dt>
            <dd className="text-2xl font-semibold text-ink">{card.value}</dd>
            <p className="text-xs text-subtle">{card.description}</p>
          </div>
        ))}
      </dl>

      <dl
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Validation operations metrics"
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4"
          >
            <dt className="text-sm text-muted">{metric.label}</dt>
            <dd className="text-2xl font-semibold text-ink">{metric.value}</dd>
          </div>
        ))}
      </dl>

      {/* T3: dedicated "recent non-snap activity" rich section on validation-ops for unified nav + dashboard/home parity (addresses gap: no recent non-snap on validation-ops) */}
      <div className="rounded-card border border-line bg-surface p-4">
        <div className="text-sm font-semibold mb-1">
          T3: Recent Non-Snap Activity (from schedules lastDiff/CTEM)
        </div>
        <div className="text-xs text-muted mb-1">
          Continuous / non-snap runs (ControlValidation, AIAppValidation,
          FixVerification) contribute to CTEM deltas and billing. Rich cards,
          Verdict, and trends live on{" "}
          <a href="/" className="underline">
            Home dashboard
          </a>{" "}
          and{" "}
          <a href="/threat-center" className="underline">
            Threat Center
          </a>{" "}
          (P3 history). Create via{" "}
          <a href="/schedules" className="underline">
            Schedules
          </a>{" "}
          pickers for recurring lastDiff updates.
        </div>
        <div className="text-[9px] text-muted">
          See CTEM Validate/Verify contrib + billing impact in home cards.
          Post-run pack links available from Schedules and Reports.
        </div>
      </div>

      {opsState.attackPaths.length ? (
        <section className={sectionClass} aria-labelledby="ops-integrity-title">
          <div className="flex items-center justify-between gap-4">
            <h3
              id="ops-integrity-title"
              className="text-base font-semibold text-ink"
            >
              Validation integrity
            </h3>
            <Badge
              tone={measuredSharePct > 0 ? "success" : "warning"}
              role="status"
              aria-label={`Measured validation share: ${measuredSharePct}%`}
            >
              {measuredSharePct}% measured
            </Badge>
          </div>
          <p className="text-sm text-muted">
            Measured evidence is proven from authoritative configuration or an
            observed probe; heuristic evidence is inferred from a known attack
            pattern. Only measured paths carry a proven impact.
          </p>
          {evidenceBasisDistribution.length ? (
            <DistributionChart
              title="Evidence basis"
              ariaLabel="Priority paths by evidence basis"
              data={evidenceBasisDistribution}
              variant="bar"
            />
          ) : null}
        </section>
      ) : null}

      {overdueReverifications.length ? (
        <section className={sectionClass} aria-labelledby="ops-reverify-title">
          <div className="flex items-center justify-between gap-4">
            <h3
              id="ops-reverify-title"
              className="text-base font-semibold text-ink"
            >
              Re-verification due
            </h3>
            <Badge
              tone="warning"
              role="status"
              aria-label={`Re-verification due count: ${overdueReverifications.length}`}
            >
              {overdueReverifications.length} overdue
            </Badge>
          </div>
          <p className="text-sm text-muted">
            These settled fixes are past their scheduled re-verification — their
            &ldquo;Fixed&rdquo; claim is stale until a fresh re-validation runs.
          </p>
          <div className="flex flex-col gap-2">
            {overdueReverifications.map((remediation) => {
              const reVerifyResult = verifyResults[remediation.remediationId];
              return (
                <article className={itemClass} key={remediation.remediationId}>
                  <div>
                    <strong className="text-ink">
                      {remediation.recommendedAction}
                    </strong>
                    <p className="text-sm text-muted">
                      Due{" "}
                      {remediation.nextVerificationAt
                        ? new Date(
                            remediation.nextVerificationAt
                          ).toLocaleDateString()
                        : "unknown"}
                      {remediation.lastVerifiedAt
                        ? ` · last verified ${new Date(
                            remediation.lastVerifiedAt
                          ).toLocaleDateString()}`
                        : " · never verified"}
                    </p>
                    {reVerifyResult ? (
                      <p
                        className="text-sm text-muted"
                        role="status"
                        aria-label={`Re-verification result for ${remediation.recommendedAction}: ${reVerifyResult.outcome} (${
                          reVerifyResult.measured
                            ? "measured re-validation"
                            : "not measured"
                        })`}
                      >
                        Re-verified: {reVerifyResult.outcome} ·{" "}
                        {reVerifyResult.measured
                          ? "measured re-validation"
                          : "not measured"}
                      </p>
                    ) : null}
                    {historyById[remediation.remediationId] ? (
                      <ul
                        className="mt-1 flex flex-col gap-1"
                        aria-label={`Verification history for ${remediation.recommendedAction}`}
                      >
                        {historyById[remediation.remediationId]!.length ===
                        0 ? (
                          <li className="text-xs text-subtle">
                            No verification events recorded yet.
                          </li>
                        ) : (
                          historyById[remediation.remediationId]!.map(
                            (event) => (
                              <li
                                className="text-xs text-muted"
                                key={event.verificationId}
                              >
                                {new Date(
                                  event.verifiedAt
                                ).toLocaleDateString()}
                                : {event.outcome} ·{" "}
                                {event.measuredRevalidation
                                  ? "measured"
                                  : "not measured"}
                                {event.retestMethod
                                  ? ` (${event.retestMethod})`
                                  : ""}
                              </li>
                            )
                          )
                        )}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusPill
                      status={
                        remediation.latestVerification?.measuredRevalidation
                          ? "Measured"
                          : "Unproven"
                      }
                      aria-label={`Last re-validation for ${remediation.recommendedAction}: ${
                        remediation.latestVerification?.measuredRevalidation
                          ? "Measured"
                          : "Unproven"
                      }`}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={verifyingId === remediation.remediationId}
                      onClick={() =>
                        startTransition(
                          () => void reVerify(remediation.remediationId)
                        )
                      }
                    >
                      {verifyingId === remediation.remediationId
                        ? "Re-verifying..."
                        : "Re-verify"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={historyLoadingId === remediation.remediationId}
                      onClick={() =>
                        startTransition(
                          () =>
                            void loadVerificationHistory(
                              remediation.remediationId
                            )
                        )
                      }
                    >
                      {historyLoadingId === remediation.remediationId
                        ? "Loading..."
                        : "History"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={sectionClass} aria-labelledby="ops-paths-title">
          <div className="flex items-center justify-between gap-4">
            <h3
              id="ops-paths-title"
              className="text-base font-semibold text-ink"
            >
              Priority paths
            </h3>
            <StatusPill
              status={opsState.ctemProgram.topRiskBand}
              aria-label={`Priority paths top risk band: ${opsState.ctemProgram.topRiskBand}`}
            />
          </div>
          <label
            className="flex flex-col gap-1 text-xs text-muted"
            htmlFor="ops-path-evidence-filter"
          >
            <span>Evidence basis</span>
            <select
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              id="ops-path-evidence-filter"
              onChange={(event) => setPathEvidenceFilter(event.target.value)}
              value={pathEvidenceFilter}
            >
              <option value="all">All paths</option>
              <option value="Measured">Measured (proven)</option>
              <option value="Heuristic">Heuristic (inferred)</option>
            </select>
          </label>
          {opsState.attackPaths.length === 0 ? (
            <EmptyLine>
              No priority attack paths are available for this tenant yet.
            </EmptyLine>
          ) : filteredAttackPaths.length === 0 ? (
            <EmptyLine>
              No attack paths match the selected evidence basis.
            </EmptyLine>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredAttackPaths.slice(0, 5).map((assessment) => (
                <article
                  aria-label={assessment.attackPath.name}
                  className={itemClass}
                  key={assessment.attackPath.pathId}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-ink">
                      {assessment.attackPath.name}
                    </strong>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <AttackPathClaimBadge
                        attackPath={assessment.attackPath}
                      />
                      <StatusPill
                        status={assessment.risk.band}
                        label={`${assessment.risk.band} · ${assessment.risk.score}`}
                        aria-label={`${assessment.attackPath.name} risk: ${assessment.risk.band} ${assessment.risk.score}`}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted">
                    {buildAttackPathRiskSummary(
                      assessment.attackPath,
                      assessment.risk.band
                    )}
                  </p>
                  <AttackPathDepth attackPath={assessment.attackPath} />
                  <AttackPathGraph attackPath={assessment.attackPath} />
                  <div className="flex flex-wrap gap-1">
                    {assessment.attackPath.evidenceIds.map((evidenceId) => (
                      <span className={chip} key={evidenceId}>
                        ev-{shortId(evidenceId)}
                      </span>
                    ))}
                  </div>
                  {/* Non-snap packType badge + direct View pack / schedule backlinks (when evidence from non-snap). */}
                  {(assessment.attackPath as any).nonSnapPack ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge tone="brand">
                        {(assessment.attackPath as any).nonSnapPack.packType}
                      </Badge>
                      <a
                        href={`/reports?evidencePackId=${(assessment.attackPath as any).nonSnapPack.evidencePackId}`}
                        className="underline text-brand"
                      >
                        View pack
                      </a>
                      {(assessment.attackPath as any).nonSnapPack.scheduleId ? (
                        <a href="/schedules" className="underline text-brand">
                          View schedule
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
              {filteredAttackPaths.length > 5 ? (
                <p
                  className="text-xs text-muted"
                  role="status"
                  aria-label={`Showing top 5 of ${filteredAttackPaths.length} attack paths`}
                >
                  Showing top 5 of {filteredAttackPaths.length} attack paths.
                </p>
              ) : null}
            </div>
          )}
          {riskBandDistribution.length ? (
            <DistributionChart
              title="Risk band distribution"
              ariaLabel="Priority attack paths by risk band"
              data={riskBandDistribution}
              variant="bar"
            />
          ) : null}
        </section>

        <section className={sectionClass} aria-labelledby="ops-rem-title">
          <div className="flex items-center justify-between gap-4">
            <h3 id="ops-rem-title" className="text-base font-semibold text-ink">
              Remediation queue
            </h3>
            <Badge
              tone="warning"
              role="status"
              aria-label={`Open remediation count: ${openRemediations}`}
            >
              {openRemediations} open
            </Badge>
          </div>
          {opsState.remediations.length ? (
            <div className="flex flex-col gap-2">
              {opsState.remediations.slice(0, 6).map((remediation) => (
                <article className={itemClass} key={remediation.remediationId}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-ink">
                      {remediation.recommendedAction}
                    </strong>
                    <StatusPill
                      status={remediation.status}
                      aria-label={`Remediation status for ${remediation.recommendedAction}: ${remediation.status}`}
                    />
                  </div>
                  <p className="text-sm text-muted">
                    Owner: {remediation.owner ?? "Unassigned"} · Verification:{" "}
                    {remediation.verificationMethod}
                  </p>
                  {/* Enrich core surfaces non-snap: packType badge + View pack / schedule links for FixVerification non-snap verdicts (remediation queue in validation-ops/attack-paths) */}
                  {(remediation as any).nonSnapPack ? (
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <Badge
                        tone="brand"
                        aria-label={`Non-snap pack: ${(remediation as any).nonSnapPack.packType}`}
                      >
                        {(remediation as any).nonSnapPack.packType}
                      </Badge>
                      <a
                        href={`/reports?evidencePackId=${(remediation as any).nonSnapPack.evidencePackId}`}
                        className="underline text-brand"
                      >
                        View pack
                      </a>
                      {(remediation as any).nonSnapPack.scheduleId ? (
                        <a href={`/schedules`} className="underline text-brand">
                          View schedule
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyLine>No remediation tasks are currently open.</EmptyLine>
          )}
        </section>

        <section className={sectionClass} aria-labelledby="ops-evidence-title">
          <div className="flex items-center justify-between gap-4">
            <h3
              id="ops-evidence-title"
              className="text-base font-semibold text-ink"
            >
              Evidence and reports
            </h3>
            <Badge
              tone="success"
              role="status"
              aria-label={`Ready evidence pack count: ${readyReports}`}
            >
              {readyReports} ready reports
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">
                Recent evidence
              </h4>
              {opsState.evidence.length ? (
                opsState.evidence.slice(0, 5).map((artifact) => (
                  <article
                    className="flex items-center justify-between gap-3 rounded-control border border-line bg-bg p-3"
                    key={artifact.evidenceId}
                  >
                    <div>
                      <strong className="text-ink">
                        {artifact.artifactType}
                      </strong>
                      <p className="text-sm text-muted">
                        {artifact.redactionStatus} ·{" "}
                        {formatTimestamp(artifact.createdAt)}
                      </p>
                    </div>
                    <span className={chip}>
                      ev-{shortId(artifact.evidenceId)}
                    </span>
                  </article>
                ))
              ) : (
                <EmptyLine>
                  No evidence artifacts have been stored yet.
                </EmptyLine>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">Evidence packs</h4>
              {opsState.reports.length ? (
                opsState.reports.slice(0, 5).map((report) => (
                  <article
                    className="flex items-center justify-between gap-3 rounded-control border border-line bg-bg p-3"
                    key={report.evidencePackId}
                  >
                    <div>
                      <strong className="text-ink">{report.title}</strong>
                      <p className="text-sm text-muted">
                        {report.packType} · {report.audience}
                      </p>
                    </div>
                    <StatusPill
                      status={report.status}
                      aria-label={`Evidence pack status for ${report.title}: ${report.status}`}
                    />
                  </article>
                ))
              ) : (
                <EmptyLine>
                  No evidence packs have been generated yet.
                </EmptyLine>
              )}
            </div>
          </div>
        </section>

        <section className={sectionClass} aria-labelledby="ops-readiness-title">
          <div className="flex items-center justify-between gap-4">
            <h3
              id="ops-readiness-title"
              className="text-base font-semibold text-ink"
            >
              Validation readiness
            </h3>
            <Badge
              tone="neutral"
              role="status"
              aria-label="Validation readiness source: API inputs"
            >
              API inputs
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">
                AI applications
              </h4>
              {opsState.aiApplications.length ? (
                opsState.aiApplications.map((app) => (
                  <article
                    className="rounded-control border border-line bg-bg p-3"
                    key={app.aiAppId}
                  >
                    <strong className="text-ink">{app.name}</strong>
                    <p className="text-sm text-muted">
                      {app.appType} · Last validated{" "}
                      {formatTimestamp(app.lastValidatedAt)}
                    </p>
                  </article>
                ))
              ) : (
                <EmptyLine>No AI applications are registered.</EmptyLine>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">Controls</h4>
              {opsState.controlSources.length ? (
                opsState.controlSources.map((source) => (
                  <article
                    className="flex items-center justify-between gap-3 rounded-control border border-line bg-bg p-3"
                    key={source.controlSourceId}
                  >
                    <div>
                      <strong className="text-ink">
                        {source.provider} {source.controlType}
                      </strong>
                      <p className="text-sm text-muted">
                        Telemetry {source.telemetryStatus} · Last validated{" "}
                        {formatTimestamp(source.lastValidatedAt)}
                      </p>
                    </div>
                    <StatusPill
                      status={source.healthStatus}
                      aria-label={`Control source ${source.provider} ${source.controlType} health: ${source.healthStatus}`}
                    />
                  </article>
                ))
              ) : (
                <EmptyLine>No control sources are registered.</EmptyLine>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">
                Detection coverage
              </h4>
              <p className="text-sm text-muted">
                Measured per ATT&CK technique from ingested control telemetry.
                Detected/Prevented count as covered; a logged-only SIEM hit is
                shown as such, never promoted to active detection.
              </p>
              {opsState.ruleCoverage.items.length ? (
                opsState.ruleCoverage.items.map((item) => (
                  <article
                    className="flex items-center justify-between gap-3 rounded-control border border-line bg-bg p-3"
                    key={`${item.controlSourceId}:${item.scenarioId}`}
                  >
                    <div>
                      <strong className="text-ink">
                        {item.techniqueId} {item.techniqueName}
                      </strong>
                      <p className="text-sm text-muted">
                        {item.observedSources.length
                          ? `Observed via ${item.observedSources.join(", ")}`
                          : "No tool telemetry has been observed for this technique."}
                      </p>
                    </div>
                    <Badge
                      aria-label={`Detection coverage for ${item.techniqueId}: ${coverageStatusLabel(item.status)}`}
                      className="border-0 bg-transparent px-0"
                      role="status"
                      tone={coverageStatusTone(item.status)}
                    >
                      {coverageStatusLabel(item.status)}
                    </Badge>
                  </article>
                ))
              ) : (
                <EmptyLine>
                  No detection coverage has been measured yet.
                </EmptyLine>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">Runners</h4>
              {opsState.runners.length ? (
                opsState.runners.map((runner) => (
                  <article
                    className="flex items-center justify-between gap-3 rounded-control border border-line bg-bg p-3"
                    key={runner.runnerId}
                  >
                    <div>
                      <strong className="text-ink">{runner.name}</strong>
                      <p className="text-sm text-muted">
                        {runner.transportMode} · Last seen{" "}
                        {formatTimestamp(runner.lastSeenAt)}
                      </p>
                    </div>
                    <StatusPill
                      status={runner.status}
                      aria-label={`Runner ${runner.name} status: ${runner.status}`}
                    />
                  </article>
                ))
              ) : (
                <EmptyLine>No internal runners are registered.</EmptyLine>
              )}
            </div>
          </div>
        </section>

        <section className={sectionClass} aria-labelledby="ops-ctem-title">
          <div className="flex items-center justify-between gap-4">
            <h3
              id="ops-ctem-title"
              className="text-base font-semibold text-ink"
            >
              CTEM program view
            </h3>
            <StatusPill
              status={opsState.ctemProgram.topRiskBand}
              aria-label={`CTEM top risk band: ${opsState.ctemProgram.topRiskBand}`}
            />
          </div>
          <p className="text-sm text-muted">
            {opsState.ctemProgram.source === "Snapshot"
              ? `Generated ${formatTimestamp(opsState.ctemProgram.generatedAt)} from Snapshot ${opsState.ctemProgram.snapshotId ?? "evidence"}.`
              : `Generated ${formatTimestamp(opsState.ctemProgram.generatedAt)} as a live baseline from tenant-scoped state because no Snapshot report exists yet.`}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {opsState.ctemProgram.stages.map((stage) => (
              <article
                className="rounded-control border border-line bg-bg p-3"
                key={stage.stage}
              >
                <span className="text-xs uppercase tracking-wide text-subtle">
                  {stage.stage}
                </span>
                <strong className="mt-1 block text-ink">{stage.status}</strong>
                <p className="mt-1 text-xs text-muted">
                  {stage.evidenceCount} evidence · {stage.openItemCount} open ·{" "}
                  {stage.trend}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className={sectionClass} aria-labelledby="ops-billing-title">
          <div className="flex items-center justify-between gap-4">
            <h3
              id="ops-billing-title"
              className="text-base font-semibold text-ink"
            >
              Billing and usage
            </h3>
            <Badge
              tone="neutral"
              role="status"
              aria-label={`Active billing meter count: ${opsState.billingUsage.meters.length}`}
            >
              {opsState.billingUsage.meters.length} active meters
            </Badge>
          </div>
          <p className="text-sm text-muted">
            Periscan packaging follows the public rule:{" "}
            <strong>Pay for what you validate.</strong> Exact pricing and
            payment processing are not configured in this product surface.
          </p>
          <p className="text-sm text-muted">
            Period {formatTimestamp(opsState.billingUsage.meteringPeriodStart)}
            {" through "}
            {formatTimestamp(opsState.billingUsage.meteringPeriodEnd)}.
          </p>
          <article
            className="rounded-control border border-line bg-bg p-3"
            aria-label="Active subscription package"
          >
            <span className="text-xs uppercase tracking-wide text-subtle">
              Active subscription
            </span>
            {opsState.activeBillingPackage ? (
              <>
                <strong className="mt-1 block text-ink">
                  {opsState.activeBillingPackage.label}
                </strong>
                <p className="mt-1 text-xs text-muted">
                  Capabilities your tenant is entitled to use:
                </p>
                <ul
                  className="mt-1 flex flex-wrap gap-1"
                  aria-label="Entitled capabilities"
                >
                  {opsState.activeBillingPackage.includedCapabilities.map(
                    (capability, index) => (
                      <li key={`${capability}:${index}`}>
                        <Badge tone="brand">{capability}</Badge>
                      </li>
                    )
                  )}
                </ul>
              </>
            ) : (
              <>
                <strong className="mt-1 block text-ink">
                  No active subscription
                </strong>
                <p className="mt-1 text-xs text-muted">
                  This tenant has no subscription package assigned, so
                  capability-gated actions are denied until a package is
                  assigned.
                </p>
              </>
            )}
          </article>

          {/* Visible usage meters for release-grade transparency (ValidationRuns, EvidencePacks, RunnerMinutes, etc.) */}
          {opsState.billingUsage.meters.length > 0 && (
            <article
              className="rounded-control border border-line bg-bg p-3"
              aria-label="Current period usage meters"
            >
              <span className="text-xs uppercase tracking-wide text-subtle">
                Current usage (this period)
              </span>
              <ul
                className="mt-2 space-y-1 text-sm"
                aria-label="Meter readings"
              >
                {opsState.billingUsage.meters.map((meter) => (
                  <li key={meter.meterName} className="flex justify-between">
                    <span>{meter.label}</span>
                    <span className="font-mono text-ink">
                      {meter.quantity} {meter.unit}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-muted">
                Meters are transparent; entitlements are enforced via package
                capabilities.
              </p>
            </article>
          )}

          <div
            className="grid gap-2 sm:grid-cols-2"
            aria-label="Billing packages"
          >
            {opsState.billingPackages.map((billingPackage) => (
              <article
                className="rounded-control border border-line bg-bg p-3"
                key={billingPackage.packageKey}
              >
                <span className="text-xs uppercase tracking-wide text-subtle">
                  {billingPackage.label}
                </span>
                <strong className="mt-1 block text-ink">
                  {billingPackage.status}
                </strong>
                <p className="mt-1 text-xs text-muted">
                  {billingPackage.description}
                </p>
                <p className="mt-1 text-xs text-muted">
                  API access: {billingPackage.apiAccess} · Payment processor:{" "}
                  {billingPackage.paymentProcessorStatus}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Meters: {billingPackage.includedMeterNames.join(", ")}
                </p>
              </article>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {opsState.billingMeters.map((meter) => {
              const usage = opsState.billingUsage.meters.find(
                (candidate) => candidate.meterName === meter.meterName
              );

              return (
                <article
                  className="rounded-control border border-line bg-bg p-3"
                  key={meter.meterName}
                >
                  <span className="text-xs uppercase tracking-wide text-subtle">
                    {meter.label}
                  </span>
                  <strong className="mt-1 block text-ink">
                    {usage?.quantity ?? 0}
                  </strong>
                  <p className="mt-1 text-xs text-muted">{meter.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className={sectionClass} aria-labelledby="ops-health-title">
          <div className="flex items-center justify-between gap-4">
            <h3
              id="ops-health-title"
              className="text-base font-semibold text-ink"
            >
              Operational health and trends
            </h3>
            <Badge
              tone="neutral"
              role="status"
              aria-label="Operational health source: API-derived"
            >
              API-derived
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">Mission starts</h4>
              <dl className="grid grid-cols-1 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted">Started missions</dt>
                  <dd className="text-ink">
                    {
                      opsState.operationalMetrics.missionStartLatency
                        .startedMissionCount
                    }
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Average start latency</dt>
                  <dd className="text-ink">
                    {opsState.operationalMetrics.missionStartLatency
                      .averageDurationMs == null
                      ? "Not available"
                      : `${Math.round(
                          opsState.operationalMetrics.missionStartLatency
                            .averageDurationMs
                        )} ms`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Connector syncs</dt>
                  <dd className="text-ink">
                    {opsState.operationalMetrics.connectorSyncs.totalSyncCount}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">
                Remediation velocity
              </h4>
              <dl className="grid grid-cols-1 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted">Total remediations</dt>
                  <dd className="text-ink">
                    {
                      opsState.executiveTrends.remediationVelocity
                        .totalRemediations
                    }
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Ready for verification</dt>
                  <dd className="text-ink">
                    {
                      opsState.executiveTrends.remediationVelocity
                        .readyForVerification
                    }
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Closed without evidence</dt>
                  <dd className="text-ink">
                    {
                      opsState.executiveTrends.remediationVelocity
                        .closedWithoutEvidence
                    }
                  </dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">
                Recommendations
              </h4>
              {[
                ...opsState.operationalMetrics.recommendations,
                ...opsState.executiveTrends.recommendations
              ].length ? (
                <ul className="flex flex-col gap-1 text-sm text-muted">
                  {[
                    ...opsState.operationalMetrics.recommendations,
                    ...opsState.executiveTrends.recommendations
                  ].map((recommendation) => (
                    <li key={recommendation}>{recommendation}</li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>
                  No operational recommendations are available.
                </EmptyLine>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
