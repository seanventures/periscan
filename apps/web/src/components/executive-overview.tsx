"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  CTEMStageSummary,
  ExecutiveTrendSeries,
  ExecutiveTrendSummary,
  RemediationTask,
  ValidatedFinding
} from "@periscan/shared";
import { formatRiskBandDisplayLabel } from "@periscan/shared";

import { formatPathClaimSnippet } from "../lib/claim-safe-display";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import { ExecutiveTrendChart } from "./executive-trend-chart";
import {
  AttackPathClaimBadge,
  DistributionChart,
  ErrorState,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  ReadinessRing,
  RiskBandBadge,
  SegmentedBar,
  StateBadge,
  Tabs,
  buttonClassName,
  riskBandTone,
  severityChartColor,
  type ChartDatum,
  type StateTone
} from "../ui";

/**
 * Risk-band chart fills: severity bands share severityChartColor; Fixed is
 * presentation-only (display "Closed (risk)") and uses a distinct success tone.
 */
function bandChartColor(band: string): string {
  if (band === "Fixed") return "var(--color-fixed)";
  return severityChartColor(band);
}
const DIRECTION_TONE: Record<string, StateTone> = {
  Improved: "fixed",
  Worsened: "missed",
  Unchanged: "inconclusive",
  NotAvailable: "neutral"
};

const HIGHER_IS_BETTER_METRICS = new Set([
  "evidence_packs_ready",
  "healthy_integrations",
  "verified_fixes"
]);

type ExecutivePeriod = 30 | 90 | 365 | "all";
type ExecutivePeriodMetric = ExecutiveTrendSummary["metrics"][number] & {
  comparisonCapturedAt: string | null;
};

export function computeExecutivePeriodMetrics(input: {
  current: ExecutiveTrendSummary | null;
  period: ExecutivePeriod;
  series: ExecutiveTrendSeries | null;
}): ExecutivePeriodMetric[] {
  if (!input.current) return [];

  const currentAt = new Date(input.current.generatedAt).getTime();
  const cutoff =
    input.period === "all"
      ? null
      : currentAt - input.period * 24 * 60 * 60 * 1000;

  return input.current.metrics.map((metric) => {
    const seriesMetric = input.series?.metrics.find(
      (candidate) => candidate.metricId === metric.metricId
    );
    const points = [...(seriesMetric?.points ?? [])]
      .filter((point) => new Date(point.capturedAt).getTime() < currentAt)
      .sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
    const baseline =
      cutoff === null
        ? (points.find(
            (point) =>
              currentAt - new Date(point.capturedAt).getTime() >= 60_000
          ) ?? null)
        : ([...points]
            .reverse()
            .find((point) => new Date(point.capturedAt).getTime() <= cutoff) ??
          null);

    if (!baseline) {
      return {
        ...metric,
        comparisonCapturedAt: null,
        delta: 0,
        previousValue: null,
        trendDirection: "NotAvailable" as const
      };
    }

    const delta = metric.value - baseline.value;
    const higherIsBetter = HIGHER_IS_BETTER_METRICS.has(metric.metricId);
    const trendDirection =
      delta === 0
        ? ("Unchanged" as const)
        : delta > 0 === higherIsBetter
          ? ("Improved" as const)
          : ("Worsened" as const);

    return {
      ...metric,
      comparisonCapturedAt: baseline.capturedAt,
      delta,
      previousValue: baseline.value,
      trendDirection
    };
  });
}

