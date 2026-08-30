"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { ModuleManifest } from "@periscan/modules";
import type {
  AttackTechnique,
  EngagementResult,
  ExecuteScenarioInput,
  ScenarioBundle,
  Scope,
  StopScenarioFeedbackInput,
  TenantSafetySettings
} from "@periscan/shared";

import {
  browserPeriscanApiClient,
  PeriscanApiClientError,
  type AuthSessionPayload
} from "../lib/periscan-api-client";
import {
  Badge,
  Button,
  Card,
  DistributionChart,
  PartialLoadBanner,
  StatusPill,
  buttonClassName
} from "../ui";
import { StatusPanel } from "./status-panel";
import { EngagementCollaborationWorkspace } from "./engagement-collaboration-workspace";
import { ScenarioFeedbackLoop } from "./scenario-feedback-loop";

// Engagement-status tones for the recent-engagements distribution.
const ENGAGEMENT_STATUS_COLORS: Array<{ status: string; color: string }> = [
  { color: "var(--color-success)", status: "Completed" },
  { color: "var(--color-danger)", status: "Denied" },
  { color: "var(--color-info)", status: "Planned" },
  { color: "var(--color-muted)", status: "Empty" }
];

// Map step status onto kit StatusPill vocabulary so domain truthfulness stays
// explicit: only executed → success; denied/failed → danger; else pending.
function stepStatusForPill(status: string) {
  if (status === "executed") {
    return "executed";
  }
  if (status === "denied" || status === "failed") {
    return "denied";
  }
  return "pending";
}

// Engagement-level: Completed → success; Denied → danger; Planned/Empty → pending.
function engagementStatusForPill(status: string) {
  if (status === "Completed") {
    return "completed";
  }
  if (status === "Denied") {
    return "denied";
  }
  return "pending";
}

function SummaryTile({
  label,
  value,
  ariaLabel
}: {
  label: string;
  value: number;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-control border border-line bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className="text-lg font-semibold text-ink"
        role="status"
        aria-label={ariaLabel}
      >
        {value}
      </dd>
    </div>
  );
}

const fieldClass = "flex min-w-0 flex-col gap-1 text-sm text-muted";
const inputClass =
  "min-w-0 max-w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const itemClass =
  "flex min-w-0 flex-col items-stretch justify-between gap-3 rounded-control border border-line bg-surface p-3 sm:flex-row sm:items-start";

