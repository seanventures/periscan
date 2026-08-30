"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  EngagementCollaborationSnapshot,
  EngagementWorkspaceRole,
  TenantMember
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  InlineError,
  LiveUpdatePill,
  StateBadge,
  buttonClassName,
  cn
} from "../ui";

const inputClass =
  "rounded-control border border-line bg-canvas px-2.5 py-2 text-xs text-ink outline-none focus:border-brand";

export function EngagementCollaborationWorkspace({
  engagementId,
  evidenceIds
}: {
  engagementId: string;
  evidenceIds: string[];
}) {
  const [snapshot, setSnapshot] =
    useState<EngagementCollaborationSnapshot | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [title, setTitle] = useState(`Engagement ${engagementId.slice(0, 8)}`);
  const [objective, setObjective] = useState(
    "Coordinate validation, record operator decisions, and preserve the evidence-backed replay."
  );
  const [note, setNote] = useState("");
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState<EngagementWorkspaceRole>("Operator");
  const [assigneeId, setAssigneeId] = useState("");
  const [evidenceId, setEvidenceId] = useState(evidenceIds[0] ?? "");
  const [busy, setBusy] = useState<string | null>("load");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayMode, setReplayMode] = useState(false);
  const [replaySequence, setReplaySequence] = useState(1);

  useEffect(() => {
    let active = true;
    async function load(initial: boolean) {
      if (!initial) setRefreshing(true);
      try {
        const [nextSnapshot, nextMembers] = await Promise.all([
          api.getEngagementCollaboration(engagementId),
          initial ? api.listTenantMembers() : Promise.resolve(null)
        ]);
        if (!active) return;
        setSnapshot(nextSnapshot);
        if (!replayMode && nextSnapshot) {
          setReplaySequence(
            Math.max(1, nextSnapshot.workspace.lastEventSequence)
          );
        }
        if (nextMembers) {
          setMembers(nextMembers);
          setMemberId(nextMembers[0]?.user.userId ?? "");
          setAssigneeId(nextMembers[0]?.user.userId ?? "");
        }
        setError(null);
      } catch (caught) {
        if (active && initial) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Couldn't load engagement collaboration."
          );
        }
      } finally {
        if (active) {
          setBusy(null);
          setRefreshing(false);
        }
      }
    }
    void load(true);
    const timer = window.setInterval(() => void load(false), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [engagementId, replayMode]);

  function apply(next: EngagementCollaborationSnapshot) {
    setSnapshot(next);
    if (!replayMode) {
      setReplaySequence(Math.max(1, next.workspace.lastEventSequence));
    }
  }

  async function initialize() {
    setBusy("initialize");
    setError(null);
    try {
      apply(
        await api.initializeEngagementCollaboration(engagementId, {
          objective,
          title
        })
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Initialization failed."
      );
    } finally {
      setBusy(null);
    }
  }

  async function addCollaborator() {
    if (!memberId) return;
    setBusy("collaborator");
    setError(null);
    try {
      apply(
        await api.upsertEngagementCollaborator(engagementId, {
          role,
          userId: memberId
        })
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Collaborator update failed."
      );
    } finally {
      setBusy(null);
    }
  }

  async function append(
    input: Parameters<typeof api.appendEngagementCollaborationEvent>[1],
    action: string
  ) {
    setBusy(action);
    setError(null);
    try {
      apply(await api.appendEngagementCollaborationEvent(engagementId, input));
      if (input.eventType === "Note") setNote("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Activity update failed."
      );
    } finally {
      setBusy(null);
    }
  }

  const visibleEvents = useMemo(
    () =>
      (snapshot?.events ?? []).filter(
        (event) => !replayMode || event.sequence <= replaySequence
      ),
    [replayMode, replaySequence, snapshot?.events]
  );

  if (busy === "load") {
    return (
      <section className="rounded-control border border-line bg-surface p-4">
        <p className="text-xs text-subtle">
          Loading shared operator workspace…
        </p>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section
        aria-label="Shared engagement workspace"
        className="overflow-hidden rounded-control border border-brand/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-brand)_8%,transparent),transparent_62%)]"
      >
        <div className="border-b border-line px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-subtle">
            Shared RTAP workspace
          </p>
          <h4 className="mt-1 text-sm font-semibold text-ink">
            Coordinate the people around this engagement
          </h4>
          <p className="mt-1 max-w-3xl text-[11px] leading-4 text-muted">
            Notes, roles, assignments, evidence pins, and status changes become
            one hash-linked replay. Execution safety remains in the engagement
            policy gate.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
            Workspace title
            <input
              className={inputClass}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-muted sm:col-span-2">
            Objective
            <textarea
              className={cn(inputClass, "min-h-20 resize-y")}
              onChange={(event) => setObjective(event.target.value)}
              value={objective}
            />
          </label>
          <button
            className={buttonClassName({ size: "sm", variant: "primary" })}
            disabled={
              busy !== null ||
              title.trim().length < 3 ||
              objective.trim().length < 3
            }
            onClick={() => void initialize()}
            type="button"
          >
            {busy === "initialize"
              ? "Creating replay ledger…"
              : "Start shared workspace"}
          </button>
          {error ? <InlineError message={error} /> : null}
        </div>
      </section>
    );
  }

  const lead = snapshot.collaborators.find(
    (item) => item.userId === snapshot.workspace.leadUserId
  );

  return (
    <section
      aria-label="Shared engagement workspace"
      className="overflow-hidden rounded-control border border-line bg-surface"
    >
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-subtle">
              Shared RTAP workspace
            </p>
            <h4 className="mt-1 text-sm font-semibold text-ink">
              {snapshot.workspace.title}
            </h4>
            <p className="mt-1 max-w-3xl text-[11px] leading-4 text-muted">
              {snapshot.workspace.objective}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LiveUpdatePill
              lastUpdatedAt={snapshot.workspace.updatedAt}
              refreshing={refreshing}
            />
            <StateBadge
              dot={false}
              tone={snapshot.integrity.valid ? "validated" : "missed"}
            >
              {snapshot.integrity.valid
                ? `Chain verified · ${snapshot.integrity.eventCount}`
                : `Chain broken · #${snapshot.integrity.brokenAtSequence}`}
            </StateBadge>
            <StateBadge dot={false} tone="neutral">
              {snapshot.workspace.status}
            </StateBadge>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="border-b border-line p-4 lg:border-b-0 lg:border-r">
          <p className="text-[10px] uppercase tracking-wide text-subtle">
            Team
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {snapshot.collaborators.map((collaborator) => (
              <div
                className="flex items-center justify-between gap-2 rounded-control border border-line px-2.5 py-2"
                key={collaborator.collaboratorId}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">
                    {collaborator.name}
                  </p>
                  <p className="truncate text-[10px] text-subtle">
                    {collaborator.email}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-brand">
                  {collaborator.role}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            <select
              aria-label="Workspace tenant member"
              className={inputClass}
              onChange={(event) => setMemberId(event.target.value)}
              value={memberId}
            >
              {members.map((item) => (
                <option key={item.user.userId} value={item.user.userId}>
                  {item.user.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Workspace role"
              className={inputClass}
              onChange={(event) =>
                setRole(event.target.value as EngagementWorkspaceRole)
              }
              value={role}
            >
              <option value="Lead">Lead</option>
              <option value="Operator">Operator</option>
              <option value="Observer">Observer</option>
            </select>
            <button
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              disabled={!memberId || busy !== null}
              onClick={() => void addCollaborator()}
              type="button"
            >
              {busy === "collaborator" ? "Updating team…" : "Add or update"}
            </button>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-[10px] uppercase tracking-wide text-subtle">
              Assignment
            </p>
            <p className="mt-1 text-xs text-ink">
              Lead · {lead?.name ?? "Unassigned"}
            </p>
            <div className="mt-2 grid gap-2">
              <select
                aria-label="Engagement assignee"
                className={inputClass}
                onChange={(event) => setAssigneeId(event.target.value)}
                value={assigneeId}
              >
                {members.map((item) => (
                  <option key={item.user.userId} value={item.user.userId}>
                    {item.user.name}
                  </option>
                ))}
              </select>
              <button
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
                disabled={!assigneeId || busy !== null}
                onClick={() =>
                  void append(
                    {
                      assignedToUserId: assigneeId,
                      eventType: "AssignmentChanged",
                      evidenceIds: []
                    },
                    "assign"
                  )
                }
                type="button"
              >
                {busy === "assign" ? "Assigning…" : "Assign lead"}
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_15rem]">
            <label className="flex flex-col gap-1 text-[11px] font-medium text-muted">
              Operator note
              <textarea
                className={cn(inputClass, "min-h-20 resize-y")}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Record an observation, decision, handoff, or blocker."
                value={note}
              />
            </label>
            <div className="flex flex-col justify-end gap-2">
              <button
                className={buttonClassName({ size: "sm", variant: "primary" })}
                disabled={note.trim().length === 0 || busy !== null}
                onClick={() =>
                  void append(
                    { body: note, eventType: "Note", evidenceIds: [] },
                    "note"
                  )
                }
                type="button"
              >
                {busy === "note" ? "Appending note…" : "Append to replay"}
              </button>
              <div className="flex gap-1">
                {(["Open", "InReview", "Closed"] as const).map((status) => (
                  <button
                    className={cn(
                      "flex-1 rounded-control border px-1 py-1.5 font-mono text-[9px]",
                      snapshot.workspace.status === status
                        ? "border-brand/40 bg-brand/10 text-brand"
                        : "border-line text-subtle"
                    )}
                    disabled={busy !== null}
                    key={status}
                    onClick={() =>
                      void append(
                        { eventType: "StatusChanged", evidenceIds: [], status },
                        `status-${status}`
                      )
                    }
                    type="button"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {evidenceIds.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-control border border-line bg-canvas px-3 py-2">
              <span className="text-[10px] uppercase tracking-wide text-subtle">
                Pin engagement evidence
              </span>
              <select
                aria-label="Engagement evidence"
                className={cn(inputClass, "min-w-48 flex-1")}
                onChange={(event) => setEvidenceId(event.target.value)}
                value={evidenceId}
              >
                {evidenceIds.map((id) => (
                  <option key={id} value={id}>
                    ev-{id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <button
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
                disabled={!evidenceId || busy !== null}
                onClick={() =>
                  void append(
                    {
                      eventType: "EvidencePinned",
                      evidenceIds: [evidenceId]
                    },
                    "evidence"
                  )
                }
                type="button"
              >
                Pin to replay
              </button>
            </div>
          ) : null}

          {error ? <InlineError className="mt-3" message={error} /> : null}

          <div className="mt-4 border-t border-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-ink">
                  Evidence-backed activity replay
                </p>
                <p className="mt-0.5 text-[10px] text-subtle">
                  Sequence{" "}
                  {replayMode
                    ? replaySequence
                    : snapshot.workspace.lastEventSequence}{" "}
                  of {snapshot.workspace.lastEventSequence}
                </p>
              </div>
              <button
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
                onClick={() => {
                  const next = !replayMode;
                  setReplayMode(next);
                  setReplaySequence(
                    next ? 1 : Math.max(1, snapshot.workspace.lastEventSequence)
                  );
                }}
                type="button"
              >
                {replayMode ? "Return to live" : "Replay from start"}
              </button>
            </div>
            {replayMode ? (
              <input
                aria-label="Collaboration replay position"
                className="mt-3 w-full accent-brand"
                max={Math.max(1, snapshot.workspace.lastEventSequence)}
                min={1}
                onChange={(event) =>
                  setReplaySequence(Number(event.target.value))
                }
                type="range"
                value={replaySequence}
              />
            ) : null}
            <ol
              className="mt-3 flex flex-col gap-2"
              aria-label="Collaboration replay events"
            >
              {visibleEvents
                .slice()
                .reverse()
                .map((event) => (
                  <li
                    className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2 rounded-control border border-line px-3 py-2"
                    key={event.engagementCollaborationEventId}
                  >
                    <span className="font-mono text-[10px] text-brand">
                      #{event.sequence}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-ink">
                          {event.eventType.replace(/([a-z])([A-Z])/gu, "$1 $2")}
                        </span>
                        <span className="text-[10px] text-subtle">
                          {event.actorName} ·{" "}
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {event.body ? (
                        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-4 text-muted">
                          {event.body}
                        </p>
                      ) : null}
                      {event.assignedToName ? (
                        <p className="mt-1 text-[11px] text-brand">
                          Assigned to {event.assignedToName}
                        </p>
                      ) : null}
                      {event.status ? (
                        <p className="mt-1 text-[11px] text-brand">
                          Status → {event.status}
                        </p>
                      ) : null}
                      {event.evidenceIds.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {event.evidenceIds.map((id) => (
                            <span
                              className="rounded-pill bg-brand/10 px-2 py-0.5 font-mono text-[9px] text-brand"
                              key={id}
                            >
                              ev-{id.slice(0, 8)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-1 truncate font-mono text-[8px] text-subtle">
                        {event.eventHash}
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
