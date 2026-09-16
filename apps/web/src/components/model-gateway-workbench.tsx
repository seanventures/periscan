"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import type {
  ConversationalMissionDraft,
  HybridCompileInputFromDraft,
  ModelGatewayAuditEvent,
  ModelPolicyProfile,
  ModelPrecisionMode,
  ModelProvider,
  ModelSession,
  ModelSessionMode,
  ModelTool,
  ModelToolRequest,
  ModelUsageEvent,
  RunnerRecord,
  Scope
} from "@periscan/shared";

import {
  browserPeriscanApiClient,
  PeriscanApiClientError,
  type AuthSessionPayload
} from "../lib/periscan-api-client";
import { Badge, Button, Card, StatusPill } from "../ui";
import { ModelFinOpsConsole } from "./model-finops-console";
import { StatusPanel } from "./status-panel";

type LoadStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface GatewayState {
  auth: AuthSessionPayload | null;
  providers: ModelProvider[];
  policies: ModelPolicyProfile[];
  tools: ModelTool[];
  runners: RunnerRecord[];
  sessions: ModelSession[];
  scopes: Scope[];
}

interface SessionDetailState {
  session: ModelSession;
  toolRequests: ModelToolRequest[];
  turns: ModelUsageEvent[];
  auditEvents: ModelGatewayAuditEvent[];
}

const INITIAL_STATE: GatewayState = {
  auth: null,
  policies: [],
  providers: [],
  runners: [],
  scopes: [],
  sessions: [],
  tools: []
};

// G5: NL Campaign Builder enhancement (re-use ollama from G2). Prompts like "create gamified ctf campaign for ransomware to DC" parsed via local model for pack selection + video replay attach. Safe, tenant scoped. Marketplace ctf-pack integration.

const PROVIDER_TYPES = [
  "OpenAICompatible",
  "AnthropicCompatible",
  "GoogleCompatible",
  "MicrosoftCompatible",
  "AWSBedrockCompatible",
  "LocalOpenAICompatible",
  "CustomerPrivateEndpoint",
  "Other"
] as const;

const DEPLOYMENT_TYPES = [
  "Cloud",
  "CustomerVPC",
  "OnPrem",
  "LocalRunner",
  "AirGappedFuture"
] as const;

const SESSION_MODES: ModelSessionMode[] = [
  "PlanOnly",
  "ReadOnlyEvidence",
  "SafeValidation",
  "GuidedRemediation",
  "HighAssurance"
];

const SAFETY_LEVELS = [
  "PassiveReadOnly",
  "ActiveNonInvasive",
  "ControlledValidation",
  "BASLite",
  "AdvancedAdversarial"
] as const;

const fieldClass = "flex flex-col gap-1 text-sm text-muted";
const inputClass =
  "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const listItemClass =
  "flex flex-col gap-2 rounded-control border border-line bg-surface p-3";

async function loadGatewayState(): Promise<GatewayState> {
  const auth = await browserPeriscanApiClient.getMe();
  const [providers, policies, tools, sessions, scopes, runners] =
    await Promise.all([
      browserPeriscanApiClient.listModelProviders(),
      browserPeriscanApiClient.listModelPolicyProfiles(),
      browserPeriscanApiClient.listModelTools(),
      browserPeriscanApiClient.listModelSessions(),
      browserPeriscanApiClient.listScopes(),
      browserPeriscanApiClient.listRunners().catch(() => [] as RunnerRecord[])
    ]);

  return { auth, policies, providers, runners, scopes, sessions, tools };
}

async function loadSessionDetail(
  modelSessionId: string
): Promise<SessionDetailState> {
  const [session, toolRequests, auditEvents, turns] = await Promise.all([
    browserPeriscanApiClient.getModelSession(modelSessionId),
    browserPeriscanApiClient.listModelToolRequests(modelSessionId),
    browserPeriscanApiClient.listModelGatewayAuditEvents(modelSessionId),
    browserPeriscanApiClient.listModelSessionTurns(modelSessionId)
  ]);

  return { auditEvents, session, toolRequests, turns };
}

