"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  SafetyLevelBadge,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import { AgentSessionActivity } from "./agent-session-activity";
import { AgentBehaviorAnalytics } from "./agent-behavior-analytics";
import { AgentTrustConsole } from "./agent-trust-console";
import { WorkflowVariableLens } from "./workflow-variable-lens";

const MODES = [
  "PlanOnly",
  "ReadOnlyEvidence",
  "SafeValidation",
  "GuidedRemediation",
  "HighAssurance"
] as const;
type Mode = (typeof MODES)[number];

const MODE_BLURB: Record<Mode, string> = {
  PlanOnly: "Plans only — no evidence read, no actions.",
  ReadOnlyEvidence: "Reads redacted evidence to reason; cannot act.",
  SafeValidation: "May request safe validation tools (approval-gated).",
  GuidedRemediation: "May propose + verify fixes (approval-gated).",
  HighAssurance: "Full governed toolset; every action approval-gated."
};

const SESSION_TONE: Record<string, StateTone> = {
  Active: "validated",
  Created: "approval",
  Paused: "inconclusive",
  Blocked: "missed",
  Terminated: "inconclusive",
  Expired: "inconclusive",
  Archived: "neutral"
};

export function AgentWorkflowStudio() {
  const providers = useApiResource(() => api.listModelProviders(), []);
  const policies = useApiResource(() => api.listModelPolicyProfiles(), []);
  const scopes = useApiResource(() => api.listScopes(), []);
  const tools = useApiResource(() => api.listModelTools(), []);
  const sessions = useApiResource(() => api.listModelSessions(), []);
  const workflowRuns = useApiResource(() => api.listAgentWorkflowRuns(), []);

  const [providerId, setProviderId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [mode, setMode] = useState<Mode>("PlanOnly");
  const [scopeIds, setScopeIds] = useState<Set<string>>(new Set());
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState("");

  useEffect(() => {
    const availableSessions = sessions.data ?? [];
    if (
      availableSessions.length > 0 &&
      !availableSessions.some(
        (session) => session.modelSessionId === selectedSessionId
      )
    ) {
      const firstLive = availableSessions.find((session) =>
        ["Active", "Created", "Paused"].includes(session.status)
      );
      setSelectedSessionId(
        (firstLive ?? availableSessions[0])?.modelSessionId ?? ""
      );
    }
  }, [selectedSessionId, sessions.data]);

  const policy = (policies.data ?? []).find(
    (p) => p.modelPolicyProfileId === policyId
  );
  const allowedModes: Mode[] = policy
    ? (policy.allowedModes as Mode[])
    : [...MODES];

  const availableTools = useMemo(() => {
    return (tools.data ?? []).map((tool) => {
      const blocked = policy?.blockedTools.includes(tool.toolName) ?? false;
      const available =
        tool.enabled && !blocked && tool.allowedSessionModes.includes(mode);
      return { tool, available };
    });
  }, [tools.data, policy, mode]);

  const availableCount = availableTools.filter((t) => t.available).length;

  const missingSetup =
    !providers.loading &&
    !policies.loading &&
    ((providers.data ?? []).length === 0 || (policies.data ?? []).length === 0);

  const canLaunch =
    providerId &&
    policyId &&
    mode &&
    scopeIds.size > 0 &&
    purpose.trim().length > 0;

  function toggleScope(id: string) {
    setScopeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function launch() {
    if (!canLaunch) return;
    setBusy(true);
    setError(null);
    setLaunched(null);
    let createdSessionId: string | null = null;
    try {
      const definition = await api.createAgentWorkflowDefinition({
        name: "Governed validation workflow",
        purpose:
          "Build governed context, evaluate policy, route the model, supervise tools, and bind evidence.",
        steps: [
          {
            dependsOn: [],
            name: "Build governed context",
            stepKey: "context",
            stepKind: "Context"
          },
          {
            dependsOn: ["context"],
            name: "Evaluate tenant policy",
            stepKey: "policy",
            stepKind: "Policy"
          },
          {
            dependsOn: ["policy"],
            name: "Route frontier model",
            stepKey: "model",
            stepKind: "Model"
          },
          {
            dependsOn: ["model"],
            name: "Supervise governed tools",
            stepKey: "tools",
            stepKind: "Tool",
            toolName: "tenant-policy-selected"
          },
          {
            dependsOn: ["tools"],
            name: "Bind evidence",
            stepKey: "evidence",
            stepKind: "Evidence"
          }
        ],
        version: 1
      });
      const session = await api.createModelSession({
        modelProviderId: providerId,
        modelPolicyProfileId: policyId,
        purpose: purpose.trim(),
        scopeIds: [...scopeIds],
        mode
      });
      createdSessionId = session.modelSessionId;
      const run = await api.createAgentWorkflowRun({
        evidenceIds: [],
        inputManifest: {
          mode,
          modelPolicyProfileId: policyId,
          modelProviderId: providerId,
          purpose: purpose.trim(),
          scopeIds: [...scopeIds]
        },
        modelSessionId: session.modelSessionId,
        policyDecisionIds: [],
        workflowDefinitionId: definition.workflowDefinitionId
      });
      await api.appendAgentWorkflowEvent(run.workflowRunId, {
        eventType: "StepStarted",
        evidenceIds: [],
        payloadRedacted: {
          contextSourceRefs: [...scopeIds].map((id) => `scope:${id}`),
          redactionPolicy: "default",
          storedPromptText: false
        },
        stepKey: "context"
      });
      await api.startModelSession(session.modelSessionId);
      setLaunched(session.modelSessionId);
      setSelectedSessionId(session.modelSessionId);
      setPurpose("");
      await Promise.all([sessions.refetch(), workflowRuns.refetch()]);
    } catch (caught) {
      if (createdSessionId) {
        await api
          .terminateModelSession(createdSessionId)
          .catch(() => undefined);
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "The workflow couldn't be launched."
      );
    } finally {
      setBusy(false);
    }
  }

  const selectedSession = (sessions.data ?? []).find(
    (session) => session.modelSessionId === selectedSessionId
  );
  // Explicit catalog pick wins; otherwise bind to the selected model session.
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selectedWorkflowRun = selectedRunId
    ? (workflowRuns.data ?? []).find(
        (run) => run.workflowRunId === selectedRunId
      )
    : (workflowRuns.data ?? []).find(
        (run) => run.modelSessionId === selectedSessionId
      );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Autonomous · Agent Workflows
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Compose an agent workflow
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Point your own frontier model at the scopes, evidence and signals
          Periscan already has — under a policy that decides which governed
          tools it may use. The model never touches raw secrets or the network;
          every tool request is policy-checked and audited.{" "}
          <a href="#flight-recorder-catalog" className="text-brand hover:underline">
            Open the durable flight recorder
          </a>{" "}
          to seal checkpoints and fork verified history.
        </p>
      </header>

      {missingSetup ? (
        <Panel>
          <div className="p-4">
            <NotConfigured
              title="Connect a model and a policy first"
              message="An agent workflow needs a BYO model provider and a policy profile. Set those up once in the Model Gateway, then build workflows here."
              action={{ href: "/model-gateway", label: "Open Model Gateway" }}
            />
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Builder */}
        <Panel>
          <PanelHeader title="New workflow" />
          <div className="flex flex-col gap-4 p-4">
            <Field label="Model provider">
              <Select
                label="Model provider"
                value={providerId}
                onChange={setProviderId}
                placeholder="Choose a model…"
                options={(providers.data ?? []).map((p) => ({
                  value: p.modelProviderId,
                  label: `${p.providerName} (${p.providerType})`
                }))}
              />
            </Field>

            <Field label="Policy profile">
              <Select
                label="Policy profile"
                value={policyId}
                onChange={(v) => {
                  setPolicyId(v);
                  const next = (policies.data ?? []).find(
                    (p) => p.modelPolicyProfileId === v
                  );
                  const first = next?.allowedModes?.[0] as Mode | undefined;
                  if (first) setMode(first);
                }}
                placeholder="Choose a policy…"
                options={(policies.data ?? []).map((p) => ({
                  value: p.modelPolicyProfileId,
                  label: p.name
                }))}
              />
            </Field>

            <Field label="Mode">
              <div className="flex flex-wrap gap-1.5">
                {MODES.map((m) => {
                  const allowed = allowedModes.includes(m);
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={!allowed}
                      onClick={() => setMode(m)}
                      className={cn(
                        "rounded-control border px-2.5 py-1 text-[12px] transition-colors",
                        active
                          ? "border-brand/60 bg-brand/12 text-ink"
                          : allowed
                            ? "border-line text-muted hover:text-ink"
                            : "border-line/60 text-subtle opacity-50"
                      )}
                      title={
                        !allowed ? "Not allowed by this policy" : undefined
                      }
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[12px] text-subtle">
                {MODE_BLURB[mode]}
              </p>
            </Field>

            <Field
              label={`Context — scopes the agent can reason over (${scopeIds.size})`}
            >
              {scopes.loading ? (
                <LoadingSkeleton rows={2} className="p-0" />
              ) : (scopes.data ?? []).length === 0 ? (
                <p className="text-[12.5px] text-subtle">
                  No scopes yet.{" "}
                  <Link href="/missions" className="text-brand">
                    Verify a scope
                  </Link>{" "}
                  to give an agent something to work on.
                </p>
              ) : (
                <div className="flex max-h-44 flex-col gap-1 overflow-y-auto">
                  {(scopes.data ?? []).map((scope) => (
                    <label
                      key={scope.scopeId}
                      className="flex cursor-pointer items-center gap-2 rounded-control border border-line px-2.5 py-1.5 text-[12.5px] hover:border-line-strong"
                    >
                      <input
                        type="checkbox"
                        checked={scopeIds.has(scope.scopeId)}
                        onChange={() => toggleScope(scope.scopeId)}
                        className="accent-[color:var(--color-brand)]"
                      />
                      <span className="truncate text-ink">{scope.value}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-subtle">
                          {scope.scopeType}
                        </span>
                        <StateBadge
                          tone={
                            scope.verificationStatus === "Verified"
                              ? "fixed"
                              : "inconclusive"
                          }
                          dot={false}
                        >
                          {scope.verificationStatus}
                        </StateBadge>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </Field>

            <Field label="Goal">
              <textarea
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                rows={3}
                placeholder="e.g. Investigate internet-exposed data stores in scope and propose fixes."
                className="w-full resize-y rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong"
              />
            </Field>

            {error ? (
              <p role="alert" className="text-sm text-missed">
                {error}
              </p>
            ) : null}
            {launched ? (
              <p className="text-sm text-fixed">
                Workflow launched — it&apos;s on the{" "}
                <Link href="/swarm" className="underline">
                  scope
                </Link>{" "}
                now.
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={launch}
                disabled={!canLaunch || busy}
                className={buttonClassName({ variant: "primary" })}
              >
                {busy ? "Launching…" : "Launch agent workflow"}
              </button>
              <span className="text-[12px] text-subtle">
                {availableCount} tool{availableCount === 1 ? "" : "s"} available
                in {mode}
              </span>
            </div>
          </div>
        </Panel>

        {/* Tool catalog */}
        <Panel>
          <PanelHeader
            title="Governed tools"
            link={{ href: "/model-gateway", label: "Manage" }}
          />
          {tools.loading ? (
            <LoadingSkeleton rows={5} />
          ) : tools.error ? (
            <ErrorState message={tools.error} onRetry={tools.refetch} />
          ) : availableTools.length === 0 ? (
            <div className="p-4">
              <NotConfigured
                title="No tools registered"
                message="The code-defined tool catalog is empty for this tenant."
              />
            </div>
          ) : (
            <ul>
              {availableTools.map(({ tool, available }) => (
                <li
                  key={tool.toolName}
                  className={cn(
                    "flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0",
                    !available && "opacity-45"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      available ? "bg-fixed" : "bg-inconclusive"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink">
                      {tool.definition.title}
                    </p>
                    <p className="line-clamp-1 text-[12px] text-muted">
                      {tool.definition.description}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <SafetyLevelBadge
                        level={tool.definition.safetyLevel}
                        dot={false}
                      />
                      {tool.approvalRequired ? (
                        <StateBadge tone="approval" dot={false}>
                          Approval
                        </StateBadge>
                      ) : null}
                      <span className="font-mono text-[10px] text-subtle">
                        {tool.toolName}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Existing workflows */}
      <Panel>
        <PanelHeader
          title="Your agent workflows"
          link={{ href: "/model-gateway", label: "Model Gateway" }}
        />
        {sessions.loading ? (
          <LoadingSkeleton rows={3} />
        ) : sessions.error ? (
          <ErrorState message={sessions.error} onRetry={sessions.refetch} />
        ) : (sessions.data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-subtle">
            No workflows yet — compose one above.
          </p>
        ) : (
          <ul>
            {(sessions.data ?? []).map((session) => (
              <li
                key={session.modelSessionId}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={session.modelSessionId === selectedSessionId}
                    onClick={() => {
                      setSelectedSessionId(session.modelSessionId);
                      setSelectedRunId(null);
                    }}
                    className="block w-full truncate text-left text-[13px] text-ink hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {session.purpose}
                  </button>
                  <p className="font-mono text-[11px] text-subtle">
                    {session.modelSessionId.slice(0, 8)} · {session.mode} ·{" "}
                    {session.scopeIds.length} scope
                    {session.scopeIds.length === 1 ? "" : "s"}
                  </p>
                </div>
                <StateBadge
                  tone={SESSION_TONE[session.status] ?? "neutral"}
                  className="ml-auto"
                >
                  {session.status}
                </StateBadge>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSessionId(session.modelSessionId);
                    setSelectedRunId(null);
                  }}
                  className="font-mono text-[10px] uppercase tracking-[0.06em] text-brand hover:text-brand-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {session.modelSessionId === selectedSessionId
                    ? "Viewing live"
                    : "View activity"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <AgentBehaviorAnalytics />

      {selectedSession ? (
        <AgentSessionActivity session={selectedSession} />
      ) : null}

      <Panel id="flight-recorder-catalog">
        <PanelHeader
          title="Durable flight recorder catalog"
          actions={
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-subtle">
              Checkpoint seal · fork replay
            </span>
          }
        />
        {workflowRuns.loading ? (
          <LoadingSkeleton rows={3} />
        ) : workflowRuns.error ? (
          <ErrorState
            message={workflowRuns.error}
            onRetry={workflowRuns.refetch}
          />
        ) : (workflowRuns.data ?? []).length === 0 ? (
          <div className="p-4">
            <NotConfigured
              title="No durable workflow runs yet"
              message="Launch a governed workflow above. Each run is hash-chained; you can seal a checkpoint and fork only while input, policy, evidence, and chain hashes still match."
            />
          </div>
        ) : (
          <ul aria-label="Workflow runs for flight recorder">
            {(workflowRuns.data ?? []).map((run) => {
              const isOpen =
                selectedWorkflowRun?.workflowRunId === run.workflowRunId;
              return (
                <li
                  key={run.workflowRunId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[12px] text-ink">
                      {run.workflowRunId.slice(0, 12)}…
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      status {run.status}
                      {run.modelSessionId
                        ? ` · session ${run.modelSessionId.slice(0, 8)}`
                        : " · no session link"}
                      {run.evidenceIds.length > 0
                        ? ` · ${run.evidenceIds.length} evidence ref${run.evidenceIds.length === 1 ? "" : "s"}`
                        : ""}
                      {run.forkedFromCheckpointId
                        ? " · forked from checkpoint"
                        : ""}
                    </p>
                  </div>
                  <StateBadge
                    tone={
                      run.status === "Completed"
                        ? "fixed"
                        : run.status === "Failed"
                          ? "missed"
                          : "brand"
                    }
                    className="ml-auto"
                  >
                    {run.status}
                  </StateBadge>
                  <button
                    type="button"
                    aria-pressed={isOpen}
                    onClick={() => {
                      setSelectedRunId(run.workflowRunId);
                      if (run.modelSessionId) {
                        setSelectedSessionId(run.modelSessionId);
                      }
                    }}
                    className={buttonClassName({
                      size: "sm",
                      variant: isOpen ? "primary" : "secondary"
                    })}
                  >
                    {isOpen ? "Viewing recorder" : "Open flight recorder"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {workflowRuns.loading && selectedWorkflowRun ? (
        <Panel>
          <LoadingSkeleton rows={3} />
        </Panel>
      ) : selectedWorkflowRun ? (
        <WorkflowFlightRecorder
          workflowRunId={selectedWorkflowRun.workflowRunId}
          onRunChanged={workflowRuns.refetch}
        />
      ) : selectedSession ? (
        <Panel>
          <PanelHeader title="Durable flight recorder" />
          <div className="p-4">
            <NotConfigured
              title="This session has no durable workflow run"
              message="Select a run from the flight recorder catalog above, or launch a new workflow so Periscan can version and hash-chain events. Existing model sessions alone are not invented into historical workflow events."
            />
          </div>
        </Panel>
      ) : null}
      <AgentTrustConsole />
    </div>
  );
}

function WorkflowFlightRecorder({
  workflowRunId,
  onRunChanged
}: {
  workflowRunId: string;
  onRunChanged: () => Promise<unknown>;
}) {
  const detail = useApiResource(
    () => api.getAgentWorkflowRun(workflowRunId),
    [workflowRunId]
  );
  const quality = useApiResource(
    () => api.evaluateAgentWorkflowRunQuality(workflowRunId),
    [workflowRunId]
  );
  const [busy, setBusy] = useState<"checkpoint" | "replay" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (detail.loading) {
    return (
      <Panel>
        <PanelHeader title="Durable flight recorder" />
        <LoadingSkeleton rows={4} />
      </Panel>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <Panel>
        <PanelHeader title="Durable flight recorder" />
        <ErrorState
          message={detail.error ?? "The flight recorder is unavailable."}
          onRetry={detail.refetch}
        />
      </Panel>
    );
  }

  const recorder = detail.data;
  const lastCheckpoint = recorder.checkpoints.at(-1);
  const reusableThroughStepKey =
    [...recorder.events].reverse().find((event) => event.stepKey)?.stepKey ??
    recorder.definition.steps[0]?.stepKey;

  async function sealCheckpoint() {
    if (!reusableThroughStepKey) return;
    setBusy("checkpoint");
    setActionError(null);
    setMessage(null);
    try {
      await api.createAgentWorkflowCheckpoint(workflowRunId, {
        reusableThroughStepKey
      });
      setMessage(`Checkpoint sealed through ${reusableThroughStepKey}.`);
      await Promise.all([detail.refetch(), quality.refetch()]);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Checkpoint failed."
      );
    } finally {
      setBusy(null);
    }
  }

  async function forkCheckpoint() {
    if (!lastCheckpoint) return;
    setBusy("replay");
    setActionError(null);
    setMessage(null);
    try {
      const fork = await api.replayAgentWorkflowRun(workflowRunId, {
        workflowCheckpointId: lastCheckpoint.workflowCheckpointId
      });
      setMessage(
        `Fork ${fork.workflowRunId.slice(0, 8)} reused verified history through event ${lastCheckpoint.sequence}.`
      );
      await Promise.all([detail.refetch(), quality.refetch(), onRunChanged()]);
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Replay was denied because the checkpoint is no longer valid."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel id="flight-recorder-detail">
      <PanelHeader title="Durable flight recorder" />
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">
                {recorder.definition.name} · v{recorder.definition.version}
              </p>
              <p className="mt-1 max-w-2xl text-[12px] text-muted">
                Every transition is append-only and hash-linked. Payloads
                contain redacted references; prompt text and credentials are not
                stored here. Use Seal checkpoint / Fork from checkpoint in the
                sidebar for time-travel replay when the chain is verified.
              </p>
            </div>
            <StateBadge
              tone={recorder.flightRecorderValid ? "fixed" : "missed"}
            >
              {recorder.flightRecorderValid
                ? "Chain verified"
                : "Integrity failure"}
            </StateBadge>
          </div>

          <WorkflowVariableLens workflowRunId={workflowRunId} />

          <ol className="relative ml-2 border-l border-line pl-5">
            {recorder.events.map((event) => (
              <li
                key={event.workflowEventId}
                className="relative pb-4 last:pb-0"
              >
                <span
                  aria-hidden
                  className="absolute -left-[1.44rem] top-1.5 size-2 rounded-full border border-surface bg-brand"
                />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-[10px] text-subtle">
                    #{event.sequence}
                  </span>
                  <span className="text-[13px] font-medium text-ink">
                    {event.eventType}
                  </span>
                  {event.stepKey ? (
                    <span className="text-[11px] text-brand">
                      {event.stepKey}
                    </span>
                  ) : null}
                  <span className="ml-auto font-mono text-[10px] text-subtle">
                    {event.eventHash.slice(0, 12)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {event.modelProvider
                    ? `${event.modelProvider}${event.modelVersion ? ` · ${event.modelVersion}` : ""}`
                    : "Deterministic control-plane event"}
                  {event.latencyMs !== null ? ` · ${event.latencyMs} ms` : ""}
                  {event.costMicrousd !== null
                    ? ` · ${event.costMicrousd} µUSD`
                    : ""}
                  {event.toolRequestId
                    ? ` · tool ${event.toolRequestId.slice(0, 8)}`
                    : ""}
                  {event.evidenceIds.length > 0
                    ? ` · ${event.evidenceIds.length} evidence ref${event.evidenceIds.length === 1 ? "" : "s"}`
                    : ""}
                </p>
                {event.toolRequestId || event.evidenceIds.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 font-mono text-[10px]">
                    {event.toolRequestId ? (
                      <span
                        className="rounded-control border border-line bg-bg px-1.5 py-0.5 text-subtle"
                        title={event.toolRequestId}
                      >
                        toolRequestId {event.toolRequestId.slice(0, 8)}…
                      </span>
                    ) : null}
                    {event.evidenceIds.map((evidenceId) => (
                      <Link
                        key={evidenceId}
                        href={`/evidence?evidenceId=${encodeURIComponent(evidenceId)}`}
                        className="rounded-control border border-line bg-bg px-1.5 py-0.5 text-brand hover:underline"
                        title={evidenceId}
                      >
                        evidence {evidenceId.slice(0, 8)}…
                      </Link>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        <aside className="flex flex-col gap-4 p-4">
          <div aria-label="Workflow quality evaluation">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                Run quality
              </p>
              {quality.data ? (
                <StateBadge
                  tone={
                    quality.data.status === "Ready"
                      ? "fixed"
                      : quality.data.status === "IntegrityFailure"
                        ? "missed"
                        : "approval"
                  }
                >
                  {quality.data.score}/100 · {quality.data.status}
                </StateBadge>
              ) : null}
            </div>
            {quality.loading ? (
              <LoadingSkeleton rows={2} className="mt-2 p-0" />
            ) : quality.error ? (
              <p role="alert" className="mt-2 text-[12px] text-missed">
                {quality.error}
              </p>
            ) : quality.data ? (
              <div className="mt-2 space-y-2">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                  <dt className="text-subtle">Evidence grounding</dt>
                  <dd className="text-right text-ink">
                    {Math.round(quality.data.metrics.evidenceGrounding * 100)}%
                  </dd>
                  <dt className="text-subtle">Step coverage</dt>
                  <dd className="text-right text-ink">
                    {Math.round(quality.data.metrics.stepCoverage * 100)}%
                  </dd>
                  <dt className="text-subtle">Tool + policy trace</dt>
                  <dd className="text-right text-ink">
                    {Math.round(quality.data.metrics.toolPolicyCoverage * 100)}%
                  </dd>
                  <dt className="text-subtle">Model identity</dt>
                  <dd className="text-right text-ink">
                    {Math.round(
                      quality.data.metrics.modelIdentityCoverage * 100
                    )}
                    %
                  </dd>
                </dl>
                {quality.data.findings.length > 0 ? (
                  <ul className="space-y-1 border-t border-line pt-2 text-[11px] leading-4 text-muted">
                    {quality.data.findings.slice(0, 3).map((finding) => (
                      <li key={finding.code}>{finding.message}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t border-line pt-2 text-[11px] text-fixed">
                    Integrity, grounding, policy, model identity, and workflow
                    coverage all satisfy the deterministic release gate.
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <div>
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
              Replay contract
            </p>
            <p className="mt-1 text-[12px] text-muted">
              A replay always forks. Upstream work is reused only while input,
              policy, evidence, and the event chain still match the checkpoint.
            </p>
          </div>
          <dl className="grid gap-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-subtle">Run</dt>
              <dd className="font-mono text-ink">
                {workflowRunId.slice(0, 12)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-subtle">Checkpoints</dt>
              <dd className="text-ink">{recorder.checkpoints.length}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-subtle">Evidence refs</dt>
              <dd className="text-ink">{recorder.run.evidenceIds.length}</dd>
            </div>
          </dl>
          {actionError ? (
            <p role="alert" className="text-[12px] text-missed">
              {actionError}
            </p>
          ) : null}
          {message ? <p className="text-[12px] text-fixed">{message}</p> : null}
          <div className="mt-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={sealCheckpoint}
              disabled={busy !== null || !recorder.flightRecorderValid}
              className={buttonClassName({ variant: "secondary" })}
            >
              {busy === "checkpoint" ? "Sealing…" : "Seal checkpoint"}
            </button>
            <button
              type="button"
              onClick={forkCheckpoint}
              disabled={
                busy !== null ||
                !lastCheckpoint ||
                !recorder.flightRecorderValid
              }
              className={buttonClassName({ variant: "primary" })}
            >
              {busy === "replay" ? "Validating…" : "Fork from checkpoint"}
            </button>
          </div>
        </aside>
      </div>
    </Panel>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </span>
      {children}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
