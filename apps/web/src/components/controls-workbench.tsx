"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  ControlRuleCoverageSnapshotPoint,
  ControlSource,
  DetectionMarkerProofResult,
  DetectionRuleCoverageItem,
  DnsExfilCanaryProofResult,
  Integration,
  Scope,
  ValidationStimulus,
  ValidationRun
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ControlStateBadge,
  DistributionChart,
  EmptyState,
  ErrorState,
  FilterEmpty,
  LoadingSkeleton,
  NotConfigured,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  ReadinessRing,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import {
  ControlCoverageBadge,
  ControlCoverageTrendBadge
} from "./control-coverage-badges";

const CONTROL_TYPES = [
  "EDR",
  "XDR",
  "SIEM",
  "SOAR",
  "MDR",
  "WAF",
  "Firewall",
  "MFA",
  "EmailSecurity",
  "CloudGuardrail",
  "AIGuardrail"
] as const;
const EXPECTED_BEHAVIORS = [
  "Detected",
  "Blocked",
  "Logged",
  "Alerted",
  "Routed"
] as const;

function healthTone(status: string): StateTone {
  if (status === "Healthy") return "fixed";
  if (status === "Degraded") return "approval";
  if (status === "Unhealthy" || status === "Error") return "missed";
  return "inconclusive";
}

