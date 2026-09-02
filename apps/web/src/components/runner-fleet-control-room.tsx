"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import type {
  RunnerFleetHealthState,
  RunnerFleetPolicy,
  RunnerFleetRunner,
  RunnerFleetWorkspace,
  RunnerRecord,
  RunnerTransportDecision,
  RunnerTaskRecord
} from "@periscan/shared";

import { useApiResource, type ApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ConfirmDialog,
  ErrorState,
  InfoPopover,
  InlineError,
  LiveUpdatePill,
  LoadingSkeleton,
  NotConfigured,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import { RUNNER_CONTROL_PLANE, RunnerPairing } from "./runner-pairing";

const HEALTH_TONE: Record<RunnerFleetHealthState, StateTone> = {
  Attention: "approval",
  Halted: "blocked",
  Healthy: "fixed",
  Offline: "missed",
  Provisioning: "inconclusive",
  Revoked: "missed"
};

const TASK_TONE: Record<string, StateTone> = {
  Accepted: "validated",
  Cancelled: "inconclusive",
  Completed: "fixed",
  DeniedByLocalPolicy: "blocked",
  DeniedByServerPolicy: "blocked",
  Expired: "inconclusive",
  Failed: "missed",
  Leased: "approval",
  Queued: "inconclusive",
  Rejected: "missed",
  Running: "approval"
};

const ALERT_TONE: Record<string, StateTone> = {
  Critical: "missed",
  Info: "inconclusive",
  Warning: "approval"
};

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function relativeTime(value?: string | null): string {
  if (!value) return "Never";
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed)) return "Unknown";
  const seconds = Math.max(0, Math.floor(elapsed / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function duration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3_600)}h ${Math.floor((seconds % 3_600) / 60)}m`;
}

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function RunnerFleetControlRoom() {
  const fleet = useApiResource(() => api.getRunnerFleetWorkspace(), [], {
    refetchIntervalMs: 15_000
  });
  const registeredRunners = useApiResource(() => api.listRunners(), []);
  const transport = useApiResource(
    () => api.listRunnerTransportDecisions(),
    []
  );
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | null>(null);

  const selected = useMemo(() => {
    const runners = fleet.data?.runners ?? [];
    return (
      runners.find((item) => item.runner.runnerId === selectedRunnerId) ??
      runners[0] ??
      null
    );
  }, [fleet.data, selectedRunnerId]);

  useEffect(() => {
    if (selected && selected.runner.runnerId !== selectedRunnerId) {
      setSelectedRunnerId(selected.runner.runnerId);
    }
  }, [selected, selectedRunnerId]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
              Ops instrument · Fleet health
            </p>
            <span className="size-1 rounded-full bg-fixed shadow-[0_0_12px_currentColor]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
              outbound control plane
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Runner control room
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
            Treat fleet health as the primary ops instrument: triage
            server-received liveness, queue depth, and signed task state before
            pairing or emergency halt. Heartbeat age uses control-plane receipt
            time; host-reported time stays in the immutable liveness record.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveUpdatePill
            lastUpdatedAt={fleet.lastUpdatedAt}
            refreshing={fleet.refreshing}
          />
          <button
            type="button"
            onClick={() => void fleet.refetch()}
            disabled={fleet.refreshing}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {fleet.refreshing ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      </header>

      {fleet.loading ? (
        <div className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
          <LoadingSkeleton rows={7} />
        </div>
      ) : fleet.error ? (
        <div className="mt-5">
          <ErrorState message={fleet.error} onRetry={fleet.refetch} />
        </div>
      ) : fleet.data ? (
        <>
          <FleetSummary workspace={fleet.data} />
          {fleet.data.runners.length ? (
            <div className="mt-4 grid min-h-[640px] overflow-hidden rounded-card border border-[#22396c] bg-[#080f20] shadow-[0_28px_80px_rgba(0,0,0,0.35)] lg:grid-cols-[390px_minmax(0,1fr)]">
              <RunnerRail
                workspace={fleet.data}
                selectedRunnerId={selected?.runner.runnerId ?? null}
                onSelect={setSelectedRunnerId}
              />
              {selected ? (
                <RunnerInspector runner={selected} onChanged={fleet.refetch} />
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-card border border-line bg-surface p-5">
              <NotConfigured
                title="No runners registered"
                message="Pair an outbound-only runner below, then wait for its first authenticated check-in. Periscan will not invent fleet activity before an agent connects."
              />
            </div>
          )}

          <OperationsConfiguration
            workspace={fleet.data}
            registeredRunners={registeredRunners}
            transport={transport}
            onPolicyChanged={fleet.refetch}
          />
        </>
      ) : null}
    </div>
  );
}

function FleetSummary({ workspace }: { workspace: RunnerFleetWorkspace }) {
  const { summary } = workspace;
  const needingAttention = summary.attention + summary.offline + summary.halted;
  const metrics = [
    {
      detail: `${summary.total} registered`,
      label: "Fleet healthy",
      tone:
        summary.healthy === summary.total && summary.total > 0
          ? "text-fixed"
          : "text-ink",
      value: `${summary.healthy}/${summary.total}`
    },
    {
      detail: `${summary.offline} offline · ${summary.halted} halted`,
      label: "Needs attention",
      tone: needingAttention ? "text-approval" : "text-fixed",
      value: String(needingAttention)
    },
    {
      detail: "queued, leased, running",
      label: "Active tasks",
      tone: "text-brand",
      value: String(summary.activeTasks)
    },
    {
      detail: "terminal tasks, last 24h",
      label: "Completion",
      tone: "text-ink",
      value: percent(summary.completionRate24h)
    },
    {
      detail: "redacted artifacts, last 24h",
      label: "Evidence returned",
      tone: "text-validated",
      value: String(summary.evidence24h)
    }
  ];

  return (
    <section
      aria-label="Fleet summary"
      className="mt-4 grid grid-cols-2 overflow-hidden rounded-card border border-line bg-surface lg:grid-cols-5"
    >
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={cn(
            "border-b border-r border-line px-4 py-3 lg:border-b-0 lg:last:border-r-0",
            metric.label === "Evidence returned" &&
              "col-span-2 border-b-0 lg:col-span-1"
          )}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle">
            {metric.label}
          </p>
          <p
            className={cn(
              "mt-1 font-display text-2xl font-semibold",
              metric.tone
            )}
          >
            {metric.value}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-subtle">
            {metric.detail}
          </p>
        </div>
      ))}
    </section>
  );
}

function RunnerRail({
  workspace,
  selectedRunnerId,
  onSelect
}: {
  workspace: RunnerFleetWorkspace;
  selectedRunnerId: string | null;
  onSelect: (runnerId: string) => void;
}) {
  const order: Record<RunnerFleetHealthState, number> = {
    Offline: 0,
    Attention: 1,
    Halted: 2,
    Provisioning: 3,
    Healthy: 4,
    Revoked: 5
  };
  const runners = [...workspace.runners].sort(
    (a, b) => order[a.healthState] - order[b.healthState]
  );

  return (
    <aside className="border-b border-[#22396c] bg-[#0a1328] lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-ink">
            Fleet inventory
          </h2>
          <p className="mt-0.5 text-[11px] text-subtle">
            Exceptions first · threshold policy v{workspace.rulesVersion}
          </p>
        </div>
        <InfoPopover label="How fleet health works">
          Health is derived from the most recent server-received heartbeat,
          configured attention/offline thresholds, revocation state, and the
          server kill switch. A host-reported clock cannot make itself healthy.
        </InfoPopover>
      </div>
      <div className="max-h-[430px] overflow-y-auto lg:max-h-[720px]">
        {runners.map((item) => {
          const selected = selectedRunnerId === item.runner.runnerId;
          const queueDepth = item.latestHeartbeat?.queueDepth ?? 0;
          return (
            <button
              type="button"
              key={item.runner.runnerId}
              onClick={() => onSelect(item.runner.runnerId)}
              aria-pressed={selected}
              className={cn(
                "group relative w-full border-b border-line px-4 py-3.5 text-left transition-colors",
                selected
                  ? "bg-[linear-gradient(90deg,rgba(38,92,224,0.2),rgba(20,36,74,0.72))]"
                  : "hover:bg-white/[0.025]"
              )}
            >
              {selected ? (
                <span className="absolute inset-y-0 left-0 w-0.5 bg-brand shadow-[0_0_14px_#3c96ff]" />
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-full bg-current shadow-[0_0_10px_currentColor]",
                        HEALTH_TONE[item.healthState] === "fixed"
                          ? "text-fixed"
                          : HEALTH_TONE[item.healthState] === "approval"
                            ? "text-approval"
                            : HEALTH_TONE[item.healthState] === "missed"
                              ? "text-missed"
                              : "text-inconclusive-text"
                      )}
                    />
                    <span className="truncate font-display text-[13px] font-semibold text-ink">
                      {item.runner.name}
                    </span>
                    {item.runner.labels.includes("demo") ? (
                      <span className="rounded-control border border-brand/40 px-1.5 font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-brand">
                        Demo
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-subtle">
                    {item.runner.hostname} · {item.runner.os}/{item.runner.arch}
                  </p>
                </div>
                <StateBadge tone={HEALTH_TONE[item.healthState]}>
                  {item.healthState}
                </StateBadge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                <MiniFact
                  label="Heartbeat"
                  value={relativeTime(item.runner.lastSeenAt)}
                />
                <MiniFact label="Queue" value={String(queueDepth)} />
                <MiniFact
                  label="Work"
                  value={String(item.taskSummary.active)}
                />
              </div>
              {item.alerts.length ? (
                <p className="mt-2 truncate text-[10px] text-approval">
                  {item.alerts[0]?.title}
                  {item.alerts.length > 1
                    ? ` · +${item.alerts.length - 1} more`
                    : ""}
                </p>
              ) : (
                <p className="mt-2 text-[10px] text-fixed">
                  Inside operating envelope
                </p>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono uppercase tracking-[0.06em] text-subtle">
        {label}
      </p>
      <p className="mt-0.5 truncate text-muted">{value}</p>
    </div>
  );
}

function RunnerInspector({
  runner,
  onChanged
}: {
  runner: RunnerFleetRunner;
  onChanged: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<"halt" | "release" | "revoke" | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const record = runner.runner;

  async function applyControl() {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      if (confirm === "revoke") {
        await api.revokeRunner(record.runnerId);
        setNotice(
          "Credentials revoked. Host acknowledgement is tracked separately."
        );
      } else {
        const active = confirm === "halt";
        await api.setRunnerKillSwitch(record.runnerId, {
          active,
          reason: active ? "Fleet operator emergency halt" : null
        });
        setNotice(
          active
            ? "Server kill switch engaged; awaiting the next host poll."
            : "Server kill switch released; eligible work may resume."
        );
      }
      setConfirm(null);
      await onChanged();
    } catch (caught) {
      setError(errorMessage(caught, "Unable to update runner control state."));
    } finally {
      setBusy(false);
    }
  }

  const confirmCopy =
    confirm === "revoke"
      ? {
          confirmLabel: "Revoke credentials",
          description:
            "This permanently revokes the runner's credentials. Periscan will deny future authenticated polls and preserve the host acknowledgement state for investigation.",
          phrase: record.name,
          title: `Revoke ${record.name}?`
        }
      : confirm === "halt"
        ? {
            confirmLabel: "Engage kill switch",
            description:
              "Periscan will immediately stop leasing new work. The agent will observe the halt and acknowledge it on its next outbound poll.",
            phrase: undefined,
            title: `Halt ${record.name}?`
          }
        : {
            confirmLabel: "Release kill switch",
            description:
              "The runner becomes eligible to receive policy-approved, signed work again. Existing scope and safety controls remain enforced.",
            phrase: undefined,
            title: `Release ${record.name}?`
          };

  return (
    <section className="min-w-0 bg-[radial-gradient(circle_at_78%_0%,rgba(39,94,215,0.13),transparent_34%)]">
      <div className="flex flex-col gap-4 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-display text-xl font-semibold text-ink">
              {record.name}
            </h2>
            <StateBadge tone={HEALTH_TONE[runner.healthState]}>
              {runner.healthState}
            </StateBadge>
            {record.labels.includes("demo") ? (
              <StateBadge tone="brand" variant="outline">
                Demonstration data
              </StateBadge>
            ) : null}
          </div>
          <p className="mt-1 font-mono text-[11px] text-subtle">
            {record.hostname} · {record.deploymentMode} · {record.os}/
            {record.arch}
            {" · "}agent {record.version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setConfirm(record.killSwitchActive ? "release" : "halt")
            }
            disabled={record.status === "Revoked"}
            className={buttonClassName({
              size: "sm",
              variant: record.killSwitchActive ? "secondary" : "danger"
            })}
          >
            {record.killSwitchActive ? "Release halt" : "Emergency halt"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm("revoke")}
            disabled={record.status === "Revoked"}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Revoke
          </button>
        </div>
      </div>

      <div className="grid gap-px bg-line xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="min-w-0 bg-[#080f20] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-ink">
                Liveness signal
              </h3>
              <p className="mt-0.5 text-[11px] text-subtle">
                Last {runner.heartbeatSeries.length} persisted receipt
                {runner.heartbeatSeries.length === 1 ? "" : "s"}
              </p>
            </div>
            <span className="font-mono text-[10px] text-subtle">
              server age {duration(runner.heartbeatAgeSeconds)}
            </span>
          </div>
          <HeartbeatPulse runner={runner} />

          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-4">
            <LivenessFact
              label="Last receipt"
              value={relativeTime(record.lastSeenAt)}
              detail={
                record.lastSeenAt
                  ? new Date(record.lastSeenAt).toLocaleString()
                  : "No authenticated receipt"
              }
            />
            <LivenessFact
              label="Queue depth"
              value={String(runner.latestHeartbeat?.queueDepth ?? 0)}
              detail={`${runner.taskSummary.active} active task${runner.taskSummary.active === 1 ? "" : "s"}`}
            />
            <LivenessFact
              label="Certificate"
              value={
                runner.certificateDaysRemaining === null
                  ? "Not reported"
                  : `${Math.max(0, Math.floor(runner.certificateDaysRemaining))}d left`
              }
              detail={
                record.certificateExpiresAt
                  ? `expires ${new Date(record.certificateExpiresAt).toLocaleDateString()}`
                  : "Awaiting agent report"
              }
            />
            <LivenessFact
              label="Agent version"
              value={record.version}
              detail={
                runner.versionCompliant === false
                  ? "Below fleet minimum"
                  : runner.versionCompliant === true
                    ? "Meets fleet minimum"
                    : "No minimum configured"
              }
            />
          </div>

          <TaskTimeline tasks={runner.recentTasks} />
        </div>

        <aside className="bg-[#0a1328] p-5">
          <h3 className="font-display text-sm font-semibold text-ink">
            Operator attention
          </h3>
          <p className="mt-0.5 text-[11px] text-subtle">
            Derived fleet exceptions; raw scanner output is excluded.
          </p>
          {runner.alerts.length ? (
            <ul className="mt-3 space-y-2">
              {runner.alerts.map((alert) => (
                <li
                  key={alert.code}
                  className="rounded-control border border-line bg-[#080f20] p-3"
                >
                  <StateBadge tone={ALERT_TONE[alert.severity] ?? "neutral"}>
                    {alert.severity}
                  </StateBadge>
                  <p className="mt-2 text-[12px] font-medium text-ink">
                    {alert.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    {alert.detail}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-control border border-fixed/30 bg-fixed/5 p-3">
              <StateBadge tone="fixed">Inside envelope</StateBadge>
              <p className="mt-2 text-[11px] leading-5 text-muted">
                Liveness, queue, certificate, version, control acknowledgement,
                and recent task outcomes are within fleet policy.
              </p>
            </div>
          )}

          <dl className="mt-5 space-y-3 border-t border-line pt-4 text-[11px]">
            <Definition
              label="Transport"
              value={`${record.transportMode} · outbound only`}
            />
            <Definition
              label="Kill-switch host ack"
              value={
                record.killSwitchAcknowledgedAt
                  ? relativeTime(record.killSwitchAcknowledgedAt)
                  : record.killSwitchActive
                    ? "Pending"
                    : "Not required"
              }
            />
            <Definition
              label="Revocation host ack"
              value={
                record.revocationAcknowledgedAt
                  ? relativeTime(record.revocationAcknowledgedAt)
                  : record.revokedAt
                    ? "Pending"
                    : "Not required"
              }
            />
            <Definition label="Runner ID" value={record.runnerId} mono />
          </dl>
          {notice ? (
            <p
              role="status"
              className="mt-4 rounded-control border border-fixed/30 bg-fixed/5 px-3 py-2 text-[11px] text-fixed"
            >
              {notice}
            </p>
          ) : null}
          {error ? <InlineError message={error} /> : null}
        </aside>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        confirmPhrase={confirmCopy.phrase}
        destructive={confirm !== "release"}
        busy={busy}
        error={error}
        onCancel={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={() => void applyControl()}
      />
    </section>
  );
}

function HeartbeatPulse({ runner }: { runner: RunnerFleetRunner }) {
  const samples = runner.heartbeatSeries;
  const latestQueue = runner.latestHeartbeat?.queueDepth ?? 0;
  const maxQueue = Math.max(1, ...samples.map((sample) => sample.queueDepth));
  const placeholders = Math.max(0, 24 - samples.length);

  return (
    <div className="relative mt-3 h-28 overflow-hidden rounded-control border border-[#1c3262] bg-[linear-gradient(180deg,rgba(21,49,106,0.34),rgba(8,15,32,0.1)),repeating-linear-gradient(90deg,transparent,transparent_calc(8.333%-1px),rgba(71,98,154,0.13)_calc(8.333%-1px),rgba(71,98,154,0.13)_8.333%)] px-3 pb-3 pt-6">
      <div className="absolute left-3 top-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-subtle">
        <span className="size-1.5 animate-pulse rounded-full bg-fixed shadow-[0_0_10px_#29d69a]" />
        authenticated receipts · queue {latestQueue}
      </div>
      <div
        className="flex h-full items-end gap-1"
        aria-label="Recent heartbeat receipts"
      >
        {Array.from({ length: placeholders }, (_, index) => (
          <span
            key={`empty-${index}`}
            className="h-1 flex-1 rounded-t-sm bg-white/[0.035]"
          />
        ))}
        {samples.map((sample) => {
          const height = 22 + Math.round((sample.queueDepth / maxQueue) * 54);
          return (
            <span
              key={sample.heartbeatSampleId}
              title={`${new Date(sample.receivedAt).toLocaleString()} · queue ${sample.queueDepth}`}
              className={cn(
                "group relative flex-1 rounded-t-sm bg-fixed/70 shadow-[0_0_10px_rgba(41,214,154,0.15)] transition-colors hover:bg-fixed",
                sample.status === "Degraded" && "bg-approval/80",
                (sample.status === "Offline" || sample.status === "Revoked") &&
                  "bg-missed/80"
              )}
              style={{ height }}
            >
              <span className="absolute inset-x-0 top-0 h-px bg-white/70" />
            </span>
          );
        })}
      </div>
    </div>
  );
}

function LivenessFact({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-[#0a1328] px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.09em] text-subtle">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-medium text-ink">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-subtle">{detail}</p>
    </div>
  );
}

function TaskTimeline({ tasks }: { tasks: RunnerTaskRecord[] }) {
  const visible = tasks.slice(0, 8);
  return (
    <div className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-ink">
            Task activity
          </h3>
          <p className="mt-0.5 text-[11px] text-subtle">
            Recent signed work and normalized outcome state
          </p>
        </div>
        <span className="font-mono text-[10px] text-subtle">
          {tasks.length} retained here
        </span>
      </div>
      {visible.length ? (
        <ol className="mt-3 border-l border-[#25457e] pl-4">
          {visible.map((task) => (
            <li
              key={task.taskId}
              className="relative border-b border-line py-3 first:pt-0 last:border-b-0"
            >
              <span
                className={cn(
                  "absolute -left-[20.5px] top-4 size-2 rounded-sm bg-current",
                  task.status === "Completed"
                    ? "text-fixed"
                    : task.status === "Failed"
                      ? "text-missed"
                      : "text-brand"
                )}
              />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[11px] text-ink">
                    {task.moduleId}
                  </p>
                  <p className="mt-1 text-[10px] text-subtle">
                    {relativeTime(task.issuedAt)} · {task.safetyLevel} ·{" "}
                    {task.redactedEvidenceIds.length} evidence
                  </p>
                </div>
                <StateBadge tone={TASK_TONE[task.status] ?? "neutral"}>
                  {task.status}
                </StateBadge>
              </div>
              {task.errorSummary ? (
                <p className="mt-1 text-[10px] text-missed">
                  {task.errorSummary}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-control border border-dashed border-line px-3 py-5 text-center text-[11px] text-subtle">
          No signed tasks have been persisted for this runner yet.
        </p>
      )}
    </div>
  );
}

function Definition({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.09em] text-subtle">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 break-all text-muted",
          mono && "font-mono text-[10px]"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function OperationsConfiguration({
  workspace,
  registeredRunners,
  transport,
  onPolicyChanged
}: {
  workspace: RunnerFleetWorkspace;
  registeredRunners: ApiResource<RunnerRecord[]>;
  transport: ApiResource<RunnerTransportDecision[]>;
  onPolicyChanged: () => Promise<void>;
}) {
  const firewallRules = Array.from(
    new Map(
      workspace.runners.flatMap(({ runner }) =>
        runner.networkProfile.gatewayHostnames.map((hostname) => [
          `${hostname}:${runner.networkProfile.outboundHttpsPorts.join(",")}`,
          {
            hostname,
            ports: runner.networkProfile.outboundHttpsPorts,
            proxy: runner.networkProfile.explicitProxyUrl
          }
        ])
      )
    ).values()
  );

  return (
    <section className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
      <details
        open={!workspace.policy.configured}
        className="group border-b border-line"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02]">
          <div>
            <p className="font-display text-sm font-semibold text-ink">
              Fleet operating policy
            </p>
            <p className="mt-0.5 text-[11px] text-subtle">
              {workspace.policy.configured
                ? `Attention ${workspace.policy.attentionAfterSeconds}s · offline ${workspace.policy.offlineAfterSeconds}s · owner ${workspace.policy.supportOwner}`
                : "Default thresholds are active; assign the operating owner and escalation contract."}
            </p>
          </div>
          <StateBadge tone={workspace.policy.configured ? "fixed" : "approval"}>
            {workspace.policy.configured ? "Sealed" : "Configure"}
          </StateBadge>
        </summary>
        <PolicyEditor policy={workspace.policy} onChanged={onPolicyChanged} />
      </details>

      <details className="group border-b border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02]">
          <div>
            <p className="font-display text-sm font-semibold text-ink">
              Pair and deploy a runner
            </p>
            <p className="mt-0.5 text-[11px] text-subtle">
              Issue a one-time enrollment token and verify the first
              authenticated check-in.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-brand">
            Open
          </span>
        </summary>
        <div className="border-t border-line p-4">
          <RunnerPairing runners={registeredRunners} />
        </div>
      </details>

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02]">
          <div>
            <p className="font-display text-sm font-semibold text-ink">
              Network and transport contract
            </p>
            <p className="mt-0.5 text-[11px] text-subtle">
              DNS plus outbound HTTPS only; no listener, inbound port, reverse
              SSH, or arbitrary shell.
            </p>
          </div>
          <StateBadge tone="validated">Outbound only</StateBadge>
        </summary>
        <div className="grid gap-5 border-t border-line p-4 lg:grid-cols-2">
          <div>
            <h3 className="font-display text-xs font-semibold text-ink">
              Persisted firewall destinations
            </h3>
            <ul className="mt-2 divide-y divide-line rounded-control border border-line">
              {(firewallRules.length
                ? firewallRules
                : [
                    {
                      hostname: new URL(RUNNER_CONTROL_PLANE).hostname,
                      ports: [443],
                      proxy: null
                    }
                  ]
              ).map((rule) => (
                <li
                  key={`${rule.hostname}:${rule.ports.join(",")}`}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <code className="text-[11px] text-ink">{rule.hostname}</code>
                  <span className="font-mono text-[9px] text-subtle">
                    TCP {rule.ports.join(", ")}
                    {rule.proxy ? ` · ${rule.proxy}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-display text-xs font-semibold text-ink">
              Control-channel decisions
            </h3>
            {transport.loading ? (
              <LoadingSkeleton rows={2} className="mt-2" />
            ) : transport.error ? (
              <InlineError message={transport.error} />
            ) : (
              <ul className="mt-2 space-y-2">
                {(transport.data ?? []).map((decision) => (
                  <li
                    key={decision.channel}
                    className="rounded-control border border-line px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-ink">
                        {decision.channel}
                      </span>
                      <StateBadge
                        tone={
                          decision.status === "Primary"
                            ? "fixed"
                            : decision.status === "Disallowed"
                              ? "blocked"
                              : "inconclusive"
                        }
                      >
                        {decision.status}
                      </StateBadge>
                    </div>
                    <p className="mt-1 text-[10px] text-subtle">
                      {decision.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}

function PolicyEditor({
  policy,
  onChanged
}: {
  policy: RunnerFleetPolicy;
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    attentionAfterSeconds: policy.attentionAfterSeconds,
    certificateWarningDays: policy.certificateWarningDays,
    escalationReference: policy.escalationReference ?? "SECOPS-RUNNER",
    minimumAgentVersion: policy.minimumAgentVersion ?? "0.1.0",
    offlineAfterSeconds: policy.offlineAfterSeconds,
    queueWarningDepth: policy.queueWarningDepth,
    supportOwner: policy.supportOwner ?? "Security Operations"
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      attentionAfterSeconds: policy.attentionAfterSeconds,
      certificateWarningDays: policy.certificateWarningDays,
      escalationReference: policy.escalationReference ?? "SECOPS-RUNNER",
      minimumAgentVersion: policy.minimumAgentVersion ?? "0.1.0",
      offlineAfterSeconds: policy.offlineAfterSeconds,
      queueWarningDepth: policy.queueWarningDepth,
      supportOwner: policy.supportOwner ?? "Security Operations"
    });
  }, [policy]);

  function setNumber(
    field:
      | "attentionAfterSeconds"
      | "certificateWarningDays"
      | "offlineAfterSeconds"
      | "queueWarningDepth",
    value: string
  ) {
    setForm((current) => ({ ...current, [field]: Number(value) }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateRunnerFleetPolicy({
        ...form,
        minimumAgentVersion: form.minimumAgentVersion.trim() || null
      });
      setSaved(true);
      await onChanged();
    } catch (caught) {
      setError(errorMessage(caught, "Unable to save fleet policy."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-line bg-[#080f20] p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PolicyField label="Attention after" suffix="seconds">
          <input
            type="number"
            min={30}
            max={3_600}
            value={form.attentionAfterSeconds}
            onChange={(event) =>
              setNumber("attentionAfterSeconds", event.target.value)
            }
            className={inputClass}
          />
        </PolicyField>
        <PolicyField label="Offline after" suffix="seconds">
          <input
            type="number"
            min={60}
            max={86_400}
            value={form.offlineAfterSeconds}
            onChange={(event) =>
              setNumber("offlineAfterSeconds", event.target.value)
            }
            className={inputClass}
          />
        </PolicyField>
        <PolicyField label="Queue warning" suffix="tasks">
          <input
            type="number"
            min={1}
            max={10_000}
            value={form.queueWarningDepth}
            onChange={(event) =>
              setNumber("queueWarningDepth", event.target.value)
            }
            className={inputClass}
          />
        </PolicyField>
        <PolicyField label="Certificate warning" suffix="days">
          <input
            type="number"
            min={1}
            max={90}
            value={form.certificateWarningDays}
            onChange={(event) =>
              setNumber("certificateWarningDays", event.target.value)
            }
            className={inputClass}
          />
        </PolicyField>
        <PolicyField label="Minimum agent version">
          <input
            value={form.minimumAgentVersion}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                minimumAgentVersion: event.target.value
              }));
              setSaved(false);
            }}
            placeholder="0.1.0"
            className={inputClass}
          />
        </PolicyField>
        <PolicyField label="Support owner">
          <input
            value={form.supportOwner}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                supportOwner: event.target.value
              }));
              setSaved(false);
            }}
            className={inputClass}
          />
        </PolicyField>
        <PolicyField label="Escalation reference">
          <input
            value={form.escalationReference}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                escalationReference: event.target.value
              }));
              setSaved(false);
            }}
            className={inputClass}
          />
        </PolicyField>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={
              busy || form.offlineAfterSeconds <= form.attentionAfterSeconds
            }
            className={buttonClassName({ size: "sm", variant: "primary" })}
          >
            {busy ? "Sealing…" : "Seal fleet policy"}
          </button>
          {saved ? (
            <span role="status" className="pb-2 text-[11px] text-fixed">
              Saved
            </span>
          ) : null}
        </div>
      </div>
      {form.offlineAfterSeconds <= form.attentionAfterSeconds ? (
        <p className="mt-2 text-[11px] text-missed">
          Offline threshold must be later than the attention threshold.
        </p>
      ) : null}
      {error ? <InlineError message={error} /> : null}
      <p className="mt-3 text-[10px] leading-5 text-subtle">
        Policy changes are tenant-scoped and audited. They affect derived health
        immediately; heartbeat history remains immutable.
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-[12px] text-ink outline-none placeholder:text-subtle focus:border-brand focus:ring-2 focus:ring-brand/20";

function PolicyField({
  label,
  suffix,
  children
}: {
  label: string;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-subtle">
        {label}
        {suffix ? (
          <span className="normal-case tracking-normal">{suffix}</span>
        ) : null}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
