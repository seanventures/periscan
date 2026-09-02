"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  deriveAttackPathClaim,
  formatRiskBandDisplayLabel,
  projectPathValidationState,
  type AttackPath,
  type AttackPathAssessment,
  type AttackPathChokePointAnalysis,
  type RiskScore
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  MULTI_HOP_OPERATOR_JOURNEY,
  resolveMultiHopMeasureCta
} from "../lib/multi-hop-journey";
import { type ApiResource, useApiResource } from "../hooks/use-api-resource";
import { BusinessImpactWorkbench } from "./business-impact-workbench";
import {
  AttackPathClaimBadge,
  EmptyState,
  ErrorState,
  EvidenceBasisBadge,
  FilterEmpty,
  LoadingSkeleton,
  NotConfigured,
  PageHeader,
  PageShell,
  Panel,
  RiskBandBadge,
  buttonClassName
} from "../ui";

const RISK_ORDER = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational",
  "Fixed"
];

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    notation: value >= 1_000_000 ? "compact" : "standard",
    style: "currency"
  }).format(value);
}

function proofFusionLabel(methodology: string | null | undefined) {
  if (methodology?.includes("public-exposure-and-kubernetes-cis-failure")) {
    return "Public exposure × live CIS";
  }
  if (methodology?.includes("reachability-then-exploit")) {
    return "Reachability × exploit";
  }
  if (methodology?.includes("measured-config-analysis")) {
    return "Authoritative config";
  }
  return null;
}

