"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  InfrastructureChangeRequest,
  Integration
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  InlineError,
  InfoPopover,
  StateBadge,
  buttonClassName,
  cn
} from "../ui";

const ACTIVE_STATES = new Set([
  "PullRequestOpened",
  "ChecksPassing",
  "ChecksFailed"
]);

function isGitHub(integration: Integration) {
  return (
    integration.authType === "pat" &&
    (integration.config?.connectorKey === "github" ||
      integration.product.toLowerCase().includes("github"))
  );
}

function receipt(change: InfrastructureChangeRequest) {
  const value = change.applicationReceipt;
  if (!value || typeof value !== "object") return null;
  return value as {
    branchName?: string;
    checks?: { conclusion?: string; names?: string[]; refreshedAt?: string };
    commitSha?: string;
    pullRequestNumber?: number;
    pullRequestUrl?: string;
  };
}

function stateTone(state: InfrastructureChangeRequest["state"]) {
  if (state === "ChecksPassing") return "validated" as const;
  if (state === "ChecksFailed" || state === "Failed") return "missed" as const;
  if (state === "MergedAwaitingVerification") return "approval" as const;
  if (state === "RolledBack") return "inconclusive" as const;
  return "neutral" as const;
}

export function IacRemediationWorkspace({
  remediationId
}: {
  remediationId: string;
}) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [changes, setChanges] = useState<InfrastructureChangeRequest[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [integrationId, setIntegrationId] = useState("");
  const [owner, setOwner] = useState("");
  const [repository, setRepository] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [filePath, setFilePath] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState(
    "Applies the reviewed Periscan remediation change. Review CI and require a fresh validation after merge."
  );
  const [proposedContent, setProposedContent] = useState("");
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.listIntegrations(),
      api.listInfrastructureChanges(remediationId)
    ])
      .then(([nextIntegrations, nextChanges]) => {
        if (!active) return;
        const github = nextIntegrations.filter(isGitHub);
        setIntegrations(github);
        setIntegrationId(github[0]?.integrationId ?? "");
        setChanges(nextChanges);
        setActiveId(nextChanges[0]?.iacChangeRequestId ?? null);
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Couldn't load infrastructure change readiness."
          );
        }
      })
      .finally(() => {
        if (active) setBusy(null);
      });
    return () => {
      active = false;
    };
  }, [remediationId]);

  const change = useMemo(
    () => changes.find((item) => item.iacChangeRequestId === activeId) ?? null,
    [activeId, changes]
  );
  const changeReceipt = change ? receipt(change) : null;
  const formReady = Boolean(
    integrationId &&
    owner.trim() &&
    repository.trim() &&
    baseBranch.trim() &&
    filePath.trim() &&
    title.trim() &&
    body.trim() &&
    proposedContent.trim()
  );

  function upsert(next: InfrastructureChangeRequest) {
    setChanges((current) => [
      next,
      ...current.filter(
        (item) => item.iacChangeRequestId !== next.iacChangeRequestId
      )
    ]);
    setActiveId(next.iacChangeRequestId);
  }

  async function preview() {
    if (!formReady) return;
    setBusy("preview");
    setError(null);
    try {
      const next = await api.previewInfrastructureChange(remediationId, {
        baseBranch,
        filePath,
        idempotencyKey:
          `${remediationId}:${integrationId}:${owner}/${repository}:${filePath}:${Date.now()}`.slice(
            0,
            200
          ),
        integrationId,
        proposedContent,
        pullRequestBody: body,
        pullRequestTitle: title,
        repository: { name: repository, owner }
      });
      upsert(next);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Infrastructure preview failed."
      );
    } finally {
      setBusy(null);
    }
  }

  async function confirm(operation: "approve" | "execute" | "rollback") {
    if (!change) return;
    setBusy(operation);
    setError(null);
    try {
      upsert(
        await api.confirmInfrastructureChange(
          change.iacChangeRequestId,
          operation,
          change.previewHash
        )
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Couldn't ${operation} the infrastructure change.`
      );
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    if (!change) return;
    setBusy("refresh");
    setError(null);
    try {
      upsert(await api.refreshInfrastructureChange(change.iacChangeRequestId));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't refresh pull request state."
      );
    } finally {
      setBusy(null);
    }
  }

  function startAnother() {
    setActiveId(null);
    setProposedContent("");
    setTitle("");
    setError(null);
  }

  return (
    <section
      aria-label="Infrastructure as code remediation"
      className="overflow-hidden rounded-control border border-line bg-surface"
    >
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-subtle">
                Infrastructure proof loop
              </p>
              <InfoPopover label="infrastructure pull request safety">
                Periscan reads the current file, scans the proposal for secret
                material, hashes the exact diff, and requires approval of that
                hash. It can open but never merge the pull request. After merge,
                the remediation stays pending until a fresh Periscan re-test.
              </InfoPopover>
            </div>
            <h3 className="mt-1 text-sm font-semibold text-ink">
              Turn a fix into a reviewable pull request
            </h3>
            <p className="mt-1 max-w-3xl text-[11px] leading-4 text-muted">
              One file, one branch, one approved diff. Periscan opens the PR
              only — it never merges, never applies live cloud config, and does
              not multi-file batch. Repository protections and human review
              remain in control. After merge, run auto-revalidate or targeted
              verification; Fixed still requires measured proof.
            </p>
          </div>
          {change ? (
            <StateBadge dot={false} tone={stateTone(change.state)}>
              {change.state === "MergedAwaitingVerification"
                ? "Merged · revalidation required"
                : change.state.replace(/([a-z])([A-Z])/gu, "$1 $2")}
            </StateBadge>
          ) : null}
        </div>
      </div>

      {busy === "load" ? (
        <p className="p-4 text-xs text-subtle">
          Checking repository readiness…
        </p>
      ) : integrations.length === 0 ? (
        <div className="p-4">
          <p className="text-sm font-medium text-ink">
            A real GitHub PAT integration is required
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-subtle">
            Connect GitHub with repository-scoped contents and pull-request
            write access. Demo integrations and fixture credentials are denied
            for repository writes.
          </p>
          <a
            className={cn(
              buttonClassName({ size: "sm", variant: "secondary" }),
              "mt-3 inline-flex"
            )}
            href="/integrations"
          >
            Configure GitHub
          </a>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
            {change ? (
              <ChangeSummary
                change={change}
                changeReceipt={changeReceipt}
                busy={busy}
                onApprove={() => void confirm("approve")}
                onExecute={() => void confirm("execute")}
                onRefresh={() => void refresh()}
                onRollback={() => void confirm("rollback")}
                onStartAnother={startAnother}
              />
            ) : (
              <ChangeForm
                baseBranch={baseBranch}
                body={body}
                busy={busy}
                filePath={filePath}
                formReady={formReady}
                integrationId={integrationId}
                integrations={integrations}
                onBaseBranch={setBaseBranch}
                onBody={setBody}
                onFilePath={setFilePath}
                onIntegration={setIntegrationId}
                onOwner={setOwner}
                onPreview={() => void preview()}
                onProposedContent={setProposedContent}
                onRepository={setRepository}
                onTitle={setTitle}
                owner={owner}
                proposedContent={proposedContent}
                repository={repository}
                title={title}
              />
            )}
            {error ? <InlineError className="mt-3" message={error} /> : null}
          </div>

          <div className="min-h-72 bg-canvas/50 p-4">
            {change ? (
              <DiffPreview change={change} />
            ) : (
              <div className="flex h-full min-h-64 items-center justify-center text-center">
                <div className="max-w-sm">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand">
                    Preview gate
                  </p>
                  <p className="mt-2 text-sm font-medium text-ink">
                    The exact repository diff appears here before any write.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-subtle">
                    Approval binds to its SHA-256 hash. A changed base file
                    makes the approval stale and blocks execution.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {changes.length > 1 ? (
        <div className="border-t border-line px-4 py-3">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-subtle">
            Change history
          </p>
          <div className="flex flex-wrap gap-2">
            {changes.map((item) => (
              <button
                className={cn(
                  "rounded-control border px-2 py-1 font-mono text-[10px]",
                  activeId === item.iacChangeRequestId
                    ? "border-brand/40 bg-brand/10 text-brand"
                    : "border-line text-subtle hover:text-ink"
                )}
                key={item.iacChangeRequestId}
                onClick={() => setActiveId(item.iacChangeRequestId)}
                type="button"
              >
                {item.manifest.filePath} · {item.state}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
      {label}
      <input
        className="rounded-control border border-line bg-canvas px-2.5 py-2 text-xs text-ink outline-none focus:border-brand"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function ChangeForm(props: {
  baseBranch: string;
  body: string;
  busy: string | null;
  filePath: string;
  formReady: boolean;
  integrationId: string;
  integrations: Integration[];
  onBaseBranch: (value: string) => void;
  onBody: (value: string) => void;
  onFilePath: (value: string) => void;
  onIntegration: (value: string) => void;
  onOwner: (value: string) => void;
  onPreview: () => void;
  onProposedContent: (value: string) => void;
  onRepository: (value: string) => void;
  onTitle: (value: string) => void;
  owner: string;
  proposedContent: string;
  repository: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
        GitHub integration
        <select
          className="rounded-control border border-line bg-canvas px-2.5 py-2 text-xs text-ink"
          onChange={(event) => props.onIntegration(event.target.value)}
          value={props.integrationId}
        >
          {props.integrations.map((item) => (
            <option key={item.integrationId} value={item.integrationId}>
              {item.vendor} · {item.product}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Repository owner"
          onChange={props.onOwner}
          value={props.owner}
        />
        <Field
          label="Repository"
          onChange={props.onRepository}
          value={props.repository}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Base branch"
          onChange={props.onBaseBranch}
          value={props.baseBranch}
        />
        <Field
          label="File path"
          onChange={props.onFilePath}
          placeholder="infra/main.tf"
          value={props.filePath}
        />
      </div>
      <Field
        label="Pull request title"
        onChange={props.onTitle}
        value={props.title}
      />
      <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
        Pull request context
        <textarea
          className="min-h-16 resize-y rounded-control border border-line bg-canvas px-2.5 py-2 text-xs leading-5 text-ink outline-none focus:border-brand"
          onChange={(event) => props.onBody(event.target.value)}
          value={props.body}
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
        Complete proposed file
        <textarea
          className="min-h-44 resize-y rounded-control border border-line bg-[#09111f] px-3 py-2 font-mono text-[11px] leading-5 text-[#d5e7ff] outline-none focus:border-brand"
          onChange={(event) => props.onProposedContent(event.target.value)}
          placeholder="# Paste the complete safe IaC file. Literal secrets are blocked."
          spellCheck={false}
          value={props.proposedContent}
        />
      </label>
      <button
        className={buttonClassName({ size: "sm", variant: "primary" })}
        disabled={!props.formReady || props.busy !== null}
        onClick={props.onPreview}
        type="button"
      >
        {props.busy === "preview"
          ? "Reading and hashing…"
          : "Preview exact diff"}
      </button>
    </div>
  );
}

function ChangeSummary(props: {
  busy: string | null;
  change: InfrastructureChangeRequest;
  changeReceipt: ReturnType<typeof receipt>;
  onApprove: () => void;
  onExecute: () => void;
  onRefresh: () => void;
  onRollback: () => void;
  onStartAnother: () => void;
}) {
  const { change } = props;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-ink">
          {change.manifest.repository.owner}/{change.manifest.repository.name}
        </p>
        <p className="mt-1 font-mono text-[10px] text-subtle">
          {change.manifest.baseBranch} → {change.manifest.branchName}
        </p>
      </div>
      <dl className="grid gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <dt className="text-subtle">Preview hash</dt>
          <dd className="break-all font-mono text-ink">{change.previewHash}</dd>
        </div>
        <div>
          <dt className="text-subtle">Source SHA</dt>
          <dd className="break-all font-mono text-ink">
            {change.manifest.beforeSha}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">Blast radius</dt>
          <dd className="text-ink">{change.manifest.blastRadius}</dd>
        </div>
        <div>
          <dt className="text-subtle">Rollback window</dt>
          <dd className="text-ink">Available until merge</dd>
        </div>
      </dl>

      {props.changeReceipt?.pullRequestUrl ? (
        <a
          className="font-mono text-[11px] text-brand hover:text-brand-2"
          href={props.changeReceipt.pullRequestUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open PR #{props.changeReceipt.pullRequestNumber} ↗
        </a>
      ) : null}
      {props.changeReceipt?.checks ? (
        <div className="rounded-control border border-line bg-canvas px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-subtle">
            CI checks
          </p>
          <p className="mt-1 text-xs font-medium text-ink">
            {props.changeReceipt.checks.conclusion ?? "Pending"}
            {props.changeReceipt.checks.names?.length
              ? ` · ${props.changeReceipt.checks.names.join(" · ")}`
              : ""}
          </p>
        </div>
      ) : null}
      {change.state === "MergedAwaitingVerification" ? (
        <div className="rounded-control border border-brand/30 bg-brand/10 p-3">
          <p className="text-xs font-semibold text-ink">Merge is not proof.</p>
          <p className="mt-1 text-[11px] leading-4 text-muted">
            Periscan moved this remediation to Verification Pending. Run the
            fresh targeted re-test below before it can become Fixed.
          </p>
        </div>
      ) : null}
      {change.failureReason ? (
        <InlineError message={change.failureReason} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {change.state === "AwaitingApproval" ? (
          <button
            className={buttonClassName({ size: "sm", variant: "primary" })}
            disabled={props.busy !== null}
            onClick={props.onApprove}
            type="button"
          >
            {props.busy === "approve"
              ? "Approving hash…"
              : "Approve exact hash"}
          </button>
        ) : null}
        {change.state === "Approved" ? (
          <button
            className={buttonClassName({ size: "sm", variant: "primary" })}
            disabled={props.busy !== null}
            onClick={props.onExecute}
            type="button"
          >
            {props.busy === "execute"
              ? "Opening pull request…"
              : "Open pull request"}
          </button>
        ) : null}
        {ACTIVE_STATES.has(change.state) ? (
          <>
            <button
              className={buttonClassName({ size: "sm", variant: "primary" })}
              disabled={props.busy !== null}
              onClick={props.onRefresh}
              type="button"
            >
              {props.busy === "refresh"
                ? "Refreshing…"
                : "Refresh CI + merge state"}
            </button>
            <button
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              disabled={props.busy !== null}
              onClick={props.onRollback}
              type="button"
            >
              {props.busy === "rollback"
                ? "Rolling back…"
                : "Close PR + delete branch"}
            </button>
          </>
        ) : null}
        {["RolledBack", "Failed", "MergedAwaitingVerification"].includes(
          change.state
        ) ? (
          <button
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            disabled={props.busy !== null}
            onClick={props.onStartAnother}
            type="button"
          >
            Propose another change
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DiffPreview({ change }: { change: InfrastructureChangeRequest }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-ink">
            {change.manifest.filePath}
          </p>
          <p className="mt-0.5 font-mono text-[9px] text-subtle">
            {change.manifest.beforeContentHash.slice(0, 12)} →{" "}
            {change.manifest.afterContentHash.slice(0, 12)}
          </p>
        </div>
        <span className="rounded-control border border-line px-2 py-1 font-mono text-[9px] text-subtle">
          exact approved diff
        </span>
      </div>
      <pre
        aria-label="Exact infrastructure diff"
        className="max-h-[34rem] overflow-auto rounded-control border border-[#20314c] bg-[#09111f] p-3 font-mono text-[10px] leading-5"
      >
        {change.manifest.unifiedDiff.split("\n").map((line, index) => (
          <span
            className={cn(
              "block min-w-max px-1",
              line.startsWith("+") && !line.startsWith("+++")
                ? "bg-[#123424] text-[#8ee3b2]"
                : line.startsWith("-") && !line.startsWith("---")
                  ? "bg-[#3a1821] text-[#ff9cad]"
                  : line.startsWith("@@")
                    ? "text-[#8cb8ff]"
                    : "text-[#c5d3e8]"
            )}
            key={`${index}:${line}`}
          >
            {line || " "}
          </span>
        ))}
      </pre>
      <p className="mt-3 text-[11px] leading-4 text-subtle">
        Periscan will perform only the three declared writes: create this
        branch, commit this file, and open the pull request. It cannot merge.
      </p>
    </div>
  );
}