export function ModelGatewayWorkbench() {
  const [state, setState] = useState<GatewayState>(INITIAL_STATE);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [detail, setDetail] = useState<SessionDetailState | null>(null);

  const [providerForm, setProviderForm] = useState({
    apiKey: "",
    deploymentType: "Cloud" as (typeof DEPLOYMENT_TYPES)[number],
    endpointUrl: "https://api.openai.com/v1",
    adapterAlias: "",
    adapterModel: "",
    precisionMode: "ProviderManaged" as ModelPrecisionMode,
    providerName: "Customer OpenAI",
    providerType: "OpenAICompatible" as (typeof PROVIDER_TYPES)[number]
  });
  const [policyForm, setPolicyForm] = useState({
    allowedModes: ["PlanOnly", "ReadOnlyEvidence"] as ModelSessionMode[],
    description: "Read-only analyst profile.",
    maxSafetyLevel: "PassiveReadOnly" as (typeof SAFETY_LEVELS)[number],
    name: "Read-only analyst"
  });
  const [sessionForm, setSessionForm] = useState({
    mode: "ReadOnlyEvidence" as ModelSessionMode,
    modelPolicyProfileId: "",
    modelProviderId: "",
    adapterAlias: "",
    precisionMode: "ProviderManaged" as ModelPrecisionMode,
    requestedModel: "",
    purpose: "Investigate exposures",
    scopeId: ""
  });
  const [turnPrompt, setTurnPrompt] = useState("");
  const [turnQueueLane, setTurnQueueLane] = useState<"Standard" | "Priority">(
    "Standard"
  );
  const [missionDraft, setMissionDraft] =
    useState<ConversationalMissionDraft | null>(null);
  const [hybridCompileFromDraft, setHybridCompileFromDraft] =
    useState<HybridCompileInputFromDraft | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);

  async function buildMissionDraft(input: {
    intent: string;
    source: "AevProofPlanPreset" | "ThreatLibraryProofPreset" | "FreeformIntent";
    title: string;
  }) {
    setDraftBusy(true);
    setErrorMessage(null);
    setHybridCompileFromDraft(null);
    try {
      const verifiedScope =
        state.scopes.find((scope) => scope.verificationStatus === "Verified") ??
        state.scopes[0] ??
        null;
      const draft =
        await browserPeriscanApiClient.createConversationalMissionDraft({
          intent: input.intent,
          maximumSteps: 4,
          scopeId: verifiedScope?.scopeId,
          source: input.source,
          title: input.title
        });
      setMissionDraft(draft);
      setTurnPrompt(input.intent);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof PeriscanApiClientError
          ? error.message
          : "Unable to create mission draft."
      );
    } finally {
      setDraftBusy(false);
    }
  }

  async function convertDraftToHybridCompileInput() {
    if (!missionDraft) {
      return;
    }
    const runnerId = state.runners[0]?.runnerId;
    if (!runnerId) {
      setErrorMessage(
        "Register an active runner before converting a mission draft to hybrid compile input."
      );
      return;
    }
    setDraftBusy(true);
    setErrorMessage(null);
    try {
      const verifiedScope =
        state.scopes.find((scope) => scope.verificationStatus === "Verified") ??
        state.scopes[0] ??
        null;
      const converted =
        await browserPeriscanApiClient.convertConversationalMissionDraftToHybridCompileInput(
          {
            draft: missionDraft,
            options: {
              queueTasks: false,
              runnerId,
              scopeId: missionDraft.scopeId ?? verifiedScope?.scopeId,
              targetHost:
                missionDraft.targetHost ??
                (verifiedScope?.value
                  ? `host.${verifiedScope.value}`
                  : undefined)
            }
          }
        );
      setHybridCompileFromDraft(converted);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof PeriscanApiClientError
          ? error.message
          : "Unable to convert mission draft to hybrid compile input."
      );
    } finally {
      setDraftBusy(false);
    }
  }

  async function reload() {
    setState(await loadGatewayState());
    setLoadStatus("authenticated");
  }

  useEffect(() => {
    let active = true;
    setLoadStatus("loading");

    void loadGatewayState()
      .then((next) => {
        if (active) {
          setState(next);
          setLoadStatus("authenticated");
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof PeriscanApiClientError && error.status === 401) {
          setState(INITIAL_STATE);
          setLoadStatus("unauthenticated");
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load the gateway."
        );
        setLoadStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  async function withBusy(task: () => Promise<void>) {
    setErrorMessage(null);
    setIsBusy(true);

    try {
      await task();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gateway request failed."
      );
    } finally {
      setIsBusy(false);
    }
  }

  function run(task: () => Promise<void>) {
    startTransition(() => {
      void withBusy(task);
    });
  }

  async function openSession(modelSessionId: string) {
    setDetail(await loadSessionDetail(modelSessionId));
  }

  const activeDetailId = detail?.session.modelSessionId ?? null;
  const hasLiveTurn = detail?.turns.some((turn) => turn.status === "Enqueued");

  useEffect(() => {
    if (!activeDetailId || !hasLiveTurn) return;
    let active = true;
    const timer = window.setInterval(() => {
      void loadSessionDetail(activeDetailId).then((next) => {
        if (active) setDetail(next);
      });
    }, 1_500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeDetailId, hasLiveTurn]);

  if (loadStatus === "loading") {
    return (
      <StatusPanel
        body="Resolving your session and loading the Frontier Gateway control plane..."
        eyebrow="Frontier Gateway"
        kind="loading"
        title="Loading the Model Gateway"
      />
    );
  }

  if (loadStatus === "unauthenticated") {
    return (
      <StatusPanel
        body="Sign in from the workspace to register a model provider, define policy profiles, and run policy-controlled model sessions."
        eyebrow="Frontier Gateway"
        kind="info"
        title="Sign in to use the Model Gateway"
      />
    );
  }

  if (loadStatus === "error") {
    return (
      <StatusPanel
        actions={
          <Button variant="secondary" onClick={() => run(reload)}>
            Retry
          </Button>
        }
        body={errorMessage ?? "Unable to load the Model Gateway."}
        eyebrow="Frontier Gateway"
        kind="error"
        title="Model Gateway unavailable"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {errorMessage ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-danger">{errorMessage}</p>
          <button
            aria-label="Dismiss error"
            className="text-xs text-muted underline"
            onClick={() => setErrorMessage(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* P04-18: hard-label stub advanced-safety helpers — not enterprise AI governance. */}
      <div
        className="rounded-control border border-approval/40 bg-approval/10 px-3 py-2 text-sm text-muted"
        data-testid="model-gateway-advanced-safety-honesty"
        role="note"
      >
        <p className="font-medium text-ink">
          Not enterprise AI governance — safety ceiling honesty
        </p>
        <p className="mt-1">
          Production controls here are allow/block lists, session mode gates,
          safety ceiling, redaction, and the operator kill switch (terminates
          sessions and blocks pending tool requests). Behavioral anomaly scores
          and blast-radius numbers inside the policy engine are{" "}
          <strong className="text-ink">stubs / synthetic</strong> — not a trained
          anomaly model, not measured network blast radius, and not
          certification-grade AI governance. Do not sell them as such.
        </p>
      </div>

      <ModelFinOpsConsole providers={state.providers} />

      <Card elevated className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">Providers</h2>
          <Badge
            tone="neutral"
            role="status"
            aria-label={`Registered provider count: ${state.providers.length}`}
          >
            {state.providers.length} registered
          </Badge>
        </div>
        <p className="text-sm text-muted">
          Bring your own frontier model. The API key is encrypted at rest, never
          returned on read, and never sent to the model.
        </p>
        {state.providers.length === 0 ? (
          <p className="text-sm text-muted">No providers registered yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.providers.map((provider) => (
              <li className={listItemClass} key={provider.modelProviderId}>
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-ink">{provider.providerName}</strong>
                  <StatusPill status={provider.status} />
                </div>
                <p className="text-sm text-muted">
                  {provider.providerType} · {provider.deploymentType} ·{" "}
                  {provider.endpointUrl}
                </p>
                <p className="text-xs text-muted">
                  Precision:{" "}
                  {provider.servingCapabilities.precisionModes.join(", ")} ·
                  Adapters:{" "}
                  {provider.servingCapabilities.adapterAliases.length > 0
                    ? provider.servingCapabilities.adapterAliases
                        .map((adapter) => adapter.alias)
                        .join(", ")
                    : "none declared"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() =>
                      run(async () => {
                        const result =
                          await browserPeriscanApiClient.testModelProviderConnection(
                            provider.modelProviderId
                          );

                        setErrorMessage(
                          `${result.ok ? "Connection OK" : "Connection failed"}: ${result.message}`
                        );
                        await reload();
                      })
                    }
                  >
                    Test connection
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() =>
                      run(async () => {
                        await browserPeriscanApiClient.deleteModelProvider(
                          provider.modelProviderId
                        );
                        await reload();
                      })
                    }
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              await browserPeriscanApiClient.createModelProvider({
                allowedUseCases: [],
                apiKey: providerForm.apiKey ? providerForm.apiKey : null,
                authMethod: "bearer",
                deploymentType: providerForm.deploymentType,
                endpointUrl: providerForm.endpointUrl,
                providerName: providerForm.providerName,
                providerType: providerForm.providerType,
                servingCapabilities: {
                  adapterAliases:
                    providerForm.adapterAlias && providerForm.adapterModel
                      ? [
                          {
                            alias: providerForm.adapterAlias,
                            model: providerForm.adapterModel,
                            status: "Active"
                          }
                        ]
                      : [],
                  defaultPrecisionMode: providerForm.precisionMode,
                  precisionModes: [providerForm.precisionMode],
                  source: "ProviderDeclared",
                  supportsAdapterHotSwap: false,
                  supportsUsageByAdapter: Boolean(providerForm.adapterAlias)
                }
              });
              setProviderForm((current) => ({ ...current, apiKey: "" }));
              await reload();
            });
          }}
        >
          <label className={fieldClass}>
            <span>Name</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setProviderForm((current) => ({
                  ...current,
                  providerName: event.target.value
                }))
              }
              required
              value={providerForm.providerName}
            />
          </label>
          <label className={fieldClass}>
            <span>Provider type</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setProviderForm((current) => ({
                  ...current,
                  providerType: event.target
                    .value as (typeof PROVIDER_TYPES)[number]
                }))
              }
              value={providerForm.providerType}
            >
              {PROVIDER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClass}>
            <span>Deployment</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setProviderForm((current) => ({
                  ...current,
                  deploymentType: event.target
                    .value as (typeof DEPLOYMENT_TYPES)[number]
                }))
              }
              value={providerForm.deploymentType}
            >
              {DEPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClass}>
            <span>Endpoint URL</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setProviderForm((current) => ({
                  ...current,
                  endpointUrl: event.target.value
                }))
              }
              required
              value={providerForm.endpointUrl}
            />
          </label>
          <label className={fieldClass}>
            <span>API key (write-only)</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setProviderForm((current) => ({
                  ...current,
                  apiKey: event.target.value
                }))
              }
              placeholder="sk-..."
              type="password"
              value={providerForm.apiKey}
            />
          </label>
          <label className={fieldClass}>
            <span>Managed adapter alias (optional)</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setProviderForm((current) => ({
                  ...current,
                  adapterAlias: event.target.value
                }))
              }
              placeholder="security-review-v2"
              value={providerForm.adapterAlias}
            />
          </label>
          <label className={fieldClass}>
            <span>Adapter model / endpoint name</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setProviderForm((current) => ({
                  ...current,
                  adapterModel: event.target.value
                }))
              }
              placeholder="ft:model-or-adapter-id"
              value={providerForm.adapterModel}
            />
          </label>
          <label className={fieldClass}>
            <span>Provider precision</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setProviderForm((current) => ({
                  ...current,
                  precisionMode: event.target.value as ModelPrecisionMode
                }))
              }
              value={providerForm.precisionMode}
            >
              {[
                "ProviderManaged",
                "FP32",
                "TF32",
                "BF16",
                "FP16",
                "INT8",
                "INT4"
              ].map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button disabled={isBusy} type="submit">
              Register provider
            </Button>
          </div>
        </form>
      </Card>

      <Card elevated className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">Policy profiles</h2>
          <Badge
            tone="neutral"
            role="status"
            aria-label={`Policy profile count: ${state.policies.length}`}
          >
            {state.policies.length} defined
          </Badge>
        </div>
        <p className="text-sm text-muted">
          Policy profiles gate which modes a session can use, the maximum safety
          level a tool can reach, and whether raw evidence is ever exposed.
        </p>
        {state.policies.length === 0 ? (
          <p className="text-sm text-muted">No policy profiles yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.policies.map((policy) => (
              <li className={listItemClass} key={policy.modelPolicyProfileId}>
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-ink">{policy.name}</strong>
                  <Badge tone="neutral">{policy.maxSafetyLevel}</Badge>
                </div>
                <p className="text-sm text-muted">{policy.description}</p>
                <p className="text-sm text-muted">
                  Modes: {policy.allowedModes.join(", ")} · Raw evidence:{" "}
                  {policy.allowRawEvidence ? "allowed" : "blocked"}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              await browserPeriscanApiClient.createModelPolicyProfile({
                allowedDataClasses: [],
                allowedModes: policyForm.allowedModes,
                allowedTools: [],
                allowExternalValidation: false,
                allowInternalValidation: false,
                allowRawEvidence: false,
                allowRunnerTasks: false,
                allowSensitiveContext: false,
                allowTicketCreation: false,
                approvalRequiredAboveLevel: "ActiveNonInvasive",
                blockedTools: [],
                description: policyForm.description,
                maxSafetyLevel: policyForm.maxSafetyLevel,
                name: policyForm.name,
                redactionPolicy: "default",
                sessionTimeoutMinutes: 60
              });
              await reload();
            });
          }}
        >
          <label className={fieldClass}>
            <span>Name</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setPolicyForm((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              required
              value={policyForm.name}
            />
          </label>
          <label className={fieldClass}>
            <span>Description</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setPolicyForm((current) => ({
                  ...current,
                  description: event.target.value
                }))
              }
              required
              value={policyForm.description}
            />
          </label>
          <label className={fieldClass}>
            <span>Max safety level</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setPolicyForm((current) => ({
                  ...current,
                  maxSafetyLevel: event.target
                    .value as (typeof SAFETY_LEVELS)[number]
                }))
              }
              value={policyForm.maxSafetyLevel}
            >
              {SAFETY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <fieldset className={fieldClass}>
            <span>Allowed modes</span>
            <div className="flex flex-wrap gap-3">
              {SESSION_MODES.map((mode) => (
                <label
                  className="flex items-center gap-1 text-xs text-muted"
                  key={mode}
                >
                  <input
                    checked={policyForm.allowedModes.includes(mode)}
                    onChange={(event) =>
                      setPolicyForm((current) => ({
                        ...current,
                        allowedModes: event.target.checked
                          ? [...current.allowedModes, mode]
                          : current.allowedModes.filter((m) => m !== mode)
                      }))
                    }
                    type="checkbox"
                  />
                  {mode}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-end">
            <Button
              disabled={isBusy || policyForm.allowedModes.length === 0}
              type="submit"
            >
              Create policy profile
            </Button>
          </div>
        </form>
      </Card>

      <Card
        elevated
        className="flex flex-col gap-3"
        data-testid="conversational-threat-builder"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">
            Conversational threat builder
          </h2>
          <Badge tone="neutral">mission draft · not executable BAS</Badge>
        </div>
        <p className="text-sm text-muted">
          Presets produce a typed mission draft object for review and later
          Hybrid Execution Compiler compile. They do not dispatch runner tasks
          or claim multi-agent BAS.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isBusy || draftBusy}
            onClick={() =>
              void buildMissionDraft({
                intent:
                  "Build a governed AEV/CTEM proof plan using only safety-gated modules and AttackPacks that are liveSupported or dry-run. Prefer measured HTTP/TLS/DNS, external exposure, and path validation. Explicitly exclude malware, phishing, DNS-exfil, and live kill-chain. Output plan steps, policy gates, and recommended schedule.",
                source: "AevProofPlanPreset",
                title: "AEV proof mission draft"
              })
            }
          >
            AEV proof plan (mission draft)
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isBusy || draftBusy}
            onClick={() =>
              void buildMissionDraft({
                intent:
                  "Propose a continuous validation plan from the Threat Library mapped to pillars (ASV, APV, SCV, DRV, CSV, EXV). Emphasize measured edges, fix verification, and EvidencePack output for EXV revalidation. Label any simulated steps honestly; do not claim full multi-vector BAS.",
                source: "ThreatLibraryProofPreset",
                title: "Threat Library mission draft"
              })
            }
          >
            Threat Library proof draft
          </Button>
        </div>
        {missionDraft ? (
          <div
            className="rounded-control border border-line bg-surface p-3 text-sm"
            data-testid="conversational-mission-draft"
          >
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-ink">{missionDraft.title}</strong>
              <Badge>executable: false</Badge>
              <Badge>{missionDraft.safetyCeiling}</Badge>
              <Badge>{missionDraft.moduleIds.length} modules</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              {missionDraft.honesty.summary}
            </p>
            <ul className="mt-2 list-disc pl-5 text-xs text-ink">
              {missionDraft.steps.map((step) => (
                <li key={step.stepKey}>
                  {step.agentRole} · {step.moduleId} · {step.safetyLevel}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isBusy || draftBusy}
                onClick={() => void convertDraftToHybridCompileInput()}
                data-testid="convert-draft-to-hybrid-compile"
              >
                Convert to hybrid compile input
              </Button>
              <span className="text-xs text-muted">
                Draft stays non-executable BAS · queueTasks defaults false
              </span>
            </div>
            {hybridCompileFromDraft ? (
              <div
                className="mt-3 rounded-control border border-line bg-surface-2 p-2 text-xs"
                data-testid="hybrid-compile-input-from-draft"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">draftExecutable: false</Badge>
                  <Badge>
                    {hybridCompileFromDraft.compileInput.moduleIds?.length ?? 0}{" "}
                    passive modules
                  </Badge>
                  <Badge>
                    queueTasks:{" "}
                    {String(hybridCompileFromDraft.compileInput.queueTasks)}
                  </Badge>
                </div>
                <p className="mt-1 text-muted">
                  {hybridCompileFromDraft.honesty.summary}
                </p>
                <ul className="mt-1 list-disc pl-5 text-ink">
                  {(hybridCompileFromDraft.compileInput.moduleIds ?? []).map(
                    (moduleId) => (
                      <li key={moduleId}>{moduleId}</li>
                    )
                  )}
                </ul>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted">
              Next: Hybrid Execution Compiler for signed passive runner tasks —
              not live APT/Atomic/multi-agent offense.
            </p>
          </div>
        ) : null}
      </Card>

      <Card elevated className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">Sessions</h2>
          <Badge
            tone="neutral"
            role="status"
            aria-label={`Model session count: ${state.sessions.length}`}
          >
            {state.sessions.length} total
          </Badge>
        </div>
        {state.sessions.length === 0 ? (
          <p className="text-sm text-muted">No sessions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.sessions.map((session) => (
              <li className={listItemClass} key={session.modelSessionId}>
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      run(() => openSession(session.modelSessionId))
                    }
                  >
                    {session.purpose}
                  </Button>
                  <StatusPill status={session.status} />
                </div>
                <p className="text-sm text-muted">Mode: {session.mode}</p>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              const created = await browserPeriscanApiClient.createModelSession(
                {
                  mode: sessionForm.mode,
                  adapterAlias: sessionForm.adapterAlias || null,
                  modelPolicyProfileId: sessionForm.modelPolicyProfileId,
                  modelProviderId: sessionForm.modelProviderId,
                  purpose: sessionForm.purpose,
                  precisionMode: sessionForm.precisionMode,
                  requestedModel: sessionForm.requestedModel || null,
                  scopeIds: sessionForm.scopeId ? [sessionForm.scopeId] : []
                }
              );
              await reload();
              await openSession(created.modelSessionId);
            });
          }}
        >
          <label className={fieldClass}>
            <span>Provider</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  modelProviderId: event.target.value
                }))
              }
              required
              value={sessionForm.modelProviderId}
            >
              <option value="">Select a provider</option>
              {state.providers.map((provider) => (
                <option
                  key={provider.modelProviderId}
                  value={provider.modelProviderId}
                >
                  {provider.providerName}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClass}>
            <span>Policy profile</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  modelPolicyProfileId: event.target.value
                }))
              }
              required
              value={sessionForm.modelPolicyProfileId}
            >
              <option value="">Select a policy profile</option>
              {state.policies.map((policy) => (
                <option
                  key={policy.modelPolicyProfileId}
                  value={policy.modelPolicyProfileId}
                >
                  {policy.name}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClass}>
            <span>Mode</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  mode: event.target.value as ModelSessionMode
                }))
              }
              value={sessionForm.mode}
            >
              {SESSION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClass}>
            <span>Scope</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  scopeId: event.target.value
                }))
              }
              required
              value={sessionForm.scopeId}
            >
              <option value="">Select a scope</option>
              {state.scopes.map((scope) => (
                <option key={scope.scopeId} value={scope.scopeId}>
                  {scope.value}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClass}>
            <span>Purpose</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  purpose: event.target.value
                }))
              }
              required
              value={sessionForm.purpose}
            />
          </label>
          <label className={fieldClass}>
            <span>Model override (optional)</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  requestedModel: event.target.value
                }))
              }
              placeholder="Provider default"
              value={sessionForm.requestedModel}
            />
          </label>
          <label className={fieldClass}>
            <span>Adapter alias (optional)</span>
            <input
              className={inputClass}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  adapterAlias: event.target.value
                }))
              }
              placeholder="Declared provider alias"
              value={sessionForm.adapterAlias}
            />
          </label>
          <label className={fieldClass}>
            <span>Precision mode</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setSessionForm((current) => ({
                  ...current,
                  precisionMode: event.target.value as ModelPrecisionMode
                }))
              }
              value={sessionForm.precisionMode}
            >
              {[
                "ProviderManaged",
                "FP32",
                "TF32",
                "BF16",
                "FP16",
                "INT8",
                "INT4"
              ].map((mode) => (
                <option key={mode}>{mode}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button disabled={isBusy} type="submit">
              Create session
            </Button>
          </div>
        </form>
      </Card>

      {detail ? (
        <Card elevated className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-ink">
              {detail.session.purpose}
            </h2>
            <StatusPill status={detail.session.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() =>
                run(async () => {
                  await browserPeriscanApiClient.startModelSession(
                    detail.session.modelSessionId
                  );
                  await openSession(detail.session.modelSessionId);
                  await reload();
                })
              }
            >
              Start
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() =>
                run(async () => {
                  await browserPeriscanApiClient.pauseModelSession(
                    detail.session.modelSessionId
                  );
                  await openSession(detail.session.modelSessionId);
                  await reload();
                })
              }
            >
              Pause
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={isBusy}
              onClick={() =>
                run(async () => {
                  await browserPeriscanApiClient.terminateModelSession(
                    detail.session.modelSessionId
                  );
                  await openSession(detail.session.modelSessionId);
                  await reload();
                })
              }
            >
              Terminate
            </Button>
          </div>

          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                await browserPeriscanApiClient.submitModelSessionTurn(
                  detail.session.modelSessionId,
                  { prompt: turnPrompt, queueLane: turnQueueLane }
                );
                setTurnPrompt("");
                await openSession(detail.session.modelSessionId);
              });
            }}
          >
            <label className={`${fieldClass} flex-1`}>
              <span>Prompt the model (enqueues a turn)</span>
              <input
                className={inputClass}
                onChange={(event) => setTurnPrompt(event.target.value)}
                placeholder="Investigate the top exposure in scope..."
                required
                value={turnPrompt}
              />
            </label>
            <Button disabled={isBusy} type="submit">
              Submit turn
            </Button>
            <label className={fieldClass}>
              <span>Queue lane</span>
              <select
                className={inputClass}
                onChange={(event) =>
                  setTurnQueueLane(
                    event.target.value as "Standard" | "Priority"
                  )
                }
                value={turnQueueLane}
              >
                <option value="Standard">Standard · fair share</option>
                <option value="Priority">Priority · tenant-enabled</option>
              </select>
            </label>
            <p className="mt-2 text-xs text-muted">
              Prefer the Conversational threat builder card above for typed
              mission drafts (not executable BAS). Session turns remain
              policy-gated model prompts only.
            </p>
          </form>

          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">Live turns</h3>
            <span className="text-xs text-muted">
              Policy-isolated results · refreshes while running
            </span>
          </div>
          {detail.turns.length === 0 ? (
            <p className="text-sm text-muted">
              No turns yet. Submit a prompt to see queue, provider, cache, and
              policy state here.
            </p>
          ) : (
            <ul
              className="flex flex-col gap-2"
              aria-label="Model turn activity"
            >
              {detail.turns.map((turn) => (
                <li className={listItemClass} key={turn.turnId}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {turn.status === "Enqueued" ? (
                        <span
                          aria-label="Turn active"
                          className="h-2 w-2 animate-pulse rounded-full bg-brand"
                        />
                      ) : null}
                      <strong className="text-ink">
                        {turn.promptRedacted ||
                          `Turn ${turn.turnId.slice(0, 8)}`}
                      </strong>
                    </div>
                    <StatusPill status={turn.status} />
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    <Badge>{turn.queueLane} lane</Badge>
                    <Badge>Cache {turn.cacheDisposition.toLowerCase()}</Badge>
                    {turn.model ? <Badge>{turn.model}</Badge> : null}
                    {turn.latencyMs !== null ? (
                      <span>{turn.latencyMs} ms provider path</span>
                    ) : null}
                    {turn.queueWaitMs !== null ? (
                      <span>{turn.queueWaitMs} ms queue</span>
                    ) : null}
                  </div>
                  {turn.assistantTextRedacted ? (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
                      {turn.assistantTextRedacted}
                    </p>
                  ) : turn.status === "Enqueued" ? (
                    <p className="text-sm text-muted">
                      Waiting for the governed worker to evaluate cache,
                      context, provider route, and tools.
                    </p>
                  ) : null}
                  {turn.failureCategory ? (
                    <p className="text-sm text-danger">
                      {turn.failureCategory}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <h3 className="text-sm font-semibold text-ink">Tool requests</h3>
          <p className="text-xs text-muted">
            Every tool use surfaces its request id and any bound evidence ids.
            Open{" "}
            <Link
              href="/workflows"
              className="font-medium text-brand hover:underline"
            >
              Agent Workflows → Durable flight recorder
            </Link>{" "}
            for checkpoint seal / fork replay on the linked run.
          </p>
          {detail.toolRequests.length === 0 ? (
            <p className="text-sm text-muted">No tool requests yet.</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Tool request receipts">
              {detail.toolRequests.map((requestItem) => {
                const evidenceIds = requestItem.result?.evidenceIds ?? [];
                return (
                  <li className={listItemClass} key={requestItem.toolRequestId}>
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-ink">{requestItem.toolName}</strong>
                      <StatusPill status={requestItem.status} />
                    </div>
                    <p className="font-mono text-xs text-muted" title={requestItem.toolRequestId}>
                      toolRequestId {requestItem.toolRequestId}
                    </p>
                    <p className="text-sm text-muted">
                      {requestItem.requestReason}
                    </p>
                    {requestItem.denialReason ? (
                      <p className="text-sm text-muted">
                        Denied: {requestItem.denialReason}
                      </p>
                    ) : null}
                    {evidenceIds.length > 0 ? (
                      <ul
                        className="flex flex-wrap gap-1.5"
                        aria-label={`Evidence ids for ${requestItem.toolName}`}
                      >
                        {evidenceIds.map((evidenceId) => (
                          <li key={evidenceId}>
                            <Link
                              href={`/evidence?evidenceId=${encodeURIComponent(evidenceId)}`}
                              className="inline-flex rounded-control border border-line bg-bg px-1.5 py-0.5 font-mono text-[11px] text-brand hover:underline"
                              title={evidenceId}
                            >
                              evidence {evidenceId.slice(0, 8)}…
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {requestItem.status === "RequiresApproval" ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isBusy}
                            onClick={() =>
                              run(async () => {
                                await browserPeriscanApiClient.approveModelToolRequest(
                                  requestItem.toolRequestId
                                );
                                await openSession(detail.session.modelSessionId);
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isBusy}
                            onClick={() =>
                              run(async () => {
                                await browserPeriscanApiClient.denyModelToolRequest(
                                  requestItem.toolRequestId
                                );
                                await openSession(detail.session.modelSessionId);
                              })
                            }
                          >
                            Deny
                          </Button>
                        </>
                      ) : null}
                      {requestItem.status === "Allowed" ||
                      requestItem.status === "Approved" ? (
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={() =>
                            run(async () => {
                              await browserPeriscanApiClient.executeModelToolRequest(
                                requestItem.toolRequestId
                              );
                              await openSession(detail.session.modelSessionId);
                            })
                          }
                        >
                          Execute
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="text-sm font-semibold text-ink">Audit timeline</h3>
          {detail.auditEvents.length === 0 ? (
            <p className="text-sm text-muted">No audit events yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {detail.auditEvents.map((event) => (
                <li className={listItemClass} key={event.eventId}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-ink">{event.eventType}</strong>
                    <span className="text-sm text-muted">
                      {event.createdAt}
                    </span>
                  </div>
                  {event.toolName ? (
                    <p className="text-sm text-muted">Tool: {event.toolName}</p>
                  ) : null}
                  {event.toolRequestId ? (
                    <p className="font-mono text-xs text-muted" title={event.toolRequestId}>
                      toolRequestId {event.toolRequestId}
                    </p>
                  ) : null}
                  {event.evidenceIds.length > 0 ? (
                    <ul
                      className="flex flex-wrap gap-1.5"
                      aria-label="Audit evidence ids"
                    >
                      {event.evidenceIds.map((evidenceId) => (
                        <li key={evidenceId}>
                          <Link
                            href={`/evidence?evidenceId=${encodeURIComponent(evidenceId)}`}
                            className="font-mono text-[11px] text-brand hover:underline"
                            title={evidenceId}
                          >
                            evidence {evidenceId.slice(0, 8)}…
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-ink">
            Operator kill switch
          </h2>
          <Badge tone="danger">Emergency · real control</Badge>
        </div>
        <p className="text-sm text-muted">
          Real control: immediately terminate all active model sessions and block
          every pending tool request for this tenant. This is not the synthetic
          getKillSwitchStatus stub used only inside secondary policy helpers.
        </p>
        <div>
          <Button
            variant="danger"
            disabled={isBusy}
            onClick={() =>
              run(async () => {
                const result =
                  await browserPeriscanApiClient.activateModelGatewayKillSwitch(
                    {
                      enabled: true,
                      reason:
                        "Operator-triggered kill switch from the Model Gateway UI."
                    }
                  );

                setErrorMessage(
                  `Kill switch activated: ${result.terminatedSessions} session(s) terminated, ${result.blockedToolRequests} request(s) blocked.`
                );
                setDetail(null);
                await reload();
              })
            }
          >
            Activate kill switch
          </Button>
        </div>
      </Card>
    </div>
  );
}
