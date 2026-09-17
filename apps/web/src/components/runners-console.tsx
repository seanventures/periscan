"use client";

/**
 * @deprecated P14-18 — not mounted on `/runners`. Product surface is
 * `RunnerFleetControlRoom` (apps/web/app/runners/page.tsx). Kept for residual
 * unit tests only; do not re-wire into product routes.
 */
import { useState } from "react";

import type { RunnerRecord } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ConfirmDialog,
  ErrorState,
  InlineError,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import { RUNNER_CONTROL_PLANE, RunnerPairing } from "./runner-pairing";

const RUNNER_TONE: Record<string, StateTone> = {
  Active: "fixed",
  Provisioning: "approval",
  Degraded: "approval",
  Offline: "inconclusive",
  Revoked: "missed",
  KillSwitchActive: "missed"
};

const TASK_TONE: Record<string, StateTone> = {
  Completed: "fixed",
  Accepted: "validated",
  Leased: "approval",
  Running: "approval",
  Queued: "inconclusive",
  Failed: "missed",
  Rejected: "missed",
  DeniedByLocalPolicy: "missed",
  DeniedByServerPolicy: "missed",
  Expired: "inconclusive",
  Cancelled: "inconclusive"
};

function transportTone(status: string): StateTone {
  if (/denied|blocked|reject/i.test(status)) return "missed";
  if (/selected|allow|ok|active/i.test(status)) return "fixed";
  return "inconclusive";
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

export function RunnersConsole() {
  const runners = useApiResource(() => api.listRunners(), []);
  const transport = useApiResource(
    () => api.listRunnerTransportDecisions(),
    []
  );
  const persistedFirewallRules = Array.from(
    new Map(
      (runners.data ?? []).flatMap((runner) =>
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
  const firewallRules = persistedFirewallRules.length
    ? persistedFirewallRules
    : [
        {
          hostname: new URL(RUNNER_CONTROL_PLANE).hostname,
          ports: [443],
          proxy: null
        }
      ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Operate
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Runners
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Outbound-only agents that reach into your network to run signed,
          scope-enforced tasks. No inbound ports — a runner dials out over TLS,
          the control plane blocks new work immediately, and the host confirms
          the stop on its next outbound poll.
        </p>
      </header>

      <RunnerPairing runners={runners} />

      <Panel>
        <PanelHeader title="Firewall allowlist" />
        <div className="p-4">
          <p className="text-sm text-muted">
            Runners require DNS and outbound HTTPS only. Use the persisted
            gateway FQDNs below for a plant or datacenter firewall request; no
            inbound rule is required.
          </p>
          {runners.loading ? (
            <LoadingSkeleton rows={1} className="mt-3" />
          ) : (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-control border border-line">
              {firewallRules.map((rule) => (
                <li
                  key={`${rule.hostname}:${rule.ports.join(",")}`}
                  className="grid gap-1 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <code className="text-xs text-ink">{rule.hostname}</code>
                  <span className="font-mono text-[11px] text-subtle">
                    outbound TCP {rule.ports.join(", ")}
                    {rule.proxy ? ` · proxy ${rule.proxy}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!runners.loading && persistedFirewallRules.length === 0 ? (
            <p className="mt-2 text-xs text-subtle">
              Pairing default shown. The runner&apos;s persisted profile
              replaces it after first check-in.
            </p>
          ) : null}
        </div>
      </Panel>

      {/* Runners */}
      <Panel>
        <PanelHeader
          title={`Registered runners (${(runners.data ?? []).length})`}
        />
        {runners.loading ? (
          <LoadingSkeleton rows={3} />
        ) : runners.error ? (
          <ErrorState message={runners.error} onRetry={runners.refetch} />
        ) : (runners.data ?? []).length === 0 ? (
          <div className="p-4">
            <NotConfigured
              title="No runners registered"
              message="Pair a runner above, then run the install command on an in-network host."
            />
          </div>
        ) : (
          <ul>
            {(runners.data ?? []).map((runner) => (
              <RunnerRow
                key={runner.runnerId}
                runner={runner}
                onChanged={runners.refetch}
              />
            ))}
          </ul>
        )}
      </Panel>

      {/* Transport decisions */}
      <Panel>
        <PanelHeader title="Transport decisions" />
        {transport.loading ? (
          <LoadingSkeleton rows={2} />
        ) : transport.error ? (
          <ErrorState message={transport.error} onRetry={transport.refetch} />
        ) : (transport.data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-subtle">
            No transport decisions recorded. Runners default to outbound HTTPS;
            reverse SSH is not part of the default design.
          </p>
        ) : (
          <ul>
            {(transport.data ?? []).map((decision, i) => (
              <li
                key={`${decision.channel}-${i}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="font-mono text-[12px] text-ink">
                  {decision.channel}
                </span>
                <StateBadge tone={transportTone(decision.status)} dot={false}>
                  {decision.status}
                </StateBadge>
                <span className="text-[12px] text-muted">
                  {decision.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function RunnerRow({
  runner,
  onChanged
}: {
  runner: RunnerRecord;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"kill" | "revoke" | null>(null);
  const [confirm, setConfirm] = useState<"kill" | "revoke" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activatingKill = !runner.killSwitchActive;

  async function toggleKill() {
    setBusy("kill");
    setError(null);
    try {
      await api.setRunnerKillSwitch(runner.runnerId, {
        active: !runner.killSwitchActive,
        reason: runner.killSwitchActive ? null : "Manual kill switch"
      });
      setConfirm(null);
      setNotice(
        activatingKill
          ? "Kill switch engaged — the runner is stopped."
          : "Kill switch released."
      );
      onChanged();
    } catch (e) {
      setError(errMessage(e, "Couldn't update the kill switch. Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    setBusy("revoke");
    setError(null);
    try {
      await api.revokeRunner(runner.runnerId);
      setConfirm(null);
      setNotice("Runner revoked. Its credentials are no longer valid.");
      onChanged();
    } catch (e) {
      setError(errMessage(e, "Couldn't revoke the runner. Try again."));
    } finally {
      setBusy(null);
    }
  }

  function openConfirm(action: "kill" | "revoke") {
    setError(null);
    setNotice(null);
    setConfirm(action);
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
          <span className="text-[13px] text-ink">{runner.name}</span>
        </button>
        <span className="font-mono text-[11px] text-subtle">
          {runner.hostname} · {runner.os}/{runner.arch}
        </span>
        <StateBadge tone={RUNNER_TONE[runner.status] ?? "neutral"} dot={false}>
          {runner.status}
        </StateBadge>
        <span className="font-mono text-[11px] text-subtle">
          {runner.transportMode} · seen {relTime(runner.lastSeenAt)}
        </span>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            onClick={() => openConfirm("kill")}
            disabled={busy !== null || !!runner.revokedAt}
            className={cn(
              buttonClassName({ size: "sm", variant: "secondary" }),
              runner.killSwitchActive ? "text-fixed" : "text-missed"
            )}
          >
            {busy === "kill"
              ? "…"
              : runner.killSwitchActive
                ? "Release"
                : "Kill switch"}
          </button>
          {!runner.revokedAt ? (
            <button
              type="button"
              onClick={() => openConfirm("revoke")}
              disabled={busy !== null}
              className={cn(
                buttonClassName({ size: "sm", variant: "secondary" }),
                "text-missed"
              )}
            >
              Revoke
            </button>
          ) : null}
        </div>
      </div>
      {/* Action feedback — rendered next to the controls so a failure is never silent. */}
      {error && confirm === null ? (
        <div className="px-4 pb-3">
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}
      {notice ? (
        <div className="px-4 pb-3">
          <InlineError
            message={notice}
            tone="success"
            onDismiss={() => setNotice(null)}
          />
        </div>
      ) : null}
      {open ? <RunnerDetail runner={runner} /> : null}

      <ConfirmDialog
        open={confirm === "kill"}
        title={activatingKill ? "Engage kill switch?" : "Release kill switch?"}
        description={
          activatingKill
            ? `This immediately stops "${runner.name}" from running any tasks until the kill switch is released.`
            : `This lets "${runner.name}" resume running signed, scope-enforced tasks.`
        }
        confirmLabel={activatingKill ? "Engage kill switch" : "Release"}
        destructive={activatingKill}
        busy={busy === "kill"}
        error={confirm === "kill" ? error : null}
        onConfirm={toggleKill}
        onCancel={() => {
          setConfirm(null);
          setError(null);
        }}
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        title="Revoke this runner?"
        description={`Revoking "${runner.name}" permanently invalidates its credentials. This cannot be undone — you'll have to pair and reinstall a new runner.`}
        confirmLabel="Revoke runner"
        destructive
        confirmPhrase={runner.name}
        busy={busy === "revoke"}
        error={confirm === "revoke" ? error : null}
        onConfirm={revoke}
        onCancel={() => {
          setConfirm(null);
          setError(null);
        }}
      />
    </li>
  );
}

function errMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function RunnerDetail({ runner }: { runner: RunnerRecord }) {
  const tasks = useApiResource(
    () => api.listRunnerTasks(runner.runnerId),
    [runner.runnerId]
  );

  return (
    <div className="border-t border-line bg-surface/40 px-4 py-3 pl-10">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-subtle">
        <span>deploy: {runner.deploymentMode}</span>
        <span>
          egress: HTTPS {runner.networkProfile.outboundHttpsPorts.join("/")}
        </span>
        <span>FQDN: {runner.networkProfile.gatewayHostnames.join(", ")}</span>
        {runner.certificateSha256 ? (
          <span>cert: {runner.certificateSha256.slice(0, 12)}…</span>
        ) : null}
        {runner.certificateExpiresAt ? (
          <span>cert expires {relTime(runner.certificateExpiresAt)}</span>
        ) : null}
        {runner.killSwitchActive && runner.killSwitchReason ? (
          <span className="text-missed">kill: {runner.killSwitchReason}</span>
        ) : null}
      </div>
      <p className="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
        Signed task timeline
      </p>
      {tasks.loading ? (
        <LoadingSkeleton rows={2} className="p-0" />
      ) : tasks.error ? (
        <ErrorState message={tasks.error} onRetry={tasks.refetch} />
      ) : (tasks.data ?? []).length === 0 ? (
        <p className="text-[12px] text-subtle">
          No tasks dispatched to this runner yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {(tasks.data ?? []).slice(0, 12).map((task) => (
            <li
              key={task.taskId}
              className="flex flex-wrap items-center gap-2 text-[12px]"
            >
              <StateBadge
                tone={TASK_TONE[task.status] ?? "neutral"}
                dot={false}
              >
                {task.status}
              </StateBadge>
              <span className="font-mono text-subtle">{task.moduleId}</span>
              <span className="font-mono text-[10px] text-subtle">
                scope·{task.scopeId.slice(0, 8)}
              </span>
              {task.redactedEvidenceIds.length ? (
                <span className="font-mono text-[10px] text-brand">
                  {task.redactedEvidenceIds.length} evidence
                </span>
              ) : null}
              {task.errorSummary ? (
                <span className="text-missed">{task.errorSummary}</span>
              ) : null}
              <span className="ml-auto font-mono text-[10px] text-subtle">
                {relTime(task.completedAt ?? task.issuedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
