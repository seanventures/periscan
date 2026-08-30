"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  AIApplication,
  AIAppValidationCategory,
  Scope
} from "@periscan/shared";

import {
  browserPeriscanApiClient as api,
  type AIApplicationValidationResult
} from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  InlineError,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  StateBadge,
  ValidationStateBadge,
  buttonClassName,
  cn
} from "../ui";

const APP_TYPES = [
  "Chatbot",
  "Copilot",
  "Agent",
  "RAG",
  "Workflow",
  "Other"
] as const;
const VALIDATION_CATEGORIES = [
  "PromptInjection",
  "IndirectPromptInjection",
  "JailbreakGuardrailBypass",
  "RAGAuthorization",
  "SensitiveDataLeakage",
  "UnsafeToolInvocation",
  "AgentOverPermissioning",
  "SystemPromptExposure",
  "CrossTenantRetrieval",
  "RAGPoisoningResistance",
  "ModelExtractionResistance",
  "GuardrailDrift",
  "RateAbuseControls",
  "AISecurityReviewEvidence"
] as const satisfies readonly AIAppValidationCategory[];

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
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

export function AIAppsWorkbench() {
  const apps = useApiResource(() => api.listAIApplications(), []);
  const scopes = useApiResource(() => api.listScopes(), []);
  const [query, setQuery] = useState("");

  const all = apps.data ?? [];

  const summary = useMemo(
    () => ({
      total: all.length,
      rag: all.filter((a) => a.ragEnabled).length,
      tools: all.filter((a) => a.toolsEnabled).length,
      validated: all.filter(
        (a) => a.latestValidation?.validationState === "Validated"
      ).length
    }),
    [all]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.appType.toLowerCase().includes(q) ||
        a.owner.toLowerCase().includes(q)
    );
  }, [all, query]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Investigate
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          AI Apps
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Your AI applications and their attack surface — RAG data, tool access,
          guardrails — validated safely. A benign endpoint probe is recorded as
          Inconclusive, never as &quot;Validated.&quot;
        </p>
      </header>

      <RegisterAIAppForm scopes={scopes.data ?? []} onCreated={apps.refetch} />

      {all.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="AI apps" value={summary.total} tone="brand" />
          <Tile label="RAG-enabled" value={summary.rag} tone="approval" />
          <Tile label="Tool-enabled" value={summary.tools} tone="blocked" />
          <Tile label="Validated" value={summary.validated} tone="validated" />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 md:max-w-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Filter AI apps
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, owner, endpoint…"
            className="w-full rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
      </div>

      {apps.loading ? (
        <Panel>
          <LoadingSkeleton rows={5} />
        </Panel>
      ) : apps.error ? (
        <Panel>
          <ErrorState message={apps.error} onRetry={apps.refetch} />
        </Panel>
      ) : all.length === 0 ? (
        <Panel>
          <div className="p-4">
            <NotConfigured
              title="No AI apps registered"
              message="Register an AI application to validate its RAG, tool and guardrail behavior safely."
              action={{ href: "/integrations", label: "Connect a source" }}
            />
          </div>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel>
          <p className="px-4 py-10 text-center text-sm text-subtle">
            No AI apps match this search.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((app) => (
            <AppCard key={app.aiAppId} app={app} onChanged={apps.refetch} />
          ))}
        </div>
      )}
    </div>
  );
}