function relTime(iso?: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function ControlsWorkbench() {
  const sources = useApiResource(() => api.listControlSources(), []);
  const coverage = useApiResource(() => api.getControlRuleCoverage(), []);
  const integrations = useApiResource(() => api.listIntegrations(), []);
  const scopes = useApiResource(() => api.listScopes(), []);
  const runners = useApiResource(() => api.listRunners(), []);
  const stimuli = useApiResource(() => api.listValidationStimuli(), []);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [registerOpen, setRegisterOpen] = useState(false);

  const cov = coverage.data;
  const items = cov?.items ?? [];
  const hasEligibleScope = (scopes.data ?? []).some(
    (scope) =>
      scope.verificationStatus === "Verified" &&
      ["BASLite", "AdvancedAdversarial"].includes(scope.effectiveMaxSafetyLevel)
  );
  const activeRunnerCount = (runners.data ?? []).filter(
    (runner) => runner.status === "Active" && !runner.killSwitchActive
  ).length;

  const statuses = useMemo(
    () => Array.from(new Set(items.map((i) => i.status))).sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => statusFilter === "all" || i.status === statusFilter)
      .filter(
        (i) =>
          !q ||
          i.techniqueId.toLowerCase().includes(q) ||
          i.techniqueName.toLowerCase().includes(q) ||
          i.tacticName.toLowerCase().includes(q)
      );
  }, [items, statusFilter, query]);

  const coveragePct = cov
    ? cov.totalTechniques > 0
      ? Math.round(
          ((cov.coveredTechniques + cov.blockedTechniques) /
            cov.totalTechniques) *
            100
        )
      : 0
    : 0;

  const distribution = cov
    ? [
        {
          label: "Blocked",
          value: cov.blockedTechniques,
          tone: "blocked" as StateTone
        },
        {
          label: "Covered",
          value: cov.coveredTechniques,
          tone: "validated" as StateTone
        },
        {
          label: "Logged only",
          value: cov.loggedOnlyTechniques,
          tone: "approval" as StateTone
        },
        {
          label: "Needs tuning",
          value: cov.needsTuningTechniques,
          tone: "approval" as StateTone
        },
        {
          label: "Missed",
          value: cov.missedTechniques,
          tone: "missed" as StateTone
        },
        {
          label: "No evidence",
          value: cov.noEvidenceTechniques,
          tone: "inconclusive" as StateTone
        }
      ].filter((d) => d.value > 0)
    : [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Validate"
        title="Controls"
        description="Compare expected control behaviors to SIEM/EDR telemetry observations per MITRE technique, then tune gaps. Dry-run validates are telemetry-only — they do not claim a closed inject→measure loop."
      />

      <div
        role="status"
        aria-label="Control inject loop availability"
        data-tone="info"
        data-testid="control-inject-disabled-banner"
        className="rounded-control border border-brand/35 bg-brand/8 px-4 py-3 text-sm text-ink"
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
          Inject loop not available · DRV Partial overall
        </p>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">
          Closed inject→measure is disabled on the control-plane API (
          <span className="font-mono text-[11px]">
            control_live_execution_disabled
          </span>
          ). Scenario validates are{" "}
          <strong className="font-medium text-ink">
            telemetry-only observations
          </strong>{" "}
          against connected SIEM/EDR. Atomic content is dry-run scenario import
          only — not live inject BAS. The{" "}
          <strong className="font-medium text-ink">
            benign detection-marker proof
          </strong>{" "}
          below closes one allowlisted <span className="font-mono text-[11px]">periscan-*</span>{" "}
          emit→observe chain only — not a full ATT&amp;CK BAS library. The
          governed exact-marker URL canary is a separate limited stimulus. Next
          step: connect a SIEM/EDR source, verify scope, then run marker proof or
          Observe telemetry; do not treat dry-run outcomes as library-wide
          control efficacy.
        </p>
      </div>

      <DetectionMarkerProofPanel
        coverageItems={items}
        scopes={scopes.data ?? []}
        sources={sources.data ?? []}
        onCompleted={() => {
          void Promise.all([sources.refetch(), coverage.refetch()]);
        }}
      />

      <DnsExfilCanaryProofPanel
        scopes={scopes.data ?? []}
        sources={sources.data ?? []}
        onCompleted={() => {
          void Promise.all([sources.refetch(), coverage.refetch()]);
        }}
      />

      {/* Coverage summary — SCV pull observe feeds this; inject loop stays off */}
      <Panel data-testid="scv-coverage-report-panel">
        <PanelHeader
          title="Detection coverage"
          link={{ href: "/attack-techniques", label: "ATT&CK catalog" }}
        />
        <p className="border-b border-line px-4 py-2 text-[12px] leading-5 text-muted">
          Coverage is built from telemetry observations and safe markers only.
          Closed inject→measure remains disabled — this report cannot become a
          Strong SCV claim while the inject loop is off.
        </p>
        {coverage.loading ? (
          <LoadingSkeleton rows={4} />
        ) : coverage.error ? (
          <ErrorState message={coverage.error} onRetry={coverage.refetch} />
        ) : !cov ? (
          <div className="p-4">
            <NotConfigured
              title="No coverage computed yet"
              message="Connect a detection source (SIEM/EDR/XDR) and run a control validation to map coverage."
              action={{ href: "/integrations", label: "Connect a source" }}
            />
          </div>
        ) : (
          <div
            className="flex flex-col gap-4 p-4"
            data-testid="scv-coverage-report-body"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ReadinessRing
                value={coveragePct}
                label="coverage"
                tone="brand"
              />
              <div className="flex flex-1 flex-wrap gap-2">
                <span className="font-mono text-xs text-subtle">
                  {cov.totalTechniques} techniques
                </span>
                {distribution.map((d) => (
                  <span
                    key={d.label}
                    className="inline-flex items-center gap-1.5"
                  >
                    <StateBadge tone={d.tone} dot={false}>
                      {d.label}
                    </StateBadge>
                    <span className="font-mono text-xs text-muted">
                      {d.value}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <DistributionChart
              title="Technique coverage breakdown"
              ariaLabel="Detection coverage by status"
              data={distribution.map((d) => ({
                id: d.label,
                value: d.value,
                color: `var(--color-${d.tone})`
              }))}
              variant="bar"
              height={180}
              emptyLabel="No coverage to chart yet."
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[11.5px] text-subtle">
              <span>
                {cov.snapshotId
                  ? `Snapshot captured ${relTime(cov.generatedAt)}`
                  : "Live preview — run a validation to establish the first baseline"}
              </span>
              {cov.improvedTechniques > 0 ? (
                <StateBadge tone="fixed" dot={false}>
                  {cov.improvedTechniques} improved
                </StateBadge>
              ) : null}
              {cov.regressedTechniques > 0 ? (
                <StateBadge tone="missed" dot={false}>
                  {cov.regressedTechniques} regressed
                </StateBadge>
              ) : null}
            </div>
            {cov.history.length > 0 ? (
              <CoverageHistory coverage={cov.history} />
            ) : null}
          </div>
        )}
        {cov && cov.recommendations.length ? (
          <div className="border-t border-line bg-approval/5 px-4 py-3">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-approval">
              Tuning recommendations
            </p>
            <ul className="mt-1.5 flex flex-col gap-1 text-[12.5px] text-muted">
              {cov.recommendations.slice(0, 5).map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-approval">
                    ›
                  </span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      <ControlStimulusWorkbench
        coverageItems={items}
        onChanged={() => {
          void Promise.all([
            stimuli.refetch(),
            sources.refetch(),
            coverage.refetch()
          ]);
        }}
        resource={stimuli}
        scopes={scopes.data ?? []}
        sources={sources.data ?? []}
      />

      {/* Control source registry */}
      <Panel>
        <PanelHeader
          title="Control sources"
          actions={
            <button
              type="button"
              onClick={() => setRegisterOpen((v) => !v)}
              className="text-xs text-brand hover:text-brand-2"
            >
              {registerOpen ? "Close" : "Register source"}
            </button>
          }
        />
        {registerOpen ? (
          <RegisterControlSourceForm
            integrations={integrations.data ?? []}
            onCreated={() => {
              setRegisterOpen(false);
              void sources.refetch();
            }}
          />
        ) : null}
        {sources.loading ? (
          <LoadingSkeleton rows={4} />
        ) : sources.error ? (
          <ErrorState message={sources.error} onRetry={sources.refetch} />
        ) : (sources.data ?? []).length === 0 ? (
          <div className="p-4">
            <NotConfigured
              title="No control sources registered"
              message="Control sources come from your connected security integrations."
              action={{ href: "/integrations", label: "Connect a control" }}
            />
          </div>
        ) : (
          <ul>
            {(sources.data ?? []).map((source) => (
              <ControlSourceRow
                key={source.controlSourceId}
                source={source}
                activeRunnerCount={activeRunnerCount}
                coverageItems={items.filter(
                  (item) => item.controlSourceId === source.controlSourceId
                )}
                hasEligibleScope={hasEligibleScope}
                onChanged={() => {
                  void Promise.all([sources.refetch(), coverage.refetch()]);
                }}
              />
            ))}
          </ul>
        )}
      </Panel>

      {/* Per-technique coverage */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by technique or tactic…"
          aria-label="Filter coverage"
          className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong md:max-w-xs"
        />
        <label className="flex items-center gap-1.5 rounded-control border border-line bg-surface pl-3 pr-1.5 text-sm">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by coverage status"
            className="bg-transparent py-1.5 text-sm text-ink outline-none"
          >
            <option value="all">All</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Panel>
        <PanelHeader title="Validation scenarios" />
        {coverage.loading ? (
          <LoadingSkeleton rows={6} />
        ) : coverage.error ? (
          <ErrorState message={coverage.error} onRetry={coverage.refetch} />
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No validation scenarios yet"
              description="Run a control validation after connecting a detection source to populate MITRE technique coverage."
              action={
                <Link
                  href="/integrations"
                  className="text-xs font-semibold text-brand hover:text-brand-2"
                >
                  Connect a source →
                </Link>
              }
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <FilterEmpty
            title="No scenarios match these filters"
            description="Widen technique or coverage filters to see more rows."
          />
        ) : (
          <ul>
            {filteredItems.map((item) => (
              <CoverageRow
                key={`${item.scenarioId}-${item.techniqueId}`}
                item={item}
              />
            ))}
          </ul>
        )}
      </Panel>
    </PageShell>
  );
}

function stimulusTone(stimulus: ValidationStimulus): StateTone {
  if (stimulus.status === "Completed") {
    if (["Prevented", "Detected"].includes(stimulus.verdict?.verdict ?? "")) {
      return "fixed";
    }
    if (stimulus.verdict?.verdict === "TelemetryOnly") return "approval";
    if (
      ["Missed", "NotObservedBeforeTimeout"].includes(
        stimulus.verdict?.verdict ?? ""
      )
    ) {
      return "missed";
    }
    return "inconclusive";
  }
  if (stimulus.status === "RequiresApproval") return "approval";
  if (stimulus.status === "Observing") return "brand";
  if (["Failed", "DeniedByPolicy"].includes(stimulus.status)) return "missed";
  return "neutral";
}

/**
 * Wave B DRV CTA: signed benign-marker emit→observe (not full ATT&CK BAS).
 * Calls POST /api/v1/control-sources/:id/detection-marker-proof.
 */
function DetectionMarkerProofPanel({
  coverageItems,
  onCompleted,
  scopes,
  sources
}: {
  coverageItems: DetectionRuleCoverageItem[];
  onCompleted: () => void;
  scopes: Scope[];
  sources: ControlSource[];
}) {
  const eligibleScopes = scopes.filter(
    (scope) =>
      scope.verificationStatus === "Verified" &&
      ["InternalNetwork", "ControlSource", "Domain", "Subdomain"].includes(
        scope.scopeType
      )
  );
  const [sourceId, setSourceId] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [techniqueId, setTechniqueId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionMarkerProofResult | null>(null);

  const selectedSourceId = sourceId || sources[0]?.controlSourceId || "";
  const selectedScopeId = scopeId || eligibleScopes[0]?.scopeId || "";
  const selectedTechniqueId =
    techniqueId || coverageItems[0]?.techniqueId || "T1059";

  async function runProof() {
    if (!selectedSourceId) {
      setError("Register a control source first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const proof = await api.runDetectionMarkerProof(selectedSourceId, {
        // Lab/demo path may inject mock SIEM events when no live telemetry yet.
        // Live tenants with connector observe leave this unset (API defaults).
        performEmit: true,
        scopeId: selectedScopeId || undefined,
        techniqueId: selectedTechniqueId
      });
      setResult(proof);
      onCompleted();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't run detection marker proof."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel aria-labelledby="detection-marker-proof-title">
      <div className="border-b border-line bg-[radial-gradient(circle_at_top_left,rgba(120,255,180,0.1),transparent_42%),linear-gradient(135deg,rgba(10,28,48,0.98),rgba(8,18,44,0.98))] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7dffb2]">
              DRV · benign marker class
            </p>
            <h2
              id="detection-marker-proof-title"
              className="mt-1 font-display text-lg font-semibold text-ink"
            >
              Detection marker proof
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Run one allowlisted <span className="font-mono text-[12px]">periscan-*</span>{" "}
              process canary emit→SIEM/EDR observe chain with a single evidence
              mission. This is{" "}
              <strong className="font-medium text-ink">
                not a full ATT&amp;CK BAS library
              </strong>
              . Overall DRV remains{" "}
              <strong className="font-medium text-ink">Partial</strong> until
              library-wide inject is productized (refused today).
            </p>
          </div>
          <StateBadge tone="validated" variant="outline" dot={false}>
            benign marker only · no Atomic live
          </StateBadge>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Control observer
              </span>
              <select
                aria-label="Detection marker proof control source"
                value={selectedSourceId}
                onChange={(event) => setSourceId(event.target.value)}
                disabled={sources.length === 0}
                className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-line-strong"
              >
                {sources.length === 0 ? (
                  <option value="">No control sources</option>
                ) : (
                  sources.map((source) => (
                    <option
                      key={source.controlSourceId}
                      value={source.controlSourceId}
                    >
                      {source.provider} · {source.controlType}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Verified scope
              </span>
              <select
                aria-label="Detection marker proof scope"
                value={selectedScopeId}
                onChange={(event) => setScopeId(event.target.value)}
                disabled={eligibleScopes.length === 0}
                className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-line-strong"
              >
                {eligibleScopes.length === 0 ? (
                  <option value="">API may pick verified scope</option>
                ) : (
                  eligibleScopes.map((scope) => (
                    <option key={scope.scopeId} value={scope.scopeId}>
                      {scope.scopeType} · {scope.value}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Technique
              </span>
              <input
                aria-label="Detection marker proof technique"
                value={selectedTechniqueId}
                onChange={(event) =>
                  setTechniqueId(event.target.value.toUpperCase())
                }
                className="w-28 rounded-control border border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-line-strong"
              />
            </label>
            <button
              type="button"
              onClick={() => void runProof()}
              disabled={busy || !selectedSourceId}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy ? "Running marker proof…" : "Run detection marker proof"}
            </button>
          </div>

          {result ? (
            <div
              role="status"
              aria-label="Detection marker proof result"
              data-testid="detection-marker-proof-receipt"
              className="rounded-control border border-line bg-elevated p-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
                  Result receipt · DRV marker class only
                </p>
                <StateBadge
                  tone={
                    result.validationState === "Detected"
                      ? "validated"
                      : result.validationState === "Missed"
                        ? "missed"
                        : "inconclusive"
                  }
                  dot={false}
                >
                  {result.validationState ?? result.outcome}
                </StateBadge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-ink">
                  marker·{result.markerId}
                </span>
                {result.closedLoop ? (
                  <StateBadge tone="validated" variant="outline" dot={false}>
                    closed loop
                  </StateBadge>
                ) : (
                  <StateBadge tone="approval" variant="outline" dot={false}>
                    not closed loop
                  </StateBadge>
                )}
                <StateBadge tone="neutral" variant="outline" dot={false}>
                  {result.drvClaimClass}
                </StateBadge>
                {!result.fullAttackLibrary ? (
                  <StateBadge tone="approval" variant="outline" dot={false}>
                    full ATT&amp;CK library: false
                  </StateBadge>
                ) : null}
              </div>
              <p className="mt-2 text-[13px] leading-5 text-muted">
                {result.summary}
              </p>
              <dl className="mt-3 grid gap-x-4 gap-y-1.5 font-mono text-[10px] text-subtle sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-[9px] uppercase tracking-[0.1em]">
                    Mission
                  </dt>
                  <dd className="mt-0.5 truncate">
                    <Link
                      href={`/missions/${result.mission.missionId}`}
                      className="text-brand hover:text-brand-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      mission·{result.mission.missionId.slice(0, 8)}
                    </Link>
                    <span className="text-subtle">
                      {" "}
                      · {result.mission.status}
                    </span>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[9px] uppercase tracking-[0.1em]">
                    Run / module
                  </dt>
                  <dd className="mt-0.5 truncate">
                    {result.runs[0]?.moduleId ?? "—"}
                    {result.runs[0]?.runId
                      ? ` · run·${result.runs[0].runId.slice(0, 8)}`
                      : ""}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[9px] uppercase tracking-[0.1em]">
                    Outcome
                  </dt>
                  <dd className="mt-0.5 truncate">{result.outcome}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[9px] uppercase tracking-[0.1em]">
                    Claim class
                  </dt>
                  <dd className="mt-0.5">
                    {result.drvClaimClass} · limited safe stimulus only — not
                    full BAS
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-[12px] leading-5 text-muted">
              No marker proof run yet. Requires a registered control source and a
              verified InternalNetwork, ControlSource, Domain, or Subdomain
              scope (API auto-selects when omitted).
            </p>
          )}

          {error ? (
            <p role="alert" className="text-[12px] text-missed">
              {error}
            </p>
          ) : null}
        </div>

        <aside className="rounded-control border border-line bg-canvas/45 p-3 text-[11px] leading-5 text-subtle">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Honesty
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>
              Allowlisted canary only (
              <span className="font-mono">periscan-*</span> process marker).
            </li>
            <li>No malware samples, no Atomic live, no full BAS library.</li>
            <li>
              Matrix row DRV stays <strong className="text-ink">Partial</strong>{" "}
              outside this marker class.
            </li>
            <li>
              Product path:{" "}
              <span className="font-mono">detection_marker_proof</span>
            </li>
          </ul>
        </aside>
      </div>
    </Panel>
  );
}

/**
 * Phase C DNS-exfil detection canary CTA.
 * Calls POST /api/v1/control-sources/:id/dns-exfil-canary-proof.
 * Never claims real data exfiltration; measured is false without live telemetry.
 */
function DnsExfilCanaryProofPanel({
  onCompleted,
  scopes,
  sources
}: {
  onCompleted: () => void;
  scopes: Scope[];
  sources: ControlSource[];
}) {
  const eligibleScopes = scopes.filter(
    (scope) =>
      scope.verificationStatus === "Verified" &&
      ["Domain", "Subdomain"].includes(scope.scopeType)
  );
  const [sourceId, setSourceId] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [techniqueId, setTechniqueId] = useState("T1048");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DnsExfilCanaryProofResult | null>(null);

  const selectedSourceId = sourceId || sources[0]?.controlSourceId || "";
  const selectedScopeId = scopeId || eligibleScopes[0]?.scopeId || "";
  const selectedTechniqueId = techniqueId || "T1048";

  async function runProof() {
    if (!selectedSourceId) {
      setError("Register a control source first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const proof = await api.runDnsExfilCanaryProof(selectedSourceId, {
        scopeId: selectedScopeId || undefined,
        techniqueId: selectedTechniqueId
      });
      setResult(proof);
      onCompleted();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't run DNS exfil canary proof."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel aria-labelledby="dns-exfil-canary-proof-title">
      <div className="border-b border-line bg-[radial-gradient(circle_at_top_right,rgba(120,180,255,0.1),transparent_42%),linear-gradient(135deg,rgba(8,18,44,0.98),rgba(10,28,48,0.98))] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7dbbff]">
              EXV / multi-vector · DNS canary class
            </p>
            <h2
              id="dns-exfil-canary-proof-title"
              className="mt-1 font-display text-lg font-semibold text-ink"
            >
              DNS-exfil detection canary
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Emit one allowlisted <span className="font-mono text-[12px]">periscan-*</span>{" "}
              DNS canary label and correlate SIEM/DNS-monitor observation. This is{" "}
              <strong className="font-medium text-ink">
                detection class only — never real data exfiltration
              </strong>
              . Without live emit + live telemetry,{" "}
              <span className="font-mono text-[11px]">measured:false</span>.
            </p>
          </div>
          <StateBadge tone="validated" variant="outline" dot={false}>
            benign marker only · no bulk tunnel
          </StateBadge>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Control observer
              </span>
              <select
                aria-label="DNS exfil canary control source"
                value={selectedSourceId}
                onChange={(event) => setSourceId(event.target.value)}
                disabled={sources.length === 0}
                className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-line-strong"
              >
                {sources.length === 0 ? (
                  <option value="">No control sources</option>
                ) : (
                  sources.map((source) => (
                    <option
                      key={source.controlSourceId}
                      value={source.controlSourceId}
                    >
                      {source.provider} · {source.controlType}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Verified domain scope
              </span>
              <select
                aria-label="DNS exfil canary scope"
                value={selectedScopeId}
                onChange={(event) => setScopeId(event.target.value)}
                disabled={eligibleScopes.length === 0}
                className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-line-strong"
              >
                {eligibleScopes.length === 0 ? (
                  <option value="">Need verified Domain/Subdomain</option>
                ) : (
                  eligibleScopes.map((scope) => (
                    <option key={scope.scopeId} value={scope.scopeId}>
                      {scope.scopeType} · {scope.value}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Technique
              </span>
              <input
                aria-label="DNS exfil canary technique"
                value={selectedTechniqueId}
                onChange={(event) =>
                  setTechniqueId(event.target.value.toUpperCase())
                }
                className="w-28 rounded-control border border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-line-strong"
              />
            </label>
            <button
              type="button"
              onClick={() => void runProof()}
              disabled={busy || !selectedSourceId}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy ? "Running DNS canary…" : "Run DNS-exfil canary"}
            </button>
          </div>

          {result ? (
            <div
              role="status"
              aria-label="DNS exfil canary proof result"
              data-testid="dns-exfil-canary-proof-receipt"
              className="rounded-control border border-line bg-elevated p-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
                  Result receipt · DNS canary class only
                </p>
                <StateBadge
                  tone={
                    result.validationState === "Detected"
                      ? "validated"
                      : result.validationState === "Missed"
                        ? "missed"
                        : "inconclusive"
                  }
                  dot={false}
                >
                  {result.validationState ?? result.outcome}
                </StateBadge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-ink">
                  canary·{result.canaryLabel}
                </span>
                <StateBadge
                  tone={result.measured ? "validated" : "approval"}
                  variant="outline"
                  dot={false}
                >
                  measured:{String(result.measured)}
                </StateBadge>
                <StateBadge tone="neutral" variant="outline" dot={false}>
                  {result.exfilClaimClass}
                </StateBadge>
                <StateBadge tone="validated" variant="outline" dot={false}>
                  realDataExfiltrated:false
                </StateBadge>
                {!result.fullExfilLibrary ? (
                  <StateBadge tone="approval" variant="outline" dot={false}>
                    full exfil library: false
                  </StateBadge>
                ) : null}
              </div>
              <p className="mt-2 text-[13px] leading-5 text-muted">
                {result.summary}
              </p>
              <dl className="mt-3 grid gap-x-4 gap-y-1.5 font-mono text-[10px] text-subtle sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-[9px] uppercase tracking-[0.1em]">
                    Canary FQDN
                  </dt>
                  <dd className="mt-0.5 truncate">{result.canaryFqdn}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[9px] uppercase tracking-[0.1em]">
                    Mission
                  </dt>
                  <dd className="mt-0.5 truncate">
                    <Link
                      href={`/missions/${result.mission.missionId}`}
                      className="text-brand hover:text-brand-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      mission·{result.mission.missionId.slice(0, 8)}
                    </Link>
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[9px] uppercase tracking-[0.1em]">
                    Module
                  </dt>
                  <dd className="mt-0.5 truncate">
                    {result.runs[0]?.moduleId ?? "—"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[9px] uppercase tracking-[0.1em]">
                    Claim class
                  </dt>
                  <dd className="mt-0.5">
                    {result.exfilClaimClass} · detection canary only — not bulk
                    tunnel
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-[12px] leading-5 text-muted">
              No DNS canary run yet. Requires a registered control source and a
              verified Domain or Subdomain scope for the canary hostname.
            </p>
          )}

          {error ? (
            <p role="alert" className="text-[12px] text-missed">
              {error}
            </p>
          ) : null}
        </div>

        <aside className="rounded-control border border-line bg-canvas/45 p-3 text-[11px] leading-5 text-subtle">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Honesty
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>
              Allowlisted canary label only (
              <span className="font-mono">periscan-*</span>).
            </li>
            <li>
              <span className="font-mono">realDataExfiltrated</span> always
              false — no bulk customer data tunnel.
            </li>
            <li>
              <span className="font-mono">measured:true</span> only with real
              emit + live telemetry correlation.
            </li>
            <li>
              Product path:{" "}
              <span className="font-mono">dns_exfil_canary_proof</span>
            </li>
          </ul>
        </aside>
      </div>
    </Panel>
  );
}

function ControlStimulusWorkbench({
  coverageItems,
  onChanged,
  resource,
  scopes,
  sources
}: {
  coverageItems: DetectionRuleCoverageItem[];
  onChanged: () => void;
  resource: ReturnType<typeof useApiResource<ValidationStimulus[]>>;
  scopes: Scope[];
  sources: ControlSource[];
}) {
  const eligibleScopes = scopes.filter(
    (scope) =>
      scope.verificationStatus === "Verified" &&
      ["Domain", "Subdomain"].includes(scope.scopeType)
  );
  const [sourceId, setSourceId] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [techniqueId, setTechniqueId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedSourceId = sourceId || sources[0]?.controlSourceId || "";
  const selectedScopeId = scopeId || eligibleScopes[0]?.scopeId || "";
  const selectedTechniqueId =
    techniqueId || coverageItems[0]?.techniqueId || "T1059";

  async function createStimulus() {
    setBusyId("create");
    setError(null);
    try {
      await api.createValidationStimulus({
        controlSourceId: selectedSourceId,
        scopeId: selectedScopeId,
        stimulusType: "OwnedDomainUrlCanary",
        techniqueId: selectedTechniqueId,
        ttlSeconds: 600
      });
      await resource.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't create the canary."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function act(
    stimulus: ValidationStimulus,
    action: "approve-dispatch" | "dispatch" | "observe" | "cancel"
  ) {
    setBusyId(stimulus.stimulusId);
    setError(null);
    try {
      if (action === "approve-dispatch") {
        await api.approvePolicyDecision(stimulus.policyDecisionId);
        await api.dispatchValidationStimulus(stimulus.stimulusId);
      } else if (action === "dispatch") {
        await api.dispatchValidationStimulus(stimulus.stimulusId);
      } else if (action === "observe") {
        await api.observeValidationStimulus(stimulus.stimulusId);
      } else {
        await api.cancelValidationStimulus(stimulus.stimulusId);
      }
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't update the canary."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel aria-labelledby="safe-stimulus-title">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="border-b border-line bg-[radial-gradient(circle_at_top_left,rgba(0,202,255,0.14),transparent_40%),linear-gradient(135deg,rgba(14,31,77,0.98),rgba(8,18,44,0.98))] px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-[#79dcff]">
                  Safe control validation
                </p>
                <h2
                  id="safe-stimulus-title"
                  className="mt-1 font-display text-lg font-semibold text-ink"
                >
                  Exact-marker canary
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                  Send one benign request to a verified owned domain, then ask
                  the configured control source for that exact marker. A nearby
                  event, technique match, or HTTP response alone never earns a
                  detection verdict.
                </p>
              </div>
              <StateBadge tone="validated" variant="outline" dot={false}>
                one request · 1 KB cap · 10 min TTL
              </StateBadge>
            </div>

            <ol
              aria-label="Safe stimulus lifecycle"
              className="mt-4 grid gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-4"
            >
              {[
                ["1", "Authorize", "Bound policy"],
                ["2", "Dispatch", "Owned domain"],
                ["3", "Correlate", "Exact marker"],
                ["4", "Decide", "Evidence verdict"]
              ].map(([step, title, detail]) => (
                <li key={step} className="bg-canvas/80 px-3 py-2.5">
                  <p className="font-mono text-[10px] text-[#79dcff]">{step}</p>
                  <p className="mt-0.5 text-xs font-semibold text-ink">
                    {title}
                  </p>
                  <p className="text-[10px] text-muted">{detail}</p>
                </li>
              ))}
            </ol>
          </div>

          {resource.loading ? (
            <LoadingSkeleton rows={3} />
          ) : resource.error ? (
            <ErrorState message={resource.error} onRetry={resource.refetch} />
          ) : (resource.data ?? []).length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted sm:px-5">
              No canary attempts yet. Create one to establish a policy-bound,
              evidence-linked control verdict.
            </div>
          ) : (
            <ol
              className="divide-y divide-line"
              aria-label="Control canary attempts"
            >
              {(resource.data ?? []).map((stimulus) => (
                <li key={stimulus.stimulusId} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StateBadge tone={stimulusTone(stimulus)} dot={false}>
                          {stimulus.verdict?.verdict ?? stimulus.status}
                        </StateBadge>
                        <span className="font-mono text-[10px] text-subtle">
                          {stimulus.techniqueId} · marker{" "}
                          {stimulus.markerFingerprint}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-ink">
                        {stimulus.targetHost}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-muted">
                        {stimulus.verdict?.reason ??
                          (stimulus.status === "Observing"
                            ? "Canary dispatched. Check the observer after telemetry ingestion, before the TTL expires."
                            : "Approval creates authority to dispatch; it does not assert that the control works.")}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-subtle">
                        <Link
                          href={`/missions/${stimulus.missionId}`}
                          className="text-brand hover:text-brand-2"
                        >
                          mission·{stimulus.missionId.slice(0, 8)}
                        </Link>
                        <span>{stimulus.evidenceIds.length} evidence</span>
                        {stimulus.dispatchReceipt ? (
                          <span>
                            HTTP {stimulus.dispatchReceipt.responseStatus} ·{" "}
                            {stimulus.dispatchReceipt.requestBytes} B ·
                            redirects off
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {stimulus.status === "RequiresApproval" ? (
                        <button
                          type="button"
                          disabled={busyId === stimulus.stimulusId}
                          onClick={() => void act(stimulus, "approve-dispatch")}
                          className={buttonClassName({
                            size: "sm",
                            variant: "primary"
                          })}
                        >
                          {busyId === stimulus.stimulusId
                            ? "Authorizing…"
                            : "Approve & dispatch"}
                        </button>
                      ) : stimulus.status === "Ready" ? (
                        <button
                          type="button"
                          disabled={busyId === stimulus.stimulusId}
                          onClick={() => void act(stimulus, "dispatch")}
                          className={buttonClassName({
                            size: "sm",
                            variant: "primary"
                          })}
                        >
                          Dispatch
                        </button>
                      ) : stimulus.status === "Observing" ? (
                        <button
                          type="button"
                          disabled={busyId === stimulus.stimulusId}
                          onClick={() => void act(stimulus, "observe")}
                          className={buttonClassName({
                            size: "sm",
                            variant: "secondary"
                          })}
                        >
                          {busyId === stimulus.stimulusId
                            ? "Checking…"
                            : "Check exact marker"}
                        </button>
                      ) : null}
                      {["RequiresApproval", "Ready", "Observing"].includes(
                        stimulus.status
                      ) ? (
                        <button
                          type="button"
                          disabled={busyId === stimulus.stimulusId}
                          onClick={() => void act(stimulus, "cancel")}
                          className={buttonClassName({
                            size: "sm",
                            variant: "ghost"
                          })}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside className="border-t border-line bg-canvas/45 p-4 lg:border-l lg:border-t-0">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
            New governed canary
          </p>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-muted">
              <span>Control observer</span>
              <select
                aria-label="Canary control observer"
                value={selectedSourceId}
                onChange={(event) => setSourceId(event.target.value)}
                className="mt-1 w-full rounded-control border border-line bg-surface px-2.5 py-2 text-xs text-ink"
              >
                {sources.map((source) => (
                  <option
                    key={source.controlSourceId}
                    value={source.controlSourceId}
                  >
                    {source.provider} · {source.controlType}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              <span>Verified owned domain</span>
              <select
                aria-label="Canary verified scope"
                value={selectedScopeId}
                onChange={(event) => setScopeId(event.target.value)}
                className="mt-1 w-full rounded-control border border-line bg-surface px-2.5 py-2 text-xs text-ink"
              >
                {eligibleScopes.map((scope) => (
                  <option key={scope.scopeId} value={scope.scopeId}>
                    {scope.value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              <span>ATT&amp;CK technique</span>
              <input
                aria-label="Canary ATT&CK technique"
                value={selectedTechniqueId}
                onChange={(event) =>
                  setTechniqueId(event.target.value.toUpperCase())
                }
                className="mt-1 w-full rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-xs text-ink"
              />
            </label>
            <button
              type="button"
              disabled={
                busyId === "create" ||
                !selectedSourceId ||
                !selectedScopeId ||
                !/^T\d{4}(?:\.\d{3})?$/.test(selectedTechniqueId)
              }
              onClick={() => void createStimulus()}
              className={cn(
                buttonClassName({ size: "sm", variant: "primary" }),
                "w-full justify-center"
              )}
            >
              {busyId === "create"
                ? "Binding policy…"
                : "Create approval request"}
            </button>
          </div>
          {!selectedSourceId || !selectedScopeId ? (
            <p className="mt-3 text-[11px] leading-4 text-approval">
              Register a control observer and verify a Domain or Subdomain scope
              first.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-[11px] leading-4 text-missed">
              {error}
            </p>
          ) : null}
          <details className="mt-4 border-t border-line pt-3">
            <summary className="cursor-pointer text-xs text-brand">
              What this proves
            </summary>
            <p className="mt-2 text-[11px] leading-5 text-subtle">
              A matched verdict proves the configured observer found this
              canary's exact marker. It does not prove every event of the same
              technique is covered. Repeat after tuning and keep the linked
              evidence.
            </p>
          </details>
        </aside>
      </div>
    </Panel>
  );
}

function CoverageHistory({
  coverage
}: {
  coverage: ControlRuleCoverageSnapshotPoint[];
}) {
  return (
    <div>
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        Coverage history
      </p>
      <ol
        aria-label="Detection coverage snapshot history"
        className="mt-2 flex items-end gap-1.5 overflow-x-auto pb-1"
      >
        {coverage.map((snapshot) => {
          const percent =
            snapshot.totalTechniques > 0
              ? Math.round(
                  ((snapshot.blockedTechniques + snapshot.coveredTechniques) /
                    snapshot.totalTechniques) *
                    100
                )
              : 0;

          return (
            <li
              key={snapshot.snapshotId}
              className="flex min-w-14 flex-col items-center gap-1"
              title={`${percent}% covered · ${snapshot.regressedTechniques} regressed · ${new Date(snapshot.generatedAt).toLocaleString()}`}
            >
              <span className="font-mono text-[9px] text-subtle">
                {percent}%
              </span>
              <span className="flex h-12 w-3 items-end overflow-hidden rounded-full bg-line">
                <span
                  aria-hidden
                  className={cn(
                    "w-full rounded-full",
                    snapshot.regressedTechniques > 0 ? "bg-missed" : "bg-brand"
                  )}
                  style={{ height: `${Math.max(6, percent)}%` }}
                />
              </span>
              <time
                dateTime={snapshot.generatedAt}
                className="whitespace-nowrap font-mono text-[9px] text-subtle"
              >
                {new Date(snapshot.generatedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short"
                })}
              </time>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function BehaviorPicker({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: ControlSource["expectedBehaviors"]) => void;
  value: ControlSource["expectedBehaviors"];
}) {
  return (
    <fieldset className="min-w-0 flex-1">
      <legend className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {EXPECTED_BEHAVIORS.map((behavior) => {
          const checked = value.includes(behavior);
          return (
            <label
              key={behavior}
              className={cn(
                "cursor-pointer rounded-control border px-2 py-1 text-xs transition-colors",
                checked
                  ? "border-brand/50 bg-brand/10 text-ink"
                  : "border-line bg-elevated text-muted hover:border-line-strong"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? value.filter((item) => item !== behavior)
                      : [...value, behavior]
                  )
                }
                className="sr-only"
              />
              {behavior}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ControlSourceRow({
  activeRunnerCount,
  coverageItems,
  hasEligibleScope,
  source,
  onChanged
}: {
  activeRunnerCount: number;
  coverageItems: DetectionRuleCoverageItem[];
  hasEligibleScope: boolean;
  source: ControlSource;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [draft, setDraft] = useState<ControlSource["expectedBehaviors"]>([
    ...source.expectedBehaviors
  ]);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ValidationRun | null>(null);
  const [techniqueId, setTechniqueId] = useState("");

  const selectedTechniqueId =
    techniqueId || coverageItems[0]?.techniqueId || "";

  async function validate() {
    setBusy(true);
    setError(null);
    try {
      const run = await api.validateControlSource(source.controlSourceId, {
        executionMode: "DryRun",
        techniqueId: selectedTechniqueId
      });
      setLastResult(run);
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't validate this source."
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveTuning() {
    if (draft.length === 0) {
      setError("List at least one expected behavior.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateControlSource(source.controlSourceId, {
        expectedBehaviors: draft
      });
      setTuning(false);
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't save tuning."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
          {source.controlType}
        </span>
        <span className="text-[13px] text-ink">{source.provider}</span>
        <StateBadge tone={healthTone(source.healthStatus)} dot={false}>
          {source.healthStatus}
        </StateBadge>
        {source.expectedBehaviors.length ? (
          <span className="font-mono text-[11px] text-subtle">
            expects {source.expectedBehaviors.join(", ")}
          </span>
        ) : null}
        <span className="font-mono text-[11px] text-subtle">
          validated {relTime(source.lastValidatedAt)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft([...source.expectedBehaviors]);
              setError(null);
              setTuning((value) => !value);
            }}
            className="text-xs text-brand hover:text-brand-2"
          >
            {tuning ? "Cancel" : "Tune"}
          </button>
        </div>
      </div>
      {!tuning ? (
        <div className="flex flex-col gap-2 rounded-control border border-line bg-elevated p-2.5">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                ATT&amp;CK scenario
              </span>
              <select
                aria-label={`Validation scenario for ${source.provider}`}
                value={selectedTechniqueId}
                onChange={(event) => setTechniqueId(event.target.value)}
                className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-line-strong"
              >
                {coverageItems.map((item) => (
                  <option key={item.scenarioId} value={item.techniqueId}>
                    {item.techniqueId} · {item.techniqueName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Execution
              </span>
              <select
                aria-label={`Execution mode for ${source.provider}`}
                value="DryRun"
                disabled
                className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink disabled:opacity-100"
              >
                <option value="DryRun">
                  Dry-run · telemetry-only (no inject)
                </option>
              </select>
            </label>
            <button
              type="button"
              onClick={validate}
              disabled={busy || !hasEligibleScope || !selectedTechniqueId}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              {busy ? "Observing…" : "Observe telemetry"}
            </button>
          </div>
          <p className="text-[11px] text-subtle">
            {hasEligibleScope
              ? "Verified scope ready for limited safe stimulus"
              : "Verified scope with limited safe-stimulus ceiling required"}
            {` · ${activeRunnerCount} active internal ${activeRunnerCount === 1 ? "runner" : "runners"}`}
            {
              " · Inject loop not available (control_live_execution_disabled) — telemetry-only observations; not a closed inject-measure claim."
            }
            {
              " · Use Detection marker proof above for allowlisted periscan-* emit→observe (benign-marker class only)."
            }
          </p>
          {lastResult ? (
            <p role="status" className="text-[11.5px] text-muted">
              Last result: {lastResult.validationState ?? "Inconclusive"} · mode{" "}
              {String(lastResult.target.executionMode ?? "DryRun")}
              {lastResult.target.observationMode === "telemetry_only" ||
              lastResult.target.injectLoopAvailable === false
                ? " · telemetry-only (inject loop not available)"
                : ""}{" "}
              · completed {relTime(lastResult.completedAt)}
            </p>
          ) : null}
        </div>
      ) : null}
      {tuning ? (
        <div className="flex flex-col gap-1.5 rounded-control border border-line bg-surface p-2.5">
          <div className="flex flex-wrap items-end gap-2">
            <BehaviorPicker
              label={`Expected behaviors for ${source.provider}`}
              value={draft}
              onChange={setDraft}
            />
            <button
              type="button"
              onClick={saveTuning}
              disabled={busy}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy ? "Saving…" : "Save tuning"}
            </button>
          </div>
          <p className="text-[11px] text-subtle">
            The selected behaviors are the recorded coverage expectation. The
            next validation re-grades real control signals against this
            expectation; tuning never asserts effectiveness by itself.
          </p>
          {error ? (
            <p className="text-[11px] text-[color:var(--color-blocked)]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      {!tuning && error ? (
        <p role="alert" className="text-[11px] text-missed">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function isControlGapStatus(
  status: DetectionRuleCoverageItem["status"]
): status is "LoggedOnly" | "NeedsTuning" | "Missed" {
  return (
    status === "LoggedOnly" ||
    status === "NeedsTuning" ||
    status === "Missed"
  );
}

function CoverageRow({ item }: { item: DetectionRuleCoverageItem }) {
  const [open, setOpen] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [createdRemediationId, setCreatedRemediationId] = useState<
    string | null
  >(null);
  const canCreateDetectionEngTask = isControlGapStatus(item.status);

  async function createDetectionEngTask() {
    if (!isControlGapStatus(item.status)) return;
    setTaskBusy(true);
    setTaskError(null);
    try {
      const task = await api.createControlGapRemediation({
        controlSourceId: item.controlSourceId,
        coverageStatus: item.status,
        techniqueId: item.techniqueId,
        techniqueName: item.techniqueName,
        note: item.recommendation || undefined
      });
      setCreatedRemediationId(task.remediationId);
    } catch (caught) {
      setTaskError(
        caught instanceof Error
          ? caught.message
          : "Unable to create detection-eng task"
      );
    } finally {
      setTaskBusy(false);
    }
  }

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/attack-techniques?technique=${encodeURIComponent(item.techniqueId)}`}
            className="font-mono text-[11px] text-brand hover:text-brand-2"
          >
            {item.techniqueId}
          </Link>
          <span className="text-[13px] text-ink">{item.techniqueName}</span>
          <span className="font-mono text-[10px] text-subtle">
            {item.tacticName}
          </span>
          <ControlCoverageBadge className="ml-auto" status={item.status} />
          <ControlCoverageTrendBadge
            previousStatus={item.previousStatus}
            trend={item.trend}
          />
        </div>
        <p className="text-[12px] font-medium text-ink">{item.title}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px]">
          <BehaviorRow label="Expected" behaviors={item.expectedBehaviors} />
          <BehaviorRow label="Observed" behaviors={item.observedBehaviors} />
          {item.observedSources.length ? (
            <span className="text-subtle">
              via {item.observedSources.join(", ")}
            </span>
          ) : null}
          <span className="font-mono text-subtle">
            conf {item.confidence.toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="ml-auto text-xs text-brand hover:text-brand-2"
          >
            {open ? "Hide proof" : "Show proof"}
          </button>
        </div>
        {item.recommendation ? (
          <p className="text-[12px] text-approval">{item.recommendation}</p>
        ) : null}
        {canCreateDetectionEngTask ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void createDetectionEngTask()}
              disabled={taskBusy}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              {taskBusy
                ? "Creating…"
                : createdRemediationId
                  ? "Task created"
                  : "Create detection-eng task"}
            </button>
            {createdRemediationId ? (
              <Link
                href={`/remediation?remediationId=${encodeURIComponent(createdRemediationId)}`}
                className="text-xs font-semibold text-brand hover:text-brand-2"
              >
                Open remediation →
              </Link>
            ) : (
              <span className="text-[11px] text-subtle">
                Mobilize gap into a durable detection-eng work item (not Fixed
                until re-observed).
              </span>
            )}
            {taskError ? (
              <p role="alert" className="w-full text-[11px] text-missed">
                {taskError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {open ? (
        <div className="grid gap-3 border-t border-line bg-elevated px-4 py-3 text-xs sm:grid-cols-3">
          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
              Observation
            </p>
            <p className="mt-1 text-muted">
              Last observed {relTime(item.lastObservedAt)}
            </p>
            <p className="mt-1 break-all font-mono text-[10px] text-subtle">
              control·{item.controlSourceId}
            </p>
          </div>
          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
              Evidence
            </p>
            {item.evidenceIds.length ? (
              <ul className="mt-1 space-y-1">
                {item.evidenceIds.map((evidenceId) => (
                  <li key={evidenceId}>
                    <Link
                      href={`/evidence?evidenceId=${encodeURIComponent(evidenceId)}`}
                      className="font-mono text-brand hover:text-brand-2"
                    >
                      ev·{evidenceId.slice(0, 8)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-subtle">No linked evidence.</p>
            )}
          </div>
          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
              Signals
            </p>
            {item.signalIds.length ? (
              <ul className="mt-1 space-y-1">
                {item.signalIds.map((signalId) => (
                  <li key={signalId}>
                    <Link
                      href={`/signal-activity?signalId=${encodeURIComponent(signalId)}`}
                      className="font-mono text-brand hover:text-brand-2"
                    >
                      sig·{signalId.slice(0, 8)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-subtle">No linked signals.</p>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function RegisterControlSourceForm({
  integrations,
  onCreated
}: {
  integrations: Integration[];
  onCreated: () => void;
}) {
  const [controlType, setControlType] =
    useState<(typeof CONTROL_TYPES)[number]>("SIEM");
  const [integrationId, setIntegrationId] = useState("");
  const [provider, setProvider] = useState("");
  const [behaviors, setBehaviors] = useState<
    ControlSource["expectedBehaviors"]
  >(["Detected", "Alerted"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input =
    "rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong";

  async function submit() {
    if (!integrationId || !provider.trim() || behaviors.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.createControlSource({
        controlType,
        integrationId,
        provider: provider.trim(),
        expectedBehaviors: behaviors
      });
      setProvider("");
      onCreated();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't register the source."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 border-b border-line bg-surface/40 p-4 sm:grid-cols-2">
      <select
        className={input}
        value={controlType}
        onChange={(e) => setControlType(e.target.value as typeof controlType)}
        aria-label="Control type"
      >
        {CONTROL_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        className={input}
        value={integrationId}
        onChange={(e) => setIntegrationId(e.target.value)}
        aria-label="Integration"
      >
        <option value="">Backing integration…</option>
        {integrations.map((i) => (
          <option key={i.integrationId} value={i.integrationId}>
            {i.vendor} {i.product}
          </option>
        ))}
      </select>
      <input
        className={input}
        placeholder="Provider (e.g. Splunk)"
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
        aria-label="Provider"
      />
      <BehaviorPicker
        label="Expected behaviors"
        value={behaviors}
        onChange={setBehaviors}
      />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="button"
          onClick={submit}
          disabled={
            busy || !integrationId || !provider.trim() || behaviors.length === 0
          }
          className={buttonClassName({ size: "sm", variant: "primary" })}
        >
          {busy ? "Registering…" : "Register source"}
        </button>
        {integrations.length === 0 ? (
          <span className="text-[12px] text-approval">
            Connect a security integration first.
          </span>
        ) : null}
        {error ? <span className="text-sm text-missed">{error}</span> : null}
      </div>
    </div>
  );
}

function BehaviorRow({
  label,
  behaviors
}: {
  label: string;
  behaviors: string[];
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle"
        )}
      >
        {label}
      </span>
      {behaviors.length ? (
        behaviors.map((b) => (
          <ControlStateBadge key={b} state={b} dot={false} />
        ))
      ) : (
        <span className="text-subtle">—</span>
      )}
    </span>
  );
}
