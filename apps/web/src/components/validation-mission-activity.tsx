"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  communityValidationSuiteEntry,
  type AuditEvent,
  type ValidationMission,
  type ValidationRun
} from "@periscan/shared";

import {
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  validationStateTone,
  type StateTone
} from "../ui";
import {
  OrchestrationFlowMap,
  type OrchestrationLink,
  type OrchestrationNode
} from "./orchestration-flow-map";

const ACTIVE_MISSION_STATUSES = new Set([
  "Draft",
  "Queued",
  "Running",
  "RequiresApproval"
]);
const ACTIVE_RUN_STATUSES = new Set(["Queued", "Running"]);

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  state: string;
  tone: StateTone;
  occurredAt: string;
}

function runTone(run: ValidationRun): StateTone {
  if (run.status === "Failed") return "missed";
  if (run.status === "Completed") {
    return run.validationState
      ? validationStateTone(run.validationState)
      : "fixed";
  }
  if (run.status === "Running") return "validated";
  if (run.status === "Queued") return "brand";
  return "neutral";
}

function missionTone(status: string): StateTone {
  if (status === "Completed") return "fixed";
  if (status === "Failed" || status === "DeniedByPolicy") return "missed";
  if (status === "RequiresApproval") return "approval";
  if (status === "Running") return "validated";
  if (status === "Queued") return "brand";
  return "neutral";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function readableModule(value: string) {
  return (
    communityValidationSuiteEntry(value)?.title ??
    value
      .replace(/^periscan\./, "")
      .replace(/^runner\./, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function buildMissionFlow(
  mission: ValidationMission,
  runs: ValidationRun[]
): { links: OrchestrationLink[]; nodes: OrchestrationNode[] } {
  const visibleRuns = [...runs]
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    )
    .slice(-5);
  const evidenceIds = new Set([
    ...mission.evidenceIds,
    ...runs.flatMap((run) => run.evidenceIds)
  ]);
  const runPositions = [
    { column: 1, row: 3 },
    { column: 2, row: 4 },
    { column: 3, row: 3 },
    { column: 4, row: 4 },
    { column: 5, row: 3 }
  ];
  const policyNodeId =
    mission.policyDecisionId ?? `${mission.missionId}:policy-unlinked`;
  const evidenceNodeId = `${mission.missionId}:evidence`;
  const outcomeNodeId = `${mission.missionId}:outcome`;
  const nodes: OrchestrationNode[] = [
    {
      id: policyNodeId,
      code: "POL",
      label: "Policy gate",
      detail: mission.policyProfile ?? "No profile recorded",
      state: mission.policyDecisionId ? "Linked" : "Unlinked",
      tone: mission.policyDecisionId ? "validated" : "inconclusive",
      column: 1,
      row: 1,
      active: mission.status === "RequiresApproval"
    },
    {
      id: mission.missionId,
      code: "MSN",
      label: readableModule(mission.missionType),
      detail: `${mission.scopeIds.length} authorized scope${mission.scopeIds.length === 1 ? "" : "s"}`,
      state: mission.status,
      tone: missionTone(mission.status),
      column: 3,
      row: 1,
      active: mission.status === "Running"
    },
    {
      id: outcomeNodeId,
      code: "OUT",
      label: "Mission outcome",
      detail:
        visibleRuns
          .map((run) => run.validationState)
          .filter(Boolean)
          .join(" · ") || "No validation state recorded",
      state: mission.status,
      tone: missionTone(mission.status),
      column: 5,
      row: 1,
      active: false
    }
  ];

  if (visibleRuns.length === 0) {
    nodes.push({
      id: `${mission.missionId}:run-pending`,
      code: "RUN",
      label: "Module execution",
      detail: "No run recorded",
      state: ACTIVE_MISSION_STATUSES.has(mission.status) ? "Waiting" : "None",
      tone: "inconclusive",
      column: 3,
      row: 3,
      active: ACTIVE_MISSION_STATUSES.has(mission.status)
    });
  } else {
    visibleRuns.forEach((run, index) => {
      const position = runPositions[index] ?? { column: 3, row: 4 };
      nodes.push({
        id: run.runId,
        code: run.runnerId ? "RNR" : `R${index + 1}`,
        label: readableModule(run.moduleId),
        detail: run.runnerId
          ? `runner ${run.runnerId.slice(0, 8)}`
          : "control plane",
        state: run.validationState ?? run.status,
        tone: runTone(run),
        column: position.column,
        row: position.row,
        active: ACTIVE_RUN_STATUSES.has(run.status)
      });
    });
  }

  nodes.push({
    id: evidenceNodeId,
    code: "EV",
    label: "Evidence receipts",
    detail: `${evidenceIds.size} linked receipt${evidenceIds.size === 1 ? "" : "s"}`,
    state: evidenceIds.size > 0 ? "Retained" : "Waiting",
    tone: evidenceIds.size > 0 ? "fixed" : "inconclusive",
    column: 3,
    row: 5,
    active: false
  });

  const links: OrchestrationLink[] = [
    {
      from: policyNodeId,
      to: mission.missionId,
      tone: mission.policyDecisionId ? "validated" : "inconclusive",
      active: mission.status === "RequiresApproval"
    }
  ];
  if (visibleRuns.length === 0) {
    links.push({
      from: mission.missionId,
      to: `${mission.missionId}:run-pending`,
      tone: "inconclusive",
      active: ACTIVE_MISSION_STATUSES.has(mission.status)
    });
  } else {
    for (const run of visibleRuns) {
      links.push({
        from: mission.missionId,
        to: run.runId,
        tone: runTone(run),
        active: ACTIVE_RUN_STATUSES.has(run.status)
      });
      if (run.evidenceIds.length > 0) {
        links.push({
          from: run.runId,
          to: evidenceNodeId,
          tone: "fixed",
          active: false
        });
      }
    }
  }
  links.push({
    from: evidenceNodeId,
    to: outcomeNodeId,
    tone: missionTone(mission.status),
    active: mission.status === "Running" && evidenceIds.size > 0
  });
  return { links, nodes };
}

function buildActivity(
  mission: ValidationMission,
  runs: ValidationRun[],
  auditEvents: AuditEvent[]
): ActivityItem[] {
  const items: ActivityItem[] = [
    {
      id: `${mission.missionId}:created`,
      title: "Mission created",
      detail: `${mission.missionType} · ${mission.scopeIds.length} authorized scope${mission.scopeIds.length === 1 ? "" : "s"}`,
      state: "Created",
      tone: "brand",
      occurredAt: mission.createdAt
    }
  ];
  if (mission.policyDecisionId) {
    items.push({
      id: `${mission.missionId}:policy`,
      title: "Policy decision linked",
      detail: `${mission.policyProfile ?? "policy profile"} · ${mission.policyDecisionId}`,
      state: "Authorized",
      tone: "validated",
      occurredAt: mission.startedAt ?? mission.updatedAt
    });
  }
  for (const run of runs) {
    if (run.startedAt) {
      items.push({
        id: `${run.runId}:started`,
        title: `${readableModule(run.moduleId)} started`,
        detail: run.runnerId
          ? `Dispatched to runner ${run.runnerId}`
          : "Executed in the Periscan control plane",
        state: "Running",
        tone: "validated",
        occurredAt: run.startedAt
      });
    }
    if (run.completedAt) {
      items.push({
        id: `${run.runId}:completed`,
        title: `${readableModule(run.moduleId)} completed`,
        detail:
          run.outcome ?? run.errorSummary ?? "No outcome summary recorded",
        state: run.validationState ?? run.status,
        tone: runTone(run),
        occurredAt: run.completedAt
      });
    }
    if (run.evidenceIds.length > 0) {
      items.push({
        id: `${run.runId}:evidence`,
        title: "Evidence receipts retained",
        detail: `${run.evidenceIds.length} receipt${run.evidenceIds.length === 1 ? "" : "s"} linked to ${run.moduleId}`,
        state: "Retained",
        tone: "fixed",
        occurredAt: run.completedAt ?? run.updatedAt
      });
    }
  }
  for (const event of auditEvents) {
    items.push({
      id: event.auditEventId,
      title: event.action.replaceAll(".", " "),
      detail: `${event.actorType} · ${event.entityType}${event.entityId ? ` · ${event.entityId}` : ""}`,
      state: "Audited",
      tone: event.action.includes("rejected") ? "missed" : "brand",
      occurredAt: event.createdAt
    });
  }
  if (mission.completedAt) {
    items.push({
      id: `${mission.missionId}:completed`,
      title: "Mission reached a terminal state",
      detail: `${runs.length} run${runs.length === 1 ? "" : "s"} · ${new Set(runs.flatMap((run) => run.evidenceIds)).size} evidence receipt${new Set(runs.flatMap((run) => run.evidenceIds)).size === 1 ? "" : "s"}`,
      state: mission.status,
      tone: missionTone(mission.status),
      occurredAt: mission.completedAt
    });
  }
  return items.sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  );
}

export function ValidationMissionActivity({
  auditEvents,
  mission,
  runs,
  refreshing
}: {
  auditEvents: AuditEvent[];
  mission: ValidationMission;
  runs: ValidationRun[];
  refreshing?: boolean;
}) {
  const live =
    ACTIVE_MISSION_STATUSES.has(mission.status) ||
    runs.some((run) => ACTIVE_RUN_STATUSES.has(run.status));
  const flow = useMemo(() => buildMissionFlow(mission, runs), [mission, runs]);
  const activity = useMemo(
    () => buildActivity(mission, runs, auditEvents),
    [auditEvents, mission, runs]
  );
  const evidenceIds = new Set([
    ...mission.evidenceIds,
    ...runs.flatMap((run) => run.evidenceIds)
  ]);
  const metrics = [
    {
      label: "Modules active",
      value: runs.filter((run) => ACTIVE_RUN_STATUSES.has(run.status)).length,
      tone: "brand" as StateTone
    },
    {
      label: "Runs completed",
      value: runs.filter((run) => run.status === "Completed").length,
      tone: "fixed" as StateTone
    },
    {
      label: "Evidence receipts",
      value: evidenceIds.size,
      tone: "validated" as StateTone
    },
    {
      label: "Policy gate",
      value: mission.policyDecisionId ? "linked" : "unlinked",
      tone: mission.policyDecisionId
        ? ("validated" as StateTone)
        : ("inconclusive" as StateTone)
    }
  ];

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="mission-live-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand">
            Evidence-backed orchestration
          </p>
          <h2
            id="mission-live-title"
            className="mt-1 font-display text-xl font-semibold text-ink"
          >
            Live validation execution
          </h2>
          <p className="mt-1 text-sm text-muted">
            Policy, mission, module, runner, evidence, and outcome records shown
            from this mission&apos;s persisted lifecycle.
          </p>
        </div>
        <StateBadge tone={live ? "validated" : missionTone(mission.status)}>
          {refreshing ? "Refreshing" : live ? "Live" : mission.status}
        </StateBadge>
      </div>

      <dl className="grid grid-cols-2 border-y border-line md:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="border-b border-line px-4 py-3 odd:border-r md:border-b-0 md:border-r md:last:border-r-0"
          >
            <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
              {metric.label}
            </dt>
            <dd
              className="mt-1 font-display text-2xl font-semibold"
              style={{ color: `var(--color-${metric.tone})` }}
            >
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Panel>
          <PanelHeader
            title="Validation handoffs"
            actions={
              <span className="font-mono text-[11px] text-fixed">
                {runs.length} run{runs.length === 1 ? "" : "s"} ·{" "}
                {evidenceIds.size} receipts
              </span>
            }
          />
          <OrchestrationFlowMap
            ariaLabel="Validation mission lifecycle records"
            links={flow.links}
            nodes={flow.nodes}
          />
        </Panel>

        <Panel>
          <PanelHeader
            title="Execution ledger"
            actions={
              <span className="inline-flex items-center gap-2 font-mono text-[10px] text-[#cfe0ff]">
                <span
                  aria-hidden="true"
                  className={
                    live
                      ? "size-1.5 animate-pulse rounded-full bg-fixed"
                      : "size-1.5 rounded-full bg-subtle"
                  }
                />
                {live ? "listening" : "recorded"}
              </span>
            }
          />
          <ol
            className="max-h-[454px] overflow-y-auto"
            aria-label="Validation execution activity"
          >
            {activity.map((item) => (
              <li
                key={item.id}
                className="flex gap-3 border-b border-[#101f3d] px-4 py-3 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2 shrink-0 rounded-sm bg-current"
                  style={{ color: `var(--color-${item.tone})` }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-semibold capitalize text-ink">
                      {item.title}
                    </p>
                    <time className="shrink-0 font-mono text-[10px] text-subtle">
                      {formatTime(item.occurredAt)}
                    </time>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">
                    {item.detail}
                  </p>
                  <StateBadge tone={item.tone} className="mt-1" dot={false}>
                    {item.state}
                  </StateBadge>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
            <Link
              href={`/evidence?missionId=${encodeURIComponent(mission.missionId)}`}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Review evidence
            </Link>
            <Link
              href={`/audit?search=${encodeURIComponent(mission.missionId)}`}
              className={buttonClassName({ size: "sm", variant: "ghost" })}
            >
              Open audit trail
            </Link>
          </div>
        </Panel>
      </div>
    </section>
  );
}
