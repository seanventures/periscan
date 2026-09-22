"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  Scope,
  ValidationMission,
  ValidationStimulus
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
import {
  correlationTone,
  presentStimulusCorrelation
} from "./bas-operator-workspace";

const AUTHORIZED_SAFETY = new Set(["BASLite", "AdvancedAdversarial"]);

function isAuthorizedControlValidationScope(scope: Scope): boolean {
  return (
    scope.verificationStatus === "Verified" &&
    AUTHORIZED_SAFETY.has(scope.effectiveMaxSafetyLevel)
  );
}

function shortId(value: string): string {
  return value.slice(0, 8);
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
  if (stimulus.status === "DeniedByPolicy" || stimulus.status === "Failed") {
    return "missed";
  }
  if (stimulus.status === "Cancelled") return "neutral";
  if (stimulus.status === "Observing" || stimulus.status === "Dispatching") {
    return "approval";
  }
  return "neutral";
}

function canCancel(status: ValidationStimulus["status"]): boolean {
  return ["RequiresApproval", "Ready", "Observing"].includes(status);
}

export function ControlValidationWorkbench() {
  const missions = useApiResource(() => api.listMissions(), []);
  const scopes = useApiResource(() => api.listScopes(), []);
  const sources = useApiResource(() => api.listControlSources(), []);
  const stimuli = useApiResource(() => api.listValidationStimuli(), []);

  const authorizedScopes = useMemo(
    () => (scopes.data ?? []).filter(isAuthorizedControlValidationScope),
    [scopes.data]
  );

  const [scopeId, setScopeId] = useState("");
  const [startedMissions, setStartedMissions] = useState<ValidationMission[]>(
    []
  );
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [busyStimulusId, setBusyStimulusId] = useState<string | null>(null);
  const [stimulusError, setStimulusError] = useState<string | null>(null);

  const selectedScopeId = scopeId || authorizedScopes[0]?.scopeId || "";
  const controlMissions = useMemo(() => {
    const fromApi = (missions.data ?? []).filter(
      (item) => item.missionType === "ControlValidation"
    );
    const extra = startedMissions.filter(
      (item) => !fromApi.some((mission) => mission.missionId === item.missionId)
    );
    return [...extra, ...fromApi];
  }, [missions.data, startedMissions]);

  async function startMission() {
    if (!selectedScopeId) return;
    setStarting(true);
    setStartError(null);
    try {
      const created = await api.createMission({
        missionType: "ControlValidation",
        safetyLevel: "BASLite",
        scopeId: selectedScopeId
      });
      setStartedMissions((current) => [created, ...current]);
      await missions.refetch();
    } catch (caught) {
      setStartError(
        caught instanceof Error
          ? caught.message
          : "Unable to start ControlValidation."
      );
    } finally {
      setStarting(false);
    }
  }

  async function act(
    next: ValidationStimulus,
    action: "dispatch" | "observe" | "cancel"
  ) {
    setBusyStimulusId(next.stimulusId);
    setStimulusError(null);
    try {
      if (action === "dispatch") {
        await api.dispatchValidationStimulus(next.stimulusId);
      } else if (action === "observe") {
        await api.observeValidationStimulus(next.stimulusId);
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
    <PageShell data-testid="control-validation-workbench">
      <PageHeader
        eyebrow="Validate"
        title="Control validation"
        description="Start a ControlValidation mission on authorized scope, then dispatch a governed stimulus. This path is a benign canary / marker-only coverage."
        actions={
          <>
            <Link
              href="/bas"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              BAS operator workspace
            </Link>
            <Link
              href="/controls"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Controls coverage
            </Link>
            <Link
              href="/attack-navigator"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              ATT&CK Navigator overlay
            </Link>
          </>
        }
      />

      <div
        role="status"
        data-testid="control-validation-honesty"
        className="rounded-control border border-brand/35 bg-brand/8 px-4 py-3 text-sm text-ink"
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
          benign canary / marker-only coverage
        </p>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">
          drvClaimClass stays{" "}
          <span className="font-mono text-[11px] text-ink">
            benign_marker_only
          </span>
          . Stimuli use one approved canary against verified scope. Additional BAS
          scenarios require qualified adapters and measured receipts. Denied
          tasks are never queued.
        </p>
      </div>

      <Panel aria-labelledby="cv-start-title">
        <PanelHeader titleId="cv-start-title" title="Start ControlValidation" />
        {scopes.loading ? (
          <LoadingSkeleton rows={3} />
        ) : scopes.error ? (
          <ErrorState message={scopes.error} onRetry={scopes.refetch} />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {authorizedScopes.length === 0 ? (
              <NotConfigured
                title="Verify a scope that permits BAS-lite"
                message="ControlValidation only starts on a verified scope whose effective ceiling is BASLite (or AdvancedAdversarial). Unverified scope cannot queue this mission."
                action={{ href: "/scopes", label: "Verify scope" }}
              />
            ) : (
              <label className="flex max-w-md flex-col gap-1 text-xs text-muted">
                Authorized scope
                <select
                  aria-label="Authorized ControlValidation scope"
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
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={starting || !selectedScopeId}
                onClick={() => void startMission()}
                className={buttonClassName({ size: "sm", variant: "primary" })}
              >
                {starting ? "Starting…" : "Start ControlValidation mission"}
              </button>
              <p className="text-[11px] text-subtle">
                Safety BASLite · {(sources.data ?? []).length} control source
                {(sources.data ?? []).length === 1 ? "" : "s"} registered
              </p>
            </div>
            {startError ? <InlineError message={startError} /> : null}
          </div>
        )}
      </Panel>

      <Panel aria-labelledby="cv-missions-title">
        <PanelHeader
          titleId="cv-missions-title"
          title="ControlValidation missions"
        />
        {missions.loading ? (
          <LoadingSkeleton rows={4} />
        ) : missions.error ? (
          <ErrorState message={missions.error} onRetry={missions.refetch} />
        ) : controlMissions.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No ControlValidation missions yet"
              description="Start one on authorized scope. Current coverage is the approved marker class."
            />
          </div>
        ) : (
          <ul>
            {controlMissions.map((item) => (
              <MissionRow key={item.missionId} mission={item} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel aria-labelledby="cv-stimuli-title">
        <PanelHeader titleId="cv-stimuli-title" title="Stimuli" />
        {stimuli.loading ? (
          <LoadingSkeleton rows={4} />
        ) : stimuli.error ? (
          <ErrorState message={stimuli.error} onRetry={stimuli.refetch} />
        ) : (stimuli.data ?? []).length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No stimuli yet"
              description="Dispatch a benign canary after starting a ControlValidation mission on authorized scope. Observation is exact-marker only."
            />
          </div>
        ) : (
          <ol
            className="divide-y divide-line"
            aria-label="Control-validation stimuli"
          >
            {(stimuli.data ?? []).map((item) => {
              const source = (sources.data ?? []).find(
                (candidate) =>
                  candidate.controlSourceId === item.controlSourceId
              );
              const correlated = presentStimulusCorrelation(item, source);
              return (
              <li
                key={item.stimulusId}
                data-testid={`stimulus-${item.stimulusId}`}
                className="flex flex-wrap items-start gap-3 px-4 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StateBadge
                      tone={
                        item.verdict
                          ? correlationTone(correlated.verdict)
                          : stimulusTone(item)
                      }
                      dot={false}
                    >
                      {item.verdict ? correlated.verdict : item.status}
                    </StateBadge>
                    <StateBadge
                      tone={
                        source?.healthStatus === "Healthy"
                          ? "fixed"
                          : source?.healthStatus === "Unhealthy"
                            ? "missed"
                            : "inconclusive"
                      }
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
                    Governed exact-marker stimulus. Dispatch, observe, or cancel
                    through the API client — never live inject.
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] text-subtle">
                    <Link
                      href={`/missions/${item.missionId}`}
                      className="text-brand hover:text-brand-2"
                    >
                      mission·{shortId(item.missionId)}
                    </Link>
                    <span>{item.evidenceIds.length} evidence</span>
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
    </PageShell>
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
