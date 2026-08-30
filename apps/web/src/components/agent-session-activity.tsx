"use client";

import Link from "next/link";
import { useMemo } from "react";

import type {
  ModelGatewayAuditEvent,
  ModelSession,
  ModelToolRequest
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  Button,
  ErrorState,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  type StateTone
} from "../ui";
import {
  OrchestrationFlowMap,
  type OrchestrationLink,
  type OrchestrationNode
} from "./orchestration-flow-map";

const ACTIVE_SESSION_STATUSES = new Set(["Created", "Active", "Paused"]);
const ACTIVE_REQUEST_STATUSES = new Set([
  "Requested",
  "Allowed",
  "Approved",
  "Running"
]);
const APPROVAL_REQUEST_STATUSES = new Set(["RequiresApproval"]);

const EVENT_LABEL: Record<string, string> = {
  ApprovalRequested: "Approval requested",
  ContextBundleCreated: "Redacted context assembled",
  KillSwitchActivated: "Kill switch activated",
  RedactionApplied: "Evidence redaction applied",
  SensitiveDataBlocked: "Sensitive data blocked",
  SessionCreated: "Session created",
  SessionPaused: "Session paused",
  SessionStarted: "Session started",
  SessionTerminated: "Session terminated",
  ToolAllowed: "Tool request allowed",
  ToolDenied: "Tool request denied",
  ToolExecuted: "Governed tool executed",
  ToolFailed: "Governed tool failed",
  ToolRequested: "Governed tool requested",
  ToolResultReturned: "Redacted result returned"
};

function requestTone(status: string): StateTone {
  if (status === "Completed") return "fixed";
  if (status === "Denied" || status === "Failed") return "missed";
  if (status === "RequiresApproval") return "approval";
  if (ACTIVE_REQUEST_STATUSES.has(status)) return "brand";
  return "neutral";
}

