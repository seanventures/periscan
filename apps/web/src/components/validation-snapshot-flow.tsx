"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  communityPolicyPreviewRequest,
  communityScopeAuthorizationHint,
  type CommunityValidationStartResult,
  type CommunityValidationSuiteResponse,
  type ValidationMission,
  type ValidationSnapshot
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  AttackPathClaimBadge,
  EmptyState,
  ErrorState,
  InfoPopover,
  InlineError,
  LoadingSkeleton,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  PolicyGateBadge,
  RiskBandBadge,
  SafetyLevelBadge,
  StateBadge,
  ValidationStateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import { CommunityRunProgress } from "./community-run-progress";
import { ScopeSafetyEditor } from "./scope-safety-editor";
import { ScopeValueHint } from "./scope-value-hint";

import {
  COMMUNITY_VALIDATE_SCOPE_TYPES,
  VALIDATE_EMPTY_SCOPE_COPY,
  buildCommunityAddScopeInput,
  communityAddScopePlaceholder,
  communityScopeAllowsOperatorAttestation,
  communityVerifyFailureCopy,
  communityVerifyScopeRequest,
  communityVerifyTokenHint,
  deferredModuleAction,
  nothingStartableCopy,
  nucleiStartCopy,
  resolveCommunityAddScopeType,
  type CommunityValidateScopeType
} from "./validation-community-status";