function periodLabel(period: ExecutivePeriod): string {
  return period === "all" ? "all captured history" : `${period} days`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function ExecutiveOverview() {
  const exec = useApiResource(() => api.getExecutiveTrends(), []);
  const series = useApiResource(() => api.getExecutiveTrendSeries(), []);
  const ctem = useApiResource(() => api.getCTEMProgram(), []);
  const paths = useApiResource(() => api.listAttackPaths(), []);
  const findings = useApiResource(() => api.listFindings(), []);
  const remediations = useApiResource(() => api.listRemediations(), []);
  const advisories = useApiResource(() => api.listThreatAdvisories(), []);
  // Pilot packaging honesty: live marketPresence for zero-ref success banner.
  const trust = useApiResource(() => api.getTrustSafetySummary(), []);
  // Real activation spine — pilot checklist checkmarks only from API, never invented.
  const activation = useApiResource(() => api.getProductActivationState(), []);
  const [period, setPeriod] = useState<ExecutivePeriod>(90);

  const slaDiscipline = useMemo(
    () =>
      computeSlaDisciplineSummary({
        findings: findings.data ?? [],
        remediations: remediations.data ?? []
      }),
    [findings.data, remediations.data]
  );

  const readiness = useMemo(() => {
    const stages = ctem.data?.stages ?? [];
    if (!stages.length) return 0;
    const sum = stages.reduce(
      (a, s) =>
        a +
        (s.status === "OnTrack" ? 1 : s.status === "NeedsAttention" ? 0.5 : 0),
      0
    );
    return Math.round((sum / stages.length) * 100);
  }, [ctem.data]);

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
        color: bandChartColor(b)
      }));
  }, [paths.data]);

  const topPaths = useMemo(
    () =>
      [...(paths.data ?? [])]
        .sort((a, b) => b.risk.score - a.risk.score)
        .slice(0, 8),
    [paths.data]
  );

  const periodMetrics = useMemo(
    () =>
      computeExecutivePeriodMetrics({
        current: exec.data,
        period,
        series: series.data
      }),
    [exec.data, period, series.data]
  );
  const filteredSeries = useMemo(() => {
    if (!series.data || period === "all") return series.data?.metrics ?? [];
    const cutoff =
      new Date(exec.data?.generatedAt ?? series.data.generatedAt).getTime() -
      period * 24 * 60 * 60 * 1000;

    return series.data.metrics.map((metric) => {
      const ordered = [...metric.points].sort((left, right) =>
        left.capturedAt.localeCompare(right.capturedAt)
      );
      const prior = [...ordered]
        .reverse()
        .find((point) => new Date(point.capturedAt).getTime() <= cutoff);
      return {
        ...metric,
        points: ordered.filter(
          (point) =>
            point === prior || new Date(point.capturedAt).getTime() >= cutoff
        )
      };
    });
  }, [exec.data?.generatedAt, period, series.data]);
  const missingBaselineCount = periodMetrics.filter(
    (metric) => metric.trendDirection === "NotAvailable"
  ).length;
  const missingProofInputs =
    exec.data?.metrics.find(
      (metric) => metric.metricId === "missing_signal_gaps"
    )?.value ?? 0;
  const honestyTrust = exec.data?.honestyTrust ?? null;
  const measuredShareLow =
    honestyTrust != null &&
    honestyTrust.claimsTotalCount > 0 &&
    honestyTrust.claimsMeasuredPct < 50;
  const confidenceMessages = [
    exec.error ? "current executive metrics are unavailable" : null,
    series.error ? "persisted trend history is unavailable" : null,
    missingProofInputs > 0
      ? `${missingProofInputs} proof ${missingProofInputs === 1 ? "input is" : "inputs are"} missing`
      : null,
    missingBaselineCount > 0 && periodMetrics.length > 0
      ? `${missingBaselineCount} of ${periodMetrics.length} metrics lack a ${periodLabel(period)} baseline`
      : null,
    measuredShareLow
      ? `only ${honestyTrust!.claimsMeasuredPct}% of path/hop claims are Measured (Heuristic remainder is hypothesis)`
      : null
  ].filter((message): message is string => Boolean(message));

  function exportPeriodCsv() {
    const header = [
      "metric_id",
      "label",
      "current_value",
      "unit",
      "baseline_value",
      "baseline_captured_at",
      "delta",
      "direction",
      "period"
    ];
    const rows = periodMetrics.map((metric) => [
      metric.metricId,
      metric.label,
      metric.value,
      metric.unit,
      metric.previousValue ?? "",
      metric.comparisonCapturedAt ?? "",
      metric.delta,
      metric.trendDirection,
      periodLabel(period)
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `periscan-executive-${period === "all" ? "all-history" : `${period}d`}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const publicReferenceCount =
    trust.data?.marketPresence.publicReferenceCount ?? null;
  const showPilotBanner =
    publicReferenceCount !== null && publicReferenceCount === 0;
  const measuredResultDone =
    activation.data?.milestones.some(
      (m) => m.key === "MeasuredResult" && m.state === "Completed"
    ) ?? false;

  return (
    <div
      className="executive-overview mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6"
      data-testid="executive-overview"
      role="region"
      aria-label="Executive overview"
    >
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            Prove · Leadership
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Executive overview
          </h1>
          <p className="max-w-2xl text-sm text-muted">
            Posture at a glance. Controls, exposure, path risk, and remediation
            velocity — with change since last period.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
              Comparison period
            </span>
            <select
              aria-label="Executive comparison period"
              value={period}
              onChange={(event) =>
                setPeriod(
                  event.target.value === "all"
                    ? "all"
                    : (Number(event.target.value) as 30 | 90 | 365)
                )
              }
              className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-line-strong"
            >
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 12 months</option>
              <option value="all">All captured history</option>
            </select>
          </label>
          <button
            type="button"
            onClick={exportPeriodCsv}
            disabled={periodMetrics.length === 0}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            data-testid="print-board-narrative"
          >
            Print board narrative
          </button>
          <Link
            href="/reports?pack=board"
            className={buttonClassName({ size: "sm", variant: "primary" })}
            data-testid="build-board-pack"
          >
            Build board pack
          </Link>
        </div>
      </header>

      {showPilotBanner ? (
        <PilotSuccessCriteriaBanner
          publicReferenceCount={publicReferenceCount}
          waveGate={trust.data?.marketPresence.waveMarketPresenceGate}
          mqGate={trust.data?.marketPresence.mqMarketPresenceGate}
          measuredResultDone={measuredResultDone}
          honestyTrust={honestyTrust}
        />
      ) : null}

      {confidenceMessages.length > 0 ? (
        <div
          role="status"
          className="rounded-control border border-approval/35 bg-approval/5 px-3 py-2 text-[12.5px] text-muted print:border-neutral-300 print:bg-amber-50 print:text-neutral-800"
        >
          <span className="font-semibold text-approval print:text-amber-900">
            Decision confidence limited:
          </span>{" "}
          {confidenceMessages.join("; ")}.
        </div>
      ) : null}

      {/* ICP-P1-6: honestyTrust strip — Measured vs Heuristic + Fixed revalidated */}
      {honestyTrust ? (
        <HonestyTrustStrip honestyTrust={honestyTrust} />
      ) : exec.loading ? null : exec.error ? null : (
        <div
          role="status"
          className="rounded-control border border-line bg-surface px-3 py-2 text-[12.5px] text-subtle"
          data-testid="honesty-trust-unavailable"
        >
          Honesty trust metrics are not available on this response yet.
        </div>
      )}

      {/* One-screen board narrative: visible on screen; optimized for print projection. */}
      <BoardNarrativePanel
        period={period}
        periodMetrics={periodMetrics}
        honestyTrust={honestyTrust}
        readiness={readiness}
        topBand={ctem.data?.topRiskBand}
        proofDelivery={exec.data?.proofDelivery ?? null}
        remediationVelocity={exec.data?.remediationVelocity ?? null}
        topPaths={topPaths.slice(0, 3)}
        slaDiscipline={slaDiscipline}
      />

      <div className="print:hidden">
      <Tabs
        aria-label="Executive views"
        items={[
          {
            value: "overview",
            label: "Summary",
            content: (
              <OverviewTab
                exec={exec.data}
                execError={exec.error}
                execLoading={exec.loading}
                period={period}
                periodMetrics={periodMetrics}
                readiness={readiness}
                readinessStages={ctem.data?.stages ?? []}
                readinessSource={ctem.data?.source}
                topBand={ctem.data?.topRiskBand}
                severityData={severityData}
                bandData={bandData}
                findingsLoading={findings.loading}
                pathsLoading={paths.loading}
                slaDiscipline={slaDiscipline}
                slaLoading={findings.loading || remediations.loading}
              />
            )
          },
          {
            value: "trends",
            label: "Trends",
            content: (
              <Panel>
                <PanelHeader title="Posture over time" />
                {series.loading ? (
                  <LoadingSkeleton rows={5} />
                ) : series.error ? (
                  <ErrorState message={series.error} onRetry={series.refetch} />
                ) : (
                  <ExecutiveTrendChart metrics={filteredSeries} />
                )}
              </Panel>
            )
          },
          {
            value: "top",
            label: "Top risks",
            content: (
              <Panel>
                <PanelHeader
                  title="Highest-risk attack paths"
                  link={{ href: "/attack-paths", label: "All paths" }}
                />
                {paths.loading ? (
                  <LoadingSkeleton rows={6} />
                ) : paths.error ? (
                  <ErrorState message={paths.error} onRetry={paths.refetch} />
                ) : topPaths.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-subtle">
                    No priority attack paths yet.
                  </p>
                ) : (
                  <ul>
                    {topPaths.map(({ attackPath, risk }) => (
                      <li
                        key={attackPath.pathId}
                        className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                      >
                        <RiskBandBadge band={risk.band} dot={false} />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/attack-paths/${attackPath.pathId}`}
                            className="block truncate text-[13px] text-ink hover:text-brand"
                          >
                            {attackPath.name}
                          </Link>
                          {/* UX-W11: claim-safe path snippet — never raw Validated without hop proof */}
                          <p
                            className="mt-0.5 font-mono text-[11px] text-subtle"
                            data-testid="executive-path-claim-snippet"
                          >
                            {formatPathClaimSnippet(attackPath)}
                          </p>
                        </div>
                        <AttackPathClaimBadge attackPath={attackPath} />
                        <span className="font-mono text-[12px] text-muted">
                          score {risk.score}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )
          },
          {
            value: "threats",
            label: "Threat exposure",
            content: (
              <ThreatsTab
                advisories={advisories.data ?? []}
                loading={advisories.loading}
                error={advisories.error}
                onRetry={advisories.refetch}
              />
            )
          }
        ]}
      />
      </div>
    </div>
  );
}

