"use client";

import { useMemo, useState } from "react";

import type {
  CreateModelPolicyProfileInput,
  ModelSessionMode,
  ModelPolicyProfile,
  ModelProvider,
  ModelTool
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource, type ApiResource } from "../hooks/use-api-resource";
import { ModelFinOpsConsole } from "./model-finops-console";
import { ModelInterventionQueue } from "./model-intervention-queue";
import {
  ErrorState,
  ConfirmDialog,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  SafetyLevelBadge,
  StateBadge,
  Tabs,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

const PROVIDER_TYPES = [
  "AnthropicCompatible",
  "OpenAICompatible",
  "GoogleCompatible",
  "MicrosoftCompatible",
  "AWSBedrockCompatible",
  "LocalOpenAICompatible",
  "CustomerPrivateEndpoint",
  "SpecializedCyberModel",
  "Other"
] as const;
const DEPLOYMENT_TYPES = [
  "Cloud",
  "CustomerVPC",
  "OnPrem",
  "LocalRunner",
  "AirGappedFuture"
] as const;
const SAFETY_LEVELS = [
  "PassiveReadOnly",
  "ActiveNonInvasive",
  "ControlledValidation",
  "BASLite",
  "AdvancedAdversarial"
] as const;
const SESSION_MODES: ModelSessionMode[] = [
  "PlanOnly",
  "ReadOnlyEvidence",
  "SafeValidation",
  "GuidedRemediation",
  "HighAssurance"
];

const PROVIDER_TONE: Record<string, StateTone> = {
  Active: "fixed",
  Disabled: "inconclusive",
  Error: "missed"
};

const EVENT_TONE: Record<string, StateTone> = {
  ToolAllowed: "validated",
  ToolExecuted: "fixed",
  ToolResultReturned: "fixed",
  RedactionApplied: "blocked",
  ApprovalRequested: "approval",
  ToolRequested: "inconclusive",
  ContextBundleCreated: "inconclusive",
  SessionCreated: "inconclusive",
  SessionStarted: "validated",
  SessionPaused: "inconclusive",
  SessionTerminated: "inconclusive",
  ToolDenied: "missed",
  ToolFailed: "missed",
  SensitiveDataBlocked: "missed",
  InterventionLinkIssued: "brand",
  InterventionResumed: "fixed",
  InterventionCancelled: "missed",
  InterventionExpired: "inconclusive",
  InterventionRejected: "missed"
};

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function FrontierGatewayConsole() {
  const providers = useApiResource(() => api.listModelProviders(), []);
  const policies = useApiResource(() => api.listModelPolicyProfiles(), []);
  const tools = useApiResource(() => api.listModelTools(), []);
  const events = useApiResource(() => api.listModelGatewayAuditEvents(), []);

  const enabledTools = (tools.data ?? []).filter((t) => t.enabled).length;
  const denials = (events.data ?? []).filter(
    (e) =>
      e.eventType === "ToolDenied" || e.eventType === "SensitiveDataBlocked"
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Autonomous · Frontier Gateway
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Frontier Gateway
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          The safety proxy for BYO frontier models. A model never gets raw
          secrets or direct network access — it can only request typed,
          code-defined tools, and every request is policy-checked, redacted, and
          audited here.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Providers"
          value={(providers.data ?? []).length}
          tone="brand"
        />
        <Tile
          label="Policy profiles"
          value={(policies.data ?? []).length}
          tone="blocked"
        />
        <Tile label="Tools enabled" value={enabledTools} tone="validated" />
        <Tile label="Denied / blocked" value={denials} tone="missed" />
      </div>

      <KillSwitch />

      <ModelFinOpsConsole providers={providers.data ?? []} />

      <Tabs
        aria-label="Frontier Gateway configuration"
        items={[
          {
            value: "interventions",
            label: "Interventions",
            content: <ModelInterventionQueue />
          },
          {
            value: "providers",
            label: "Providers",
            content: <ProvidersTab providers={providers} />
          },
          {
            value: "policies",
            label: "Policy rules",
            content: <PoliciesTab policies={policies} />
          },
          {
            value: "tools",
            label: "Tool governance",
            content: <ToolsTab tools={tools} />
          },
          {
            value: "logs",
            label: "Decision log",
            content: <LogsTab events={events} />
          }
        ]}
      />
    </div>
  );
}

function KillSwitch() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.activateModelGatewayKillSwitch({
        enabled: true,
        reason: "Manual kill switch from Frontier Gateway console"
      });
      setResult(
        `Kill switch engaged — ${r.terminatedSessions} session(s) terminated, ${r.blockedToolRequests} pending request(s) blocked.`
      );
      setConfirming(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't engage the kill switch."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-missed/40 bg-missed/[0.06] px-4 py-3">
      <svg
        width="20"
        height="20"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="text-missed"
      >
        <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 4.5v4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[13px] font-semibold text-ink">
          Kill switch
        </p>
        <p className="text-[12px] text-muted">
          Immediately terminate all active sessions and block every pending tool
          request for this tenant.
        </p>
        {result ? (
          <p className="mt-0.5 text-[12px] text-fixed">{result}</p>
        ) : null}
        {error ? (
          <p className="mt-0.5 text-[12px] text-missed">{error}</p>
        ) : null}
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={activate}
            disabled={busy}
            className={cn(
              buttonClassName({ size: "sm", variant: "primary" }),
              "!bg-missed"
            )}
          >
            {busy ? "Engaging…" : "Confirm — kill all"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={cn(
            buttonClassName({ size: "sm", variant: "secondary" }),
            "text-danger"
          )}
        >
          Engage kill switch
        </button>
      )}
    </div>
  );
}