export function AttackPathsWorkbench() {
  const paths = useApiResource(() => api.listAttackPaths(), []);
  const activation = useApiResource(() => api.getProductActivationState(), []);
  const optimizer = useApiResource(
    () => api.getAttackPathChokePointAnalysis(),
    []
  );
  const [state, setState] = useState("all");
  const [basis, setBasis] = useState("all");
  const [query, setQuery] = useState("");

  const all = paths.data ?? [];
  const valuedPaths = all.filter((path) => path.financialExposure);
  const annualizedExposure = valuedPaths.reduce(
    (total, path) =>
      total + (path.financialExposure?.annualizedLossExposureUsd ?? 0),
    0
  );
  const scopeVerified =
    activation.data?.milestones.some(
      (milestone) =>
        milestone.key === "ScopeVerified" && milestone.state === "Completed"
    ) ?? false;
  const measureCta = useMemo(
    () =>
      resolveMultiHopMeasureCta({
        paths: all,
        scopeVerified
      }),
    [all, scopeVerified]
  );

  const stateOptions = useMemo(
    () =>
      Array.from(new Set(all.map((a) => a.attackPath.validationState))).sort(),
    [all]
  );

  const bandCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of all) {
      counts.set(a.risk.band, (counts.get(a.risk.band) ?? 0) + 1);
    }
    return counts;
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...all]
      .filter((a) => state === "all" || a.attackPath.validationState === state)
      .filter((a) => basis === "all" || a.attackPath.evidenceBasis === basis)
      .filter((a) => !q || a.attackPath.name.toLowerCase().includes(q))
      .sort((a, b) => b.risk.score - a.risk.score);
  }, [all, state, basis, query]);

  // Flagship multi-hop measurement progress — derived from real edges only.
  // Never invent Measured; fullyMeasured requires every hop Measured.
  const hopProgress = useMemo(() => {
    let fullyMeasured = 0;
    let partial = 0;
    let unmeasured = 0;
    let hopsMeasured = 0;
    let hopsTotal = 0;
    for (const { attackPath } of all) {
      const claim = deriveAttackPathClaim(attackPath);
      hopsMeasured += claim.measuredEdgeCount;
      hopsTotal += claim.totalEdgeCount;
      if (claim.totalEdgeCount === 0) {
        unmeasured += 1;
      } else if (claim.fullyMeasured) {
        fullyMeasured += 1;
      } else if (claim.measuredEdgeCount > 0) {
        partial += 1;
      } else {
        unmeasured += 1;
      }
    }
    return { fullyMeasured, partial, unmeasured, hopsMeasured, hopsTotal };
  }, [all]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Investigate · measured multi-hop"
        title="Attack paths"
        description="Flagship journey: measure each hop with safe probes, confirm edge receipts with evidence IDs, then act on path breakers. A path is Measured only when every hop is independently measured — launch alone never upgrades certainty."
        actions={
          <Link
            href={measureCta.href}
            data-testid="paths-header-primary-cta"
            className={buttonClassName({ size: "md", variant: "primary" })}
          >
            {measureCta.label}
          </Link>
        }
      />

      {/* Multi-hop measurement progress (honest empty when none measured) */}
      {all.length > 0 ? (
        <Panel data-testid="multi-hop-measurement-strip">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
                Multi-hop measurement
              </p>
              <p className="mt-1 text-sm text-ink">
                {hopProgress.hopsTotal === 0
                  ? "Paths are recorded but have no hop edges yet — nothing to measure."
                  : hopProgress.hopsMeasured === 0
                    ? `No hops measured yet across ${hopProgress.hopsTotal} recorded hop${hopProgress.hopsTotal === 1 ? "" : "s"}. Open a path and use Measure hop (safe) — progress appears only as edge receipts with evidence.`
                    : `${hopProgress.hopsMeasured} of ${hopProgress.hopsTotal} hops measured · ${hopProgress.fullyMeasured} fully measured path${hopProgress.fullyMeasured === 1 ? "" : "s"} · ${hopProgress.partial} partial · ${hopProgress.unmeasured} still hypothesis`}
              </p>
              {hopProgress.hopsMeasured === 0 && hopProgress.hopsTotal > 0 ? (
                <p className="mt-1 text-[12px] text-muted">
                  Declared path basis badges stay Heuristic until receipts exist.
                  We never label a path Measured without hop evidence.
                </p>
              ) : null}
              {!scopeVerified && hopProgress.hopsTotal > 0 ? (
                <p className="mt-1 text-[12px] text-muted">
                  Hop probes need verified authorized scope.{" "}
                  <Link
                    href="/scopes"
                    className="font-semibold text-brand hover:text-brand-2"
                  >
                    Authorize scope →
                  </Link>
                </p>
              ) : null}
              <p className="mt-2 text-[12px] text-subtle">
                <Link
                  href={MULTI_HOP_OPERATOR_JOURNEY.gettingStartedHref}
                  className="font-semibold text-brand hover:text-brand-2"
                >
                  {MULTI_HOP_OPERATOR_JOURNEY.label}
                </Link>
                {" · "}
                {MULTI_HOP_OPERATOR_JOURNEY.summary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="font-mono text-sm text-ink"
                aria-label={`${hopProgress.hopsMeasured} of ${hopProgress.hopsTotal} hops measured across all paths`}
              >
                {hopProgress.hopsMeasured}/{hopProgress.hopsTotal} hops
              </span>
              {measureCta.firstPathId || all.length > 0 ? (
                <Link
                  href={measureCta.href}
                  data-testid="multi-hop-primary-cta"
                  className={buttonClassName({
                    size: "sm",
                    variant: "primary"
                  })}
                >
                  {measureCta.label}
                </Link>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}

      {/* Risk-band summary */}
      {all.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-subtle">
            {all.length} path{all.length === 1 ? "" : "s"}
          </span>
          {RISK_ORDER.filter((band) => bandCounts.has(band)).map((band) => (
            <span key={band} className="inline-flex items-center gap-1.5">
              <RiskBandBadge band={band} dot={false} />
              <span className="font-mono text-xs text-muted">
                {bandCounts.get(band)}
              </span>
            </span>
          ))}
          <span className="ml-auto font-mono text-xs text-muted">
            {valuedPaths.length > 0
              ? `${formatUsd(annualizedExposure)} assumption-based ALE · ${valuedPaths.length}/${all.length} paths valued`
              : "No path has financial assumptions yet"}
          </span>
        </div>
      ) : null}

      <BusinessImpactWorkbench onActivated={paths.refetch} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name…"
          aria-label="Filter attack paths by name"
          className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong md:max-w-xs"
        />
        <FilterSelect
          label="Recorded state"
          value={state}
          onChange={setState}
          options={stateOptions}
        />
        <FilterSelect
          label="Declared basis"
          value={basis}
          onChange={setBasis}
          options={["Measured", "Heuristic"]}
        />
        <p
          className="w-full text-[11px] text-subtle sm:ml-auto sm:w-auto"
          data-testid="paths-list-nav-hint"
        >
          Open a row for hop measure · sticky{" "}
          <span className="text-muted">← All attack paths</span> returns from
          detail ·{" "}
          <kbd className="rounded border border-line px-1 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>{" "}
          jumps anywhere
        </p>
      </div>

      <Panel>
        {paths.loading ? (
          <LoadingSkeleton rows={6} />
        ) : paths.error ? (
          <ErrorState message={paths.error} onRetry={paths.refetch} />
        ) : all.length === 0 ? (
          <div className="p-4" data-testid="attack-paths-empty">
            {/* UX-W7/#43-44: EmptyState with one primary + one secondary CTA only */}
            <EmptyState
              title="No attack paths yet — multi-hop measurement starts here"
              description="Connect a signal source and run a Validation Snapshot to correlate your first path from real evidence. Measured multi-hop proof appears only after you measure hops and edge receipts land with evidence IDs — empty is honest, not a fake Measured path. We never claim FullyMeasured without hop receipts."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link
                    href="/integrations"
                    className={buttonClassName({
                      size: "sm",
                      variant: "primary"
                    })}
                  >
                    Connect a source
                  </Link>
                  <Link
                    href={MULTI_HOP_OPERATOR_JOURNEY.gettingStartedHref}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    {MULTI_HOP_OPERATOR_JOURNEY.label}
                  </Link>
                </div>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <FilterEmpty
            title="No paths match these filters"
            description="Clear risk band or search to see every correlated path."
          />
        ) : (
          <ul>
            {filtered.map(({ attackPath, financialExposure, risk }) => (
              <PathRow
                key={attackPath.pathId}
                attackPath={attackPath}
                financialExposure={financialExposure}
                risk={risk}
              />
            ))}
          </ul>
        )}
      </Panel>

      <PathBreakerOptimizer resource={optimizer} />
    </PageShell>
  );
}

function PathBreakerOptimizer({
  resource
}: {
  resource: ApiResource<AttackPathChokePointAnalysis>;
}) {
  const analysis = resource.data;

  return (
    <Panel aria-labelledby="path-breaker-optimizer-title">
      <div className="border-b border-line bg-[radial-gradient(circle_at_top_right,rgba(57,189,248,0.16),transparent_42%),linear-gradient(135deg,rgba(17,34,84,0.96),rgba(8,17,44,0.98))] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-[#78d7ff]">
              Evidence-backed path breakers
            </p>
            <h2
              id="path-breaker-optimizer-title"
              className="mt-1 font-display text-lg font-semibold text-ink"
            >
              Path breaker optimizer
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Rank evidence-backed path breakers — controllable internal nodes
              that intersect persisted, evidence-linked paths. Methodology is a
              greedy hitting-set approximation with optional measured-hop
              evidence weights for prioritization — not exact global min-cut /
              max-flow science or a Leading choke-point claim. Revalidate
              affected paths after any fix; a recommendation is never proof.
            </p>
          </div>
          {analysis && analysis.totalPaths > 0 ? (
            <div className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line">
              <Metric
                label="Paths modeled"
                value={String(analysis.totalPaths)}
              />
              <Metric
                label="Recommended fixes"
                value={String(analysis.recommendedCutSet.length)}
              />
              <Metric
                label="Paths / fix"
                value={analysis.collapseRatio.toFixed(1)}
              />
              <Metric label="Method" value="Greedy approx" />
            </div>
          ) : null}
        </div>
      </div>

      {resource.loading ? (
        <LoadingSkeleton rows={3} />
      ) : resource.error ? (
        <div className="p-4">
          <ErrorState message={resource.error} onRetry={resource.refetch} />
        </div>
      ) : !analysis || analysis.totalPaths === 0 ? (
        <div className="p-4">
          <NotConfigured
            title="No path set to optimize"
            message="The optimizer uses persisted, evidence-linked attack paths. Connect a source and run a Validation Snapshot first."
            action={{ href: "/integrations", label: "Connect a source" }}
          />
        </div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="divide-y divide-line">
            {analysis.recommendedCutSet.map((point, index) => (
              <div
                key={point.nodeId}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-center sm:px-5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-brand/50 bg-brand/10 font-mono text-xs font-semibold text-[#8cddff]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">
                      {point.label}
                    </p>
                    <EvidenceBasisBadge
                      basis={point.evidenceBasis}
                      dot={false}
                    />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Intersects {point.pathCount} of {analysis.totalPaths} paths
                    {point.pathNames.length > 0
                      ? ` · ${point.pathNames.slice(0, 2).join(" · ")}${point.pathNames.length > 2 ? ` +${point.pathNames.length - 2}` : ""}`
                      : ""}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-subtle">
                    node·{shortId(point.nodeId)} · {point.evidenceIds.length}{" "}
                    evidence
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-mono text-lg font-semibold text-ink">
                    {Math.round(point.betweenness * 100)}%
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.08em] text-subtle">
                    path coverage
                  </p>
                </div>
              </div>
            ))}
          </div>
          <aside className="border-t border-line bg-canvas/50 px-4 py-4 lg:border-l lg:border-t-0">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              How to use this
            </p>
            <ol className="mt-3 space-y-3 text-xs leading-5 text-muted">
              <li>
                <span className="text-ink">1.</span> Measure multi-hop paths
                first so breaker priority rests on hop certainty, not hypothesis
                alone.
              </li>
              <li>
                <span className="text-ink">2.</span> Open the affected paths and
                confirm the underlying evidence before treating a node as a
                path breaker.
              </li>
              <li>
                <span className="text-ink">3.</span> Remediate the real control
                or relationship, then run policy-gated verification — never
                mark Fixed from this ranking alone.
              </li>
            </ol>
            <details className="mt-4 border-t border-line pt-3">
              <summary className="cursor-pointer text-xs font-medium text-[#8cddff]">
                Assumptions and limits
              </summary>
              <ul className="mt-2 space-y-2 text-[11px] leading-4 text-subtle">
                {analysis.assumptions.map((assumption) => (
                  <li key={assumption}>• {assumption}</li>
                ))}
              </ul>
            </details>
          </aside>
        </div>
      )}
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 bg-canvas/80 px-3 py-2.5">
      <p className="font-mono text-sm font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
    </div>
  );
}

function PathRow({
  attackPath,
  financialExposure,
  risk
}: {
  attackPath: AttackPath;
  financialExposure: AttackPathAssessment["financialExposure"];
  risk: RiskScore;
}) {
  const nodeById = new Map(
    attackPath.pathNodes.map((n) => [n.pathNodeId, n.label])
  );
  const entry = nodeById.get(attackPath.entryNodeId);
  const objective = nodeById.get(attackPath.impactNodeId);
  const fusionLabel = proofFusionLabel(attackPath.methodology);
  // UX-W1 claim-safe hero: always project through claim language — never show
  // raw Validated / Exploitable as the operator-facing certainty label.
  const pathProjection = projectPathValidationState(attackPath);
  const claim = pathProjection.claim;
  const riskBandLabel = formatRiskBandDisplayLabel(risk.band);
  const hopLabel =
    claim.totalEdgeCount === 0
      ? "no hops recorded"
      : claim.fullyMeasured
        ? `${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops measured`
        : claim.measuredEdgeCount > 0
          ? `${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops measured · partial`
          : `0/${claim.totalEdgeCount} hops measured`;
  // Measure CTA on cards: claim-safe — never implies Validated from launch alone.
  const measureChipLabel =
    claim.totalEdgeCount > 0 && !claim.fullyMeasured
      ? "Measure path hops"
      : null;

  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/attack-paths/${attackPath.pathId}#hop-measurement`}
        data-testid="path-row"
        data-claim-kind={claim.kind}
        data-claim-safe-state={pathProjection.claimSafeValidationState}
        data-risk-band-display={riskBandLabel}
        className="flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-surface md:flex-row md:items-center md:gap-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* Fixed wire band → "Closed (risk)" via RiskBandBadge / formatRiskBandDisplayLabel */}
            <RiskBandBadge band={risk.band} dot={false} />
            <span className="font-mono text-[11px] text-subtle">
              score {risk.score}
            </span>
            <span
              className="font-mono text-[11px] text-muted"
              aria-label={hopLabel}
            >
              {hopLabel}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-sm font-medium text-ink">
              {attackPath.name}
            </p>
            {fusionLabel ? (
              <span className="shrink-0 rounded-control border border-success/40 bg-success/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-success">
                {fusionLabel}
              </span>
            ) : null}
          </div>
          {entry && objective ? (
            <p className="mt-0.5 truncate text-[12px] text-muted">
              <span className="text-subtle">entry</span> {entry}{" "}
              <span className="text-subtle">→ objective</span> {objective}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-[11px] text-subtle">
            {attackPath.pathBreakers.length} breaker
            {attackPath.pathBreakers.length === 1 ? "" : "s"} ·{" "}
            {attackPath.evidenceIds.length} evidence
            {attackPath.evidenceIds[0]
              ? ` · ev·${shortId(attackPath.evidenceIds[0])}`
              : ""}
            {measureChipLabel ? " · open to Measure hop" : ""}
            {pathProjection.remapped
              ? ` · recorded ${pathProjection.recordedValidationState} → claim-safe ${pathProjection.claimSafeValidationState}`
              : ""}
          </p>
          {financialExposure ? (
            <p className="mt-1 text-[12px] text-brand">
              {formatUsd(financialExposure.annualizedLossExposureUsd)}{" "}
              annualized exposure · {financialExposure.businessServiceName} ·
              assumption-based
            </p>
          ) : null}
        </div>
        <div
          className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2"
          data-testid="path-claim-hero"
        >
          <span className="font-mono text-[11px] text-muted">
            conf {attackPath.confidence.toFixed(2)}
          </span>
          {/* First-class evidence basis (Heuristic | Measured | Imported) via kit badge */}
          <EvidenceBasisBadge
            basis={attackPath.evidenceBasis}
            dot={false}
            data-testid={`path-basis-${attackPath.pathId}`}
          />
          <AttackPathClaimBadge attackPath={attackPath} />
          {measureChipLabel ? (
            <span className="rounded-control border border-brand/40 bg-brand/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-2">
              {measureChipLabel}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-control border border-line bg-surface pl-3 pr-1.5 text-sm">
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Filter by ${label}`}
        className="bg-transparent py-1.5 text-sm text-ink outline-none"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
