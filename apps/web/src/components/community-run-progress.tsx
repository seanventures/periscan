"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  COMMUNITY_VALIDATION_SUITE,
  type CommunityValidationStartResult,
  type ValidationRun
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  EmptyState,
  ErrorState,
  LiveUpdatePill,
  LoadingSkeleton,
  StateBadge,
  ValidationStateBadge,
  buttonClassName,
  type StateTone
} from "../ui";
import { nucleiStartCopy } from "./validation-community-status";

/** 1s poll so a ~3s Gitleaks run is still a Watch beat. Never invent percent-complete. */
export const COMMUNITY_RUN_POLL_INTERVAL_MS = 1_000;

export const COMMUNITY_RUN_REVIEW_FINDINGS_LABEL = "Review findings";

export const COMMUNITY_RUN_COMPLETED_FIXED_COPY =
  "Finished — Fixed still requires a retest.";

export function communityRunIsInFlight(status: string): boolean {
  return status === "Queued" || status === "Running";
}

export function communityRunElapsedLabel(
  startedAt: string | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (!startedAt) {
    return null;
  }
  const startMs = Date.parse(startedAt);
  if (!Number.isFinite(startMs)) {
    return null;
  }
  const elapsedMs = Math.max(0, nowMs - startMs);
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function useWatchNowMs(enabled: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) {
      return;
    }
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return nowMs;
}

export type CommunityRunGroupKind = "primary" | "nuclei";

export type CommunityRunGroup = {
  kind: CommunityRunGroupKind;
  missionId: string;
  title: string;
};

export function communityModuleLabel(moduleId: string): string {
  const suiteTitle = COMMUNITY_VALIDATION_SUITE.find(
    (entry) => entry.moduleId === moduleId
  )?.title;
  if (suiteTitle) {
    return suiteTitle;
  }
  return fallbackModuleLabel(moduleId);
}

function fallbackModuleLabel(moduleId: string): string {
  return moduleId
    .replace(/^periscan\./, "")
    .replace(/^runner\./, "")
    .split(".")
    .map((part) =>
      part
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    )
    .join(" · ");
}

export function communityRunGroups(input: {
  missionId: string;
  nucleiMissionId: string | null;
}): CommunityRunGroup[] {
  const groups: CommunityRunGroup[] = [
    {
      kind: "primary",
      missionId: input.missionId,
      title: "Community mission"
    }
  ];
  if (input.nucleiMissionId) {
    groups.push({
      kind: "nuclei",
      missionId: input.nucleiMissionId,
      title: "Nuclei second mission"
    });
  }
  return groups;
}

export function communityMissionStatusCopy(status: string): string {
  switch (status) {
    case "Queued":
      return "Queued — waiting for a runner or control plane.";
    case "Running":
      return "Running — engines are executing.";
    case "Completed":
      return "Completed — review findings and evidence.";
    case "Failed":
      return "Failed — inspect run errors below.";
    case "DeniedByPolicy":
      return "Denied by policy — this work was never queued.";
    case "RequiresApproval":
      return "Requires approval — no work is queued until approved.";
    case "Cancelled":
      return "Cancelled.";
    case "Draft":
      return "Draft — not started.";
    default:
      return status;
  }
}

export function communityFindingsHref(missionId: string): string {
  return `/findings?missionId=${encodeURIComponent(missionId)}`;
}

export function communityMissionHref(missionId: string): string {
  return `/missions/${missionId}`;
}

const MISSION_TONE: Record<string, StateTone> = {
  Running: "validated",
  Queued: "approval",
  RequiresApproval: "approval",
  Completed: "fixed",
  Failed: "missed",
  DeniedByPolicy: "missed",
  Cancelled: "inconclusive",
  Draft: "inconclusive"
};

const RUN_TONE: Record<string, StateTone> = {
  Running: "validated",
  Queued: "approval",
  RequiresApproval: "approval",
  Completed: "fixed",
  Failed: "missed",
  DeniedByPolicy: "missed",
  Cancelled: "inconclusive"
};

