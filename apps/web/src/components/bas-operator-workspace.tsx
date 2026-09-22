"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  BAS_BENIGN_MARKER_SCENARIO_ID,
  BAS_DANGER_ACK_DENY_REASON,
  CAMPAIGN_DAG_EMPTY_DESCRIPTION,
  CAMPAIGN_DAG_EMPTY_TITLE,
  HIGH_DANGER_ACK_CHECKBOX_LABEL,
  HIGH_DANGER_ACK_DIGEST,
  HIGH_DANGER_SECTION_TITLE,
  campaignPinStepKey,
  correlateStimulusObservation,
  emptyDangerOperatorGate,
  isDangerCatalogModule,
  presentCampaignDagView,
  presentDangerCatalogOperatorView,
  type BasCampaignPreview,
  type BasCampaignTypedInputs,
  type BasContentVersionSummary,
  type BasControlPlaneScenario,
  type CampaignDagViewStepLabel,
  type ControlSource,
  type DangerCatalogEntry,
  type DetectionCorrelationResult,
  type DetectionCorrelationStage,
  type DetectionCorrelationVerdict,
  type Scope,
  type ValidationMission,
  type ValidationStimulus
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  EmptyState,
  ErrorState,
  InlineError,
  LoadingSkeleton,
  NotConfigured,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  type StateTone
} from "../ui";
import { readMondayModePref } from "./dashboard-command-center";

const AUTHORIZED_SAFETY = new Set(["BASLite", "AdvancedAdversarial"]);
const LOOP_STEPS: readonly {
  id: DetectionCorrelationStage;
  label: string;
  hint: string;
}[] = [
  {
    id: "inject",
    label: "Inject",
    hint: "Benign marker only. Dispatch a unique run/step canary."
  },
  {
    id: "observe",
    label: "Observe",
    hint: "Correlate marker, asset, technique, rule, and event time."
  },
  {
    id: "verdict",
    label: "Verdict",
    hint: "Executed / Prevented / Logged / Alerted / Routed / Inconclusive."
  },
  {
    id: "retest",
    label: "Retest",
    hint: "Replay the same versioned marker path. Fixed still needs verification."
  }
];

function isAuthorizedControlValidationScope(scope: Scope): boolean {
  return (
    scope.verificationStatus === "Verified" &&
    AUTHORIZED_SAFETY.has(scope.effectiveMaxSafetyLevel)
  );
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function readMondayModeOn(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return readMondayModePref() === "1";
}

/**
 * P3-BASHYDRATE: Monday focus must not occupy the inject-panel SSR slot.
 * Paint it only after mount so /bas hydrates when Home persisted Monday mode.
 */
export function basMondayFocusReady(
  mounted: boolean,
  mondayPrefOn: boolean
): boolean {
  return mounted && mondayPrefOn;
}

export function correlationTone(
  verdict: DetectionCorrelationVerdict
): StateTone {
  switch (verdict) {
    case "Prevented":
      return "fixed";
    case "Alerted":
    case "Routed":
      return "validated";
    case "Logged":
    case "Executed":
      return "approval";
    case "Missed":
      return "missed";
    case "Inconclusive":
      return "inconclusive";
  }
}

function healthTone(status: string): StateTone {
  if (status === "Healthy") return "fixed";
  if (status === "Degraded") return "approval";
  if (status === "Unhealthy" || status === "Error") return "missed";
  return "inconclusive";
}

function sourceForStimulus(
  stimulus: ValidationStimulus,
  sources: readonly ControlSource[]
): ControlSource | undefined {
  return sources.find(
    (source) => source.controlSourceId === stimulus.controlSourceId
  );
}

export function presentStimulusCorrelation(
  stimulus: ValidationStimulus,
  source: ControlSource | undefined
): DetectionCorrelationResult {
  return correlateStimulusObservation({
    correlationMatched: stimulus.verdict?.correlationMatched ?? false,
    dispatchReceiptPresent: Boolean(
      stimulus.dispatchReceipt ?? stimulus.dispatchedAt
    ),
    injectedAt: stimulus.dispatchedAt,
    marker: stimulus.markerFingerprint,
    observationDeadlineAt: stimulus.observationDeadlineAt,
    observerHealthStatus: source?.healthStatus ?? "Unknown",
    observerLastValidatedAt: source?.lastValidatedAt ?? null,
    observerTelemetryStatus: source?.telemetryStatus ?? "Unknown",
    runId: stimulus.runId,
    stepId: stimulus.stimulusId,
    storedObservedOutcome: stimulus.verdict?.observedOutcome ?? null,
    storedVerdict: stimulus.verdict?.verdict ?? null,
    stimulusStatus: stimulus.status,
    techniqueId: stimulus.techniqueId,
    windowStart: stimulus.dispatchedAt ?? stimulus.createdAt
  });
}

function resolveActiveLoopStage(
  stimuli: readonly ValidationStimulus[],
  sources: readonly ControlSource[]
): DetectionCorrelationStage {
  if (stimuli.some((item) => item.status === "Observing")) {
    return "observe";
  }
  if (
    stimuli.some((item) => {
      const correlated = presentStimulusCorrelation(
        item,
        sourceForStimulus(item, sources)
      );
      return (
        item.status === "Completed" &&
        correlated.stage === "verdict" &&
        correlated.verdict !== "Executed"
      );
    })
  ) {
    return stimuli.some((item) => item.status === "Ready")
      ? "inject"
      : "retest";
  }
  if (stimuli.some((item) => item.status === "Ready")) {
    return "inject";
  }
  return "inject";
}

function canCancel(status: ValidationStimulus["status"]): boolean {
  return ["RequiresApproval", "Ready", "Observing"].includes(status);
}

function parseTypedInputValue(raw: string): string | number | boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/u.test(raw.trim())) {
    return Number(raw);
  }
  return raw;
}