function eventTone(eventType: string): StateTone {
  if (eventType.includes("Denied") || eventType.includes("Failed")) return "missed";
  if (eventType.includes("Approval")) return "approval";
  if (eventType === "ToolResultReturned") return "fixed";
  if (eventType === "ToolExecuted" || eventType === "SessionStarted") {
    return "validated";
  }
  return "brand";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function shortToolName(value: string) {
  return value
    .replace(/^request_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function eventRate(events: ModelGatewayAuditEvent[]) {
  const now = Date.now();
  return events.filter((event) => now - new Date(event.createdAt).getTime() < 60_000)
    .length;
}

function buildFlow(
  session: ModelSession,
  requests: ModelToolRequest[],
  events: ModelGatewayAuditEvent[]
): { links: OrchestrationLink[]; nodes: OrchestrationNode[] } {
  const contextEvent = events.find(
    (event) => event.eventType === "ContextBundleCreated"
  );
  const approvalRequests = requests.filter((request) =>
    APPROVAL_REQUEST_STATUSES.has(request.status)
  );
  const evidenceIds = new Set([
    ...events.flatMap((event) => event.evidenceIds),
    ...requests.flatMap((request) => request.result?.evidenceIds ?? [])
  ]);
  const visibleRequests = [...requests]
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )
    .slice(0, 5);
  const requestPositions = [
    { column: 1, row: 3 },
    { column: 2, row: 4 },
    { column: 3, row: 3 },
    { column: 4, row: 4 },
    { column: 5, row: 3 }
  ];
  const sessionActive = session.status === "Active";
  const nodes: OrchestrationNode[] = [
    {
      id: session.modelSessionId,
      code: "AI",
      label: "Model session",
      detail: session.mode,
      state: session.status,
      tone: sessionActive ? "validated" : "neutral",
      column: 3,
      row: 1,
      active: sessionActive
    },
    {
      id: contextEvent?.eventId ?? `${session.modelSessionId}:context`,
      code: "CTX",
      label: "Redacted context",
      detail: `${session.scopeIds.length} authorized scope${session.scopeIds.length === 1 ? "" : "s"}`,
      state: contextEvent ? "Built" : "Waiting",
      tone: contextEvent ? "fixed" : "inconclusive",
      column: 1,
      row: 2,
      active: false
    }
  ];

  if (approvalRequests.length > 0) {
    nodes.push({
      id: `${session.modelSessionId}:approval`,
      code: "HITL",
      label: "Human approval",
      detail: `${approvalRequests.length} request${approvalRequests.length === 1 ? "" : "s"} waiting`,
      state: "Required",
      tone: "approval",
      column: 5,
      row: 2,
      active: true
    });
  }

  visibleRequests.forEach((request, index) => {
    const position = requestPositions[index] ?? { column: 3, row: 4 };
    nodes.push({
      id: request.toolRequestId,
      code: `T${index + 1}`,
      label: shortToolName(request.toolName),
      detail: request.toolName,
      state: request.status,
      tone: requestTone(request.status),
      column: position.column,
      row: position.row,
      active: ACTIVE_REQUEST_STATUSES.has(request.status)
    });
  });

  nodes.push({
    id: `${session.modelSessionId}:evidence`,
    code: "EV",
    label: "Evidence receipts",
    detail: `${evidenceIds.size} linked receipt${evidenceIds.size === 1 ? "" : "s"}`,
    state: evidenceIds.size > 0 ? "Returned" : "Waiting",
    tone: evidenceIds.size > 0 ? "fixed" : "inconclusive",
    column: 3,
    row: 5,
    active: false
  });

  const links: OrchestrationLink[] = [
    {
      from: session.modelSessionId,
      to: contextEvent?.eventId ?? `${session.modelSessionId}:context`,
      tone: contextEvent ? "fixed" : "inconclusive",
      active: sessionActive && !contextEvent
    }
  ];
  if (approvalRequests.length > 0) {
    links.push({
      from: session.modelSessionId,
      to: `${session.modelSessionId}:approval`,
      tone: "approval",
      active: true
    });
  }
  for (const request of visibleRequests) {
    links.push({
      from: contextEvent?.eventId ?? session.modelSessionId,
      to: request.toolRequestId,
      tone: requestTone(request.status),
      active: ACTIVE_REQUEST_STATUSES.has(request.status)
    });
    if ((request.result?.evidenceIds.length ?? 0) > 0) {
      links.push({
        from: request.toolRequestId,
        to: `${session.modelSessionId}:evidence`,
        tone: "fixed",
        active: false
      });
    }
  }
  return { links, nodes };
}

export function AgentSessionActivity({ session }: { session: ModelSession }) {
  const live = ACTIVE_SESSION_STATUSES.has(session.status);
  const detail = useApiResource(
    async () => {
      const [requests, events] = await Promise.all([
        api.listModelToolRequests(session.modelSessionId),
        api.listModelGatewayAuditEvents(session.modelSessionId)
      ]);
      return { events, requests };
    },
    [session.modelSessionId],
    { refetchIntervalMs: live ? 4_000 : undefined }
  );

  const requests = detail.data?.requests ?? [];
  const events = useMemo(
    () =>
      [...(detail.data?.events ?? [])].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      ),
    [detail.data?.events]
  );
  const flow = useMemo(
    () => buildFlow(session, requests, events),
    [events, requests, session]
  );
  const evidenceCount = new Set([
    ...events.flatMap((event) => event.evidenceIds),
    ...requests.flatMap((request) => request.result?.evidenceIds ?? [])
  ]).size;
  const metrics = [
    {
      label: "Tool requests active",
      value: requests.filter((request) => ACTIVE_REQUEST_STATUSES.has(request.status))
        .length,
      tone: "brand" as StateTone
    },
    {
      label: "Awaiting approval",
      value: requests.filter((request) => request.status === "RequiresApproval")
        .length,
      tone: "approval" as StateTone
    },
    {
      label: "Tools completed",
      value: requests.filter((request) => request.status === "Completed").length,
      tone: "fixed" as StateTone
    },
    {
      label: "Evidence receipts",
      value: evidenceCount,
      tone: "validated" as StateTone
    }
  ];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="agent-live-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand">
            Live agent orchestration
          </p>
          <h2
            id="agent-live-title"
            className="mt-1 font-display text-xl font-semibold text-ink"
          >
            {session.purpose}
          </h2>
          <p className="mt-1 font-mono text-[11px] text-subtle">
            {session.modelSessionId} · {session.mode} · {session.status}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StateBadge tone={live ? "validated" : "neutral"}>
            {live ? "Live" : session.status}
          </StateBadge>
          <Button
            variant="secondary"
            size="sm"
            loading={detail.refreshing}
            onClick={() => void detail.refetch()}
          >
            Refresh
          </Button>
        </div>
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

      {detail.error && !detail.data ? (
        <ErrorState message={detail.error} onRetry={detail.refetch} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <Panel>
            <PanelHeader
              title="Governed handoffs"
              actions={
                <span className="font-mono text-[11px] text-fixed">
                  {eventRate(events)} handoffs / min
                </span>
              }
            />
            <OrchestrationFlowMap
              ariaLabel="Agent session workflow records"
              links={flow.links}
              nodes={flow.nodes}
            />
          </Panel>

          <Panel>
            <PanelHeader
              title="Activity ledger"
              actions={
                <span className="inline-flex items-center gap-2 font-mono text-[10px] text-[#cfe0ff]">
                  <span
                    aria-hidden="true"
                    className={live ? "size-1.5 animate-pulse rounded-full bg-fixed" : "size-1.5 rounded-full bg-subtle"}
                  />
                  {live ? "listening" : "recorded"}
                </span>
              }
            />
            {events.length === 0 ? (
              <div className="p-4 text-sm text-muted">
                No session events have been recorded yet. Periscan will show
                context creation, policy decisions, approvals, tool execution,
                redaction, and returned evidence here as they occur.
              </div>
            ) : (
              <ol className="max-h-[454px] overflow-y-auto" aria-label="Agent activity events">
                {events.map((event) => (
                  <li
                    key={event.eventId}
                    className="flex gap-3 border-b border-[#101f3d] px-4 py-3 last:border-b-0"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-2 shrink-0 rounded-sm bg-current"
                      style={{ color: `var(--color-${eventTone(event.eventType)})` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13px] font-semibold text-ink">
                          {EVENT_LABEL[event.eventType] ?? event.eventType}
                        </p>
                        <time className="shrink-0 font-mono text-[10px] text-subtle">
                          {formatTime(event.createdAt)}
                        </time>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted">
                        {event.toolName ?? event.eventId}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-subtle">
                        {event.toolRequestId ? (
                          <span title={event.toolRequestId}>
                            tool {event.toolRequestId.slice(0, 8)}
                          </span>
                        ) : null}
                        {event.policyDecisionId ? (
                          <span>policy {event.policyDecisionId.slice(0, 8)}</span>
                        ) : null}
                        {event.evidenceIds.length > 0 ? (
                          <span>
                            {event.evidenceIds.length} evidence receipt
                            {event.evidenceIds.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                      {event.evidenceIds.length > 0 ? (
                        <ul
                          className="mt-1.5 flex flex-wrap gap-1.5"
                          aria-label="Evidence receipt ids"
                        >
                          {event.evidenceIds.map((evidenceId) => (
                            <li key={evidenceId}>
                              <Link
                                href={`/evidence?evidenceId=${encodeURIComponent(evidenceId)}`}
                                className="font-mono text-[10px] text-brand hover:underline"
                                title={evidenceId}
                              >
                                {evidenceId.slice(0, 8)}…
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
              <Link
                href="/model-gateway"
                className={buttonClassName({ size: "sm", variant: "secondary" })}
              >
                Open full audit
              </Link>
              <Link
                href="/workflows"
                className={buttonClassName({ size: "sm", variant: "secondary" })}
              >
                Flight recorder / checkpoint
              </Link>
              <Link
                href="/audit"
                className={buttonClassName({ size: "sm", variant: "ghost" })}
              >
                Tenant audit log
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Tool + evidence receipts" />
            {requests.length === 0 ? (
              <div className="p-4 text-sm text-muted">
                No governed tool requests yet. When the model invokes tools, each
                request id and any returned evidence ids appear here for audit.
              </div>
            ) : (
              <ul aria-label="Tool request receipts">
                {requests.map((request) => {
                  const evidenceIds = request.result?.evidenceIds ?? [];
                  return (
                    <li
                      key={request.toolRequestId}
                      className="border-b border-line px-4 py-3 last:border-b-0"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <strong className="text-[13px] text-ink">
                          {shortToolName(request.toolName)}
                        </strong>
                        <StateBadge tone={requestTone(request.status)} dot={false}>
                          {request.status}
                        </StateBadge>
                        <span
                          className="ml-auto font-mono text-[10px] text-subtle"
                          title={request.toolRequestId}
                        >
                          tool {request.toolRequestId.slice(0, 8)}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[10.5px] text-muted">
                        {request.toolName}
                        {request.result?.toolResultId
                          ? ` · result ${request.result.toolResultId.slice(0, 8)}`
                          : ""}
                      </p>
                      {evidenceIds.length > 0 ? (
                        <ul
                          className="mt-2 flex flex-wrap gap-1.5"
                          aria-label={`Evidence ids for ${request.toolName}`}
                        >
                          {evidenceIds.map((evidenceId) => (
                            <li key={evidenceId}>
                              <Link
                                href={`/evidence?evidenceId=${encodeURIComponent(evidenceId)}`}
                                className="inline-flex items-center rounded-control border border-line bg-bg px-1.5 py-0.5 font-mono text-[10px] text-brand hover:underline"
                                title={evidenceId}
                              >
                                evidence {evidenceId.slice(0, 8)}…
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : request.status === "Completed" ? (
                        <p className="mt-1 text-[11px] text-subtle">
                          Completed without evidence binding.
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </section>
  );
}