export function CommunityRunProgress({
  communityRun
}: {
  communityRun: CommunityValidationStartResult;
}) {
  const groups = communityRunGroups({
    missionId: communityRun.mission.missionId,
    nucleiMissionId: communityRun.nucleiMissionId
  });
  const nucleiOutcome = nucleiStartCopy(communityRun);
  const progress = useApiResource(
    () =>
      Promise.all(
        groups.map(async (group) => {
          const [mission, runs] = await Promise.all([
            api.getMission(group.missionId),
            api.listMissionRuns(group.missionId)
          ]);
          return { group, mission, runs };
        })
      ),
    [communityRun.mission.missionId, communityRun.nucleiMissionId],
    { refetchIntervalMs: COMMUNITY_RUN_POLL_INTERVAL_MS }
  );
  const livePrimaryStatus =
    progress.data?.find((item) => item.group.kind === "primary")?.mission
      .status ?? communityRun.mission.status;
  const watching = communityRunIsInFlight(livePrimaryStatus);
  const completed = livePrimaryStatus === "Completed";
  const nowMs = useWatchNowMs(watching);

  return (
    <section
      data-testid="community-run-progress"
      className="rounded-control border border-line bg-surface p-3"
      aria-labelledby="community-run-progress-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          id="community-run-progress-heading"
          className="text-[12px] font-semibold text-ink"
        >
          Community run status
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LiveUpdatePill
            lastUpdatedAt={progress.lastUpdatedAt}
            refreshing={progress.refreshing}
          />
          {completed ? (
            <Link
              href={communityFindingsHref(communityRun.mission.missionId)}
              className={buttonClassName({ size: "sm" })}
              data-testid="community-run-review-findings"
            >
              {COMMUNITY_RUN_REVIEW_FINDINGS_LABEL}
            </Link>
          ) : null}
        </div>
      </div>

      {progress.loading && !progress.data ? (
        <LoadingSkeleton rows={3} className="px-0 pb-0 pt-3" />
      ) : null}
      {progress.error ? (
        <ErrorState
          title="Couldn't load Community runs"
          message={progress.error}
          onRetry={progress.refetch}
          className="px-0 pb-0 pt-3"
        />
      ) : null}
      {progress.data
        ? progress.data.map((item) => (
            <MissionRunGroup
              key={item.group.missionId}
              group={item.group}
              missionStatus={item.mission.status}
              nowMs={nowMs}
              runs={item.runs}
            />
          ))
        : null}

      {nucleiOutcome.kind === "skipped" && nucleiOutcome.text ? (
        <p
          data-testid="community-run-nuclei-skipped"
          className="mt-2 text-[12px] text-muted"
        >
          {nucleiOutcome.text}
        </p>
      ) : null}
    </section>
  );
}

function MissionRunGroup({
  group,
  missionStatus,
  nowMs,
  runs
}: {
  group: CommunityRunGroup;
  missionStatus: string;
  nowMs: number;
  runs: ValidationRun[];
}) {
  const missionLinkLabel =
    group.kind === "nuclei" ? "Open Nuclei mission" : "Open mission";
  const showCompletedHonesty =
    group.kind === "primary" && missionStatus === "Completed";

  return (
    <div
      className="mt-3 border-t border-line pt-2"
      data-testid={`community-run-group-${group.kind}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-semibold text-ink">{group.title}</p>
        <StateBadge tone={MISSION_TONE[missionStatus] ?? "neutral"} dot={false}>
          {missionStatus}
        </StateBadge>
        <Link
          href={communityMissionHref(group.missionId)}
          className="text-[12px] font-medium text-brand hover:text-brand-2"
        >
          {missionLinkLabel}
        </Link>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        {communityMissionStatusCopy(missionStatus)}
      </p>
      {showCompletedHonesty ? (
        <p
          data-testid="community-run-completed-honesty"
          className="mt-1 text-[12px] text-muted"
        >
          {COMMUNITY_RUN_COMPLETED_FIXED_COPY}
        </p>
      ) : null}
      {runs.length === 0 ? (
        <EmptyState
          className="mt-2 px-3 py-6"
          title="No runs recorded yet"
          description="Engines were queued, but run records have not appeared yet. This panel polls the mission."
        />
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {runs.map((run) => {
            const elapsed = communityRunIsInFlight(run.status)
              ? communityRunElapsedLabel(run.startedAt ?? run.createdAt, nowMs)
              : null;
            return (
              <li
                key={run.runId}
                className="flex flex-wrap items-center gap-2 text-[12px]"
              >
                <span className="min-w-0 text-ink">
                  {communityModuleLabel(run.moduleId)}
                </span>
                {elapsed ? (
                  <span
                    data-testid="community-run-elapsed"
                    className="font-mono text-[11px] text-subtle"
                  >
                    {elapsed}
                  </span>
                ) : null}
                <StateBadge
                  tone={RUN_TONE[run.status] ?? "neutral"}
                  dot={false}
                >
                  {run.status}
                </StateBadge>
                {run.validationState ? (
                  <ValidationStateBadge
                    state={run.validationState}
                    dot={false}
                  />
                ) : null}
                {run.errorSummary ? (
                  <span className="text-missed">{run.errorSummary}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
