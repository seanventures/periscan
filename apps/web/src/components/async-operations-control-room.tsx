"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";

import type {
  AsyncOperationsPolicyInput,
  AsyncOperationsWorkItem,
  AsyncRecoveryDecisionInput
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  Button,
  ErrorState,
  InlineError,
  LiveUpdatePill,
  LoadingSkeleton,
  Panel,
  buttonClassName,
  cn
} from "../ui";

const ADMIN_ROLES = new Set(["Owner", "Admin", "MSSPOwner", "ClientAdmin"]);
const FIELD =
  "min-w-0 rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand";
const DEFAULT_POLICY: AsyncOperationsPolicyInput = {
  escalationChannel: "#security-operations",
  queueAgeTargetSeconds: 900,
  reviewReference: "OPS-RUNBOOK-001",
  runnerLeaseWarningSeconds: 600,
  runningTimeoutSeconds: 1800,
  supportOwner: "Security Operations"
};

function formatAge(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function stateTone(state: AsyncOperationsWorkItem["operationalState"]) {
  if (state === "Stalled" || state === "TerminalFailure") {
    return "border-danger/35 bg-danger/10 text-danger";
  }
  if (state === "WaitingTooLong") {
    return "border-warning/35 bg-warning/10 text-warning";
  }
  if (state === "TerminalSuccess") {
    return "border-fixed/35 bg-fixed/10 text-fixed";
  }
  return "border-line bg-brand/5 text-[#cfe0ff]";
}

function healthCopy(health: string) {
  if (health === "Critical") return "Stale work needs reconciliation";
  if (health === "Attention") return "Queue exceptions need review";
  if (health === "Healthy") return "Inside reviewed targets";
  return "Operating targets not reviewed";
}

export function AsyncOperationsControlRoom() {
  const workspace = useApiResource(
    () => api.getAsyncOperationsWorkspace(),
    [],
    { refetchIntervalMs: 10_000 }
  );
  const session = useApiResource(() => api.getMe(), []);
  const [selectedId, setSelectedId] = useState("");
  const [policyDraft, setPolicyDraft] =
    useState<AsyncOperationsPolicyInput>(DEFAULT_POLICY);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [recoveryMissionId, setRecoveryMissionId] = useState<string | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);

  useEffect(() => {
    if (workspace.data?.policy) {
      const {
        escalationChannel,
        queueAgeTargetSeconds,
        reviewReference,
        runnerLeaseWarningSeconds,
        runningTimeoutSeconds,
        supportOwner
      } = workspace.data.policy;
      setPolicyDraft({
        escalationChannel,
        queueAgeTargetSeconds,
        reviewReference,
        runnerLeaseWarningSeconds,
        runningTimeoutSeconds,
        supportOwner
      });
    }
  }, [workspace.data?.policy]);

  useEffect(() => {
    if (
      workspace.data?.workItems.length &&
      !workspace.data.workItems.some((item) => item.workloadId === selectedId)
    ) {
      setSelectedId(workspace.data.workItems[0]!.workloadId);
    }
  }, [selectedId, workspace.data?.workItems]);

  const selected = useMemo(
    () =>
      workspace.data?.workItems.find(
        (item) => item.workloadId === selectedId
      ) ?? null,
    [selectedId, workspace.data?.workItems]
  );
  const canOperate = session.data
    ? ADMIN_ROLES.has(session.data.membership.role)
    : false;

  async function runMutation(
    key: string,
    action: () => Promise<unknown>,
    successMessage: string
  ) {
    setBusy(key);
    setFeedback(null);
    try {
      await action();
      await workspace.refetch();
      setFeedback({ message: successMessage, tone: "success" });
    } catch (caught) {
      setFeedback({
        message:
          caught instanceof Error ? caught.message : "The operation failed.",
        tone: "error"
      });
    } finally {
      setBusy(null);
    }
  }

  async function submitPolicy(event: FormEvent) {
    event.preventDefault();
    await runMutation(
      "policy",
      () => api.updateAsyncOperationsPolicy(policyDraft),
      "Reviewed operating targets saved and added to the integrity ledger."
    );
  }

  async function reconcile() {
    await runMutation(
      "reconcile",
      () => api.reconcileAsyncOperations({ reason, reference }),
      "Reconciliation completed. Only work beyond reviewed terminal boundaries changed."
    );
  }

  async function decide(decision: AsyncRecoveryDecisionInput["decision"]) {
    if (!selected) return;
    setBusy(decision);
    setFeedback(null);
    setRecoveryMissionId(null);
    try {
      const result = await api.recordAsyncRecoveryDecision({
        decision,
        reason,
        reference,
        workloadId: selected.workloadId,
        workloadKind: selected.workloadKind
      });
      setRecoveryMissionId(result.recoveryMissionId);
      await workspace.refetch();
      setFeedback({
        message:
          decision === "PrepareRecovery"
            ? "Recovery draft prepared. It has no policy decision and cannot execute until reviewed and started."
            : "The failed terminal outcome was accepted and recorded.",
        tone: "success"
      });
    } catch (caught) {
      setFeedback({
        message:
          caught instanceof Error ? caught.message : "The operation failed.",
        tone: "error"
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel aria-labelledby="async-operations-title">
      <div className="border-b border-line px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-subtle">
              Queue control room
            </p>
            <h2
              id="async-operations-title"
              className="mt-1 font-display text-xl font-semibold text-ink"
            >
              Live workload recovery
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
              Watch validation jobs and signed runner tasks cross reviewed
              operating boundaries. Terminal recovery is deliberate: prepare a
              fresh draft, obtain a new policy decision, then start it.
            </p>
          </div>
          <LiveUpdatePill
            lastUpdatedAt={workspace.lastUpdatedAt}
            refreshing={workspace.refreshing}
          />
        </div>
      </div>

      {workspace.loading ? <LoadingSkeleton rows={6} /> : null}
      {workspace.error && !workspace.data ? (
        <ErrorState
          title="Queue operations are unavailable"
          message={workspace.error}
          onRetry={() => void workspace.refetch()}
        />
      ) : null}

      {workspace.data ? (
        <>
          <dl className="grid border-b border-line sm:grid-cols-3 lg:grid-cols-6">
            <SummaryDatum
              label="Operating state"
              value={workspace.data.summary.health}
              detail={healthCopy(workspace.data.summary.health)}
            />
            <SummaryDatum
              label="Active"
              value={String(workspace.data.summary.activeCount)}
              detail={`${workspace.data.summary.queuedCount} queued`}
            />
            <SummaryDatum
              label="Oldest active"
              value={formatAge(workspace.data.summary.oldestActiveAgeSeconds)}
              detail="Observed age"
            />
            <SummaryDatum
              label="Stalled"
              value={String(workspace.data.summary.stalledCount)}
              detail="Safe to reconcile"
              alert={workspace.data.summary.stalledCount > 0}
            />
            <SummaryDatum
              label="Waiting"
              value={String(workspace.data.summary.waitingTooLongCount)}
              detail="Monitor pickup"
            />
            <SummaryDatum
              label="24h success"
              value={String(workspace.data.summary.recentSuccessCount)}
              detail="Terminal results"
            />
          </dl>

          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
            <section className="min-w-0 border-b border-line lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-ink">
                    Recovery queue
                  </h3>
                  <p className="mt-0.5 text-xs text-muted">
                    Exceptions first · {workspace.data.workItems.length} shown
                  </p>
                </div>
                {workspace.data.summary.stalledCount > 0 ? (
                  <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-warning">
                    <span className="size-1.5 motion-safe:animate-pulse rounded-full bg-warning" />
                    action available
                  </span>
                ) : null}
              </div>
              {workspace.data.workItems.length === 0 ? (
                <div className="px-4 py-10 text-sm text-muted">
                  No persisted jobs or runner tasks are available for this
                  tenant yet. The control room will populate from real work.
                </div>
              ) : (
                <ul
                  className="divide-y divide-line"
                  aria-label="Async workloads"
                >
                  {workspace.data.workItems.map((item) => (
                    <li key={`${item.workloadKind}:${item.workloadId}`}>
                      <button
                        type="button"
                        aria-pressed={selectedId === item.workloadId}
                        onClick={() => setSelectedId(item.workloadId)}
                        className={cn(
                          "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-left transition-colors hover:bg-brand/5",
                          selectedId === item.workloadId &&
                            "bg-brand/10 shadow-[inset_3px_0_0_#3c96ff]"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-mono text-xs text-ink">
                              {item.workloadKind === "ValidationJob"
                                ? item.queueName
                                : item.moduleId}
                            </span>
                            <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-subtle">
                              {item.workloadKind === "ValidationJob"
                                ? "job"
                                : "runner"}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted">
                            {item.detail}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1.5">
                          <span
                            className={cn(
                              "rounded-control border px-2 py-0.5 font-mono text-[10px]",
                              stateTone(item.operationalState)
                            )}
                          >
                            {item.operationalState}
                          </span>
                          <span className="font-mono text-[10px] text-subtle">
                            {formatAge(item.ageSeconds)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="min-w-0 bg-elevated/30 px-4 py-4 sm:px-5">
              {selected ? (
                <WorkloadInspector
                  item={selected}
                  canOperate={canOperate}
                  busy={busy}
                  reason={reason}
                  reference={reference}
                  setReason={setReason}
                  setReference={setReference}
                  onDecision={decide}
                />
              ) : (
                <div className="py-8 text-sm text-muted">
                  Select a persisted workload to inspect its recovery boundary.
                </div>
              )}
            </section>
          </div>

          {feedback ? (
            <div className="border-t border-line px-4 py-3 sm:px-5">
              <InlineError
                message={feedback.message}
                tone={feedback.tone}
                onDismiss={() => setFeedback(null)}
              />
              {recoveryMissionId ? (
                <Link
                  className={buttonClassName({
                    className: "mt-3",
                    size: "sm",
                    variant: "secondary"
                  })}
                  href={`/missions/${recoveryMissionId}`}
                >
                  Review recovery draft
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="grid border-t border-line lg:grid-cols-2">
            <details
              className="group border-b border-line lg:border-b-0 lg:border-r"
              open={!workspace.data.policy}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 sm:px-5">
                <span>
                  <span className="block font-display text-sm font-semibold text-ink">
                    Reviewed operating targets
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {workspace.data.policy
                      ? `${workspace.data.policy.supportOwner} · ${workspace.data.policy.reviewReference}`
                      : "Required before reconciliation"}
                  </span>
                </span>
                <span aria-hidden className="text-muted group-open:rotate-45">
                  +
                </span>
              </summary>
              <PolicyForm
                canOperate={canOperate}
                draft={policyDraft}
                busy={busy === "policy"}
                onChange={setPolicyDraft}
                onSubmit={submitPolicy}
              />
            </details>

            <details
              className="group"
              open={workspace.data.summary.stalledCount > 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 sm:px-5">
                <span>
                  <span className="block font-display text-sm font-semibold text-ink">
                    Reconciliation boundary
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    No replay · terminalize stale work only
                  </span>
                </span>
                <span aria-hidden className="text-muted group-open:rotate-45">
                  +
                </span>
              </summary>
              <div
                className="border-t border-line px-4 py-4 sm:px-5"
                data-testid="reconciliation-form"
              >
                <ReasonFields
                  reason={reason}
                  reference={reference}
                  setReason={setReason}
                  setReference={setReference}
                />
                <Button
                  className="mt-3"
                  size="sm"
                  variant="secondary"
                  loading={busy === "reconcile"}
                  disabled={
                    !canOperate ||
                    !workspace.data.policy ||
                    reason.trim().length < 10 ||
                    reference.trim().length < 3
                  }
                  onClick={() => void reconcile()}
                >
                  Reconcile stale work
                </Button>
                {!canOperate ? (
                  <p className="mt-2 text-xs text-muted">
                    Tenant admin access is required.
                  </p>
                ) : null}
              </div>
            </details>
          </div>

          <section
            className="border-t border-line"
            aria-labelledby="ops-ledger-title"
          >
            <div className="px-4 py-3 sm:px-5">
              <h3
                id="ops-ledger-title"
                className="font-display text-sm font-semibold text-ink"
              >
                Recovery ledger
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                Hash-linked, immutable operating decisions with actor,
                reference, and result.
              </p>
            </div>
            {workspace.data.events.length === 0 ? (
              <div className="border-t border-line px-4 py-6 text-sm text-muted sm:px-5">
                No operating decisions have been recorded.
              </div>
            ) : (
              <ol className="divide-y divide-line border-t border-line">
                {workspace.data.events.slice(0, 20).map((event) => (
                  <li
                    key={event.eventId}
                    className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:px-5"
                  >
                    <span className="font-mono text-subtle">
                      #{event.sequence}
                    </span>
                    <span className="min-w-0">
                      <span className="font-semibold text-ink">
                        {event.eventType}
                      </span>
                      <span className="ml-2 text-muted">{event.reference}</span>
                      <span className="mt-1 block truncate text-muted">
                        {event.reason}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] text-subtle">
                        actor {event.createdBy.slice(0, 8)} ·{" "}
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                      {event.recoveryMissionId ? (
                        <Link
                          className="mt-1 inline-flex text-[11px] font-semibold text-brand hover:text-brand-2"
                          href={`/missions/${event.recoveryMissionId}`}
                        >
                          Review recovery draft →
                        </Link>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase tracking-[0.08em]",
                        event.integrityVerified ? "text-fixed" : "text-danger"
                      )}
                    >
                      {event.integrityVerified
                        ? "hash verified"
                        : "hash failed"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="border-t border-line px-4 py-3 sm:px-5">
            {workspace.data.limitations.map((limitation) => (
              <p key={limitation} className="text-[11px] leading-5 text-subtle">
                {limitation}
              </p>
            ))}
          </div>
        </>
      ) : null}
    </Panel>
  );
}

function SummaryDatum({
  alert = false,
  detail,
  label,
  value
}: {
  alert?: boolean;
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-b border-line px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="text-[10px] uppercase tracking-[0.1em] text-subtle">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 font-mono text-base text-ink",
          alert && "text-warning"
        )}
      >
        {value}
      </dd>
      <p className="mt-0.5 truncate text-[10px] text-muted">{detail}</p>
    </div>
  );
}

function WorkloadInspector({
  busy,
  canOperate,
  item,
  onDecision,
  reason,
  reference,
  setReason,
  setReference
}: {
  busy: string | null;
  canOperate: boolean;
  item: AsyncOperationsWorkItem;
  onDecision: (
    decision: AsyncRecoveryDecisionInput["decision"]
  ) => Promise<void>;
  reason: string;
  reference: string;
  setReason: (value: string) => void;
  setReference: (value: string) => void;
}) {
  const canDecide =
    canOperate &&
    item.operationalState === "TerminalFailure" &&
    item.nextAction === "PrepareRecovery" &&
    reason.trim().length >= 10 &&
    reference.trim().length >= 3;
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.1em] text-subtle">
            {item.workloadKind}
          </p>
          <h3 className="mt-1 truncate font-mono text-sm text-ink">
            {item.workloadId}
          </h3>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-control border px-2 py-0.5 font-mono text-[10px]",
            stateTone(item.operationalState)
          )}
        >
          {item.operationalState}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">{item.detail}</p>
      {item.errorSummary ? (
        <div className="mt-3 border-l-2 border-danger/60 pl-3 text-xs leading-5 text-danger">
          {item.errorSummary}
        </div>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line py-3 text-xs">
        <InspectorDatum label="Status" value={item.status} />
        <InspectorDatum
          label="Observed age"
          value={formatAge(item.ageSeconds)}
        />
        <InspectorDatum label="Mission" value={item.missionId ?? "None"} />
        <InspectorDatum label="Run" value={item.runId ?? "None"} />
        <InspectorDatum
          label="Attempts"
          value={item.attempts?.toString() ?? "—"}
        />
        <InspectorDatum label="Next action" value={item.nextAction} />
      </dl>

      {item.operationalState === "TerminalFailure" &&
      item.nextAction === "PrepareRecovery" ? (
        <div className="mt-4" data-testid="terminal-decision-form">
          <h4 className="font-display text-sm font-semibold text-ink">
            Record terminal decision
          </h4>
          <p className="mt-1 text-xs leading-5 text-muted">
            Preparing recovery clones mission intent into Draft. It copies no
            policy decision, creates no job, and cannot execute on its own.
          </p>
          <div className="mt-3">
            <ReasonFields
              reason={reason}
              reference={reference}
              setReason={setReason}
              setReference={setReference}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy === "PrepareRecovery"}
              disabled={!canDecide}
              onClick={() => void onDecision("PrepareRecovery")}
            >
              Prepare recovery draft
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "AcceptTerminal"}
              disabled={!canDecide}
              onClick={() => void onDecision("AcceptTerminal")}
            >
              Accept terminal outcome
            </Button>
          </div>
        </div>
      ) : item.nextAction === "None" &&
        item.operationalState === "TerminalFailure" ? (
        <p className="mt-4 text-xs text-fixed">
          A terminal decision is already recorded for this workload.
        </p>
      ) : null}
    </div>
  );
}

function InspectorDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.08em] text-subtle">
        {label}
      </dt>
      <dd className="mt-1 truncate font-mono text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}

function ReasonFields({
  reason,
  reference,
  setReason,
  setReference
}: {
  reason: string;
  reference: string;
  setReason: (value: string) => void;
  setReference: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-muted">
        Decision reference
        <input
          className={`${FIELD} mt-1 w-full`}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="INC-2026-0042"
        />
      </label>
      <label className="text-xs text-muted">
        Operator reason
        <input
          className={`${FIELD} mt-1 w-full`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why this decision is safe"
        />
      </label>
    </div>
  );
}

function PolicyForm({
  busy,
  canOperate,
  draft,
  onChange,
  onSubmit
}: {
  busy: boolean;
  canOperate: boolean;
  draft: AsyncOperationsPolicyInput;
  onChange: (draft: AsyncOperationsPolicyInput) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}) {
  function numberField(
    key:
      | "queueAgeTargetSeconds"
      | "runnerLeaseWarningSeconds"
      | "runningTimeoutSeconds",
    value: string
  ) {
    onChange({ ...draft, [key]: Number(value) });
  }
  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="border-t border-line px-4 py-4 sm:px-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Support owner
          <input
            className={`${FIELD} mt-1 w-full`}
            value={draft.supportOwner}
            onChange={(event) =>
              onChange({ ...draft, supportOwner: event.target.value })
            }
          />
        </label>
        <label className="text-xs text-muted">
          Escalation channel
          <input
            className={`${FIELD} mt-1 w-full`}
            value={draft.escalationChannel}
            onChange={(event) =>
              onChange({ ...draft, escalationChannel: event.target.value })
            }
          />
        </label>
        <label className="text-xs text-muted">
          Queue-age target · seconds
          <input
            className={`${FIELD} mt-1 w-full`}
            min={30}
            max={86400}
            type="number"
            value={draft.queueAgeTargetSeconds}
            onChange={(event) =>
              numberField("queueAgeTargetSeconds", event.target.value)
            }
          />
        </label>
        <label className="text-xs text-muted">
          Running timeout · seconds
          <input
            className={`${FIELD} mt-1 w-full`}
            min={60}
            max={86400}
            type="number"
            value={draft.runningTimeoutSeconds}
            onChange={(event) =>
              numberField("runningTimeoutSeconds", event.target.value)
            }
          />
        </label>
        <label className="text-xs text-muted">
          Runner lease warning · seconds
          <input
            className={`${FIELD} mt-1 w-full`}
            min={30}
            max={86400}
            type="number"
            value={draft.runnerLeaseWarningSeconds}
            onChange={(event) =>
              numberField("runnerLeaseWarningSeconds", event.target.value)
            }
          />
        </label>
        <label className="text-xs text-muted">
          Review reference
          <input
            className={`${FIELD} mt-1 w-full`}
            value={draft.reviewReference}
            onChange={(event) =>
              onChange({ ...draft, reviewReference: event.target.value })
            }
          />
        </label>
      </div>
      <Button
        className="mt-3"
        size="sm"
        loading={busy}
        disabled={!canOperate}
        type="submit"
      >
        Save reviewed targets
      </Button>
    </form>
  );
}
