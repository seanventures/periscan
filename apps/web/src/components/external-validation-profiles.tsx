"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { ModuleManifest } from "@periscan/modules";
import type { ExternalValidationTemplateProfileMetadata } from "@periscan/policy";
import type {
  AttackPathAssessment,
  EvidenceArtifact,
  PolicyDecision,
  RemediationTask,
  Scope,
  ValidationMission,
  ValidationRun
} from "@periscan/shared";

import {
  browserPeriscanApiClient as api,
  PeriscanApiClientError
} from "../lib/periscan-api-client";
import {
  Button,
  ErrorState,
  Panel,
  PanelHeader,
  PartialLoadBanner,
  SafetyLevelBadge,
  StateBadge,
  ValidationStateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import { StatusPanel } from "./status-panel";
import { ValidationMissionActivity } from "./validation-mission-activity";

const EXTERNAL_MODULE_ID = "nuclei.external_exposure_safe";
const TERMINAL_MISSION_STATUSES = new Set([
  "Completed",
  "Failed",
  "DeniedByPolicy",
  "Cancelled"
]);
const ACTIVE_MISSION_STATUSES = new Set([
  "Draft",
  "Queued",
  "Running",
  "RequiresApproval"
]);
const FIELD_CLASS =
  "h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60";

type LoadStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface WorkspaceData {
  attackPaths: AttackPathAssessment[];
  evidence: EvidenceArtifact[];
  missions: ValidationMission[];
  modules: ModuleManifest[];
  profiles: ExternalValidationTemplateProfileMetadata[];
  remediations: RemediationTask[];
  scopes: Scope[];
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizeHostname(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]!
    .replace(/\.+$/, "");
}

function targetMatchesScope(scope: Scope | undefined, hostname: string) {
  if (!scope || scope.verificationStatus !== "Verified") return false;
  if (scope.scopeType !== "Domain" && scope.scopeType !== "Subdomain") {
    return false;
  }
  const target = normalizeHostname(hostname);
  const value = normalizeHostname(scope.value);
  return scope.scopeType === "Domain"
    ? target === value || target.endsWith(`.${value}`)
    : target === value;
}

function missionTone(mission: ValidationMission | null): StateTone {
  if (!mission) return "neutral";
  if (mission.status === "Completed") return "fixed";
  if (mission.status === "Running") return "validated";
  if (mission.status === "Queued") return "brand";
  if (mission.status === "RequiresApproval") return "approval";
  if (mission.status === "DeniedByPolicy" || mission.status === "Failed") {
    return "missed";
  }
  return "neutral";
}

export function externalValidationState(
  mission: ValidationMission | null,
  runs: ValidationRun[]
) {
  if (!mission) return "Draft";
  const timedOut = runs.some(
    (run) =>
      run.status === "Failed" &&
      /\b(time[ -]?out|timed out|deadline)\b/iu.test(run.errorSummary ?? "")
  );
  if (timedOut) return "Timed out";
  if (mission.status === "DeniedByPolicy") return "Denied";
  return mission.status;
}

function compactId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function ExternalValidationProfiles() {
  const [workspace, setWorkspace] = useState<WorkspaceData>({
    attackPaths: [],
    evidence: [],
    missions: [],
    modules: [],
    profiles: [],
    remediations: [],
    scopes: []
  });
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Supporting rails that soft-failed — never present empty as "no data". */
  const [degradedRails, setDegradedRails] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("safe-baseline");
  const [targetHostname, setTargetHostname] = useState("");
  const [policyDecision, setPolicyDecision] = useState<PolicyDecision | null>(
    null
  );
  const [activeMission, setActiveMission] = useState<ValidationMission | null>(
    null
  );
  const [activeRuns, setActiveRuns] = useState<ValidationRun[]>([]);
  const [preflighting, setPreflighting] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingRemediation, setCreatingRemediation] = useState(false);

  const externalScopes = useMemo(
    () =>
      workspace.scopes.filter(
        (scope) =>
          scope.scopeType === "Domain" || scope.scopeType === "Subdomain"
      ),
    [workspace.scopes]
  );
  const selectedScope = externalScopes.find(
    (scope) => scope.scopeId === selectedScopeId
  );
  const selectedProfile =
    workspace.profiles.find(
      (profile) => profile.profile === selectedProfileId
    ) ?? workspace.profiles[0];
  const externalModule = workspace.modules.find(
    (module) => module.moduleId === EXTERNAL_MODULE_ID
  );
  const externalMissions = workspace.missions.filter(
    (mission) => mission.missionType === "ExposureValidation"
  );
  const activeEvidenceIds = useMemo(
    () =>
      new Set([
        ...(activeMission?.evidenceIds ?? []),
        ...activeRuns.flatMap((run) => run.evidenceIds)
      ]),
    [activeMission, activeRuns]
  );
  const activeEvidence = workspace.evidence.filter((item) =>
    activeEvidenceIds.has(item.evidenceId)
  );
  const correlatedPath = workspace.attackPaths.find((assessment) =>
    assessment.attackPath.evidenceIds.some((evidenceId) =>
      activeEvidenceIds.has(evidenceId)
    )
  );
  const correlatedRemediation = workspace.remediations.find(
    (remediation) =>
      remediation.relatedPathId === correlatedPath?.attackPath.pathId
  );
  const currentState = externalValidationState(activeMission, activeRuns);
  const targetAuthorized = targetMatchesScope(selectedScope, targetHostname);
  const canLaunch =
    Boolean(policyDecision) &&
    policyDecision?.outcome === "Allowed" &&
    (policyDecision.approvalState === "NotRequired" ||
      policyDecision.approvalState === "Approved") &&
    Boolean(externalModule) &&
    targetAuthorized;

  useEffect(() => {
    let active = true;

    void loadWorkspace().catch((error: unknown) => {
      if (!active) return;
      if (error instanceof PeriscanApiClientError && error.status === 401) {
        setLoadStatus("unauthenticated");
        return;
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the external validation workbench."
      );
      setLoadStatus("error");
    });

    async function loadWorkspace() {
      setLoadStatus("loading");
      await api.getMe();
      // Primary rails fail hard; supporting Prove rails soft-fail with an
      // honest degraded banner so empty ≠ broken (panel silent-empty finding).
      const [
        scopes,
        profiles,
        modules,
        attempts,
        evidenceResult,
        attackPathsResult,
        remediationsResult
      ] = await Promise.all([
        api.listScopes(),
        api.listExternalValidationProfiles(),
        api.listModules(),
        api.listExternalValidationAttempts(),
        api.listEvidence().then(
          (value) => ({ ok: true as const, value }),
          () => ({ ok: false as const, value: [] as EvidenceArtifact[] })
        ),
        api.listAttackPaths().then(
          (value) => ({ ok: true as const, value }),
          () => ({ ok: false as const, value: [] as AttackPathAssessment[] })
        ),
        api.listRemediations().then(
          (value) => ({ ok: true as const, value }),
          () => ({ ok: false as const, value: [] as RemediationTask[] })
        )
      ]);
      if (!active) return;
      const missions = attempts.map((attempt) => attempt.mission);
      const degraded: string[] = [];
      if (!evidenceResult.ok) degraded.push("Evidence");
      if (!attackPathsResult.ok) degraded.push("Attack paths");
      if (!remediationsResult.ok) degraded.push("Remediation");
      setDegradedRails(degraded);

      const compatibleScopes = scopes.filter(
        (scope) =>
          scope.scopeType === "Domain" || scope.scopeType === "Subdomain"
      );
      const preferredScope =
        compatibleScopes.find(
          (scope) => scope.verificationStatus === "Verified"
        ) ?? compatibleScopes[0];
      const preferredProfile =
        profiles.find(
          (profile) =>
            profile.profile === preferredScope?.externalValidationProfileId
        ) ?? profiles[0];

      setWorkspace({
        attackPaths: attackPathsResult.value,
        evidence: evidenceResult.value,
        missions,
        modules,
        profiles,
        remediations: remediationsResult.value,
        scopes
      });
      if (preferredScope) {
        setSelectedScopeId(preferredScope.scopeId);
        setTargetHostname(preferredScope.value);
      }
      if (preferredProfile) {
        setSelectedProfileId(preferredProfile.profile);
      }
      setLoadStatus("authenticated");

      const latest = attempts[0];
      if (latest) {
        if (active) {
          setActiveMission(latest.mission);
          setActiveRuns(latest.runs);
        }
      }
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeMission || !ACTIVE_MISSION_STATUSES.has(activeMission.status)) {
      return;
    }
    let active = true;
    const timer = window.setInterval(() => {
      setRefreshing(true);
      void Promise.all([
        api.getMission(activeMission.missionId),
        api.listMissionRuns(activeMission.missionId)
      ])
        .then(([mission, runs]) => {
          if (!active) return;
          setActiveMission(mission);
          setActiveRuns(runs);
          setWorkspace((current) => ({
            ...current,
            missions: [
              mission,
              ...current.missions.filter(
                (item) => item.missionId !== mission.missionId
              )
            ]
          }));
          if (TERMINAL_MISSION_STATUSES.has(mission.status)) {
            void refreshSupportingRecords();
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setActionError(
              error instanceof Error
                ? error.message
                : "Live mission refresh failed."
            );
          }
        })
        .finally(() => {
          if (active) setRefreshing(false);
        });
    }, 2_500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeMission?.missionId, activeMission?.status]);

  function invalidatePreflight() {
    setPolicyDecision(null);
    setActionError(null);
  }

  function chooseScope(scopeId: string) {
    const scope = externalScopes.find((item) => item.scopeId === scopeId);
    setSelectedScopeId(scopeId);
    setTargetHostname(scope?.value ?? "");
    const profile = workspace.profiles.find(
      (item) => item.profile === scope?.externalValidationProfileId
    );
    if (profile) setSelectedProfileId(profile.profile);
    invalidatePreflight();
  }

  async function runPreflight() {
    if (!selectedScope || !selectedProfile) return;
    if (selectedScope.verificationStatus !== "Verified") {
      setActionError(
        "Verify this domain or subdomain scope before requesting authorization."
      );
      return;
    }
    if (!targetAuthorized) {
      setActionError(
        "The target must be the verified subdomain or a hostname inside the selected verified domain."
      );
      return;
    }

    setPreflighting(true);
    setActionError(null);
    try {
      const decision = await api.previewPolicyDecision(selectedScope.scopeId, {
        executionEnvironment: "ExternalPoA",
        missionType: "ExposureValidation",
        requestedAction: {
          credentialTheft: false,
          destructive: false,
          persistence: false,
          realDataExfiltration: false,
          uncontrolledExploitChaining: false
        },
        safetyLevel: "ActiveNonInvasive",
        target: {
          hostname: normalizeHostname(targetHostname),
          rateLimit: selectedProfile.defaultRateLimit,
          templateProfile: selectedProfile.profile
        }
      });
      setPolicyDecision(decision);
    } catch (error) {
      setPolicyDecision(null);
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to complete policy preflight."
      );
    } finally {
      setPreflighting(false);
    }
  }

  async function launchValidation() {
    if (!selectedScope || !selectedProfile || !policyDecision) return;
    setLaunching(true);
    setActionError(null);
    try {
      const target = {
        hostname: normalizeHostname(targetHostname),
        rateLimit: selectedProfile.defaultRateLimit,
        templateProfile: selectedProfile.profile
      };
      const mission = await api.createMission({
        missionType: "ExposureValidation",
        policyDecisionId: policyDecision.policyDecisionId,
        safetyLevel: "ActiveNonInvasive",
        scopeId: selectedScope.scopeId
      });
      setActiveMission(mission);
      setActiveRuns([]);
      const result = await api.startMission(mission.missionId, {
        moduleIds: [EXTERNAL_MODULE_ID],
        target
      });
      setActiveMission(result.mission);
      setActiveRuns(result.runs);
      setWorkspace((current) => ({
        ...current,
        missions: [
          result.mission,
          ...current.missions.filter(
            (item) => item.missionId !== result.mission.missionId
          )
        ]
      }));
      if (result.jobsQueued === 0) {
        setActionError(
          result.mission.status === "DeniedByPolicy"
            ? "The final launch gate denied this attempt. No work was queued; inspect the persisted decision and audit trail."
            : "No validation job was queued. Review the mission state before trying again."
        );
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to launch external validation."
      );
    } finally {
      setLaunching(false);
    }
  }

  async function openMission(missionId: string) {
    setRefreshing(true);
    setActionError(null);
    try {
      const [mission, runs] = await Promise.all([
        api.getMission(missionId),
        api.listMissionRuns(missionId)
      ]);
      setActiveMission(mission);
      setActiveRuns(runs);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to load the selected validation attempt."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshSupportingRecords() {
    const [evidenceResult, attackPathsResult, remediationsResult] =
      await Promise.all([
        api.listEvidence().then(
          (value) => ({ ok: true as const, value }),
          () => ({ ok: false as const, value: workspace.evidence })
        ),
        api.listAttackPaths().then(
          (value) => ({ ok: true as const, value }),
          () => ({ ok: false as const, value: workspace.attackPaths })
        ),
        api.listRemediations().then(
          (value) => ({ ok: true as const, value }),
          () => ({ ok: false as const, value: workspace.remediations })
        )
      ]);
    const degraded: string[] = [];
    if (!evidenceResult.ok) degraded.push("Evidence");
    if (!attackPathsResult.ok) degraded.push("Attack paths");
    if (!remediationsResult.ok) degraded.push("Remediation");
    setDegradedRails(degraded);
    setWorkspace((current) => ({
      ...current,
      attackPaths: attackPathsResult.value,
      evidence: evidenceResult.value,
      remediations: remediationsResult.value
    }));
  }

  async function createCorrelatedRemediation() {
    if (!correlatedPath) return;
    setCreatingRemediation(true);
    setActionError(null);
    try {
      const remediation = await api.createRemediation({
        pathId: correlatedPath.attackPath.pathId
      });
      setWorkspace((current) => ({
        ...current,
        remediations: [
          remediation,
          ...current.remediations.filter(
            (item) => item.remediationId !== remediation.remediationId
          )
        ]
      }));
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to create the correlated remediation task."
      );
    } finally {
      setCreatingRemediation(false);
    }
  }

  function prepareRetest() {
    const latestTarget = activeRuns[0]?.target.hostname;
    if (typeof latestTarget === "string") {
      setTargetHostname(latestTarget);
    }
    const profile = activeRuns[0]?.target.templateProfile;
    if (
      typeof profile === "string" &&
      workspace.profiles.some((item) => item.profile === profile)
    ) {
      setSelectedProfileId(profile);
    }
    setPolicyDecision(null);
    setActionError(null);
    document
      .getElementById("external-validation-setup")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loadStatus === "loading") {
    return (
      <StatusPanel
        body="Reading verified scope, safe profiles, executor capability, and persisted validation activity."
        eyebrow="External validation"
        kind="loading"
        title="Loading the external validation workbench."
      />
    );
  }

  if (loadStatus === "unauthenticated") {
    return (
      <StatusPanel
        body="External validation is available to authenticated tenants. Sign in to use verified scope, policy preflight, and evidence-backed execution."
        eyebrow="External validation"
        kind="info"
        title="Sign in to run external validation."
      />
    );
  }

  if (loadStatus === "error") {
    return (
      <ErrorState
        message={errorMessage ?? "External validation is unavailable."}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {degradedRails.length > 0 ? (
        <PartialLoadBanner
          rails={degradedRails}
          detail="Empty Prove stages below are degraded, not proof that no evidence or paths exist. Primary authorize / policy / launch controls still use live data."
        />
      ) : null}
      <section
        aria-label="External validation state"
        className="grid overflow-hidden rounded-card border border-line bg-surface md:grid-cols-4"
      >
        <Stage
          detail={
            selectedScope?.verificationStatus === "Verified"
              ? selectedScope.value
              : "Verified scope required"
          }
          label="1 · Authorize"
          state={selectedScope?.verificationStatus ?? "Not selected"}
          tone={
            selectedScope?.verificationStatus === "Verified"
              ? "validated"
              : "approval"
          }
        />
        <Stage
          detail={
            policyDecision
              ? compactId(policyDecision.policyDecisionId)
              : "Run target-bound preflight"
          }
          label="2 · Policy"
          state={policyDecision?.outcome ?? "Not checked"}
          tone={
            policyDecision?.outcome === "Allowed"
              ? "validated"
              : policyDecision
                ? "missed"
                : "neutral"
          }
        />
        <Stage
          active={ACTIVE_MISSION_STATUSES.has(activeMission?.status ?? "")}
          detail={
            activeMission
              ? compactId(activeMission.missionId)
              : "Bounded external point of presence"
          }
          label="3 · Execute"
          state={currentState}
          tone={missionTone(activeMission)}
        />
        <Stage
          detail={
            activeEvidenceIds.size
              ? `${activeEvidenceIds.size} linked receipt${activeEvidenceIds.size === 1 ? "" : "s"}`
              : "Waiting for normalized evidence"
          }
          label="4 · Prove"
          state={
            correlatedRemediation
              ? "Remediation linked"
              : activeEvidenceIds.size
                ? "Evidence retained"
                : "Pending"
          }
          tone={
            correlatedRemediation
              ? "fixed"
              : activeEvidenceIds.size
                ? "validated"
                : "neutral"
          }
        />
      </section>

      {actionError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-missed/50 bg-missed/5 px-4 py-3 text-sm text-missed"
        >
          <span>{actionError}</span>
          <button
            className="font-semibold underline underline-offset-2"
            onClick={() => setActionError(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.75fr)]">
        <Panel id="external-validation-setup">
          <PanelHeader
            title="Plan an authorized observation"
            actions={<SafetyLevelBadge level="ActiveNonInvasive" dot={false} />}
          />
          <div className="divide-y divide-line">
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-ink">
                  Verified scope
                </span>
                <select
                  aria-label="Verified scope"
                  className={FIELD_CLASS}
                  onChange={(event) => chooseScope(event.target.value)}
                  value={selectedScopeId}
                >
                  <option value="">Select a domain or subdomain</option>
                  {externalScopes.map((scope) => (
                    <option key={scope.scopeId} value={scope.scopeId}>
                      {scope.value} · {scope.verificationStatus}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-ink">
                  Target hostname
                </span>
                <input
                  aria-describedby="target-boundary-help"
                  className={cn(
                    FIELD_CLASS,
                    targetHostname && !targetAuthorized
                      ? "border-missed focus:border-missed"
                      : ""
                  )}
                  onChange={(event) => {
                    setTargetHostname(event.target.value);
                    invalidatePreflight();
                  }}
                  placeholder="app.example.com"
                  spellCheck={false}
                  value={targetHostname}
                />
              </label>
            </div>

            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-ink">
                    Safe observation profile
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    Profiles are server-owned allowlists, not arbitrary scanner
                    arguments.
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                  GET-only · no payloads · rate limited
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {workspace.profiles.map((profile) => {
                  const selected = selectedProfileId === profile.profile;
                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        "rounded-control border p-3 text-left transition",
                        selected
                          ? "border-brand bg-brand/8 shadow-[0_0_18px_rgba(60,150,255,0.12)]"
                          : "border-line bg-bg/30 hover:border-brand/60"
                      )}
                      key={profile.profile}
                      onClick={() => {
                        setSelectedProfileId(profile.profile);
                        invalidatePreflight();
                      }}
                      type="button"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-ink">
                          {profile.displayName}
                        </span>
                        <span className="font-mono text-[10px] text-subtle">
                          {profile.defaultRateLimit}/min · max{" "}
                          {profile.maxRequestsPerTarget}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted">
                        {profile.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge
                    tone={externalModule ? "validated" : "missed"}
                    dot
                  >
                    {externalModule ? "Executor ready" : "Module unavailable"}
                  </StateBadge>
                  <span className="font-mono text-[11px] text-subtle">
                    External PoP · {EXTERNAL_MODULE_ID}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  Periscan dispatches this profile to its bounded external point
                  of presence. Internal runners are deliberately ineligible for
                  this module. Safe observations only (GET allowlist)—not a full
                  external ASV scan, crawl, auth fuzz, or pentest.
                </p>
                {externalModule ? (
                  <p className="mt-1 font-mono text-[10px] text-subtle">
                    {externalModule.timeoutSeconds}s timeout ·{" "}
                    {externalModule.resourceLimits.maxNetworkRequests} request
                    ceiling · normalized output only
                  </p>
                ) : null}
              </div>
              <Button
                disabled={
                  !selectedScope ||
                  !selectedProfile ||
                  !targetAuthorized ||
                  !externalModule
                }
                loading={preflighting}
                onClick={runPreflight}
                variant="secondary"
              >
                Run policy preflight
              </Button>
            </div>

            <div className="grid gap-4 bg-bg/35 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-subtle">
                  Persisted authorization
                </p>
                {policyDecision ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StateBadge
                        tone={
                          policyDecision.outcome === "Allowed"
                            ? "validated"
                            : policyDecision.outcome === "RequiresApproval"
                              ? "approval"
                              : "missed"
                        }
                      >
                        {policyDecision.outcome}
                      </StateBadge>
                      <span className="font-mono text-[11px] text-ink">
                        {policyDecision.policyDecisionId}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {policyDecision.rationale}
                    </p>
                    <p className="mt-1 text-xs text-subtle">
                      Approval {policyDecision.approvalState.toLowerCase()} ·
                      expires {formatTimestamp(policyDecision.expiresAt)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    Preflight binds scope, hostname, profile, safety level, and
                    external execution environment into one decision. The final
                    launch gate rechecks target, rate, tool, and kill-switch
                    state before any job can queue.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {policyDecision?.outcome === "RequiresApproval" ? (
                  <Link
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                    href="/policies?approvalState=Pending"
                  >
                    Review approval
                  </Link>
                ) : null}
                <Button
                  disabled={!canLaunch}
                  loading={launching}
                  onClick={launchValidation}
                >
                  Launch safe validation
                </Button>
              </div>
            </div>
          </div>
        </Panel>

        <aside className="flex flex-col gap-5">
          <Panel>
            <PanelHeader title="Authorization receipt" />
            {selectedScope ? (
              <dl className="divide-y divide-line text-sm">
                <ReceiptRow
                  label="Scope"
                  value={`${selectedScope.scopeType} · ${selectedScope.value}`}
                />
                <ReceiptRow
                  label="Verification"
                  value={selectedScope.verificationStatus}
                />
                <ReceiptRow
                  label="Verified at"
                  value={formatTimestamp(selectedScope.verifiedAt)}
                />
                <ReceiptRow
                  label="Method"
                  value={selectedScope.verificationMethod ?? "Not recorded"}
                />
                <ReceiptRow
                  label="Freshness"
                  value={
                    selectedScope.verificationStale
                      ? "Re-confirmation overdue"
                      : "Within verification window"
                  }
                />
                <ReceiptRow
                  label="Boundary check"
                  value={
                    targetAuthorized
                      ? "Target inside verified scope"
                      : "Target not authorized"
                  }
                />
              </dl>
            ) : (
              <p className="p-4 text-sm text-muted">
                No compatible domain or subdomain scope exists yet.
              </p>
            )}
            <div
              className="border-t border-line bg-bg/30 p-4 text-xs leading-5 text-subtle"
              id="target-boundary-help"
            >
              Domain scope permits the exact domain and its descendants.
              Subdomain scope permits only the exact hostname. Verification is
              authorization evidence, not evidence that a security control
              worked.
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line p-3">
              <Link
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
                href="/missions"
              >
                Manage scopes
              </Link>
              <Link
                className={buttonClassName({
                  size: "sm",
                  variant: "ghost"
                })}
                href="/runners"
              >
                Runner fleet
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Recent attempts" />
            {externalMissions.length ? (
              <ol className="max-h-[330px] overflow-y-auto">
                {externalMissions.slice(0, 8).map((mission) => (
                  <li
                    className="border-b border-line last:border-b-0"
                    key={mission.missionId}
                  >
                    <button
                      className={cn(
                        "w-full px-4 py-3 text-left transition hover:bg-brand/5",
                        activeMission?.missionId === mission.missionId
                          ? "bg-brand/8"
                          : ""
                      )}
                      onClick={() => void openMission(mission.missionId)}
                      type="button"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <StateBadge dot={false} tone={missionTone(mission)}>
                          {mission.status}
                        </StateBadge>
                        <time className="font-mono text-[10px] text-subtle">
                          {formatTimestamp(mission.createdAt)}
                        </time>
                      </span>
                      <span className="mt-1 block font-mono text-[11px] text-muted">
                        {compactId(mission.missionId)}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="p-4 text-sm text-muted">
                No external validation attempts are recorded yet.
              </p>
            )}
          </Panel>
        </aside>
      </div>

      {activeMission ? (
        <>
          <ValidationMissionActivity
            auditEvents={[]}
            mission={activeMission}
            refreshing={refreshing}
            runs={activeRuns}
          />

          <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel>
              <PanelHeader
                title={`Normalized results · ${currentState}`}
                actions={
                  <Link
                    className={buttonClassName({
                      size: "sm",
                      variant: "ghost"
                    })}
                    href={`/missions/${activeMission.missionId}`}
                  >
                    Full mission
                  </Link>
                }
              />
              {activeRuns.length ? (
                <ul>
                  {activeRuns.map((run) => (
                    <li
                      className="border-b border-line p-4 last:border-b-0"
                      key={run.runId}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <StateBadge
                          tone={
                            run.status === "Completed"
                              ? "fixed"
                              : run.status === "Failed" ||
                                  run.status === "DeniedByPolicy"
                                ? "missed"
                                : "brand"
                          }
                        >
                          {externalValidationState(activeMission, [run])}
                        </StateBadge>
                        {run.validationState ? (
                          <ValidationStateBadge
                            dot={false}
                            state={run.validationState}
                          />
                        ) : null}
                        <span className="font-mono text-[11px] text-subtle">
                          {run.moduleId}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {run.outcome ??
                          run.errorSummary ??
                          "Waiting for a normalized outcome."}
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                        <ResultMetric
                          label="Executor"
                          value={
                            run.runnerId
                              ? `Runner ${compactId(run.runnerId)}`
                              : "External PoP"
                          }
                        />
                        <ResultMetric
                          label="Target"
                          value={
                            typeof run.target.hostname === "string"
                              ? run.target.hostname
                              : "Not recorded"
                          }
                        />
                        <ResultMetric
                          label="Receipts"
                          value={String(run.evidenceIds.length)}
                        />
                        <ResultMetric
                          label="Completed"
                          value={formatTimestamp(run.completedAt)}
                        />
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-4 text-sm text-muted">
                  {activeMission.status === "DeniedByPolicy"
                    ? "The launch gate denied the attempt before queueing, so no run exists."
                    : "The mission has no module run yet."}
                </p>
              )}
              {TERMINAL_MISSION_STATUSES.has(activeMission.status) ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg/30 p-4">
                  <p className="text-xs text-subtle">
                    A re-test creates a new target-bound policy decision and
                    preserves this attempt as prior evidence.
                  </p>
                  <Button onClick={prepareRetest} size="sm" variant="secondary">
                    Prepare fresh re-test
                  </Button>
                </div>
              ) : null}
            </Panel>

            <Panel>
              <PanelHeader title="Evidence & remediation inspector" />
              {activeEvidence.length ? (
                <ul>
                  {activeEvidence.map((evidence) => (
                    <li
                      className="border-b border-line p-4 last:border-b-0"
                      key={evidence.evidenceId}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StateBadge tone="validated" dot={false}>
                          {evidence.artifactType}
                        </StateBadge>
                        <time className="font-mono text-[10px] text-subtle">
                          {formatTimestamp(evidence.createdAt)}
                        </time>
                      </div>
                      <p className="mt-2 font-mono text-[11px] text-muted">
                        {compactId(evidence.evidenceId)} · SHA-256{" "}
                        {evidence.sha256.slice(0, 12)}…
                      </p>
                      <p className="mt-1 text-xs text-subtle">
                        {evidence.redactionStatus} · {evidence.sensitivityLevel}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-4 text-sm text-muted">
                  {activeEvidenceIds.size
                    ? "Linked receipt IDs exist, but their tenant-scoped metadata is not currently available."
                    : "No evidence receipt is linked to this attempt yet."}
                </p>
              )}
              <div className="border-t border-line bg-bg/30 p-4">
                {correlatedRemediation ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <StateBadge tone="fixed">
                        {correlatedRemediation.status}
                      </StateBadge>
                      <p className="mt-2 text-sm text-muted">
                        {correlatedRemediation.recommendedAction}
                      </p>
                    </div>
                    <Link
                      className={buttonClassName({
                        size: "sm",
                        variant: "secondary"
                      })}
                      href={`/remediation/${correlatedRemediation.remediationId}`}
                    >
                      Open remediation
                    </Link>
                  </div>
                ) : correlatedPath ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        Correlated path: {correlatedPath.attackPath.name}
                      </p>
                      <p className="mt-1 text-xs text-subtle">
                        Create a governed fix task from the evidence-linked
                        path.
                      </p>
                    </div>
                    <Button
                      loading={creatingRemediation}
                      onClick={createCorrelatedRemediation}
                      size="sm"
                    >
                      Create remediation
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      No evidence-linked path yet
                    </p>
                    <p className="mt-1 text-xs leading-5 text-subtle">
                      Periscan will not invent a remediation from an
                      uncorrelated scanner result. Review normalized findings
                      and measured paths first.
                    </p>
                    <Link
                      className="mt-2 inline-flex text-xs font-semibold text-brand hover:text-brand-2"
                      href="/findings"
                    >
                      Review findings →
                    </Link>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stage({
  active = false,
  detail,
  label,
  state,
  tone
}: {
  active?: boolean;
  detail: string;
  label: string;
  state: string;
  tone: StateTone;
}) {
  return (
    <div className="relative border-b border-line px-4 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      {active ? (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px animate-pulse bg-fixed shadow-[0_0_10px_currentColor]"
        />
      ) : null}
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">
        {label}
      </p>
      <StateBadge className="mt-2" tone={tone}>
        {state}
      </StateBadge>
      <p className="mt-1 truncate text-xs text-muted" title={detail}>
        {detail}
      </p>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 px-4 py-3">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="text-right text-xs font-medium text-ink">{value}</dd>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-subtle">{label}</dt>
      <dd className="mt-1 break-words font-medium text-ink">{value}</dd>
    </div>
  );
}