function ProvidersTab({
  providers
}: {
  providers: ApiResource<ModelProvider[]>;
}) {
  const [type, setType] = useState<(typeof PROVIDER_TYPES)[number]>(
    "AnthropicCompatible"
  );
  const [deployment, setDeployment] =
    useState<(typeof DEPLOYMENT_TYPES)[number]>("Cloud");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  async function register() {
    if (!name.trim() || !endpoint.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createModelProvider({
        providerType: type,
        providerName: name.trim(),
        endpointUrl: endpoint.trim(),
        deploymentType: deployment,
        authMethod: "bearer",
        allowedUseCases: [],
        apiKey: apiKey.trim() || null
      });
      setName("");
      setEndpoint("");
      setApiKey("");
      await providers.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't register the provider."
      );
    } finally {
      setBusy(false);
    }
  }

  async function test(id: string) {
    setError(null);
    try {
      const r = await api.testModelProviderConnection(id);
      setTestResult((prev) => ({
        ...prev,
        [id]: r.ok ? "Connection ok" : r.message || "Failed"
      }));
    } catch (caught) {
      setTestResult((prev) => ({
        ...prev,
        [id]: caught instanceof Error ? caught.message : "Test failed"
      }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Connected models" />
        {providers.loading ? (
          <LoadingSkeleton rows={3} />
        ) : providers.error ? (
          <ErrorState message={providers.error} onRetry={providers.refetch} />
        ) : (providers.data ?? []).length === 0 ? (
          <div className="p-4">
            <NotConfigured
              title="No frontier models connected"
              message="Register a BYO model below. Its API key is write-only — stored encrypted, never returned, never sent to the model."
            />
          </div>
        ) : (
          <ul>
            {(providers.data ?? []).map((p) => (
              <ProviderRow
                key={p.modelProviderId}
                provider={p}
                providers={providers}
                testResult={testResult[p.modelProviderId] ?? null}
                onTest={() => test(p.modelProviderId)}
              />
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Register a model" />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <SmallLabel>Provider type</SmallLabel>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
            >
              {PROVIDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <SmallLabel>Deployment</SmallLabel>
            <select
              value={deployment}
              onChange={(e) =>
                setDeployment(e.target.value as typeof deployment)
              }
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
            >
              {DEPLOYMENT_TYPES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <SmallLabel>Name</SmallLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Claude (prod)"
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
            />
          </label>
          <label className="flex flex-col gap-1">
            <SmallLabel>Endpoint URL</SmallLabel>
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://…"
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <SmallLabel>API key (write-only, encrypted at rest)</SmallLabel>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder="sk-…"
              className="rounded-control border border-line bg-surface px-3 py-1.5 font-mono text-sm text-ink outline-none focus:border-line-strong"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={register}
              disabled={busy || !name.trim() || !endpoint.trim()}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy ? "Registering…" : "Register model"}
            </button>
            {error ? (
              <span className="ml-3 text-sm text-missed">{error}</span>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ProviderRow({
  provider,
  providers,
  testResult,
  onTest
}: {
  provider: ModelProvider;
  providers: ApiResource<ModelProvider[]>;
  testResult: string | null;
  onTest: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(provider.providerName);
  const [endpoint, setEndpoint] = useState(provider.endpointUrl);
  const [deployment, setDeployment] = useState(provider.deploymentType);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function update(input: Parameters<typeof api.updateModelProvider>[1]) {
    setBusy(true);
    setError(null);
    try {
      await api.updateModelProvider(provider.modelProviderId, input);
      setApiKey("");
      setEditing(false);
      await providers.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't update the provider."
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteModelProvider(provider.modelProviderId);
      setConfirmDelete(false);
      await providers.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't delete the provider."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13px] text-ink">{provider.providerName}</span>
        <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
          {provider.providerType}
        </span>
        <StateBadge
          tone={PROVIDER_TONE[provider.status] ?? "neutral"}
          dot={false}
        >
          {provider.status}
        </StateBadge>
        <span className="font-mono text-[11px] text-subtle">
          {provider.deploymentType}
          {provider.hasCredential ? " · key set" : " · no key"}
        </span>
        {testResult ? (
          <span className="font-mono text-[11px] text-muted">{testResult}</span>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onTest}
            disabled={busy}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Test
          </button>
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            disabled={busy}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {editing ? "Cancel" : "Edit / rotate key"}
          </button>
          <button
            type="button"
            onClick={() =>
              update({
                status: provider.status === "Disabled" ? "Active" : "Disabled"
              })
            }
            disabled={busy}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {provider.status === "Disabled" ? "Enable" : "Disable"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className={cn(
              buttonClassName({ size: "sm", variant: "ghost" }),
              "text-missed"
            )}
          >
            Delete
          </button>
        </div>
      </div>
      {editing ? (
        <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Deployment
            <select
              value={deployment}
              onChange={(event) =>
                setDeployment(event.target.value as typeof deployment)
              }
              className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
            >
              {DEPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Endpoint URL
            <input
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            New API key (optional, write-only)
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Leave blank to keep current key"
              className="rounded-control border border-line bg-elevated px-3 py-2 font-mono text-sm text-ink"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() =>
                update({
                  apiKey: apiKey.trim() || undefined,
                  deploymentType: deployment,
                  endpointUrl: endpoint.trim(),
                  providerName: name.trim()
                })
              }
              disabled={busy || !name.trim() || !endpoint.trim()}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy
                ? "Saving…"
                : apiKey
                  ? "Save and rotate key"
                  : "Save provider"}
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-missed">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete model provider?"
        description="This removes the provider configuration and encrypted credential. Existing sessions may no longer be usable."
        confirmLabel="Delete provider"
        confirmPhrase={provider.providerName}
        destructive
        busy={busy}
        error={error}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </li>
  );
}

function PoliciesTab({
  policies
}: {
  policies: ApiResource<ModelPolicyProfile[]>;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<CreateModelPolicyProfileInput>(() =>
    emptyPolicyDraft()
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModelPolicyProfile | null>(
    null
  );

  function beginEdit(policy?: ModelPolicyProfile) {
    setError(null);
    setEditingId(policy?.modelPolicyProfileId ?? "new");
    setDraft(policy ? policyDraftFrom(policy) : emptyPolicyDraft());
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (editingId === "new") {
        await api.createModelPolicyProfile(draft);
      } else if (editingId) {
        await api.updateModelPolicyProfile(editingId, draft);
      }
      setEditingId(null);
      await policies.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't save the policy profile."
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteModelPolicyProfile(deleteTarget.modelPolicyProfileId);
      setDeleteTarget(null);
      await policies.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't delete the policy profile."
      );
    } finally {
      setBusy(false);
    }
  }

  if (policies.loading)
    return (
      <Panel>
        <LoadingSkeleton rows={4} />
      </Panel>
    );
  if (policies.error)
    return (
      <Panel>
        <ErrorState message={policies.error} onRetry={policies.refetch} />
      </Panel>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          Policy profiles are the model firewall: modes, safety ceiling,
          approvals, redaction, data classes, and capability switches. Every
          change is audit logged.
        </p>
        <button
          type="button"
          onClick={() => beginEdit()}
          className={buttonClassName({ size: "sm", variant: "primary" })}
        >
          Create policy profile
        </button>
      </div>

      {(policies.data ?? []).length === 0 && editingId !== "new" ? (
        <Panel>
          <div className="p-4">
            <NotConfigured
              title="No policy profiles"
              message="Create a profile to define exactly what connected models may read, request, and execute."
            />
          </div>
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(policies.data ?? []).map((policy) => (
            <Panel key={policy.modelPolicyProfileId}>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-[15px] font-semibold text-ink">
                      {policy.name}
                    </h3>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {policy.description}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => beginEdit(policy)}
                      className={buttonClassName({
                        size: "sm",
                        variant: "secondary"
                      })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(policy)}
                      className={cn(
                        buttonClassName({ size: "sm", variant: "ghost" }),
                        "text-missed"
                      )}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {policy.allowedModes.map((mode) => (
                    <StateBadge key={mode} tone="blocked" dot={false}>
                      {mode}
                    </StateBadge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                  <Rule label="Max safety" value={policy.maxSafetyLevel} />
                  <Rule
                    label="Approval above"
                    value={policy.approvalRequiredAboveLevel}
                  />
                  <Rule label="Redaction" value={policy.redactionPolicy} />
                  <Rule
                    label="Session timeout"
                    value={`${policy.sessionTimeoutMinutes}m`}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Perm on={policy.allowRawEvidence} label="Raw evidence" />
                  <Perm
                    on={policy.allowSensitiveContext}
                    label="Sensitive context"
                  />
                  <Perm on={policy.allowRunnerTasks} label="Runner tasks" />
                  <Perm
                    on={policy.allowExternalValidation}
                    label="External validation"
                  />
                  <Perm
                    on={policy.allowInternalValidation}
                    label="Internal validation"
                  />
                  <Perm
                    on={policy.allowTicketCreation}
                    label="Ticket creation"
                  />
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {editingId ? (
        <PolicyEditor
          draft={draft}
          busy={busy}
          error={error}
          editing={editingId !== "new"}
          onChange={setDraft}
          onCancel={() => setEditingId(null)}
          onSave={save}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete model policy profile?"
        description="This removes the policy from future model sessions. Sessions already bound to it may no longer be operable."
        confirmLabel="Delete profile"
        confirmPhrase={deleteTarget?.name}
        destructive
        busy={busy}
        error={error}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function emptyPolicyDraft(): CreateModelPolicyProfileInput {
  return {
    allowedDataClasses: [],
    allowedModes: ["PlanOnly", "ReadOnlyEvidence"],
    allowedTools: [],
    allowExternalValidation: false,
    allowInternalValidation: false,
    allowRawEvidence: false,
    allowRunnerTasks: false,
    allowSensitiveContext: false,
    allowTicketCreation: false,
    approvalRequiredAboveLevel: "ActiveNonInvasive",
    blockedTools: [],
    description: "Read-only analyst profile.",
    maxSafetyLevel: "PassiveReadOnly",
    name: "Read-only analyst",
    redactionPolicy: "default",
    sessionTimeoutMinutes: 60
  };
}

function policyDraftFrom(
  policy: ModelPolicyProfile
): CreateModelPolicyProfileInput {
  return {
    allowedDataClasses: policy.allowedDataClasses,
    allowedModes: policy.allowedModes,
    allowedTools: policy.allowedTools,
    allowExternalValidation: policy.allowExternalValidation,
    allowInternalValidation: policy.allowInternalValidation,
    allowRawEvidence: policy.allowRawEvidence,
    allowRunnerTasks: policy.allowRunnerTasks,
    allowSensitiveContext: policy.allowSensitiveContext,
    allowTicketCreation: policy.allowTicketCreation,
    approvalRequiredAboveLevel: policy.approvalRequiredAboveLevel,
    blockedTools: policy.blockedTools,
    description: policy.description,
    maxSafetyLevel: policy.maxSafetyLevel,
    name: policy.name,
    redactionPolicy: policy.redactionPolicy,
    sessionTimeoutMinutes: policy.sessionTimeoutMinutes
  };
}

function PolicyEditor({
  draft,
  busy,
  error,
  editing,
  onChange,
  onCancel,
  onSave
}: {
  draft: CreateModelPolicyProfileInput;
  busy: boolean;
  error: string | null;
  editing: boolean;
  onChange: (draft: CreateModelPolicyProfileInput) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const update = <K extends keyof CreateModelPolicyProfileInput>(
    key: K,
    value: CreateModelPolicyProfileInput[K]
  ) => onChange({ ...draft, [key]: value });
  const list = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const capabilityFields = [
    ["allowRawEvidence", "Raw evidence"],
    ["allowSensitiveContext", "Sensitive context"],
    ["allowRunnerTasks", "Runner tasks"],
    ["allowExternalValidation", "External validation"],
    ["allowInternalValidation", "Internal validation"],
    ["allowTicketCreation", "Ticket creation"]
  ] as const;

  return (
    <Panel>
      <PanelHeader
        title={editing ? "Edit policy profile" : "Create policy profile"}
      />
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Name
          <input
            aria-label="Policy name"
            value={draft.name}
            onChange={(event) => update("name", event.target.value)}
            className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Description
          <input
            aria-label="Policy description"
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Max safety level
          <select
            aria-label="Max safety level"
            value={draft.maxSafetyLevel}
            onChange={(event) =>
              update(
                "maxSafetyLevel",
                event.target.value as typeof draft.maxSafetyLevel
              )
            }
            className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          >
            {SAFETY_LEVELS.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Approval required above
          <select
            aria-label="Approval required above"
            value={draft.approvalRequiredAboveLevel}
            onChange={(event) =>
              update(
                "approvalRequiredAboveLevel",
                event.target.value as typeof draft.approvalRequiredAboveLevel
              )
            }
            className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          >
            {SAFETY_LEVELS.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-xs text-muted">Allowed session modes</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {SESSION_MODES.map((mode) => (
              <label
                key={mode}
                className="flex items-center gap-1.5 text-xs text-ink"
              >
                <input
                  type="checkbox"
                  checked={draft.allowedModes.includes(mode)}
                  onChange={(event) =>
                    update(
                      "allowedModes",
                      event.target.checked
                        ? [...draft.allowedModes, mode]
                        : draft.allowedModes.filter((value) => value !== mode)
                    )
                  }
                />
                {mode}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Redaction policy
          <input
            aria-label="Redaction policy"
            value={draft.redactionPolicy}
            onChange={(event) => update("redactionPolicy", event.target.value)}
            className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Session timeout (minutes)
          <input
            aria-label="Session timeout"
            type="number"
            min={1}
            max={1440}
            value={draft.sessionTimeoutMinutes}
            onChange={(event) =>
              update("sessionTimeoutMinutes", Number(event.target.value))
            }
            className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Allowed tools
          <input
            aria-label="Allowed tools"
            value={draft.allowedTools.join(", ")}
            onChange={(event) =>
              update("allowedTools", list(event.target.value))
            }
            placeholder="tool.read, tool.plan"
            className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Blocked tools
          <input
            aria-label="Blocked tools"
            value={draft.blockedTools.join(", ")}
            onChange={(event) =>
              update("blockedTools", list(event.target.value))
            }
            placeholder="tool.execute"
            className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
          Allowed data classes
          <input
            aria-label="Allowed data classes"
            value={draft.allowedDataClasses.join(", ")}
            onChange={(event) =>
              update("allowedDataClasses", list(event.target.value))
            }
            placeholder="NormalizedEvidence, Metadata"
            className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-xs text-muted">Capabilities</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {capabilityFields.map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-1.5 text-xs text-ink"
              >
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(event) => update(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={onSave}
            disabled={
              busy ||
              !draft.name.trim() ||
              !draft.description.trim() ||
              draft.allowedModes.length === 0
            }
            className={buttonClassName({ size: "sm", variant: "primary" })}
          >
            {busy ? "Saving…" : editing ? "Save policy" : "Create policy"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Cancel
          </button>
          <span className="text-[11px] text-subtle">
            The server records the actor and before/after policy diff in the
            gateway audit log.
          </span>
        </div>
        {error ? (
          <p role="alert" className="text-xs text-missed sm:col-span-2">
            {error}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function ToolsTab({ tools }: { tools: ApiResource<ModelTool[]> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(
    toolName: string,
    patch: { enabled?: boolean; approvalRequired?: boolean }
  ) {
    setBusy(toolName);
    setError(null);
    try {
      await api.updateModelTool(toolName, patch);
      await tools.refetch();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't update the tool."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel>
      <PanelHeader title="Code-defined tool catalog" />
      {tools.loading ? (
        <LoadingSkeleton rows={5} />
      ) : tools.error ? (
        <ErrorState message={tools.error} onRetry={tools.refetch} />
      ) : (tools.data ?? []).length === 0 ? (
        <p className="px-4 py-6 text-sm text-subtle">No tools registered.</p>
      ) : (
        <>
          {error ? (
            <p className="px-4 pt-3 text-sm text-missed">{error}</p>
          ) : null}
          <ul>
            {(tools.data ?? []).map((tool) => (
              <li
                key={tool.toolName}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
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
                    <span className="font-mono text-[10px] text-subtle">
                      {tool.toolName}
                    </span>
                    <span className="font-mono text-[10px] text-subtle">
                      {tool.allowedSessionModes.length} modes
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle
                    on={tool.approvalRequired}
                    label="Approval"
                    disabled={busy === tool.toolName}
                    onClick={() =>
                      update(tool.toolName, {
                        approvalRequired: !tool.approvalRequired
                      })
                    }
                  />
                  <Toggle
                    on={tool.enabled}
                    label={tool.enabled ? "Enabled" : "Disabled"}
                    disabled={busy === tool.toolName}
                    onClick={() =>
                      update(tool.toolName, { enabled: !tool.enabled })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function LogsTab({
  events
}: {
  events: ApiResource<
    Awaited<ReturnType<typeof api.listModelGatewayAuditEvents>>
  >;
}) {
  const spread = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events.data ?? [])
      counts.set(e.eventType, (counts.get(e.eventType) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events.data]);

  return (
    <Panel>
      <PanelHeader
        title="Decision log"
        link={{ href: "/swarm", label: "Live view" }}
      />
      {events.loading ? (
        <LoadingSkeleton rows={6} />
      ) : events.error ? (
        <ErrorState message={events.error} onRetry={events.refetch} />
      ) : (events.data ?? []).length === 0 ? (
        <p className="px-4 py-6 text-sm text-subtle">
          No gateway activity yet — logs appear as sessions request tools.
        </p>
      ) : (
        <>
          {spread.length ? (
            <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
              {spread.slice(0, 8).map(([type, count]) => (
                <span key={type} className="inline-flex items-center gap-1.5">
                  <StateBadge tone={EVENT_TONE[type] ?? "neutral"} dot={false}>
                    {type}
                  </StateBadge>
                  <span className="font-mono text-xs text-muted">{count}</span>
                </span>
              ))}
            </div>
          ) : null}
          <ul>
            {(events.data ?? []).slice(0, 40).map((e) => (
              <li
                key={e.eventId}
                className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
              >
                <StateBadge
                  tone={EVENT_TONE[e.eventType] ?? "neutral"}
                  dot={false}
                >
                  {e.eventType}
                </StateBadge>
                {e.toolName ? (
                  <span className="font-mono text-[11px] text-muted">
                    {e.toolName}
                  </span>
                ) : null}
                {e.policyDecisionId ? (
                  <span className="font-mono text-[10px] text-subtle">
                    policy·{e.policyDecisionId.slice(0, 8)}
                  </span>
                ) : null}
                <span className="ml-auto font-mono text-[11px] text-subtle">
                  {relTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function Tile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: StateTone;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface p-4">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `var(--color-${tone})` }}
      />
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
      <p
        className="mt-2 font-mono text-3xl font-semibold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-subtle">{label}:</span>{" "}
      <span className="font-mono text-ink">{value}</span>
    </p>
  );
}

function Perm({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-control border px-1.5 py-0.5 text-[10.5px]",
        on
          ? "border-fixed/40 text-fixed"
          : "border-line text-subtle line-through"
      )}
    >
      {on ? "✓" : "✕"} {label}
    </span>
  );
}

function Toggle({
  on,
  label,
  disabled,
  onClick
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        "rounded-control border px-2.5 py-1 text-[11px] font-medium transition-colors",
        on
          ? "border-fixed/50 bg-fixed/10 text-fixed"
          : "border-line text-subtle hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
      {children}
    </span>
  );
}