export function EngagementWorkbench() {
  const [auth, setAuth] = useState<AuthSessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [scopeId, setScopeId] = useState("");
  const [mode, setMode] = useState<"PlanOnly" | "Execute">("PlanOnly");
  const [authorizedOffensive, setAuthorizedOffensive] = useState(false);
  const [approvalId, setApprovalId] = useState("");
  const [modules, setModules] = useState<ModuleManifest[]>([]);
  const [techniques, setTechniques] = useState<AttackTechnique[]>([]);
  const [safetySettings, setSafetySettings] =
    useState<TenantSafetySettings | null>(null);
  const [moduleId, setModuleId] = useState("");
  const [techniqueId, setTechniqueId] = useState("");
  const [plan, setPlan] = useState<
    Array<{ moduleId: string; techniqueId: string }>
  >([]);
  const [result, setResult] = useState<EngagementResult | null>(null);
  const [history, setHistory] = useState<EngagementResult[]>([]);
  const [collaborationEngagementId, setCollaborationEngagementId] = useState<
    string | null
  >(null);
  const [running, setRunning] = useState(false);
  const [scenarioIntent, setScenarioIntent] = useState("");
  const [scenarioMaximumIterations, setScenarioMaximumIterations] = useState(3);
  const [scenario, setScenario] = useState<ScenarioBundle | null>(null);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [scenarioPhase, setScenarioPhase] = useState<
    "idle" | "compiling" | "preview" | "approved" | "executing" | "complete"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [degradedRails, setDegradedRails] = useState<string[]>([]);

  async function loadHistory() {
    try {
      const items = await browserPeriscanApiClient.listEngagements();
      setHistory(items);
      setDegradedRails((rails) => rails.filter((r) => r !== "Engagement history"));
    } catch {
      // History is supplementary; surface degraded honesty, do not block run.
      setDegradedRails((rails) =>
        rails.includes("Engagement history")
          ? rails
          : [...rails, "Engagement history"]
      );
    }
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const me = await browserPeriscanApiClient.getMe();
        if (!active) {
          return;
        }
        setAuth(me);
        const [scopesResult, historyResult, scenarioResult] =
          await Promise.allSettled([
            browserPeriscanApiClient.listScopes(),
            browserPeriscanApiClient.listEngagements(),
            browserPeriscanApiClient.listScenarioBundles()
          ]);
        if (!active) {
          return;
        }
        const degraded: string[] = [];
        if (scopesResult.status !== "fulfilled") {
          throw scopesResult.reason instanceof Error
            ? scopesResult.reason
            : new Error("Unable to load scopes.");
        }
        const loadedScopes = scopesResult.value;
        setScopes(loadedScopes);
        const firstVerified = loadedScopes.find(
          (scope) => scope.verificationStatus === "Verified"
        );
        if (firstVerified) {
          setScopeId(firstVerified.scopeId);
        }
        if (historyResult.status === "fulfilled") {
          setHistory(historyResult.value);
        } else {
          degraded.push("Engagement history");
        }
        const scenarioBundles =
          scenarioResult.status === "fulfilled" ? scenarioResult.value : [];
        if (scenarioResult.status !== "fulfilled") {
          degraded.push("Scenario bundles");
        }
        const latestScenario = scenarioBundles.find(
          (bundle) => bundle.status === "Approved"
        );
        if (latestScenario) {
          setScenario(latestScenario);
          setScenarioIntent(latestScenario.intent);
          setScenarioMaximumIterations(latestScenario.maximumIterations);
          setScenarioPhase("approved");
        }
        const [moduleResult, techniqueResult, safetyResult] =
          await Promise.allSettled([
            browserPeriscanApiClient.listModules(),
            browserPeriscanApiClient.listAttackTechniques(),
            browserPeriscanApiClient.getTenantSafetySettings()
          ]);
        if (!active) return;
        if (moduleResult.status === "fulfilled") {
          setModules(moduleResult.value);
          const firstCompatibleModule = moduleResult.value.find(
            (module) =>
              module.status === "Implemented" &&
              (!firstVerified ||
                module.requiredScopes.length === 0 ||
                module.requiredScopes.includes(firstVerified.scopeType))
          );
          setModuleId(firstCompatibleModule?.moduleId ?? "");
        } else {
          degraded.push("Modules");
        }
        if (techniqueResult.status === "fulfilled") {
          setTechniques(techniqueResult.value);
        } else {
          degraded.push("Attack techniques");
        }
        if (safetyResult.status === "fulfilled") {
          setSafetySettings(safetyResult.value);
        } else {
          degraded.push("Safety settings");
        }
        if (active) {
          setDegradedRails(degraded);
        }
      } catch {
        if (active) {
          setAuth(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function runEngagement() {
    setRunning(true);
    setError(null);
    try {
      const next = await browserPeriscanApiClient.runEngagement({
        authorizedOffensive,
        mode,
        plan: plan.map((step) => ({
          moduleId: step.moduleId,
          target: step.techniqueId ? { techniqueId: step.techniqueId } : {}
        })),
        scopeId,
        ...(approvalId ? { approvalId } : {})
      });
      setResult(next);
      setCollaborationEngagementId(next.engagementId);
      await loadHistory();
    } catch (caught) {
      setError(
        caught instanceof PeriscanApiClientError
          ? caught.message
          : "Engagement failed"
      );
    } finally {
      setRunning(false);
    }
  }

  async function compileScenario() {
    if (!scopeId || scenarioIntent.trim().length < 3) return;
    setScenarioBusy(true);
    setScenarioPhase("compiling");
    setError(null);
    try {
      const compiled = await browserPeriscanApiClient.compileScenario({
        intent: scenarioIntent.trim(),
        maximumIterations: scenarioMaximumIterations,
        maximumSteps: 6,
        scopeId,
        techniqueIds: techniqueId ? [techniqueId] : []
      });
      setScenario(compiled.bundle);
      setScenarioPhase(
        compiled.bundle.status === "Approved" ? "approved" : "preview"
      );
    } catch (caught) {
      setScenarioPhase("idle");
      setError(
        caught instanceof PeriscanApiClientError
          ? caught.message
          : "Scenario compilation failed"
      );
    } finally {
      setScenarioBusy(false);
    }
  }

  async function approveScenario() {
    if (!scenario) return;
    setScenarioBusy(true);
    setError(null);
    try {
      const approved = await browserPeriscanApiClient.approveScenarioBundle(
        scenario.scenarioBundleId
      );
      setScenario(approved);
      setScenarioPhase("approved");
    } catch (caught) {
      setError(
        caught instanceof PeriscanApiClientError
          ? caught.message
          : "Scenario approval failed"
      );
    } finally {
      setScenarioBusy(false);
    }
  }

  async function executeScenario(input: ExecuteScenarioInput) {
    if (!scenario || scenario.status !== "Approved") return;
    setScenarioBusy(true);
    setScenarioPhase("executing");
    setError(null);
    try {
      const execution = await browserPeriscanApiClient.executeScenarioBundle(
        scenario.scenarioBundleId,
        input
      );
      setScenario(execution.bundle);
      setResult(execution.engagement);
      setCollaborationEngagementId(execution.engagement.engagementId);
      setScenarioPhase("complete");
      await loadHistory();
    } catch (caught) {
      setScenarioPhase("approved");
      setError(
        caught instanceof PeriscanApiClientError
          ? caught.message
          : "Scenario execution failed"
      );
    } finally {
      setScenarioBusy(false);
    }
  }

  async function stopScenarioFeedback(input: StopScenarioFeedbackInput) {
    if (!scenario || scenario.status !== "Approved") return;
    setScenarioBusy(true);
    setError(null);
    try {
      const stopped = await browserPeriscanApiClient.stopScenarioFeedback(
        scenario.scenarioBundleId,
        input
      );
      setScenario(stopped);
      setScenarioPhase("complete");
    } catch (caught) {
      setError(
        caught instanceof PeriscanApiClientError
          ? caught.message
          : "Stopping the feedback loop failed"
      );
    } finally {
      setScenarioBusy(false);
    }
  }

  if (loading) {
    return (
      <StatusPanel
        body="Periscan is loading engagement scopes and history from the public API."
        eyebrow="Autonomous engagement"
        kind="loading"
        title="Loading workspace."
      />
    );
  }

  if (!auth) {
    return (
      <h2 className="text-lg font-semibold text-ink">
        Sign in to run autonomous engagements.
      </h2>
    );
  }

  const verifiedScopes = scopes.filter(
    (scope) => scope.verificationStatus === "Verified"
  );
  const selectedScope = verifiedScopes.find(
    (scope) => scope.scopeId === scopeId
  );
  const availableModules = modules.filter(
    (module) =>
      module.status === "Implemented" &&
      (!selectedScope ||
        module.requiredScopes.length === 0 ||
        module.requiredScopes.includes(selectedScope.scopeType))
  );

  function addStep() {
    if (!moduleId) return;
    setPlan((current) => [...current, { moduleId, techniqueId }]);
  }

  function moveStep(index: number, direction: -1 | 1) {
    setPlan((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      const [step] = next.splice(index, 1);
      if (step) next.splice(targetIndex, 0, step);
      return next;
    });
  }

  return (
    <Card className="flex flex-col gap-3" aria-label="Autonomous engagement">
      <h3 className="text-base font-semibold text-ink">
        Autonomous engagement
      </h3>
      <p className="text-sm text-muted">
        Governed multi-step validation over a verified scope. Every step runs
        through policy + audit; offensive steps require explicit authorization
        and default to a dry-run plan.
      </p>
      {degradedRails.length > 0 ? (
        <PartialLoadBanner
          rails={degradedRails}
          detail="Primary scope and run controls still use live data where available."
        />
      ) : null}

      {verifiedScopes.length === 0 ? (
        <div
          className="rounded-control border border-line bg-surface p-3"
          role="note"
          aria-label="Engagement scope required"
        >
          <p className="text-sm font-medium text-ink">
            {scopes.length === 0
              ? "Add an authorized scope before planning an engagement."
              : "Verify a scope before planning an engagement."}
          </p>
          <p className="mt-1 text-xs text-muted">
            Engagements stay disabled until a customer-authorized scope has a
            verified ownership record.
          </p>
          <Link
            href="/missions"
            className="mt-2 inline-flex text-sm font-medium text-brand hover:text-brand-2"
          >
            Add and verify a scope →
          </Link>
        </div>
      ) : (
        <label className={fieldClass}>
          Scope
          <select
            aria-label="Engagement scope"
            className={inputClass}
            onChange={(event) => {
              const nextScopeId = event.target.value;
              const nextScope = verifiedScopes.find(
                (scope) => scope.scopeId === nextScopeId
              );
              const nextModules = modules.filter(
                (module) =>
                  module.status === "Implemented" &&
                  (!nextScope ||
                    module.requiredScopes.length === 0 ||
                    module.requiredScopes.includes(nextScope.scopeType))
              );
              setScopeId(nextScopeId);
              if (!nextModules.some((module) => module.moduleId === moduleId)) {
                setModuleId(nextModules[0]?.moduleId ?? "");
              }
            }}
            value={scopeId}
          >
            {verifiedScopes.map((scope) => (
              <option key={scope.scopeId} value={scope.scopeId}>
                {scope.value} ({scope.verificationStatus})
              </option>
            ))}
          </select>
        </label>
      )}

      <section
        aria-label="Intent to governed scenario"
        className="overflow-hidden rounded-control border border-brand/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-brand)_9%,transparent),transparent_58%)]"
      >
        <div className="border-b border-line px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            Deterministic scenario compiler
          </p>
          <h4 className="mt-1 text-base font-semibold text-ink">
            Describe the proof you need
          </h4>
          <p className="mt-1 text-xs text-muted">
            Periscan selects only registered capabilities, compiles an exact
            signed graph, and pauses for approval. Runtime branches can consume
            saved evidence; they cannot invent tools, scope, or permissions.
          </p>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <label className={fieldClass}>
              Validation intent
              <textarea
                aria-label="Scenario intent"
                className={`${inputClass} min-h-20 resize-y`}
                onChange={(event) => setScenarioIntent(event.target.value)}
                placeholder="Validate DNS and HTTP posture for this owned domain, then continue only when the prior step produced evidence."
                value={scenarioIntent}
              />
            </label>
            <label className={fieldClass}>
              Signed cycle budget
              <select
                aria-label="Signed cycle budget"
                className={inputClass}
                disabled={scenarioBusy}
                onChange={(event) =>
                  setScenarioMaximumIterations(Number(event.target.value))
                }
                value={scenarioMaximumIterations}
              >
                {[1, 3, 5, 10].map((count) => (
                  <option key={count} value={count}>
                    {count} {count === 1 ? "cycle" : "cycles"}
                  </option>
                ))}
              </select>
              <span className="text-[11px] leading-4 text-subtle">
                Immutable after compile.
              </span>
            </label>
          </div>
          <div
            aria-label={`Scenario lifecycle: ${scenarioPhase}`}
            className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
            role="status"
          >
            {[
              [
                "Compile",
                ["compiling", "preview", "approved", "executing", "complete"]
              ],
              ["Review", ["preview", "approved", "executing", "complete"]],
              ["Approve", ["approved", "executing", "complete"]],
              ["Cycle", ["executing", "complete"]]
            ].map(([label, activePhases]) => {
              const active = (activePhases as string[]).includes(scenarioPhase);
              return (
                <div
                  className={`rounded-control border px-2.5 py-2 text-center text-xs font-medium ${
                    active
                      ? "border-brand/50 bg-brand/10 text-brand"
                      : "border-line bg-surface text-subtle"
                  }`}
                  key={label as string}
                >
                  {label as string}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                scenarioBusy ||
                scopeId.length === 0 ||
                scenarioIntent.trim().length < 3
              }
              onClick={() => void compileScenario()}
            >
              {scenarioPhase === "compiling"
                ? "Compiling signed graph…"
                : "Compile preview"}
            </Button>
            {scenario?.status === "Draft" ? (
              <Button
                disabled={scenarioBusy}
                onClick={() => void approveScenario()}
                variant="secondary"
              >
                Approve exact hash
              </Button>
            ) : null}
          </div>

          {scenario ? (
            <div className="rounded-control border border-line bg-surface/90 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {scenario.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {scenario.steps.length} steps · {scenario.safetyCeiling} ·{" "}
                    {scenario.legalClassification}
                  </p>
                </div>
                <Badge
                  tone={scenario.status === "Approved" ? "success" : "info"}
                >
                  {scenario.status}
                </Badge>
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-subtle">Compiled hash</dt>
                  <dd className="mt-0.5 break-all font-mono text-ink">
                    {scenario.compiledHash}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">Signature</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {scenario.signature.algorithm} · {scenario.signature.keyId}
                  </dd>
                </div>
              </dl>
              <ol
                aria-label="Compiled scenario steps"
                className="mt-3 flex flex-col gap-1.5"
              >
                {scenario.steps.map((step, index) => (
                  <li
                    className="grid gap-1 rounded-control border border-line px-3 py-2 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                    key={step.stepId}
                  >
                    <span className="font-mono text-xs text-brand">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-xs font-medium text-ink">
                        {step.name}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {step.when.kind === "Always"
                          ? "Start branch"
                          : `Continue when ${step.when.stepId} has ${step.when.minimumEvidenceCount}+ evidence`}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-subtle">
                      {step.moduleId}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
        {scenario?.status === "Approved" ? (
          <ScenarioFeedbackLoop
            busy={scenarioBusy}
            cycles={history.filter(
              (item) =>
                item.scenarioBundleId === scenario.scenarioBundleId &&
                item.feedbackCycleNumber !== null
            )}
            onRun={executeScenario}
            onStop={stopScenarioFeedback}
            scenario={scenario}
          />
        ) : null}
      </section>

      <label className={fieldClass}>
        Mode
        <select
          aria-label="Engagement mode"
          className={inputClass}
          onChange={(event) =>
            setMode(event.target.value === "Execute" ? "Execute" : "PlanOnly")
          }
          value={mode}
        >
          <option value="PlanOnly">Plan only</option>
          <option value="Execute">Execute</option>
        </select>
      </label>

      <fieldset className="flex min-w-0 flex-col gap-2 rounded-control border border-line bg-surface/40 p-3">
        <legend className="px-1 text-sm font-semibold text-ink">
          Validation chain
        </legend>
        <p className="text-xs text-muted">
          Build an ordered chain from implemented modules. Each step still gets
          an individual policy verdict; selecting a technique adds ATT&amp;CK
          context but never expands the module&apos;s permissions.
        </p>
        <div className="grid min-w-0 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className={fieldClass}>
            Module
            <select
              aria-label="Engagement module"
              className={inputClass}
              value={moduleId}
              onChange={(event) => setModuleId(event.target.value)}
            >
              {availableModules.length === 0 ? (
                <option value="">No compatible implemented modules</option>
              ) : null}
              {availableModules.map((module) => (
                <option key={module.moduleId} value={module.moduleId}>
                  {module.name} · {module.safetyLevel}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClass}>
            ATT&amp;CK context (optional)
            <select
              aria-label="Engagement ATT&CK technique"
              className={inputClass}
              value={techniqueId}
              onChange={(event) => setTechniqueId(event.target.value)}
            >
              <option value="">No technique context</option>
              {techniques.map((technique) => (
                <option
                  key={technique.techniqueId}
                  value={technique.techniqueId}
                >
                  {technique.techniqueId} · {technique.techniqueName}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={!moduleId} onClick={addStep}>
            Add step
          </Button>
        </div>
        {plan.length === 0 ? (
          <p className="text-xs text-subtle">
            No custom steps — Periscan will use the safe default chain for this
            scope type.
          </p>
        ) : (
          <ol
            className="flex flex-col gap-1.5"
            aria-label="Engagement plan steps"
          >
            {plan.map((step, index) => {
              const manifest = modules.find(
                (module) => module.moduleId === step.moduleId
              );
              return (
                <li
                  key={`${step.moduleId}-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-2 text-xs"
                >
                  <span className="font-mono text-subtle">{index + 1}</span>
                  <span className="font-medium text-ink">
                    {manifest?.name ?? step.moduleId}
                  </span>
                  <span className="text-subtle">
                    {manifest?.safetyLevel ?? "Unknown safety"}
                  </span>
                  {step.techniqueId ? (
                    <span className="font-mono text-brand">
                      {step.techniqueId}
                    </span>
                  ) : null}
                  <span className="ml-auto flex gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveStep(index, -1)}
                      aria-label={`Move step ${index + 1} up`}
                      className="px-1 text-brand disabled:text-subtle"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === plan.length - 1}
                      onClick={() => moveStep(index, 1)}
                      aria-label={`Move step ${index + 1} down`}
                      className="px-1 text-brand disabled:text-subtle"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPlan((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      aria-label={`Remove step ${index + 1}`}
                      className="px-1 text-missed"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          aria-label="Authorize offensive steps"
          checked={authorizedOffensive}
          disabled={!safetySettings?.offensiveValidationEnabled}
          onChange={(event) => {
            const checked = event.target.checked;
            setAuthorizedOffensive(checked);
            setApprovalId(
              checked ? (safetySettings?.authorizationReference ?? "") : ""
            );
          }}
          type="checkbox"
        />
        Authorize offensive steps
      </label>

      {authorizedOffensive ? (
        <div className="rounded-control border border-line bg-surface px-3 py-2 text-sm">
          <p className="text-xs text-subtle">Bound authorization record</p>
          <p className="mt-1 font-mono text-ink">{approvalId}</p>
          <p className="mt-1 text-xs text-muted">
            Authorized {safetySettings?.authorizedAt ?? "date not recorded"}.
            This reference is persisted on the engagement and its audit event.
          </p>
        </div>
      ) : !safetySettings?.offensiveValidationEnabled ? (
        <p className="text-xs text-subtle">
          Offensive execution is unavailable until an administrator records the
          authorization in{" "}
          <Link href="/trust-safety" className="text-brand hover:text-brand-2">
            Trust &amp; Safety
          </Link>
          . Plan-only chains remain available.
        </p>
      ) : null}

      <div>
        <Button
          disabled={running || scopeId.length === 0}
          onClick={() => void runEngagement()}
        >
          {running ? "Running..." : "Run engagement"}
        </Button>
      </div>

      {error ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-danger">{error}</p>
          <button
            aria-label="Dismiss engagement error"
            className="text-xs text-muted underline"
            onClick={() => setError(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-2">
          <p
            className="text-sm text-ink"
            aria-label={`Engagement status: ${result.status}`}
            role="status"
          >
            Status: {result.status} · {result.evidenceIds.length} evidence
            artifact(s)
          </p>
          {result.mode === "PlanOnly" ? (
            <p
              className="rounded-control border border-info/40 bg-info/10 px-3 py-2 text-sm text-info"
              role="status"
              aria-label="Preview only: no engagement steps were executed"
            >
              Preview only — this is a policy-gated plan. No steps were executed
              and nothing ran against the scope.
            </p>
          ) : null}
          {(() => {
            const executed = result.steps.filter(
              (step) => step.status === "executed"
            ).length;
            const denied = result.steps.filter(
              (step) => step.status === "denied"
            ).length;
            const planned = result.steps.filter(
              (step) => step.status === "planned"
            ).length;
            const totalSignals = result.steps.reduce(
              (sum, step) => sum + step.signalCount,
              0
            );
            return (
              <dl
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                aria-label="Engagement outcome summary"
              >
                <SummaryTile
                  label="Executed"
                  value={executed}
                  ariaLabel={`Engagement steps executed: ${executed}`}
                />
                <SummaryTile
                  label="Denied"
                  value={denied}
                  ariaLabel={`Engagement steps denied: ${denied}`}
                />
                <SummaryTile
                  label="Planned"
                  value={planned}
                  ariaLabel={`Engagement steps planned: ${planned}`}
                />
                <SummaryTile
                  label="Signals"
                  value={totalSignals}
                  ariaLabel={`Engagement signals produced: ${totalSignals}`}
                />
              </dl>
            );
          })()}
          {result.steps.map((step, index) => {
            // A denied/failed step's reason is the governance verdict — surface
            // it prominently, not buried in the muted metadata line.
            const isBlocked =
              step.status === "denied" || step.status === "failed";
            return (
              <article className={itemClass} key={`${step.moduleId}-${index}`}>
                <div className="flex flex-col gap-1">
                  <strong className="text-ink">{step.moduleId}</strong>
                  <p className="text-sm text-muted">
                    {step.runMode}
                    {step.status === "executed"
                      ? ` · ${step.evidenceIds.length} evidence · ${step.signalCount} signal${
                          step.signalCount === 1 ? "" : "s"
                        }`
                      : ""}
                    {step.reason && !isBlocked ? ` · ${step.reason}` : ""}
                  </p>
                  {isBlocked && step.reason ? (
                    <p
                      className="rounded-control border border-danger/40 bg-danger/10 px-2 py-1 text-sm text-danger"
                      role="note"
                      aria-label={`${step.status === "denied" ? "Denied" : "Failed"} reason for ${step.moduleId}`}
                    >
                      {step.status === "denied" ? "Denied" : "Failed"}:{" "}
                      {step.reason}
                    </p>
                  ) : null}
                  {step.evidenceIds.length > 0 ? (
                    <div
                      className="flex flex-wrap gap-1"
                      aria-label={`Evidence for ${step.moduleId}`}
                    >
                      {step.evidenceIds.map((evidenceId) => (
                        <span
                          className="inline-flex items-center rounded-pill bg-surface-strong px-2 py-0.5 text-xs text-muted"
                          key={evidenceId}
                        >
                          ev-{evidenceId.slice(0, 8)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <StatusPill
                  aria-label={`Step ${step.moduleId}: ${step.status}`}
                  label={step.status}
                  status={stepStatusForPill(step.status)}
                />
              </article>
            );
          })}
        </div>
      ) : null}

      {collaborationEngagementId ? (
        <EngagementCollaborationWorkspace
          engagementId={collaborationEngagementId}
          evidenceIds={
            (result?.engagementId === collaborationEngagementId
              ? result
              : history.find(
                  (item) => item.engagementId === collaborationEngagementId
                )
            )?.evidenceIds ?? []
          }
        />
      ) : null}

      {history.length > 0 ? (
        <div className="flex flex-col gap-2" aria-label="Recent engagements">
          <h4 className="text-sm font-semibold text-ink">Recent engagements</h4>
          {(() => {
            const statusDistribution = ENGAGEMENT_STATUS_COLORS.map(
              ({ color, status }) => ({
                color,
                id: status,
                label: status,
                value: history.filter(
                  (engagement) => engagement.status === status
                ).length
              })
            ).filter((datum) => datum.value > 0);
            return statusDistribution.length ? (
              <DistributionChart
                title="Recent engagements by outcome"
                ariaLabel="Recent engagements by outcome"
                data={statusDistribution}
                variant="bar"
              />
            ) : null;
          })()}
          {history.map((engagement) => {
            const executedSteps = engagement.steps.filter(
              (step) => step.status === "executed"
            ).length;
            return (
              <article className={itemClass} key={engagement.engagementId}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-ink">
                      {engagement.engagementId.slice(0, 8)}
                    </strong>
                    {/* A preview (PlanOnly) must be visually distinct from a
                        live run so operators never mistake one for the other. */}
                    <Badge
                      tone={engagement.mode === "Execute" ? "brand" : "info"}
                      aria-label={`Engagement ${engagement.engagementId} mode: ${
                        engagement.mode === "Execute"
                          ? "Execute"
                          : "Plan only (preview)"
                      }`}
                    >
                      {engagement.mode === "Execute" ? "Execute" : "Plan only"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {engagement.steps.length} step(s) · {executedSteps} executed
                    · {engagement.evidenceIds.length} evidence ·{" "}
                    {engagement.generatedAt}
                  </p>
                </div>
                <StatusPill
                  aria-label={`Engagement ${engagement.engagementId}: ${engagement.status}`}
                  label={engagement.status}
                  status={engagementStatusForPill(engagement.status)}
                />
                <button
                  className={buttonClassName({
                    size: "sm",
                    variant:
                      collaborationEngagementId === engagement.engagementId
                        ? "primary"
                        : "secondary"
                  })}
                  onClick={() =>
                    setCollaborationEngagementId(engagement.engagementId)
                  }
                  type="button"
                >
                  {collaborationEngagementId === engagement.engagementId
                    ? "Workspace open"
                    : "Open workspace"}
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}