export function ValidationSnapshotFlow() {
  const scopes = useApiResource(() => api.listScopes(), []);

  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const suite = useApiResource(
    () =>
      selectedScopeId
        ? api.getCommunityValidationSuite({ scopeId: selectedScopeId })
        : Promise.resolve(null as CommunityValidationSuiteResponse | null),
    [selectedScopeId]
  );
  const [newScopeValue, setNewScopeValue] = useState("");
  const [scopeType, setScopeType] =
    useState<CommunityValidateScopeType>("Domain");
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const [audience, setAudience] = useState<"Executive" | "Technical">(
    "Executive"
  );
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationSnapshot | null>(null);
  const [communityRun, setCommunityRun] =
    useState<CommunityValidationStartResult | null>(null);

  const [policy, setPolicy] = useState<{
    policyDecisionId: string;
    scopeId: string;
    outcome: string;
    approvalState: string;
    rationale: string;
  } | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const allScopes = scopes.data ?? [];
  const selectedScope =
    allScopes.find((s) => s.scopeId === selectedScopeId) ?? null;
  const gateOk = selectedScope?.verificationStatus === "Verified";
  const policyAllowsRun =
    policy?.scopeId === selectedScopeId &&
    (policy.outcome === "Allowed" ||
      (policy.outcome === "RequiresApproval" &&
        policy.approvalState === "Approved"));

  useEffect(() => {
    if (selectedScopeId) return;
    const list = scopes.data;
    if (!list?.length) return;
    const next =
      list.find((scope) => scope.verificationStatus === "Verified") ?? list[0];
    if (!next) return;
    setSelectedScopeId(next.scopeId);
  }, [scopes.data, selectedScopeId]);

  const nucleiOutcome = communityRun ? nucleiStartCopy(communityRun) : null;
  const policyPreview = useMemo(() => {
    if (!selectedScope || !suite.data) {
      return null;
    }
    return communityPolicyPreviewRequest({
      cloudAwsAvailable: suite.data.cloudAwsAvailable,
      includeExternalPoa: suite.data.includeExternalPoa,
      runnerAvailable: suite.data.runnerAvailable,
      scopeType: selectedScope.scopeType
    });
  }, [selectedScope, suite.data]);

  async function addScope() {
    const value = newScopeValue.trim();
    if (!value) return;
    setAdding(true);
    setScopeError(null);
    try {
      const input = buildCommunityAddScopeInput(value, scopeType);
      setScopeType(input.scopeType);
      const scope = await api.createScope(input);
      setNewScopeValue("");
      await scopes.refetch();
      setSelectedScopeId(scope.scopeId);
      setPolicy(null);
      setResult(null);
      setCommunityRun(null);
    } catch (caught) {
      setScopeError(
        caught instanceof Error ? caught.message : "Couldn't add that scope."
      );
    } finally {
      setAdding(false);
    }
  }

  async function verify(operatorAttestation = false) {
    if (!selectedScope) return;
    setVerifying(true);
    setScopeError(null);
    try {
      await api.verifyScope(
        selectedScope.scopeId,
        communityVerifyScopeRequest(operatorAttestation)
      );
      await scopes.refetch();
    } catch (caught) {
      setScopeError(
        caught instanceof Error
          ? caught.message
          : communityVerifyFailureCopy(selectedScope.scopeType)
      );
    } finally {
      setVerifying(false);
    }
  }

  async function run() {
    if (!gateOk || !selectedScope || !policyAllowsRun || !policy) return;
    setRunning(true);
    setRunError(null);
    try {
      const snapshot = await api.createSnapshot({
        audience,
        maxTopItems: 5,
        policyDecisionId: policy.policyDecisionId,
        scopeId: selectedScope.scopeId
      });
      setResult(snapshot);
    } catch (caught) {
      setRunError(
        caught instanceof Error ? caught.message : "The snapshot didn't run."
      );
    } finally {
      setRunning(false);
    }
  }

  async function runCommunitySuite() {
    if (!gateOk || !selectedScope || !policyAllowsRun || !policy) return;
    setRunning(true);
    setRunError(null);
    try {
      const started = await api.startCommunityValidation({
        includeCopyleftOptIn:
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get(
            "includeCopyleftOptIn"
          ) === "1",
        policyDecisionId: policy.policyDecisionId,
        scopeId: selectedScope.scopeId
      });
      setCommunityRun(started);
    } catch (caught) {
      setRunError(
        caught instanceof Error
          ? caught.message
          : "Community validation did not start."
      );
    } finally {
      setRunning(false);
    }
  }

  async function checkPolicy() {
    if (!selectedScope || !policyPreview) return;
    setPolicyBusy(true);
    setPolicyError(null);
    setPolicy(null);
    try {
      const decision = await api.previewPolicyDecision(selectedScope.scopeId, {
        executionEnvironment: policyPreview.executionEnvironment,
        missionType: "ValidationSnapshot",
        safetyLevel: policyPreview.safetyLevel,
        requestedAction: policyPreview.requestedAction,
        target: { value: selectedScope.value }
      });
      setPolicy({
        policyDecisionId: decision.policyDecisionId,
        scopeId: decision.scopeId,
        outcome: decision.outcome,
        approvalState: decision.approvalState,
        rationale: decision.rationale
      });
    } catch (caught) {
      setPolicyError(
        caught instanceof Error ? caught.message : "Policy preview failed."
      );
    } finally {
      setPolicyBusy(false);
    }
  }

  return (
    <PageShell width="narrow">
      <PageHeader
        eyebrow="Authorize → policy → run"
        title="Validate"
        actions={
          <InfoPopover label="public references">
            Public customer references remain 0. This first-run is the
            authorized Community proof loop, not a case study.
          </InfoPopover>
        }
        description={
          <>
            Authorize a verified scope, preview policy, then Run Community
            validation (Gitleaks, Trivy, Grype, first-party DNS/TLS/HTTP, ZAP).
            Recurring AI, control, and fix validation is created from{" "}
            <Link
              href="/schedules"
              className="font-medium text-brand underline underline-offset-2 hover:text-brand-2"
            >
              Schedules
            </Link>
            . Claim language:{" "}
            <Link
              href="/trust-safety"
              className="font-medium text-brand underline underline-offset-2 hover:text-brand-2"
            >
              Trust &amp; Safety
            </Link>
            .
          </>
        }
      />

      <Panel>
        <PanelHeader title={gateOk ? "Authorized scope" : "Authorize scope"} />
        {scopes.loading ? (
          <LoadingSkeleton rows={3} />
        ) : scopes.error ? (
          <ErrorState message={scopes.error} onRetry={scopes.refetch} />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {allScopes.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {allScopes.map((scope) => (
                  <li key={scope.scopeId}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-sm transition-colors",
                        selectedScopeId === scope.scopeId
                          ? "border-brand/60 bg-brand/5"
                          : "border-line hover:border-line-strong"
                      )}
                    >
                      <input
                        type="radio"
                        name="scope"
                        checked={selectedScopeId === scope.scopeId}
                        onChange={() => {
                          setSelectedScopeId(scope.scopeId);
                          setPolicy(null);
                          setResult(null);
                          setCommunityRun(null);
                          setRunError(null);
                        }}
                        className="accent-[color:var(--color-brand)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink">
                          {scope.value}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-subtle">
                          {scope.scopeType} · {scope.assetClass} ·{" "}
                          {scope.sensitivity}
                          {scope.isOperationalTechnology
                            ? " · OT protected"
                            : ""}
                        </span>
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-2">
                        <span className="hidden font-mono text-[10px] text-subtle sm:inline">
                          max {scope.effectiveMaxSafetyLevel}
                        </span>
                        <StateBadge
                          tone={
                            scope.verificationStatus === "Verified"
                              ? "fixed"
                              : scope.verificationStatus === "Rejected"
                                ? "missed"
                                : "approval"
                          }
                          dot={false}
                        >
                          {scope.verificationStatus}
                        </StateBadge>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <div data-testid="validate-empty-scope">
                <EmptyState
                  title="No authorized scopes yet"
                  description={VALIDATE_EMPTY_SCOPE_COPY}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  Type
                  <select
                    aria-label="Scope type"
                    value={scopeType}
                    onChange={(e) =>
                      setScopeType(e.target.value as CommunityValidateScopeType)
                    }
                    className="rounded-control border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                  >
                    {COMMUNITY_VALIDATE_SCOPE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type === "Repository"
                          ? "Repository path"
                          : type === "CloudAccount"
                            ? "AWS account"
                            : type === "IPRange"
                              ? "IP range / CIDR"
                              : type}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  value={newScopeValue}
                  onChange={(e) => {
                    const next = e.target.value;
                    setNewScopeValue(next);
                    setScopeType(resolveCommunityAddScopeType(next, scopeType));
                  }}
                  placeholder={communityAddScopePlaceholder(scopeType)}
                  aria-label="Scope value"
                  className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand md:max-w-xs"
                />
                <button
                  type="button"
                  onClick={() => void addScope()}
                  disabled={adding || !newScopeValue.trim()}
                  className={buttonClassName({
                    size: "sm",
                    variant: allScopes.length === 0 ? "primary" : "secondary"
                  })}
                >
                  {adding ? "Adding…" : "Add scope"}
                </button>
              </div>
              <ScopeValueHint value={newScopeValue} />
            </div>

            {selectedScope ? (
              <details className="rounded-control border border-line bg-surface">
                <summary className="cursor-pointer list-none px-3 py-2 text-[12.5px] font-medium text-muted marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
                  Scope safety envelope
                </summary>
                <div className="border-t border-line p-3">
                  <ScopeSafetyEditor
                    scope={selectedScope}
                    onSaved={async () => {
                      await scopes.refetch();
                      setPolicy(null);
                      setResult(null);
                      setCommunityRun(null);
                    }}
                  />
                </div>
              </details>
            ) : null}

            {/* Verification */}
            {selectedScope && !gateOk ? (
              <div className="rounded-control border border-line bg-surface p-3">
                <p className="text-[13px] text-ink">
                  Prove you control{" "}
                  <span className="font-mono text-brand">
                    {selectedScope.value}
                  </span>
                  .
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  {communityScopeAuthorizationHint(selectedScope.scopeType)}
                </p>
                {selectedScope.verificationToken ? (
                  <p className="mt-1 break-all font-mono text-[11px] text-muted">
                    {selectedScope.verificationMethod ?? "token"}:{" "}
                    {selectedScope.verificationToken}
                    {communityVerifyTokenHint(selectedScope.scopeType)
                      ? ` → ${communityVerifyTokenHint(selectedScope.scopeType)}`
                      : ""}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void verify()}
                    disabled={verifying}
                    className={buttonClassName({
                      size: "sm",
                      variant: "primary"
                    })}
                  >
                    {verifying ? "Checking…" : "Verify scope"}
                  </button>
                  {communityScopeAllowsOperatorAttestation(
                    selectedScope.scopeType
                  ) ? (
                    <button
                      type="button"
                      onClick={() => void verify(true)}
                      disabled={verifying}
                      className={buttonClassName({
                        size: "sm",
                        variant: "secondary"
                      })}
                    >
                      {verifying ? "Attesting…" : "Attest authorization"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {scopeError ? (
              <InlineError
                message={scopeError}
                onDismiss={() => setScopeError(null)}
              />
            ) : null}
          </div>
        )}
      </Panel>

      {selectedScope ? (
        <Panel>
          <PanelHeader
            title={
              <span className="inline-flex items-center gap-2">
                Run Community validation
                <InfoPopover label="policy gate">
                  Preview binds an allow, deny, or approval-required decision to
                  this scope and safety envelope. Changing either requires a new
                  preview; denied work is never queued.
                </InfoPopover>
              </span>
            }
            actions={
              <PolicyGateBadge
                outcome={
                  policy?.outcome ??
                  (gateOk ? "Not evaluated" : "Requires verified scope")
                }
                dot={false}
              />
            }
          />
          <div className="flex flex-col gap-3 p-4">
            <p className="text-[13px] text-muted">
              {gateOk
                ? "Preview policy for this verified scope, then Run Community validation."
                : "Verify this scope above, then preview policy to enable Run Community validation."}
            </p>
            <p className="text-[12px] text-muted">
              <SafetyLevelBadge
                level={policyPreview?.safetyLevel ?? "ActiveNonInvasive"}
                dot={false}
              />
              <span className="ml-2">
                Ceiling {selectedScope.effectiveMaxSafetyLevel} · 1 scope ·
                non-invasive checks
              </span>
            </p>

            {gateOk ? (
              <div className="rounded-control border border-line bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={checkPolicy}
                    disabled={policyBusy || !policyPreview}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    {policyBusy ? "Checking…" : "Preview policy decision"}
                  </button>
                  {policy ? (
                    <>
                      <PolicyGateBadge outcome={policy.outcome} dot={false} />
                      {policy.approvalState !== "NotRequired" ? (
                        <span className="font-mono text-[11px] text-approval">
                          approval {policy.approvalState}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[12px] text-subtle">
                      A current policy decision is required before this run.
                    </span>
                  )}
                </div>
                {policy ? (
                  <p className="mt-1.5 text-[12px] text-muted">
                    {policy.rationale}
                  </p>
                ) : null}
                {policyError ? (
                  <InlineError
                    className="mt-2"
                    message={policyError}
                    onDismiss={() => setPolicyError(null)}
                  />
                ) : null}
              </div>
            ) : null}
            {selectedScope && suite.loading && !suite.data ? (
              <LoadingSkeleton rows={3} className="p-0" />
            ) : null}
            {selectedScope && suite.error ? (
              <ErrorState
                title="Couldn't load Community suite"
                message={suite.error}
                onRetry={suite.refetch}
              />
            ) : null}
            {selectedScope && suite.data ? (
              <div
                data-testid="community-validation-suite"
                className="rounded-control border border-line bg-surface p-3"
              >
                <p className="text-[12px] text-muted">
                  {suite.data.valueLine} {suite.data.startableModuleIds.length}{" "}
                  engine
                  {suite.data.startableModuleIds.length === 1 ? "" : "s"} start
                  now
                  {suite.data.runnerAvailable ? "" : " · runner needed"}
                  {suite.data.cloudAwsAvailable
                    ? ""
                    : " · AWS needed for Prowler"}
                  .
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer list-none text-[12px] font-medium text-muted marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
                    Engines in this run
                  </summary>
                  <p className="mt-1.5 text-[12px] text-muted">
                    Missing binaries:{" "}
                    <Link
                      href="/engines?action=install-community-pack"
                      className="font-medium text-brand hover:text-brand-2"
                    >
                      Install + enable Community pack
                    </Link>
                    . GPL/LGPL extras:{" "}
                    <Link
                      href="/engines?action=add-copyleft-pack"
                      className="font-medium text-brand hover:text-brand-2"
                    >
                      Review licenses & add
                    </Link>
                    .
                  </p>
                  <ul className="mt-2 flex flex-col gap-1 text-[12px] text-ink">
                    {suite.data.modules.map((module) => {
                      const startable = suite.data?.startableModuleIds.includes(
                        module.moduleId
                      );
                      const deferred = suite.data?.deferredModules.find(
                        (row) => row.moduleId === module.moduleId
                      );
                      const laneLabel = startable
                        ? ""
                        : deferred && !deferredModuleAction(deferred.reason)
                          ? " · second mission"
                          : deferred
                            ? " · deferred"
                            : " · waiting";
                      return (
                        <li key={module.moduleId} className="font-mono">
                          {module.title}
                          {laneLabel}
                          {module.toolId ? ` · ${module.toolId}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                </details>
                {suite.data.deferredModules.length > 0 ? (
                  <div
                    data-testid="community-deferred-modules"
                    className="mt-3 border-t border-line pt-2"
                  >
                    <p className="text-[12px] font-semibold text-ink">
                      Deferred engines
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                      {suite.data.deferredModules.map((row) => {
                        const action = deferredModuleAction(row.reason);
                        return (
                          <li
                            key={row.moduleId}
                            className="text-[12px] text-muted"
                          >
                            <span className="font-mono text-ink">
                              {row.title}
                            </span>
                            {" — "}
                            {row.reason}
                            {action ? (
                              <>
                                {" "}
                                <Link
                                  href={action.href}
                                  className="font-medium text-brand hover:text-brand-2"
                                >
                                  {action.label}
                                </Link>
                              </>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {suite.data.startableModuleIds.length === 0 ? (
                  <p
                    data-testid="community-nothing-startable"
                    className="mt-2 text-[12px] text-muted"
                  >
                    {nothingStartableCopy({
                      cloudAwsAvailable: suite.data.cloudAwsAvailable,
                      runnerAvailable: suite.data.runnerAvailable
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={runCommunitySuite}
                disabled={
                  !gateOk ||
                  !policyAllowsRun ||
                  running ||
                  (suite.data?.startableModuleIds.length ?? 0) === 0
                }
                className={buttonClassName({ variant: "primary" })}
                data-testid="run-community-validation"
              >
                {running
                  ? "Starting Community validation…"
                  : "Run Community validation"}
              </button>
            </div>
            <details
              className="rounded-control border border-line bg-surface"
              data-testid="compose-snapshot-report"
            >
              <summary className="cursor-pointer list-none px-3 py-2 text-[12.5px] font-medium text-muted marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
                Optional: compose snapshot report
              </summary>
              <div className="flex flex-col gap-2 border-t border-line px-3 py-3">
                <p className="text-[12px] text-muted">
                  A snapshot report is a separate evidence pack — it does not
                  start Community engines.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {(["Executive", "Technical"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAudience(a)}
                      className={cn(
                        "rounded-control border px-3 py-1.5 text-[12.5px] transition-colors",
                        audience === a
                          ? "border-brand/60 bg-brand/12 text-ink"
                          : "border-line text-muted hover:text-ink"
                      )}
                    >
                      {a}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={run}
                    disabled={!gateOk || !policyAllowsRun || running}
                    className={buttonClassName({ variant: "secondary" })}
                  >
                    {running ? "Running snapshot…" : "Compose snapshot report"}
                  </button>
                </div>
              </div>
            </details>
            {gateOk && !policyAllowsRun ? (
              <p className="text-[12px] text-subtle">
                Preview an allowed policy decision to enable this run. Changing
                scope or safety settings requires a fresh preview.
              </p>
            ) : null}
            {communityRun ? (
              <div
                data-testid="community-validation-started"
                className="flex flex-col gap-1.5 text-sm text-ink"
              >
                <p>
                  Community validation queued {communityRun.jobsQueued} job
                  {communityRun.jobsQueued === 1 ? "" : "s"} across{" "}
                  {communityRun.moduleIds.length} engine
                  {communityRun.moduleIds.length === 1 ? "" : "s"}. Mission{" "}
                  <span className="font-mono">
                    {communityRun.mission.missionId}
                  </span>
                  . This started engines — it is not a snapshot report.
                </p>
                {nucleiOutcome?.text ? (
                  <p
                    data-testid={
                      nucleiOutcome.kind === "started"
                        ? "community-nuclei-started"
                        : "community-nuclei-skipped"
                    }
                    className={
                      nucleiOutcome.kind === "skipped"
                        ? "text-muted"
                        : "text-ink"
                    }
                  >
                    {nucleiOutcome.text}
                  </p>
                ) : null}
                <CommunityRunProgress communityRun={communityRun} />
              </div>
            ) : null}
            {runError ? (
              <InlineError
                message={runError}
                onDismiss={() => setRunError(null)}
              />
            ) : null}
          </div>
        </Panel>
      ) : null}

      {result ? <SnapshotResults snapshot={result} /> : null}

      <MissionsPanel />
    </PageShell>
  );
}

const MISSION_TONE: Record<string, StateTone> = {
  Running: "validated",
  Queued: "approval",
  RequiresApproval: "approval",
  Completed: "fixed",
  Failed: "missed",
  DeniedByPolicy: "missed",
  Cancelled: "inconclusive",
  Draft: "inconclusive"
};
const RUN_TONE: Record<string, StateTone> = {
  Running: "validated",
  Queued: "approval",
  RequiresApproval: "approval",
  Completed: "fixed",
  Failed: "missed",
  DeniedByPolicy: "missed",
  Cancelled: "inconclusive"
};
const ACTIVE_MISSION = new Set(["Running", "Queued", "RequiresApproval"]);

function missionRelTime(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function MissionsPanel() {
  const missions = useApiResource(() => api.listMissions(), []);
  const items = [...(missions.data ?? [])]
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    )
    .slice(0, 8);

  if (!missions.loading && !missions.error && items.length === 0) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader title="Recent validation activity" />
      {missions.loading ? (
        <LoadingSkeleton rows={3} />
      ) : missions.error ? (
        <ErrorState message={missions.error} onRetry={missions.refetch} />
      ) : (
        <ul>
          {items.map((mission) => (
            <MissionRow
              key={mission.missionId}
              mission={mission}
              onChanged={missions.refetch}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MissionRow({
  mission,
  onChanged
}: {
  mission: ValidationMission;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const runs = useApiResource(
    () => (open ? api.listMissionRuns(mission.missionId) : Promise.resolve([])),
    [open, mission.missionId]
  );

  async function cancel() {
    setBusy(true);
    try {
      await api.cancelMission(mission.missionId);
      onChanged();
    } catch {
      setBusy(false);
    }
  }

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 text-left"
        >
          <span
            aria-hidden
            className={cn(
              "font-mono text-xs text-subtle transition-transform",
              open && "rotate-90"
            )}
          >
            ›
          </span>
          <span className="text-[13px] text-ink">{mission.missionType}</span>
        </button>
        <StateBadge
          tone={MISSION_TONE[mission.status] ?? "neutral"}
          dot={false}
        >
          {mission.status}
        </StateBadge>
        <SafetyLevelBadge level={mission.safetyLevel} dot={false} />
        <span className="font-mono text-[10px] text-subtle">
          blast radius {Math.max(1, mission.scopeIds.length)} scope
          {Math.max(1, mission.scopeIds.length) === 1 ? "" : "s"}
        </span>
        <span className="font-mono text-[11px] text-subtle">
          started {missionRelTime(mission.startedAt)}
        </span>
        <Link
          href={`/missions/${mission.missionId}`}
          className={cn(
            "text-xs text-brand hover:text-brand-2",
            !ACTIVE_MISSION.has(mission.status) && "ml-auto"
          )}
        >
          Details
        </Link>
        {ACTIVE_MISSION.has(mission.status) ? (
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className={cn(
              buttonClassName({ size: "sm", variant: "secondary" }),
              "text-missed"
            )}
          >
            {busy ? "…" : "Cancel"}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="border-t border-line bg-surface/40 px-4 py-3 pl-10">
          {runs.loading ? (
            <LoadingSkeleton rows={2} className="p-0" />
          ) : runs.error ? (
            <ErrorState message={runs.error} onRetry={runs.refetch} />
          ) : (runs.data ?? []).length === 0 ? (
            <p className="text-[12px] text-subtle">No runs recorded.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {(runs.data ?? []).map((run) => (
                <li
                  key={run.runId}
                  className="flex flex-wrap items-center gap-2 text-[12px]"
                >
                  <StateBadge
                    tone={RUN_TONE[run.status] ?? "neutral"}
                    dot={false}
                  >
                    {run.status}
                  </StateBadge>
                  <span className="font-mono text-subtle">{run.moduleId}</span>
                  {run.validationState ? (
                    <ValidationStateBadge
                      state={run.validationState}
                      dot={false}
                    />
                  ) : null}
                  <SafetyLevelBadge level={run.safetyLevel} dot={false} />
                  {run.outcome ? (
                    <span className="text-muted">{run.outcome}</span>
                  ) : null}
                  {run.evidenceIds.length ? (
                    <span className="font-mono text-[10px] text-brand">
                      {run.evidenceIds.length} evidence
                    </span>
                  ) : null}
                  {run.errorSummary ? (
                    <span className="text-missed">{run.errorSummary}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}

function SnapshotResults({ snapshot }: { snapshot: ValidationSnapshot }) {
  const m = snapshot.metrics;
  return (
    <Panel>
      <PanelHeader
        title="Snapshot report"
        actions={
          <a
            href={`/api/v1/snapshots/${snapshot.snapshotId}/report`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand hover:text-brand-2"
          >
            Open report ↗
          </a>
        }
      />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-base font-semibold text-ink">
              {snapshot.summary.headline}
            </p>
            <p className="mt-1 max-w-2xl text-[13px] text-muted">
              {snapshot.summary.overview}
            </p>
          </div>
          <RiskBandBadge band={snapshot.summary.topRiskBand} dot={false} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="High-risk paths" value={m.highRiskPathCount} />
          <Metric label="Control obs." value={m.controlObservationCount} />
          <Metric label="AI risks" value={m.aiRiskCount} />
          <Metric label="Remediations" value={m.remediationCount} />
        </div>

        {snapshot.topAttackPaths.length ? (
          <div>
            <Label>Top attack paths</Label>
            <ul className="mt-1.5 flex flex-col gap-1">
              {snapshot.topAttackPaths
                .slice(0, 5)
                .map(({ attackPath, risk }) => (
                  <li key={attackPath.pathId}>
                    <Link
                      href={`/attack-paths/${attackPath.pathId}`}
                      className="flex items-center gap-2 rounded-control px-2 py-1.5 text-[13px] hover:bg-surface"
                    >
                      <RiskBandBadge band={risk.band} dot={false} />
                      <span className="truncate text-ink">
                        {attackPath.name}
                      </span>
                      <span className="ml-auto shrink-0">
                        <AttackPathClaimBadge attackPath={attackPath} />
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        {snapshot.verificationPlan.length ? (
          <div>
            <Label>Verification plan</Label>
            <ol className="mt-1.5 flex flex-col gap-1 text-[13px] text-muted">
              {snapshot.verificationPlan.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-subtle">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            href="/findings"
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Review findings
          </Link>
          <Link
            href="/remediation"
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Remediation
          </Link>
          <Link
            href="/reports"
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Reports &amp; export
          </Link>
        </div>
      </div>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control border border-line bg-surface p-3">
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
      <p
        className="mt-1 font-mono text-2xl font-semibold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
      {children}
    </span>
  );
}