function RegisterAIAppForm({
  scopes,
  onCreated
}: {
  scopes: Scope[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    appType: "Chatbot" as (typeof APP_TYPES)[number],
    endpointUrl: "",
    authMethod: "none",
    owner: "",
    scopeId: "",
    ragEnabled: false,
    toolsEnabled: false,
    dataSourcesDescription: "",
    guardrailsDescription: "",
    testAccountNotes: ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    f.name.trim() &&
    f.endpointUrl.trim() &&
    f.owner.trim() &&
    f.scopeId &&
    f.dataSourcesDescription.trim() &&
    f.guardrailsDescription.trim();

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api.createAIApplication({
        name: f.name.trim(),
        appType: f.appType,
        endpointUrl: f.endpointUrl.trim(),
        authMethod: f.authMethod.trim() || "bearer",
        owner: f.owner.trim(),
        scopeId: f.scopeId,
        ragEnabled: f.ragEnabled,
        toolsEnabled: f.toolsEnabled,
        dataSourcesDescription: f.dataSourcesDescription.trim(),
        guardrailsDescription: f.guardrailsDescription.trim(),
        testAccountNotes: f.testAccountNotes.trim() || undefined
      });
      setOpen(false);
      setF((prev) => ({
        ...prev,
        name: "",
        endpointUrl: "",
        owner: "",
        scopeId: "",
        dataSourcesDescription: "",
        guardrailsDescription: ""
      }));
      onCreated();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't register the app."
      );
    } finally {
      setBusy(false);
    }
  }

  const input =
    "rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong";

  return (
    <Panel>
      <PanelHeader
        title="Register an AI application"
        actions={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-brand hover:text-brand-2"
          >
            {open ? "Close" : "New app"}
          </button>
        }
      />
      {open ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted">Name</span>
            <input
              className={input}
              placeholder="Production RAG bot"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted">App type</span>
            <select
              className={input}
              value={f.appType}
              onChange={(e) =>
                setF({ ...f, appType: e.target.value as typeof f.appType })
              }
            >
              {APP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted">
              Endpoint URL
            </span>
            <input
              className={input}
              placeholder="https://endpoint.example.com"
              value={f.endpointUrl}
              onChange={(e) => setF({ ...f, endpointUrl: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted">Owner</span>
            <input
              className={input}
              placeholder="Team or person"
              value={f.owner}
              onChange={(e) => setF({ ...f, owner: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted">Scope</span>
            <select
              className={input}
              value={f.scopeId}
              onChange={(e) => setF({ ...f, scopeId: e.target.value })}
            >
              <option value="">Select scope…</option>
              {scopes.map((s) => (
                <option key={s.scopeId} value={s.scopeId}>
                  {s.value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted">
              Auth method
            </span>
            <input
              className={input}
              placeholder="none for a test endpoint"
              value={f.authMethod}
              onChange={(e) => setF({ ...f, authMethod: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-semibold text-muted">
              Data sources
            </span>
            <input
              className={input}
              placeholder="What the app reads"
              value={f.dataSourcesDescription}
              onChange={(e) =>
                setF({ ...f, dataSourcesDescription: e.target.value })
              }
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-semibold text-muted">
              Guardrails
            </span>
            <input
              className={input}
              placeholder="Prompt filters, allow-lists, human review…"
              value={f.guardrailsDescription}
              onChange={(e) =>
                setF({ ...f, guardrailsDescription: e.target.value })
              }
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-semibold text-muted">
              Test account notes
            </span>
            <input
              className={input}
              placeholder="Authorized notes only — never paste credentials"
              value={f.testAccountNotes}
              onChange={(e) => setF({ ...f, testAccountNotes: e.target.value })}
            />
          </label>
          <div className="flex items-center gap-4 sm:col-span-2">
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={f.ragEnabled}
                onChange={(e) => setF({ ...f, ragEnabled: e.target.checked })}
                className="accent-[color:var(--color-brand)]"
              />{" "}
              RAG enabled
            </label>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input
                type="checkbox"
                checked={f.toolsEnabled}
                onChange={(e) => setF({ ...f, toolsEnabled: e.target.checked })}
                className="accent-[color:var(--color-brand)]"
              />{" "}
              Tools enabled
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !canSubmit}
              className={
                buttonClassName({ size: "sm", variant: "primary" }) + " ml-auto"
              }
            >
              {busy ? "Registering…" : "Register"}
            </button>
          </div>
          {scopes.length === 0 ? (
            <p className="text-[12px] text-approval sm:col-span-2">
              Verify a scope first (Validation Snapshot) to attach the app.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-missed sm:col-span-2">{error}</p>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

function AppCard({
  app,
  onChanged
}: {
  app: AIApplication;
  onChanged: () => void;
}) {
  const v = app.latestValidation;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [category, setCategory] = useState<AIAppValidationCategory>(
    app.ragEnabled
      ? "RAGAuthorization"
      : app.toolsEnabled
        ? "UnsafeToolInvocation"
        : "PromptInjection"
  );
  const [executionMode, setExecutionMode] = useState<"LiveSafe" | "LiveSuite">(
    "LiveSuite"
  );
  const [phase, setPhase] = useState<"idle" | "executing" | "complete">("idle");
  const [killBusy, setKillBusy] = useState(false);
  const [killReason, setKillReason] = useState("Operator safety drill");
  const [result, setResult] = useState<AIApplicationValidationResult | null>(
    null
  );
  const endpointReady = [
    "none",
    "public",
    "no-auth",
    "unauthenticated"
  ].includes(app.authMethod.trim().toLowerCase());
  const killSwitchEnabled = app.validationKillSwitch?.enabled ?? false;
  const requestBudget =
    category === "RateAbuseControls" ||
    category === "ModelExtractionResistance"
      ? 5
      : 1;

  async function validate() {
    setBusy(true);
    setErr(null);
    setOk(null);
    setPhase("executing");
    try {
      const next = await api.validateAIApplication(app.aiAppId, {
        corpusVersion: "periscan-benign-v1",
        executionMode,
        harness: executionMode === "LiveSuite" ? "periscan" : "promptfoo",
        maxRequests: requestBudget,
        maxResponseBytes: 4_096,
        validationCategory: category
      });
      setResult(next);
      setPhase("complete");
      setOk(
        executionMode === "LiveSuite"
          ? "Bounded live suite completed and redacted evidence was recorded."
          : "Endpoint probe completed and was recorded as reachability evidence only."
      );
      onChanged();
    } catch (caught) {
      setPhase("idle");
      setErr(
        caught instanceof Error
          ? caught.message
          : "Couldn't start the safe validation."
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeKillSwitch() {
    if (killReason.trim().length < 3) return;
    setKillBusy(true);
    setErr(null);
    setOk(null);
    try {
      await api.setAIValidationKillSwitch(app.aiAppId, {
        enabled: !killSwitchEnabled,
        reason: killReason.trim()
      });
      setOk(
        killSwitchEnabled
          ? "Validation kill switch released; new runs must still pass policy."
          : "Validation kill switch acknowledged; new runs are blocked."
      );
      onChanged();
    } catch (caught) {
      setErr(
        caught instanceof Error
          ? caught.message
          : "Couldn't change the validation kill switch."
      );
    } finally {
      setKillBusy(false);
    }
  }

  return (
    <Panel className="flex flex-col">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[15px] font-semibold text-ink">
              {app.name}
            </h3>
            <p className="mt-0.5 font-mono text-[11px] text-subtle">
              {hostOf(app.endpointUrl)} · {app.owner}
            </p>
          </div>
          <span className="shrink-0 rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
            {app.appType}
          </span>
        </div>

        {/* Risk surface */}
        <div className="flex flex-wrap gap-1.5">
          <Surface on={app.ragEnabled} label="RAG" />
          <Surface on={app.toolsEnabled} label="Tools" />
          <Surface on={!!app.guardrailsDescription} label="Guardrails" />
        </div>

        <div className="flex flex-col gap-1.5 text-[12px]">
          <Line label="Data sources" value={app.dataSourcesDescription} />
          <Line label="Guardrails" value={app.guardrailsDescription} />
          <Line
            label="Test account"
            value={app.testAccountNotes ?? "No test-account notes recorded"}
          />
        </div>

        <div
          aria-label={`${app.name} AI validation readiness`}
          className="rounded-control border border-line bg-elevated/70 p-3"
          role="region"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
              Lab contract
            </span>
            <StateBadge
              dot={false}
              tone={endpointReady ? "validated" : "inconclusive"}
            >
              {endpointReady ? "Ready" : "Credential reference needed"}
            </StateBadge>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
            <div>
              <dt className="text-subtle">Corpus</dt>
              <dd className="font-mono text-ink">periscan-benign-v1</dd>
            </div>
            <div>
              <dt className="text-subtle">Request budget</dt>
              <dd className="font-mono text-ink">1–4 sequential</dd>
            </div>
            <div>
              <dt className="text-subtle">Response retention</dt>
              <dd className="text-ink">Redacted evidence only</dd>
            </div>
            <div>
              <dt className="text-subtle">Scope</dt>
              <dd className="text-ink">Verified · customer-authorized</dd>
            </div>
          </dl>
          {!endpointReady ? (
            <p className="mt-2 text-[10px] leading-4 text-approval">
              {app.authMethod} is documented, but no secret reference is sent by
              this surface. Use a dedicated no-auth test endpoint or configure a
              governed credential integration before live validation.
            </p>
          ) : null}
        </div>
      </div>

      {/* Latest validation */}
      <div className="mt-auto flex flex-col gap-2 border-t border-line px-4 py-2.5">
        {v ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {v.validationState ? (
              <ValidationStateBadge state={v.validationState} dot={false} />
            ) : (
              <StateBadge tone="inconclusive" dot={false}>
                {v.status}
              </StateBadge>
            )}
            <span className="font-mono text-subtle">{v.moduleId}</span>
            {v.outcome ? <span className="text-muted">{v.outcome}</span> : null}
            <span className="ml-auto font-mono text-subtle">
              {relTime(v.completedAt)}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-subtle">Never validated</span>
            <Link
              href="/schedules"
              className="text-[11px] font-semibold text-brand hover:text-brand-2"
            >
              Schedule →
            </Link>
          </div>
        )}
        <label className="flex items-center gap-2 text-[11px] text-muted">
          <span className="shrink-0">Execution</span>
          <select
            aria-label={`${app.name} AI validation execution mode`}
            value={executionMode}
            onChange={(event) =>
              setExecutionMode(
                event.target.value === "LiveSafe" ? "LiveSafe" : "LiveSuite"
              )
            }
            disabled={busy || killSwitchEnabled}
            className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2 py-1.5 text-xs text-ink"
          >
            <option value="LiveSuite">Bounded synthetic-canary suite</option>
            <option value="LiveSafe">Reachability probe only</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] text-muted">
          <span className="shrink-0">Safe suite</span>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as AIAppValidationCategory)
            }
            disabled={busy}
            className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2 py-1.5 text-xs text-ink"
          >
            {VALIDATION_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll(/([a-z])([A-Z])/gu, "$1 $2")}
              </option>
            ))}
          </select>
        </label>
        {category === "ModelExtractionResistance" ? (
          <div
            className="rounded-control border border-line bg-surface-2 px-2.5 py-2 text-[10px] leading-4 text-muted"
            data-testid="model-extraction-honesty-panel"
          >
            <p className="font-semibold text-ink">
              Model weight extraction · resistance only (#64)
            </p>
            <p className="mt-1">
              Runs a single-digit fingerprint / rate-limit / detail-refusal
              suite.{" "}
              <strong className="text-ink">Never</strong> attempts weight,
              checkpoint, or gradient recovery. Evidence pins{" "}
              <code className="font-mono">weightExtractionAttempted:false</code>
              .
            </p>
            <p className="mt-1 font-mono text-[10px] text-subtle">
              GET /api/v1/model-extraction-resistance/honesty
            </p>
          </div>
        ) : null}
        <div
          aria-label={`${app.name} validation lifecycle: ${phase}`}
          className="grid grid-cols-4 gap-1"
          role="status"
        >
          {["Budget", "Policy", "Execute", "Evidence"].map((label, index) => {
            const active =
              phase === "complete" || (phase === "executing" && index < 3);
            return (
              <span
                className={cn(
                  "rounded-control border px-1 py-1 text-center font-mono text-[9px]",
                  active
                    ? "border-brand/40 bg-brand/10 text-brand"
                    : "border-line text-subtle"
                )}
                key={label}
              >
                {label}
              </span>
            );
          })}
        </div>
        <button
          type="button"
          onClick={validate}
          disabled={busy || killSwitchEnabled || !endpointReady}
          aria-label="Run safe validation"
          className={
            buttonClassName({ size: "sm", variant: "secondary" }) +
            " w-full justify-center"
          }
        >
          {busy
            ? "Running governed validation…"
            : executionMode === "LiveSuite"
              ? `Run bounded suite · ${requestBudget} request${requestBudget === 1 ? "" : "s"}`
              : "Run reachability probe"}
        </button>
        {result ? (
          <div
            role="region"
            aria-label={`Latest ${app.name} safe validation result`}
            className="flex flex-col gap-2 rounded-control border border-line bg-elevated p-2.5 text-[11px]"
          >
            <div className="flex flex-wrap items-center gap-2">
              {result.run.validationState ? (
                <ValidationStateBadge
                  state={result.run.validationState}
                  dot={false}
                />
              ) : null}
              <span className="text-muted">
                {String(result.run.target.validationCategory ?? category)} ·{" "}
                {String(result.run.target.harness ?? "promptfoo")}
              </span>
              <Link
                href={`/missions/${result.mission.missionId}`}
                className="ml-auto font-mono text-brand hover:text-brand-2"
              >
                mission {result.mission.missionId.slice(0, 8)}
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.attackTechniques.map((technique) => (
                <Link
                  key={technique.techniqueId}
                  href={`/attack-techniques?technique=${encodeURIComponent(technique.techniqueId)}`}
                  className="rounded-control border border-line px-1.5 py-0.5 font-mono text-brand hover:border-line-strong"
                >
                  {technique.techniqueId} · {technique.techniqueName}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-subtle">
              <span>
                {result.signals.length} signal
                {result.signals.length === 1 ? "" : "s"}
              </span>
              {result.evidence.map((artifact) => (
                <Link
                  key={artifact.evidenceId}
                  href={`/evidence?evidenceId=${encodeURIComponent(artifact.evidenceId)}`}
                  className="font-mono text-brand hover:text-brand-2"
                >
                  evidence {artifact.evidenceId.slice(0, 8)}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        <div
          className={cn(
            "rounded-control border p-2.5",
            killSwitchEnabled
              ? "border-missed/50 bg-missed/10"
              : "border-line bg-elevated"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-ink">
              Validation kill switch
            </span>
            <StateBadge
              dot={false}
              tone={killSwitchEnabled ? "blocked" : "validated"}
            >
              {killSwitchEnabled ? "Acknowledged · runs blocked" : "Armed"}
            </StateBadge>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-subtle">
            Blocks every new validation before policy or endpoint execution. The
            audit receipt records the last completed task and operator reason.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              aria-label={`${app.name} kill switch reason`}
              className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2 py-1.5 text-[11px] text-ink"
              onChange={(event) => setKillReason(event.target.value)}
              value={killReason}
            />
            <button
              aria-label={`${killSwitchEnabled ? "Release" : "Activate"} ${app.name} validation kill switch`}
              className={buttonClassName({
                size: "sm",
                variant: killSwitchEnabled ? "secondary" : "danger"
              })}
              disabled={killBusy || killReason.trim().length < 3 || busy}
              onClick={() => void changeKillSwitch()}
              type="button"
            >
              {killBusy ? "Saving…" : killSwitchEnabled ? "Release" : "Stop"}
            </button>
          </div>
        </div>
        <p className="text-[10px] leading-4 text-subtle">
          EU AI Act / ISO 42001 trace: test scope, corpus, budget, redacted
          evidence, and limitations are recorded. This is technical control
          evidence—not certification or legal conformity.
        </p>
        {err ? (
          <InlineError
            message={err}
            tone="error"
            onDismiss={() => setErr(null)}
          />
        ) : null}
        {ok ? (
          <InlineError
            message={ok}
            tone="success"
            onDismiss={() => setOk(null)}
          />
        ) : null}
      </div>
    </Panel>
  );
}

function Surface({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-[11px]",
        on ? "border-blocked/40 text-blocked" : "border-line text-subtle"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          on ? "bg-blocked" : "bg-inconclusive"
        )}
      />
      {label} {on ? "on" : "off"}
    </span>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="line-clamp-2 text-muted">
      <span className="text-subtle">{label}:</span> {value}
    </p>
  );
}

function Tile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "brand" | "approval" | "blocked" | "validated";
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