/**
 * Design-partner pilot packaging (P03/P10): when public refs = 0, state pilot
 * success criteria honestly — never invent logos or Wave/MQ Pass.
 * Checklist checkmarks come only from real activation + honestyTrust APIs.
 */
function PilotSuccessCriteriaBanner({
  publicReferenceCount,
  waveGate,
  mqGate,
  measuredResultDone,
  honestyTrust
}: {
  publicReferenceCount: number;
  waveGate?: string;
  mqGate?: string;
  measuredResultDone: boolean;
  honestyTrust: ExecutiveTrendSummary["honestyTrust"] | null;
}) {
  const hasMeasuredClaims =
    (honestyTrust?.claimsMeasuredCount ?? 0) > 0;
  const hasFixedRevalidated =
    (honestyTrust?.fixedSurvivedCount ?? 0) > 0;
  const criteria = [
    {
      id: "measured-result",
      done: measuredResultDone,
      label:
        "First MeasuredResult on the activation spine (real product activation API)"
    },
    {
      id: "measured-paths",
      done: hasMeasuredClaims,
      label:
        "Path/hop claims Measured (not Heuristic-only) — N fully Measured multi-hop paths"
    },
    {
      id: "fixed-remeasure",
      done: hasFixedRevalidated,
      label:
        "Fixed with re-measure evidence IDs (ticket close ≠ Fixed)"
    },
    {
      id: "reference-factory",
      done: publicReferenceCount > 0,
      label: `Reference factory (no fake logos): docs/DESIGN_PARTNER/REFERENCE_FACTORY.md · public refs = ${publicReferenceCount}`
    },
    {
      id: "trust-residuals",
      done: false,
      label:
        "Trust pack residuals (DPA / pen-test / subprocessors) stay NotConfigured until published — see Trust & Safety"
    }
  ] as const;

  return (
    <aside
      role="status"
      data-testid="pilot-success-criteria-banner"
      className="rounded-control border border-approval/40 bg-approval/5 px-4 py-3 text-[12.5px] leading-relaxed text-muted print:border-neutral-300 print:bg-amber-50 print:text-neutral-800"
    >
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-approval print:text-amber-900">
        Design-partner pilot · not multi-year platform-of-record
      </p>
      <p className="mt-1.5">
        Public customer references ={" "}
        <span className="font-mono text-ink print:text-neutral-900">
          {publicReferenceCount}
        </span>
        {waveGate || mqGate ? (
          <>
            {" "}
            · Wave {waveGate ?? "Fail"} · MQ {mqGate ?? "Fail"}
          </>
        ) : null}
        . No logos or case studies are shown. Score purchase as a{" "}
        <strong className="text-ink print:text-neutral-900">
          scoped paid pilot
        </strong>
        , not sole board system of record. Platform-of-record purchase stays
        honesty-capped while refs = 0 (never claim Type II or Wave/MQ Pass
        from product alone).
      </p>
      <p className="mt-2 font-display text-[10.5px] font-semibold uppercase tracking-[0.1em] text-subtle print:text-neutral-700">
        Pilot success criteria
      </p>
      <ul
        className="mt-1.5 flex list-none flex-col gap-1.5 p-0 text-[12px] text-subtle print:text-neutral-700"
        data-testid="pilot-success-criteria-checklist"
      >
        {criteria.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2"
            data-testid={`pilot-criterion-${item.id}`}
            data-done={item.done ? "true" : "false"}
          >
            <span
              aria-hidden
              className={
                item.done
                  ? "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-fixed/20 font-mono text-[10px] font-bold text-fixed"
                  : "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line bg-bg font-mono text-[10px] text-subtle"
              }
            >
              {item.done ? "✓" : "·"}
            </span>
            <span>
              <span className="sr-only">
                {item.done ? "Met: " : "Open: "}
              </span>
              {item.id === "trust-residuals" ? (
                <>
                  Trust pack residuals (DPA / pen-test / subprocessors) stay
                  NotConfigured until published — see{" "}
                  <Link
                    href="/trust-safety"
                    className="font-semibold text-brand hover:text-brand-2 print:text-blue-800"
                  >
                    Trust &amp; Safety
                  </Link>
                  .
                </>
              ) : (
                item.label
              )}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/**
 * One-screen board narrative for print/projection (P10 delight + a11y).
 * Screen chrome uses dark theme; @media print forces light boardroom palette.
 */
function BoardNarrativePanel({
  period,
  periodMetrics,
  honestyTrust,
  readiness,
  topBand,
  proofDelivery,
  remediationVelocity,
  topPaths,
  slaDiscipline
}: {
  period: ExecutivePeriod;
  periodMetrics: ExecutivePeriodMetric[];
  honestyTrust: ExecutiveTrendSummary["honestyTrust"] | null;
  readiness: number;
  topBand?: string;
  proofDelivery: ExecutiveTrendSummary["proofDelivery"] | null;
  remediationVelocity: ExecutiveTrendSummary["remediationVelocity"] | null;
  topPaths: Array<{
    attackPath: { pathId: string; name: string };
    risk: { band: string; score: number };
  }>;
  slaDiscipline: ReturnType<typeof computeSlaDisciplineSummary>;
}) {
  const headlineMetrics = periodMetrics.slice(0, 6);
  return (
    <section
      aria-label="Board narrative"
      data-testid="board-narrative"
      className="board-narrative rounded-control border border-line bg-surface px-4 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Board narrative · one screen
          </p>
          <h2 className="mt-0.5 font-display text-lg font-semibold text-ink">
            Leadership posture brief
          </h2>
        </div>
        <p className="text-[11px] text-subtle">
          {periodLabel(period)}. Not certification. Fixed only via measured
          re-test.
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-control border border-line bg-bg px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
            CTEM readiness
          </p>
          <p className="mt-0.5 font-mono text-xl text-ink">{readiness}%</p>
          <p className="text-[11px] text-subtle">
            Stage completion. Not residual risk alone.
          </p>
        </div>
        <div className="rounded-control border border-line bg-bg px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Top risk band
          </p>
          <p className="mt-0.5 text-[15px] font-semibold text-ink">
            {topBand ? formatRiskBandDisplayLabel(topBand) : "—"}
          </p>
          <p className="text-[11px] text-subtle">
            Closed risk ≠ Fixed remediation.
          </p>
        </div>
        <div className="rounded-control border border-line bg-bg px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Path claims Measured
          </p>
          <p className="mt-0.5 font-mono text-xl text-ink">
            {honestyTrust ? `${honestyTrust.claimsMeasuredPct}%` : "—"}
          </p>
          <p className="text-[11px] text-subtle">
            {honestyTrust
              ? `${honestyTrust.claimsMeasuredCount}/${honestyTrust.claimsTotalCount}. Heuristic is hypothesis.`
              : "Honesty metrics pending."}
          </p>
        </div>
        <div className="rounded-control border border-line bg-bg px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Fixed revalidated
          </p>
          <p className="mt-0.5 font-mono text-xl text-ink">
            {honestyTrust
              ? `${honestyTrust.fixedSurvivedRevalidationPct}%`
              : "—"}
          </p>
          <p className="text-[11px] text-subtle">
            {remediationVelocity
              ? `${remediationVelocity.closedWithoutEvidence} closed without evidence. ${remediationVelocity.fixedRemediations} Fixed.`
              : "Velocity pending."}
          </p>
        </div>
      </div>

      {headlineMetrics.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {headlineMetrics.map((m) => (
            <div
              key={m.metricId}
              className="rounded-control border border-line px-3 py-2"
            >
              <p className="text-[11px] text-subtle">{m.label}</p>
              <p className="font-mono text-[15px] text-ink">
                {m.value}
                <span className="ml-1 text-[11px] text-muted">{m.unit}</span>
                {m.trendDirection !== "NotAvailable" ? (
                  <span className="ml-2 text-[11px] text-muted">
                    {m.delta > 0 ? "+" : ""}
                    {m.delta} · {m.trendDirection}
                  </span>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-control border border-line px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Priority paths (top 3)
          </p>
          {topPaths.length === 0 ? (
            <p className="mt-1 text-[12px] text-subtle">
              No priority attack paths yet.
            </p>
          ) : (
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-[12.5px] text-ink">
              {topPaths.map(({ attackPath, risk }) => (
                <li key={attackPath.pathId}>
                  <span className="font-medium">{attackPath.name}</span>
                  <span className="ml-1.5 text-subtle">
                    · {formatRiskBandDisplayLabel(risk.band)} · score{" "}
                    {risk.score}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-control border border-line px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Ops discipline &amp; proof delivery
          </p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-muted">
            <li>
              Critical/High unowned:{" "}
              <span className="font-mono text-ink">
                {slaDiscipline.criticalHighUnowned}
              </span>
            </li>
            <li>
              Open remediations without owner/due:{" "}
              <span className="font-mono text-ink">
                {slaDiscipline.openWithoutOwner}/{slaDiscipline.openWithoutDue}
              </span>
            </li>
            <li>
              Evidence packs ready:{" "}
              <span className="font-mono text-ink">
                {proofDelivery?.evidencePacksReady ?? 0}
              </span>{" "}
              · exports {proofDelivery?.reportExports ?? 0}
            </li>
            <li>
              Denied never queued:{" "}
              <span className="font-mono text-ink">
                {honestyTrust?.deniedNeverQueuedCount ?? "—"}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-subtle">
        Board appendix only. Not certification, full BAS, or vendor SOC 2 Type
        II. Formal pack: Reports → Board pack (Executive Risk Summary).
      </p>
    </section>
  );
}

/** ICP-P1-6: board honesty strip from getExecutiveTrends honestyTrust. */
function HonestyTrustStrip({
  honestyTrust
}: {
  honestyTrust: NonNullable<ExecutiveTrendSummary["honestyTrust"]>;
}) {
  const measuredTone: StateTone =
    honestyTrust.claimsTotalCount === 0
      ? "neutral"
      : honestyTrust.claimsMeasuredPct >= 70
        ? "fixed"
        : honestyTrust.claimsMeasuredPct >= 40
          ? "approval"
          : "missed";
  const fixedTone: StateTone =
    honestyTrust.fixedAttemptedCount === 0
      ? "neutral"
      : honestyTrust.fixedSurvivedRevalidationPct >= 80
        ? "fixed"
        : "approval";
  const heuristicCount = Math.max(
    0,
    honestyTrust.claimsTotalCount - honestyTrust.claimsMeasuredCount
  );

  return (
    <section
      aria-label="Honesty trust metrics"
      data-testid="honesty-trust-strip"
      className="rounded-control border border-line bg-surface px-4 py-3 print:break-inside-avoid"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
          Honesty trust · Measured vs Heuristic
        </p>
        <p className="max-w-xl text-[11px] text-subtle">
          {honestyTrust.compositionNote}
        </p>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <li className="rounded-control border border-line bg-bg px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Path/hop claims Measured
          </p>
          <p className="mt-0.5 font-mono text-lg text-ink">
            {honestyTrust.claimsMeasuredPct}
            <span className="text-sm text-muted">%</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            <StateBadge tone={measuredTone} dot={false}>
              {honestyTrust.claimsMeasuredCount}/{honestyTrust.claimsTotalCount}{" "}
              Measured
            </StateBadge>
            {heuristicCount > 0 ? (
              <span className="ml-1.5 text-subtle">
                · {heuristicCount} Heuristic
              </span>
            ) : null}
          </p>
        </li>
        <li className="rounded-control border border-line bg-bg px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Fixed survived revalidation
          </p>
          <p className="mt-0.5 font-mono text-lg text-ink">
            {honestyTrust.fixedSurvivedRevalidationPct}
            <span className="text-sm text-muted">%</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            <StateBadge tone={fixedTone} dot={false}>
              {honestyTrust.fixedSurvivedCount}/
              {honestyTrust.fixedAttemptedCount} Fixed
            </StateBadge>
          </p>
        </li>
        <li className="rounded-control border border-line bg-bg px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Denied never queued
          </p>
          <p className="mt-0.5 font-mono text-lg text-ink">
            {honestyTrust.deniedNeverQueuedCount}
          </p>
          <p className="mt-0.5 text-[11px] text-subtle">
            Fail-closed policy denials (not in queue)
          </p>
        </li>
        <li className="rounded-control border border-line bg-bg px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Signature verification
          </p>
          <p className="mt-0.5 font-mono text-lg text-ink">
            {honestyTrust.signatureVerificationRatePct == null
              ? "n/a"
              : `${honestyTrust.signatureVerificationRatePct}%`}
          </p>
          <p className="mt-0.5 text-[11px] text-subtle">
            {honestyTrust.signatureCheckedCount === 0
              ? "No signed results in window (honest empty)"
              : `${honestyTrust.signatureVerifiedCount}/${honestyTrust.signatureCheckedCount} verified`}
          </p>
        </li>
      </ul>
    </section>
  );
}

/** P04-17: operational SLA discipline counters for Executive overview. */
export function computeSlaDisciplineSummary(input: {
  findings: ValidatedFinding[];
  remediations: RemediationTask[];
}): {
  criticalHighUnowned: number;
  openWithoutOwner: number;
  openWithoutDue: number;
  overdueOpen: number;
  withOwnerAndDue: number;
} {
  const settled = new Set(["Fixed", "Mitigated", "ClosedWithoutEvidence"]);
  const openRems = input.remediations.filter((r) => !settled.has(r.status));
  const now = Date.now();
  let openWithoutOwner = 0;
  let openWithoutDue = 0;
  let overdueOpen = 0;
  let withOwnerAndDue = 0;
  for (const r of openRems) {
    const hasOwner = Boolean(r.owner?.trim());
    const hasDue = Boolean(r.dueAt);
    if (!hasOwner) openWithoutOwner += 1;
    if (!hasDue) openWithoutDue += 1;
    if (hasOwner && hasDue) withOwnerAndDue += 1;
    if (
      hasDue &&
      r.dueAt &&
      Date.parse(r.dueAt) < now &&
      !settled.has(r.status)
    ) {
      overdueOpen += 1;
    }
  }
  const criticalHighUnowned = input.findings.filter((f) => {
    const sev = f.severity;
    if (sev !== "Critical" && sev !== "High") return false;
    // Noise dispositions are not operational queue debt.
    const disposition = f.disposition?.disposition;
    if (disposition === "FalsePositive" || disposition === "Suppressed") {
      return false;
    }
    if (f.status === "Fixed" || f.status === "Revalidated") {
      return false;
    }
    // Operational ownership: ownerId / ownerDisplay, or non-AR disposition
    // assignee. AcceptedRisk acceptor alone does not clear unowned (P18-3).
    if (f.ownerId || f.ownerDisplay?.trim()) return false;
    if (
      f.disposition?.ownerId &&
      f.disposition.disposition !== "AcceptedRisk"
    ) {
      return false;
    }
    return true;
  }).length;
  return {
    criticalHighUnowned,
    openWithoutOwner,
    openWithoutDue,
    overdueOpen,
    withOwnerAndDue
  };
}

function OverviewTab({
  exec,
  execError,
  execLoading,
  period,
  periodMetrics,
  readiness,
  readinessStages,
  readinessSource,
  topBand,
  severityData,
  bandData,
  findingsLoading,
  pathsLoading,
  slaDiscipline,
  slaLoading
}: {
  exec: ExecutiveTrendSummary | null;
  execError: string | null;
  execLoading: boolean;
  period: ExecutivePeriod;
  periodMetrics: ExecutivePeriodMetric[];
  readiness: number;
  readinessStages: CTEMStageSummary[];
  readinessSource?: "Snapshot" | "LiveTenantStateBaseline";
  topBand?: string;
  severityData: ChartDatum[];
  bandData: ChartDatum[];
  findingsLoading: boolean;
  pathsLoading: boolean;
  slaDiscipline: ReturnType<typeof computeSlaDisciplineSummary>;
  slaLoading: boolean;
}) {
  const v = exec?.remediationVelocity;
  return (
    <div className="flex flex-col gap-4">
      {execError ? <ErrorState message={execError} /> : null}
      {/* Headline */}
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <Panel>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-4">
              <ReadinessRing
                value={readiness}
                label="readiness"
                tone={topBand ? riskBandTone(topBand) : "brand"}
              />
              <div>
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  Top risk band
                </p>
                {topBand ? (
                  <RiskBandBadge band={topBand} dot={false} />
                ) : (
                  <span className="text-sm text-subtle">—</span>
                )}
                <p className="mt-2 font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  Proof delivery
                </p>
                <p className="font-mono text-[13px] text-ink">
                  {exec?.proofDelivery.evidencePacksReady ?? 0} packs ·{" "}
                  {exec?.proofDelivery.reportExports ?? 0} exports
                </p>
              </div>
            </div>
            <div className="border-t border-line pt-2 text-[10.5px] text-subtle">
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Readiness score
              </p>
              <p className="mt-1">
                CTEM stages: On track = 100, Needs attention = 50, Not started =
                0.
                {readinessSource
                  ? ` Source: ${readinessSource === "Snapshot" ? "latest validation snapshot" : "live tenant baseline"}.`
                  : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {readinessStages.map((stage) => (
                  <span
                    key={stage.stage}
                    className="rounded-pill border border-line px-1.5 py-0.5"
                  >
                    {stage.stage} ·{" "}
                    {stage.status === "OnTrack"
                      ? "100"
                      : stage.status === "NeedsAttention"
                        ? "50"
                        : "0"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title={`Change over ${periodLabel(period)}`} />
          {execLoading ? (
            <LoadingSkeleton rows={3} />
          ) : periodMetrics.length === 0 ? (
            <p className="px-4 py-6 text-sm text-subtle">
              No trend metrics yet.
            </p>
          ) : (
            <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {periodMetrics.map((m) => (
                <DeltaMetric
                  key={m.metricId}
                  label={m.label}
                  value={m.value}
                  unit={m.unit}
                  delta={m.delta}
                  direction={m.trendDirection}
                  comparisonCapturedAt={m.comparisonCapturedAt}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Distributions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="p-4">
            {findingsLoading ? (
              <LoadingSkeleton rows={4} />
            ) : (
              <DistributionChart
                title="Validated exposure by severity"
                ariaLabel="Findings by severity"
                data={severityData}
                variant="bar"
                emptyLabel="No findings to chart yet."
              />
            )}
          </div>
        </Panel>
        <Panel>
          <div className="p-4">
            {pathsLoading ? (
              <LoadingSkeleton rows={4} />
            ) : (
              <DistributionChart
                title="Attack paths by risk band"
                ariaLabel="Attack paths by risk band"
                data={bandData}
                variant="bar"
                emptyLabel="No attack paths to chart yet."
              />
            )}
          </div>
        </Panel>
      </div>

      {/* Owner / SLA discipline (P04-17) */}
      <Panel>
        <PanelHeader
          title="Owner & SLA discipline"
          link={{ href: "/remediation?view=overdue", label: "Overdue queue" }}
        />
        <div className="p-4">
          {slaLoading ? (
            <LoadingSkeleton rows={2} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SlaStat
                label="Critical/High unowned"
                value={slaDiscipline.criticalHighUnowned}
                href="/findings?view=priority-unowned"
                tone={
                  slaDiscipline.criticalHighUnowned > 0 ? "missed" : "fixed"
                }
              />
              <SlaStat
                label="Open · no owner"
                value={slaDiscipline.openWithoutOwner}
                href="/remediation"
                tone={slaDiscipline.openWithoutOwner > 0 ? "approval" : "fixed"}
              />
              <SlaStat
                label="Open · no SLA date"
                value={slaDiscipline.openWithoutDue}
                href="/remediation"
                tone={slaDiscipline.openWithoutDue > 0 ? "approval" : "fixed"}
              />
              <SlaStat
                label="Overdue open"
                value={slaDiscipline.overdueOpen}
                href="/remediation?view=overdue"
                tone={slaDiscipline.overdueOpen > 0 ? "missed" : "fixed"}
              />
              <SlaStat
                label="Owned + SLA set"
                value={slaDiscipline.withOwnerAndDue}
                href="/remediation"
                tone="fixed"
              />
            </div>
          )}
          <p className="mt-3 text-[11.5px] text-subtle">
            Owner and target SLA come from remediation tasks (and projected onto
            findings). Route Critical/High findings with owner + SLA from the
            findings workbench. Alert webhooks for Measured-critical SLA breach
            remain optional catalog events — assign owners so aging is real.
          </p>
        </div>
      </Panel>

      {/* Remediation velocity */}
      <Panel>
        <PanelHeader
          title="Remediation velocity"
          actions={
            v?.averageVerificationHours != null ? (
              <span className="font-mono text-[11px] text-subtle">
                avg verify {v.averageVerificationHours.toFixed(1)}h
              </span>
            ) : null
          }
        />
        <div className="p-4">
          {v ? (
            <SegmentedBar
              ariaLabel="Remediation velocity"
              segments={[
                { label: "Open", value: v.openRemediations, tone: "approval" },
                {
                  label: "Ready to verify",
                  value: v.readyForVerification,
                  tone: "blocked"
                },
                { label: "Fixed", value: v.fixedRemediations, tone: "fixed" },
                {
                  label: "Reopened",
                  value: v.reopenedRemediations,
                  tone: "missed"
                },
                {
                  label: "Closed w/o evidence",
                  value: v.closedWithoutEvidence,
                  tone: "inconclusive"
                }
              ]}
            />
          ) : (
            <p className="text-sm text-subtle">No remediation activity yet.</p>
          )}
        </div>
      </Panel>

      {/* Recommendations */}
      {exec && exec.recommendations.length ? (
        <Panel>
          <PanelHeader title="Recommendations" />
          <ul className="flex flex-col gap-1.5 p-4 text-[13px] text-muted">
            {exec.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-brand">
                  ›
                </span>
                {r}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function SlaStat({
  label,
  value,
  href,
  tone
}: {
  label: string;
  value: number;
  href: string;
  tone: "missed" | "approval" | "fixed";
}) {
  const toneClass =
    tone === "missed"
      ? "text-missed"
      : tone === "approval"
        ? "text-approval"
        : "text-fixed";
  return (
    <Link
      href={href}
      className="rounded-control border border-line bg-surface px-3 py-2 transition-colors hover:border-line-strong"
    >
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
      <p className={`mt-1 font-mono text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </Link>
  );
}

function DeltaMetric({
  label,
  value,
  unit,
  delta,
  direction,
  comparisonCapturedAt
}: {
  label: string;
  value: number;
  unit: string;
  delta: number;
  direction: string;
  comparisonCapturedAt: string | null;
}) {
  const tone = DIRECTION_TONE[direction] ?? "neutral";
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const formattedValue =
    unit === "USD"
      ? new Intl.NumberFormat("en-US", {
          currency: "USD",
          maximumFractionDigits: 0,
          notation: value >= 1_000_000 ? "compact" : "standard",
          style: "currency"
        }).format(value)
      : String(value);
  return (
    <div>
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-ink">
        {formattedValue}
        {unit === "USD" ? null : (
          <span className="ml-1 text-[11px] font-normal text-subtle">
            {unit}
          </span>
        )}
      </p>
      {direction !== "NotAvailable" ? (
        <>
          <p
            className="mt-0.5 flex items-center gap-1 font-mono text-[11px]"
            style={{ color: `var(--color-${tone})` }}
          >
            <span aria-hidden>{arrow}</span>
            {unit === "USD"
              ? new Intl.NumberFormat("en-US", {
                  currency: "USD",
                  maximumFractionDigits: 0,
                  style: "currency"
                }).format(Math.abs(delta))
              : Math.abs(delta)}{" "}
            {direction.toLowerCase()}
          </p>
          {comparisonCapturedAt ? (
            <p className="mt-0.5 font-mono text-[9.5px] text-subtle">
              vs {new Date(comparisonCapturedAt).toLocaleDateString()}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-0.5 font-mono text-[11px] text-subtle">
          baseline not captured
        </p>
      )}
    </div>
  );
}

function ThreatsTab({
  advisories,
  loading,
  error,
  onRetry
}: {
  advisories: {
    threatAdvisoryId: string;
    title: string;
    sourceName: string;
    status: string;
    cveIds: string[];
    techniqueIds: string[];
  }[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Tracked threat exposure"
        link={{ href: "/threat-center", label: "Threat Center" }}
      />
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : advisories.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-subtle">
          No advisories tracked yet.
        </p>
      ) : (
        <ul>
          {advisories.map((a) => (
            <li
              key={a.threatAdvisoryId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0"
            >
              <Link
                href="/threat-center"
                className="min-w-0 flex-1 truncate text-[13px] text-ink hover:text-brand"
              >
                {a.title}
              </Link>
              <span className="font-mono text-[11px] text-subtle">
                {a.sourceName}
              </span>
              <span className="font-mono text-[11px] text-subtle">
                {a.cveIds.length} CVE · {a.techniqueIds.length} TTP
              </span>
              <StateBadge
                tone={a.status === "Closed" ? "neutral" : "approval"}
                dot={false}
              >
                {a.status}
              </StateBadge>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
