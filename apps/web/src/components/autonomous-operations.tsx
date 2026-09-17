"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  NotConfigured,
  Panel,
  PanelHeader,
  buttonClassName,
  type StateTone
} from "../ui";

/** Active work item for the ops list (P07-14: not a second radar). */
interface ActiveWorkItem {
  id: string;
  label: string;
  kind: "model" | "mission" | "engagement";
  tone: StateTone;
  active: boolean;
}

const SESSION_TONE: Record<string, StateTone> = {
  Active: "validated",
  Created: "approval",
  Paused: "inconclusive",
  Blocked: "missed",
  Terminated: "inconclusive",
  Expired: "inconclusive",
  Archived: "neutral"
};
const MISSION_TONE: Record<string, StateTone> = {
  Running: "validated",
  Queued: "approval",
  RequiresApproval: "approval",
  Draft: "inconclusive",
  Completed: "fixed",
  Failed: "missed",
  DeniedByPolicy: "missed",
  Cancelled: "neutral"
};
const ENGAGEMENT_TONE: Record<string, StateTone> = {
  Completed: "fixed",
  Planned: "approval",
  Denied: "missed",
  Empty: "inconclusive"
};

const LIVE_SESSION_STATES = new Set(["Active", "Created", "Paused"]);
const LIVE_MISSION_STATES = new Set(["Running", "Queued", "RequiresApproval"]);

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function AutonomousOperations() {
  const sessions = useApiResource(() => api.listModelSessions(), []);
  const missions = useApiResource(() => api.listMissions(), []);
  const engagements = useApiResource(() => api.listEngagements(), []);
  const activity = useApiResource(() => api.listSignalTriggerActivity(), []);

  // Silent auto-refresh — the "always sweeping" pulse of the product.
  useEffect(() => {
    const id = setInterval(() => {
      void sessions.refetch();
      void missions.refetch();
      void engagements.refetch();
      void activity.refetch();
    }, 6000);
    return () => clearInterval(id);
  }, [sessions.refetch, missions.refetch, engagements.refetch, activity.refetch]);

  const agents = useMemo<ActiveWorkItem[]>(() => {
    const out: ActiveWorkItem[] = [];
    for (const s of (sessions.data ?? []).filter((s) =>
      LIVE_SESSION_STATES.has(s.status)
    )) {
      out.push({
        id: s.modelSessionId,
        label: s.purpose || "Model session",
        kind: "model",
        tone: SESSION_TONE[s.status] ?? "neutral",
        active: s.status === "Active"
      });
    }
    for (const m of (missions.data ?? []).filter((m) =>
      LIVE_MISSION_STATES.has(m.status)
    )) {
      out.push({
        id: m.missionId,
        label: m.missionType,
        kind: "mission",
        tone: MISSION_TONE[m.status] ?? "neutral",
        active: m.status === "Running"
      });
    }
    for (const e of (engagements.data ?? []).slice(0, 8)) {
      out.push({
        id: e.engagementId,
        label: `${e.mode} engagement`,
        kind: "engagement",
        tone: ENGAGEMENT_TONE[e.status] ?? "neutral",
        active: false
      });
    }
    return out.slice(0, 40);
  }, [sessions.data, missions.data, engagements.data]);

  const metrics = useMemo(() => {
    const activeSessions = (sessions.data ?? []).filter(
      (s) => s.status === "Active"
    ).length;
    const runningMissions = (missions.data ?? []).filter(
      (m) => m.status === "Running"
    ).length;
    const awaiting = (missions.data ?? []).filter(
      (m) => m.status === "RequiresApproval"
    ).length;
    return {
      active: activeSessions + runningMissions,
      sessions: (sessions.data ?? []).length,
      runs: (engagements.data ?? []).length,
      awaiting,
      triggers: (activity.data ?? []).length
    };
  }, [sessions.data, missions.data, engagements.data, activity.data]);

  const feed = useMemo(
    () =>
      [...(activity.data ?? [])]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 10),
    [activity.data]
  );

  const anyError =
    sessions.error || missions.error || engagements.error || activity.error;
  const allLoading =
    sessions.loading && missions.loading && engagements.loading && activity.loading;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Autonomous operations
          <span className="inline-flex items-center gap-1.5 text-fixed">
            <span className="size-1.5 rounded-full bg-fixed motion-safe:animate-pulse" />
            <span className="font-mono text-[10px] normal-case tracking-normal text-subtle">
              live · refreshes every 6s
            </span>
          </span>
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Live validation ops
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Live model sessions, validation missions, and engagements on verified
          scope — status list only (not multi-agent swarm membership). The
          decorative proof-loop radar is reserved for first-run onboarding.
        </p>
        <div
          className="mt-3 max-w-2xl rounded-control border border-line bg-surface-2 px-3 py-2 text-xs text-muted"
          data-testid="multi-agent-honesty-panel"
        >
          <p className="font-semibold text-ink">
            Multi-agent honesty (matrix #29)
          </p>
          <p className="mt-1">
            Offensive multi-agent BAS swarm orchestration is{" "}
            <strong className="text-ink">not</strong> productized. Real path:
            passive role-tagged multi-step assembly creates{" "}
            <strong className="text-ink">Draft missions only</strong> (no
            auto-start), then Hybrid Execution Compiler → signed allowlisted
            runner tasks for passive modules. No live APT/Atomic.
          </p>
          <p className="mt-1">
            API:{" "}
            <code className="font-mono text-[11px] text-ink">
              POST /api/v1/hybrid-compiler/assemble-passive-multi-agent
            </code>{" "}
            (Draft mission) ·{" "}
            <code className="font-mono text-[11px] text-ink">
              POST /api/v1/hybrid-compiler/compile
            </code>{" "}
            (optional queueTasks) · conversational draft convert stays{" "}
            <code className="font-mono text-[11px] text-ink">
              executable:false
            </code>
            .
          </p>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Active now" value={metrics.active} tone="validated" />
        <MetricTile label="Awaiting approval" value={metrics.awaiting} tone="approval" />
        <MetricTile label="Autonomous runs" value={metrics.runs} tone="brand" />
        <MetricTile label="Signals triggered" value={metrics.triggers} tone="blocked" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* P07-14: list + status only — first-run ProofLoopRadar is the only radar metaphor */}
        <Panel>
          <PanelHeader
            title="Active work"
            actions={
              <div className="flex items-center gap-3 text-[11px] text-subtle">
                <Legend tone="validated" label="active" />
                <Legend tone="approval" label="pending" />
                <Legend tone="fixed" label="done" />
              </div>
            }
          />
          <div className="relative min-h-[12rem]">
            {anyError && !sessions.data && !missions.data ? (
              <ErrorState
                message="Autonomous activity is unavailable right now."
                onRetry={() => {
                  void sessions.refetch();
                  void missions.refetch();
                }}
              />
            ) : agents.length > 0 ? (
              <div className="px-3 py-2.5">
                <p className="mb-2 font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  Live sessions, missions, and engagements
                </p>
                <ul
                  className="flex flex-col gap-1.5"
                  aria-label="Active sessions and missions on verified scope"
                >
                  {agents.map((agent) => (
                    <li key={agent.id}>
                      <Link
                        href={
                          agent.kind === "mission"
                            ? `/missions/${agent.id}`
                            : agent.kind === "engagement"
                              ? `/engagements?engagementId=${encodeURIComponent(agent.id)}`
                              : "/model-gateway"
                        }
                        className="flex items-center gap-2 rounded-control border border-line bg-elevated px-2.5 py-1.5 text-xs text-muted hover:border-line-strong hover:text-brand"
                      >
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: `var(--color-${agent.tone})` }}
                        />
                        <span className="truncate font-medium text-ink">
                          {agent.label}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-subtle">
                          {agent.kind}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : !allLoading ? (
              <div className="flex items-center justify-center p-6">
                <div className="max-w-xs rounded-card border border-line bg-elevated/90 p-4 text-center">
                  <p className="font-display text-sm font-semibold text-ink">
                    No live sessions or missions
                  </p>
                  <p className="mt-1 text-[12.5px] text-muted">
                    This list stays empty until a model session, validation
                    mission, or engagement is running on verified scope.
                  </p>
                  <Link
                    href="/missions"
                    className={
                      buttonClassName({ size: "sm", variant: "primary" }) +
                      " mt-3 inline-block"
                    }
                  >
                    Open missions
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm text-subtle">Loading active work…</div>
            )}
          </div>
        </Panel>

        {/* Live feed */}
        <Panel>
          <PanelHeader
            title="Live activity"
            link={{ href: "/signal-activity", label: "Full stream" }}
          />
          {activity.loading && !activity.data ? (
            <div className="p-4 text-sm text-subtle">Listening…</div>
          ) : activity.error ? (
            <ErrorState message={activity.error} onRetry={activity.refetch} />
          ) : feed.length === 0 ? (
            <div className="p-4">
              <NotConfigured
                title="Quiet on the wire"
                message="Autonomous triggers — CVE, asset-change, missed-detection — stream here as they fire."
              />
            </div>
          ) : (
            <ul>
              {feed.map((event) => (
                <li
                  key={event.activityId}
                  className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-ink">{event.title}</p>
                    <p className="truncate text-[12px] text-muted">
                      {event.summary}
                    </p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-subtle">
                      {event.triggerType} · {relTime(event.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="text-center text-[11px] text-subtle">
        Build and govern the agents behind these blips in{" "}
        <Link href="/workflows" className="text-brand hover:text-brand-2">
          Agent Workflows
        </Link>
        .
      </p>
    </div>
  );
}

function MetricTile({
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

function Legend({ tone, label }: { tone: StateTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ background: `var(--color-${tone})` }}
      />
      {label}
    </span>
  );
}