function policyTone(outcome: string): StateTone {
  if (outcome === "Allowed") return "validated";
  if (outcome === "Denied") return "missed";
  return "approval";
}

function formatTypedInputs(inputs: BasCampaignTypedInputs): string {
  const entries = Object.entries(inputs);
  if (entries.length === 0) {
    return "no typed inputs";
  }
  return entries.map(([key, value]) => `${key}=${value}`).join(" · ");
}

function dagStepTone(label: CampaignDagViewStepLabel): StateTone {
  if (label === "not live executable") return "blocked";
  if (label === "not startable") return "inconclusive";
  return "validated";
}

export function BasOperatorWorkspace() {
  const missions = useApiResource(() => api.listMissions(), []);
  const scopes = useApiResource(() => api.listScopes(), []);
  const sources = useApiResource(() => api.listControlSources(), []);
  const stimuli = useApiResource(() => api.listValidationStimuli(), []);
  const scenarios = useApiResource(
    () => api.listBasControlPlaneScenarios(),
    []
  );
  const content = useApiResource(() => api.listBasContentVersions(), []);
  const campaigns = useApiResource(() => api.listBasCampaigns(), []);
  const dangerGate = useApiResource(() => api.getBasDangerOperatorGate(), []);

  const authorizedScopes = useMemo(
    () => (scopes.data ?? []).filter(isAuthorizedControlValidationScope),
    [scopes.data]
  );
  const controlMissions = useMemo(
    () =>
      (missions.data ?? []).filter(
        (item) => item.missionType === "ControlValidation"
      ),
    [missions.data]
  );
  const scenarioCatalog = (scenarios.data ?? []).filter(
    (scenario) =>
      !isDangerCatalogModule(scenario.scenarioId) &&
      !isDangerCatalogModule(scenario.moduleId)
  );
  const healthyObserverCount = (sources.data ?? []).filter(
    (source) =>
      source.healthStatus === "Healthy" && source.telemetryStatus === "Healthy"
  ).length;
  const observerOutage = (sources.data ?? []).some(
    (source) =>
      source.healthStatus === "Unhealthy" ||
      source.telemetryStatus === "Unhealthy"
  );

  const [scopeId, setScopeId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [busyStimulusId, setBusyStimulusId] = useState<string | null>(null);
  const [stimulusError, setStimulusError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const mondayMode = basMondayFocusReady(mounted, readMondayModeOn());
  const [scenarioId, setScenarioId] = useState("");
  const [contentVersionId, setContentVersionId] = useState("");
  const [typedKey, setTypedKey] = useState("");
  const [typedValue, setTypedValue] = useState("");
  const [typedInputs, setTypedInputs] = useState<BasCampaignTypedInputs>({});
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [busyDigest, setBusyDigest] = useState<string | null>(null);
  const [campaignActionError, setCampaignActionError] = useState<string | null>(
    null
  );
  const [dangerAcknowledged, setDangerAcknowledged] = useState(false);
  const [busyDangerModuleId, setBusyDangerModuleId] = useState<string | null>(
    null
  );
  const [dangerStartError, setDangerStartError] = useState<string | null>(null);

  const selectedScenarioId = scenarioId || BAS_BENIGN_MARKER_SCENARIO_ID;

  const selectedScopeId = scopeId || authorizedScopes[0]?.scopeId || "";
  const selectedSourceId =
    sourceId || (sources.data ?? [])[0]?.controlSourceId || "";
  const activeStage = resolveActiveLoopStage(
    stimuli.data ?? [],
    sources.data ?? []
  );
  const catalogView = presentDangerCatalogOperatorView({
    dangerAcknowledged,
    dangerAckDigest: dangerAcknowledged ? HIGH_DANGER_ACK_DIGEST : undefined,
    gate: dangerGate.data ?? emptyDangerOperatorGate(),
    policyAllowed: authorizedScopes.length > 0,
    scopeVerified: authorizedScopes.length > 0
  });

  async function startMarkerMission() {
    if (!selectedScopeId) return;
    setStarting(true);
    setStartError(null);
    try {
      await api.startBasScenario({
        scenarioId: BAS_BENIGN_MARKER_SCENARIO_ID,
        scopeId: selectedScopeId,
        controlSourceId: selectedSourceId || undefined
      });
      await Promise.all([missions.refetch(), stimuli.refetch()]);
    } catch (caught) {
      setStartError(
        caught instanceof Error
          ? caught.message
          : "Unable to start the benign-marker scenario."
      );
    } finally {
      setStarting(false);
    }
  }

  function addTypedInput() {
    const key = typedKey.trim();
    if (!key) return;
    setTypedInputs((current) => ({
      ...current,
      [key]: parseTypedInputValue(typedValue)
    }));
    setTypedKey("");
    setTypedValue("");
  }

  async function compileCampaign() {
    if (!selectedScopeId) return;
    setCompiling(true);
    setCompileError(null);
    try {
      if (contentVersionId) {
        const version = await api.getBasContentVersion(contentVersionId);
        const scenario = version.preview.scenarios[0];
        if (!scenario) {
          throw new Error("Registered content has no scenarios to pin.");
        }
        await api.compileBasCampaign({
          contentVersionIds: [version.basContentVersionId],
          scenarioPins: [
            {
              contentSha256: version.contentSha256,
              contentVersionId: version.basContentVersionId,
              provider: version.provider,
              typedInputs,
              upstreamId: scenario.upstreamId
            }
          ],
          scopeId: selectedScopeId
        });
      } else {
        await api.compileBasCampaign({
          scenarioPins: [
            {
              provider: "ControlPlane",
              typedInputs,
              upstreamId: selectedScenarioId
            }
          ],
          scopeId: selectedScopeId
        });
      }
      await campaigns.refetch();
    } catch (caught) {
      setCompileError(
        caught instanceof Error
          ? caught.message
          : "Unable to compile the BAS campaign."
      );
    } finally {
      setCompiling(false);
    }
  }

  async function startCampaign(preview: BasCampaignPreview) {
    if (!preview.plan.startable || preview.dispatchPrevented) {
      return;
    }
    setBusyDigest(preview.plan.compiledDigest);
    setCampaignActionError(null);
    try {
      const started = await api.startBasCampaign({
        compiledDigest: preview.plan.compiledDigest
      });
      if (started.outcome !== "Allowed") {
        setCampaignActionError(
          `${started.denyReason ?? started.rationale} · jobsQueued=${started.jobsQueued}`
        );
      }
      await Promise.all([campaigns.refetch(), missions.refetch()]);
    } catch (caught) {
      setCampaignActionError(
        caught instanceof Error
          ? caught.message
          : "Unable to start the BAS campaign."
      );
    } finally {
      setBusyDigest(null);
    }
  }

  async function startDangerEntry(entry: DangerCatalogEntry) {
    if (!selectedScopeId || !catalogView.startEnabled) {
      return;
    }
    setBusyDangerModuleId(entry.moduleId);
    setDangerStartError(null);
    try {
      const compiled = await api.compileBasCampaign({
        scopeId: selectedScopeId,
        scenarioPins: [
          {
            provider: "ControlPlane",
            typedInputs: {},
            upstreamId: entry.moduleId
          }
        ]
      });
      const started = await api.startBasCampaign({
        compiledDigest: compiled.plan.compiledDigest,
        dangerAckDigest: HIGH_DANGER_ACK_DIGEST,
        dangerAcknowledged: true
      });
      if (started.outcome !== "Allowed") {
        setDangerStartError(
          `${started.denyReason ?? started.rationale} · jobsQueued=${started.jobsQueued}`
        );
      }
      await Promise.all([campaigns.refetch(), missions.refetch()]);
    } catch (caught) {
      setDangerStartError(
        caught instanceof Error ? caught.message : BAS_DANGER_ACK_DENY_REASON
      );
    } finally {
      setBusyDangerModuleId(null);
    }
  }

  async function stopCampaign(compiledDigest: string) {
    setBusyDigest(compiledDigest);
    setCampaignActionError(null);
    try {
      await api.cancelBasCampaign({
        compiledDigest,
        cleanupReceipts: []
      });
      await campaigns.refetch();
    } catch (caught) {
      setCampaignActionError(
        caught instanceof Error
          ? caught.message
          : "Unable to stop the BAS campaign."
      );
    } finally {
      setBusyDigest(null);
    }
  }

  async function act(
    next: ValidationStimulus,
    action: "dispatch" | "observe" | "cancel" | "retest"
  ) {
    setBusyStimulusId(next.stimulusId);
    setStimulusError(null);
    try {
      if (action === "dispatch") {
        await api.dispatchValidationStimulus(next.stimulusId);
      } else if (action === "observe") {
        await api.observeValidationStimulus(next.stimulusId);
      } else if (action === "retest") {
        await api.createValidationStimulus({
          controlSourceId: next.controlSourceId,
          scopeId: next.scopeId,
          stimulusType: "OwnedDomainUrlCanary",
          techniqueId: next.techniqueId,
          ttlSeconds: next.ttlSeconds
        });
      } else {
        await api.cancelValidationStimulus(next.stimulusId);
      }
      await stimuli.refetch();
    } catch (caught) {
      setStimulusError(
        caught instanceof Error ? caught.message : "Unable to update stimulus."
      );
    } finally {
      setBusyStimulusId(null);
    }
  }

  return (
    <PageShell data-testid="bas-operator-workspace">
      <PageHeader
        eyebrow="Validate"
        title="BAS operator workspace"
        description="Inject a benign marker, observe a connected SIEM/EDR, then read a health-gated verdict. Live Atomic is not executable."
        actions={
          <>
            <Link
              href="/control-validation"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              ControlValidation
            </Link>
            <Link
              href="/controls"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Controls
            </Link>
            <Link
              href="/bas/atomic-testing"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Atomic testing
            </Link>
          </>
        }
      />

      <div
        role="status"
        data-testid="bas-operator-honesty"
        className="rounded-control border border-brand/35 bg-brand/8 px-4 py-3 text-sm text-ink"
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
          benign marker only · observer health before Missed
        </p>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">
          Today’s inject is the allowlisted{" "}
          <span className="font-mono text-[11px] text-ink">periscan-*</span>{" "}
          canary. Verdicts are Executed, Prevented, Logged, Alerted, Routed, or
          Inconclusive. Missed requires a healthy observer and a completed
          window. Outages stay Inconclusive. YAML Atomic, Caldera, and
          Metasploit remain qualification-required. Three reviewed Linux argv
          tests (hostname, env, date) can start from a compiled campaign when
          qualified, authorized, and policy Allowed. High danger is a separate
          extra-ack catalog, not Community default start and not unmarked
          Validate.
        </p>
      </div>

      <ol
        aria-label="BAS operator loop"
        data-testid="bas-operator-loop"
        className="grid gap-2 sm:grid-cols-4"
      >
        {LOOP_STEPS.map((step, index) => {
          const active = step.id === activeStage;
          return (
            <li
              key={step.id}
              data-active={active ? "true" : "false"}
              className={`rounded-control border px-3 py-3 ${
                active ? "border-brand/50 bg-brand/8" : "border-line bg-surface"
              }`}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                {String(index + 1).padStart(2, "0")} · {step.label}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-muted">
                {step.hint}
              </p>
            </li>
          );
        })}
      </ol>

      <Panel aria-labelledby="bas-observer-health-title">
        <PanelHeader
          titleId="bas-observer-health-title"
          title="Observer health"
        />
        {sources.loading ? (
          <LoadingSkeleton rows={2} />
        ) : sources.error ? (
          <ErrorState message={sources.error} onRetry={sources.refetch} />
        ) : (sources.data ?? []).length === 0 ? (
          <div className="p-4">
            <NotConfigured
              title="Connect a SIEM or EDR observer"
              message="Missed is disabled until a healthy control source is in the window. Outages and missing telemetry are Inconclusive."
              action={{ href: "/integrations", label: "Connect observer" }}
            />
          </div>
        ) : (
          <div className="p-4" data-testid="bas-observer-health">
            <p className="text-[12px] text-muted">
              {healthyObserverCount} healthy observer
              {healthyObserverCount === 1 ? "" : "s"} ·{" "}
              {(sources.data ?? []).length} registered. Outages cannot become
              Missed.
            </p>
            {observerOutage ? (
              <p
                role="status"
                className="mt-2 text-[12px] text-missed"
                data-testid="bas-observer-outage"
              >
                An observer is unhealthy. New verdicts stay Inconclusive until
                health recovers.
              </p>
            ) : null}
            <ul className="mt-3 divide-y divide-line rounded-control border border-line">
              {(sources.data ?? []).map((source) => (
                <li
                  key={source.controlSourceId}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-ink">
                      {source.provider} · {source.controlType}
                    </p>
                    <p className="font-mono text-[10px] text-subtle">
                      telemetry {source.telemetryStatus}
                    </p>
                  </div>
                  <StateBadge
                    tone={healthTone(source.healthStatus)}
                    dot={false}
                  >
                    {source.healthStatus}
                  </StateBadge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {mondayMode ? (
        <div
          role="status"
          data-testid="bas-monday-focus"
          className="rounded-control border border-line bg-surface px-4 py-3 text-sm text-ink"
        >
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Proof board · next beat only
          </p>
          <p className="mt-1 text-[13px] text-muted">
            Next beat is{" "}
            <span className="font-medium text-ink">{activeStage}</span>. Catalog
            and content preview stay collapsed until you leave the board focus.
          </p>
        </div>
      ) : null}

      <Panel
        aria-labelledby="bas-inject-title"
        data-testid="bas-inject-panel"
      >
        <PanelHeader titleId="bas-inject-title" title="Inject benign marker" />
        {scopes.loading ? (
          <LoadingSkeleton rows={3} />
        ) : scopes.error ? (
          <ErrorState message={scopes.error} onRetry={scopes.refetch} />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {authorizedScopes.length === 0 ? (
              <NotConfigured
                title="Verify a scope that permits BAS-lite"
                message="Marker inject only starts on a verified scope whose ceiling is BASLite or AdvancedAdversarial."
                action={{ href: "/scopes", label: "Verify scope" }}
              />
            ) : (
              <div className="flex flex-wrap gap-3">
                <label className="flex max-w-md flex-1 flex-col gap-1 text-xs text-muted">
                  Authorized scope
                  <select
                    aria-label="Authorized BAS inject scope"
                    value={selectedScopeId}
                    onChange={(event) => setScopeId(event.target.value)}
                    className="rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink"
                  >
                    {authorizedScopes.map((scope) => (
                      <option key={scope.scopeId} value={scope.scopeId}>
                        {scope.scopeType} · {scope.value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex max-w-md flex-1 flex-col gap-1 text-xs text-muted">
                  Control observer
                  <select
                    aria-label="BAS inject control source"
                    value={selectedSourceId}
                    onChange={(event) => setSourceId(event.target.value)}
                    disabled={(sources.data ?? []).length === 0}
                    className="rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink"
                  >
                    {(sources.data ?? []).length === 0 ? (
                      <option value="">No control sources</option>
                    ) : (
                      (sources.data ?? []).map((source) => (
                        <option
                          key={source.controlSourceId}
                          value={source.controlSourceId}
                        >
                          {source.provider} · {source.healthStatus}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={starting || !selectedScopeId}
                onClick={() => void startMarkerMission()}
                className={buttonClassName({ size: "sm", variant: "primary" })}
              >
                {starting ? "Starting…" : "Inject benign marker"}
              </button>
              <p className="text-[11px] text-subtle">
                startBasScenario · {BAS_BENIGN_MARKER_SCENARIO_ID}
              </p>
            </div>
            {startError ? <InlineError message={startError} /> : null}
          </div>
        )}
      </Panel>

      <Panel
        aria-labelledby="bas-campaign-compiler-title"
        data-testid="bas-campaign-compiler"
      >
        <PanelHeader
          titleId="bas-campaign-compiler-title"
          title="Campaign compiler"
        />
        <div className="flex flex-col gap-3 p-4">
          <p className="text-[12px] leading-5 text-muted">
            Compile a plan bound to verified scope and typed inputs. Compile
            never queues. Start uses the compiled digest only. Compiled pins
            show topological execution order. Unreviewed YAML and unqualified
            live packs stay preview-only with jobsQueued=0. Reviewed hostname,
            env, and date argv pins can start when gates pass.
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="flex max-w-md flex-1 flex-col gap-1 text-xs text-muted">
              Campaign scenario pin
              <select
                aria-label="Campaign scenario pin"
                value={selectedScenarioId}
                onChange={(event) => setScenarioId(event.target.value)}
                disabled={Boolean(contentVersionId)}
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink"
              >
                {scenarioCatalog.map((scenario) => (
                  <option key={scenario.scenarioId} value={scenario.scenarioId}>
                    {scenario.title}
                    {scenario.startable ? "" : " · qualification required"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex max-w-md flex-1 flex-col gap-1 text-xs text-muted">
              Bind registered content
              <select
                aria-label="Bind registered content"
                value={contentVersionId}
                onChange={(event) => setContentVersionId(event.target.value)}
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink"
              >
                <option value="">None — control-plane pin</option>
                {(content.data?.items ?? []).map((item) => (
                  <option
                    key={item.basContentVersionId}
                    value={item.basContentVersionId}
                  >
                    {item.provider} · {item.sourcePath} · not executable
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[8rem] flex-col gap-1 text-xs text-muted">
              Campaign typed input key
              <input
                aria-label="Campaign typed input key"
                value={typedKey}
                onChange={(event) => setTypedKey(event.target.value)}
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink"
              />
            </label>
            <label className="flex min-w-[8rem] flex-col gap-1 text-xs text-muted">
              Campaign typed input value
              <input
                aria-label="Campaign typed input value"
                value={typedValue}
                onChange={(event) => setTypedValue(event.target.value)}
                className="rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink"
              />
            </label>
            <button
              type="button"
              onClick={addTypedInput}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Add typed input
            </button>
          </div>
          {Object.keys(typedInputs).length > 0 ? (
            <p className="font-mono text-[11px] text-ink">
              {formatTypedInputs(typedInputs)}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={compiling || !selectedScopeId}
              onClick={() => void compileCampaign()}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {compiling ? "Compiling…" : "Compile campaign"}
            </button>
            <p className="text-[11px] text-subtle">
              POST /bas/campaigns/compile · jobsQueued stays 0
            </p>
          </div>
          {compileError ? <InlineError message={compileError} /> : null}
        </div>
      </Panel>

      <Panel
        aria-labelledby="bas-high-danger-title"
        className="border-missed/35"
        data-testid="bas-high-danger-catalog"
      >
        <PanelHeader
          titleId="bas-high-danger-title"
          title={HIGH_DANGER_SECTION_TITLE}
        />
        <div className="flex flex-col gap-3 p-4">
          <p
            className="rounded-control border border-missed/30 bg-missed/8 px-3 py-2 text-[12px] leading-5 text-ink"
            data-testid="bas-high-danger-copy"
          >
            {catalogView.copy} Start stays disabled until this acknowledgement,
            qualification, and tenant authorization.
          </p>
          <p className="text-[12px] leading-5 text-muted">
            {BAS_DANGER_ACK_DENY_REASON}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StateBadge
              tone={
                catalogView.qualifyState === "qualified"
                  ? "validated"
                  : "inconclusive"
              }
              variant="outline"
              dot={false}
            >
              {catalogView.qualifyState}
            </StateBadge>
            <StateBadge
              tone={
                catalogView.authorizeState === "authorized"
                  ? "validated"
                  : "blocked"
              }
              variant="outline"
              dot={false}
            >
              {catalogView.authorizeState}
            </StateBadge>
          </div>
          <label className="flex items-start gap-2 text-[13px] leading-5 text-ink">
            <input
              type="checkbox"
              checked={dangerAcknowledged}
              onChange={(event) => setDangerAcknowledged(event.target.checked)}
              aria-label={HIGH_DANGER_ACK_CHECKBOX_LABEL}
              className="mt-1"
            />
            <span>{HIGH_DANGER_ACK_CHECKBOX_LABEL}</span>
          </label>
          {dangerGate.error ? (
            <ErrorState
              message={dangerGate.error}
              onRetry={dangerGate.refetch}
            />
          ) : (
            <ul aria-label="High danger catalog">
              {catalogView.entries.map((entry) => (
                <li
                  key={entry.moduleId}
                  data-testid={`bas-high-danger-${entry.moduleId}`}
                  className="flex flex-wrap items-start justify-between gap-2 border-t border-line py-3 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink">
                        {entry.title}
                      </p>
                      <StateBadge tone="missed" variant="outline" dot={false}>
                        {entry.section}
                      </StateBadge>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-muted">
                      {entry.description}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-subtle">
                      {entry.techniqueId} · {entry.dangerClass} ·{" "}
                      {entry.moduleId}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={
                      !catalogView.startEnabled ||
                      busyDangerModuleId === entry.moduleId
                    }
                    onClick={() => void startDangerEntry(entry)}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    {busyDangerModuleId === entry.moduleId
                      ? "Starting…"
                      : `Start ${entry.title}`}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {dangerStartError ? <InlineError message={dangerStartError} /> : null}
        </div>
      </Panel>

      <Panel aria-labelledby="bas-campaign-plans-title">
        <PanelHeader
          titleId="bas-campaign-plans-title"
          title="Compiled campaign plans"
        />
        {campaigns.loading ? (
          <LoadingSkeleton rows={3} />
        ) : campaigns.error ? (
          <ErrorState message={campaigns.error} onRetry={campaigns.refetch} />
        ) : (campaigns.data?.items ?? []).length === 0 ? (
          <div className="p-4" data-testid="bas-campaign-dag">
            <EmptyState
              title="No compiled campaigns"
              description="Compile a plan against verified scope. This list is live API data, not fixtures. Compile never queues jobs."
            />
            <p className="mt-3 text-center text-[12px] leading-5 text-muted">
              {CAMPAIGN_DAG_EMPTY_TITLE}. {CAMPAIGN_DAG_EMPTY_DESCRIPTION}
            </p>
          </div>
        ) : (
          <ul aria-label="Compiled campaign plans">
            {(campaigns.data?.items ?? []).map((preview) => (
              <CampaignPlanRow
                key={preview.plan.compiledDigest}
                busy={busyDigest === preview.plan.compiledDigest}
                preview={preview}
                onStart={() => void startCampaign(preview)}
                onStop={() => void stopCampaign(preview.plan.compiledDigest)}
              />
            ))}
          </ul>
        )}
        {campaignActionError ? (
          <div className="border-t border-line px-4 py-3">
            <InlineError message={campaignActionError} />
          </div>
        ) : null}
      </Panel>

      <Panel aria-labelledby="bas-traces-title">
        <PanelHeader
          titleId="bas-traces-title"
          title="Inject → observe traces"
        />
        {stimuli.loading ? (
          <LoadingSkeleton rows={4} />
        ) : stimuli.error ? (
          <ErrorState message={stimuli.error} onRetry={stimuli.refetch} />
        ) : (stimuli.data ?? []).length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No detection traces yet"
              description="Inject the benign marker on authorized scope. Observation is exact-marker only — this workspace does not invent detections."
            />
          </div>
        ) : (
          <ol className="divide-y divide-line" aria-label="Detection traces">
            {(stimuli.data ?? []).map((item) => {
              const source = sourceForStimulus(item, sources.data ?? []);
              const correlated = presentStimulusCorrelation(item, source);
              return (
                <li
                  key={item.stimulusId}
                  data-testid={`bas-trace-${item.stimulusId}`}
                  className="flex flex-wrap items-start gap-3 px-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StateBadge
                        tone={correlationTone(correlated.verdict)}
                        dot={false}
                      >
                        {correlated.verdict}
                      </StateBadge>
                      <StateBadge
                        tone={healthTone(source?.healthStatus ?? "Unknown")}
                        variant="outline"
                        dot={false}
                      >
                        observer {source?.healthStatus ?? "Unknown"}
                      </StateBadge>
                      <span className="font-mono text-[10px] text-subtle">
                        {item.techniqueId} · marker {item.markerFingerprint}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {item.targetHost}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-muted">
                      {correlated.reason}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-subtle">
                      <Link
                        href={`/missions/${item.missionId}`}
                        className="text-brand hover:text-brand-2"
                      >
                        mission·{shortId(item.missionId)}
                      </Link>
                      <span>{item.evidenceIds.length} evidence</span>
                      {correlated.missedEligible ? (
                        <span>Missed eligible</span>
                      ) : (
                        <span>Missed gated</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.status === "Ready" ? (
                      <button
                        type="button"
                        disabled={busyStimulusId === item.stimulusId}
                        onClick={() => void act(item, "dispatch")}
                        className={buttonClassName({
                          size: "sm",
                          variant: "primary"
                        })}
                      >
                        Dispatch
                      </button>
                    ) : null}
                    {item.status === "Observing" ? (
                      <button
                        type="button"
                        disabled={busyStimulusId === item.stimulusId}
                        onClick={() => void act(item, "observe")}
                        className={buttonClassName({
                          size: "sm",
                          variant: "secondary"
                        })}
                      >
                        Observe
                      </button>
                    ) : null}
                    {item.status === "Completed" ? (
                      <button
                        type="button"
                        disabled={busyStimulusId === item.stimulusId}
                        onClick={() => void act(item, "retest")}
                        className={buttonClassName({
                          size: "sm",
                          variant: "secondary"
                        })}
                      >
                        Retest
                      </button>
                    ) : null}
                    {canCancel(item.status) ? (
                      <button
                        type="button"
                        disabled={busyStimulusId === item.stimulusId}
                        onClick={() => void act(item, "cancel")}
                        className={buttonClassName({
                          size: "sm",
                          variant: "ghost"
                        })}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {stimulusError ? (
          <div className="border-t border-line px-4 py-3">
            <InlineError message={stimulusError} />
          </div>
        ) : null}
      </Panel>

      <Panel aria-labelledby="bas-missions-title">
        <PanelHeader
          titleId="bas-missions-title"
          title="ControlValidation missions"
        />
        {missions.loading ? (
          <LoadingSkeleton rows={3} />
        ) : missions.error ? (
          <ErrorState message={missions.error} onRetry={missions.refetch} />
        ) : controlMissions.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No ControlValidation missions yet"
              description="Inject the benign marker on authorized scope. Missions come from the live API, not fixtures."
            />
          </div>
        ) : (
          <ul>
            {controlMissions.map((mission) => (
              <MissionRow key={mission.missionId} mission={mission} />
            ))}
          </ul>
        )}
      </Panel>

      {mondayMode ? null : (
        <>
          <Panel aria-labelledby="bas-content-title">
            <PanelHeader
              titleId="bas-content-title"
              title="Registered content (not a campaign)"
            />
            {content.loading ? (
              <LoadingSkeleton rows={3} />
            ) : content.error ? (
              <ErrorState message={content.error} onRetry={content.refetch} />
            ) : (content.data?.items ?? []).length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No registered content"
                  description="Registered Atomic/Caldera versions are authoring metadata — executable stays false. This list does not invent campaigns."
                />
              </div>
            ) : (
              <ContentVersionList items={content.data?.items ?? []} />
            )}
          </Panel>

          <Panel aria-labelledby="bas-scenarios-title">
            <PanelHeader
              titleId="bas-scenarios-title"
              title="Control-plane scenarios"
            />
            {scenarios.loading ? (
              <LoadingSkeleton rows={3} />
            ) : scenarios.error ? (
              <ErrorState
                message={scenarios.error}
                onRetry={scenarios.refetch}
              />
            ) : (
              <ul className="divide-y divide-line">
                {scenarioCatalog.map((scenario) => (
                  <ScenarioRow key={scenario.scenarioId} scenario={scenario} />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </PageShell>
  );
}

function CampaignPlanRow({
  busy,
  preview,
  onStart,
  onStop
}: {
  busy: boolean;
  preview: BasCampaignPreview;
  onStart: () => void;
  onStop: () => void;
}) {
  const startable = preview.plan.startable && !preview.dispatchPrevented;
  const dag = presentCampaignDagView({
    graph: preview.plan.dependencyGraph,
    pins: preview.plan.scenarioPins,
    startable
  });
  const pinByKey = new Map(
    preview.plan.scenarioPins.map(
      (pin) => [campaignPinStepKey(pin), pin] as const
    )
  );
  const cleanupLabel =
    preview.cleanup.length === 0
      ? "cleanup not recorded"
      : preview.cleanup.map((step) => `cleanup ${step.status}`).join(" · ");
  return (
    <li
      data-testid={`bas-campaign-plan-${preview.plan.compiledDigest}`}
      className="flex flex-wrap items-start gap-3 border-t border-line px-4 py-4 first:border-t-0"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge
            tone={startable ? "validated" : "inconclusive"}
            variant="outline"
            dot={false}
          >
            {startable ? "startable" : "not startable"}
          </StateBadge>
          <StateBadge
            tone={policyTone(preview.policyOutcome)}
            variant="outline"
            dot={false}
          >
            {preview.policyOutcome}
          </StateBadge>
          {preview.dispatchPrevented ? (
            <StateBadge tone="blocked" variant="outline" dot={false}>
              dispatch prevented
            </StateBadge>
          ) : null}
        </div>
        <p className="mt-2 break-all font-mono text-[11px] text-ink">
          {preview.plan.compiledDigest}
        </p>
        <CampaignCompiledDag dag={dag} pinByKey={pinByKey} />
        <p className="mt-1 text-[11px] leading-5 text-muted">
          {preview.policyRationale}
        </p>
        {preview.denyReason ? (
          <p className="mt-1 text-[11px] leading-5 text-missed">
            {preview.denyReason}
          </p>
        ) : null}
        <p className="mt-1 font-mono text-[10px] text-subtle">
          jobs queued {preview.jobsQueued} · {cleanupLabel}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !startable}
          onClick={onStart}
          className={buttonClassName({ size: "sm", variant: "primary" })}
        >
          Start campaign
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onStop}
          className={buttonClassName({ size: "sm", variant: "ghost" })}
        >
          Stop campaign
        </button>
      </div>
    </li>
  );
}

function CampaignCompiledDag({
  dag,
  pinByKey
}: {
  dag: ReturnType<typeof presentCampaignDagView>;
  pinByKey: ReadonlyMap<
    string,
    BasCampaignPreview["plan"]["scenarioPins"][number]
  >;
}) {
  return (
    <section
      aria-label="Compiled campaign DAG"
      data-testid="bas-campaign-dag"
      className="mt-3"
    >
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
        Compiled DAG
      </p>
      <p className="mt-1 text-[11px] leading-5 text-muted">{dag.honesty}</p>
      <ol
        aria-label="Campaign execution order"
        data-testid="bas-campaign-execution-order"
        className="mt-2 divide-y divide-line rounded-control border border-line border-l-2 border-l-brand/45"
      >
        {dag.steps.map((step) => {
          const pin = pinByKey.get(step.stepKey);
          return (
            <li
              key={step.stepKey}
              data-testid={`bas-campaign-pin-${step.stepKey}`}
              className="flex flex-wrap items-start gap-3 px-3 py-2"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle">
                {String(step.index).padStart(2, "0")}
              </p>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-ink">
                    {step.stepKey}
                  </span>
                  <StateBadge
                    tone={dagStepTone(step.label)}
                    variant="outline"
                    dot={false}
                  >
                    {step.label}
                  </StateBadge>
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-subtle">
                  {pin?.provider ?? "unknown"} · {step.upstreamId}
                </p>
                {step.dependsOn.length > 0 ? (
                  <p className="mt-0.5 text-[10px] text-muted">
                    depends on {step.dependsOn.join(" · ")}
                  </p>
                ) : null}
                <p className="mt-0.5 font-mono text-[11px] text-ink">
                  {formatTypedInputs(pin?.typedInputs ?? {})}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {dag.edges.length > 0 ? (
        <>
          <p className="mt-2 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
            Edges
          </p>
          <ul
            aria-label="Campaign DAG edges"
            data-testid="bas-campaign-dag-edges"
            className="mt-1 space-y-1 font-mono text-[11px] text-ink"
          >
            {dag.edges.map((edge) => (
              <li
                key={`${edge.from}->${edge.to}`}
                data-testid={edge.id}
              >
                {edge.label}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function MissionRow({ mission }: { mission: ValidationMission }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 first:border-t-0">
      <div className="min-w-0">
        <Link
          href={`/missions/${mission.missionId}`}
          className="font-mono text-sm text-brand hover:text-brand-2"
        >
          mission·{shortId(mission.missionId)}
        </Link>
        <p className="mt-0.5 text-[11px] text-muted">
          {mission.safetyLevel} · {mission.status}
        </p>
      </div>
      <StateBadge tone="neutral" dot={false}>
        {mission.status}
      </StateBadge>
    </li>
  );
}

function ContentVersionList({
  items
}: {
  items: readonly BasContentVersionSummary[];
}) {
  return (
    <ul className="divide-y divide-line" aria-label="Registered BAS content">
      {items.map((item) => (
        <li key={item.basContentVersionId} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <StateBadge tone="inconclusive" variant="outline" dot={false}>
              {item.executable ? "executable" : "not executable"}
            </StateBadge>
            <span className="font-mono text-[11px] text-ink">
              {item.provider} · {item.sourcePath}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            {item.scenarioCount} scenarios · revision {item.sourceRevision} ·
            authoring metadata only
          </p>
        </li>
      ))}
    </ul>
  );
}

function ScenarioRow({ scenario }: { scenario: BasControlPlaneScenario }) {
  const liveDenied = scenario.claimClass === "qualification_required";
  return (
    <li
      data-testid={`bas-scenario-${scenario.scenarioId}`}
      className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{scenario.title}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-muted">
          {scenario.description}
        </p>
        <p className="mt-1 font-mono text-[10px] text-subtle">
          {scenario.scenarioId} · {scenario.claimClass}
        </p>
      </div>
      <StateBadge
        tone={scenario.startable ? "validated" : "inconclusive"}
        variant="outline"
        dot={false}
      >
        {liveDenied
          ? "qualification required"
          : scenario.startable
            ? "benign marker"
            : "not startable"}
      </StateBadge>
    </li>
  );
}
