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

/** 1–2s measured Home Watch beat after jobsQueued=1 evidence. Not a percent. */
export const COMMUNITY_HOME_WATCH_DWELL_MS = 1_500;

/** Full walker: sample Home Watch as soon as evidence paints. Never waitIdle. */
export const COMMUNITY_HOME_WATCH_WALKER_WAIT_IDLE_MS = 0;

/** Sample window after first Watch + VALIDATED paint. Not a 1s poll. */
export const COMMUNITY_HOME_WATCH_WALKER_HOLD_MS = 2_200;

export const COMMUNITY_HOME_WATCH_WALKER_MIN_VISIBLE_MS = 1_000;

export const COMMUNITY_HOME_WATCH_WALKER_MAX_VISIBLE_MS = 2_500;

/** Dwell only for a still-fresh first-hour finding, not a returning visit. */
export const COMMUNITY_HOME_WATCH_FRESH_MS = 5 * 60 * 1_000;

/** sessionStorage key prefix: one 1.5s beat per findingId, not per Home remount. */
export const COMMUNITY_HOME_WATCH_DWELL_STORAGE_PREFIX =
  "periscan-home-watch-dwell:";

export const COMMUNITY_RUN_WATCH_LABEL = "Watch";

export const COMMUNITY_RUN_REVIEW_FINDINGS_LABEL = "Review findings";

export const COMMUNITY_RUN_COMPLETED_FIXED_COPY =
  "Finished — Fixed still requires a retest.";

const COMMUNITY_WATCH_STOP_STATUSES = new Set([
  "Failed",
  "DeniedByPolicy",
  "Cancelled"
]);

export function communityRunIsInFlight(status: string): boolean {
  return status === "Queued" || status === "Running";
}

export function communityRunHasEvidence(input: {
  missionEvidenceIds?: readonly string[] | null;
  runs: readonly { evidenceIds?: readonly string[] | null }[];
}): boolean {
  if ((input.missionEvidenceIds?.length ?? 0) > 0) {
    return true;
  }
  return input.runs.some((run) => (run.evidenceIds?.length ?? 0) > 0);
}

/** Keep a 1s Watch poll until evidence exists. Failed/denied runs stop. */
export function communityWatchPollMs(input: {
  status: string;
  hasEvidence: boolean;
}): number | undefined {
  if (input.hasEvidence) {
    return undefined;
  }
  if (COMMUNITY_WATCH_STOP_STATUSES.has(input.status)) {
    return undefined;
  }
  return COMMUNITY_RUN_POLL_INTERVAL_MS;
}

export function formatCommunityFindingPathRule(finding: {
  location?: string | null;
  ruleId?: string | null;
  title: string;
}): string {
  const location = finding.location?.trim();
  const ruleId = finding.ruleId?.trim();
  if (location && ruleId) {
    return `${location} · ${ruleId}`;
  }
  return finding.title;
}

export function communityHomeWatchDwellRemainingMs(input: {
  jobsQueued: number;
  hasEvidence: boolean;
  evidenceAtMs: number | null;
  nowMs: number;
  accumulatedVisibleMs?: number;
}): number {
  if (
    input.jobsQueued !== 1 ||
    !input.hasEvidence ||
    input.evidenceAtMs == null
  ) {
    return 0;
  }
  const sessionMs = input.nowMs - input.evidenceAtMs;
  if (!Number.isFinite(sessionMs) || sessionMs < 0) {
    return COMMUNITY_HOME_WATCH_DWELL_MS;
  }
  const elapsed =
    input.accumulatedVisibleMs != null
      ? input.accumulatedVisibleMs + sessionMs
      : sessionMs;
  return Math.max(0, COMMUNITY_HOME_WATCH_DWELL_MS - elapsed);
}

export function communityHomeWatchAllowsAutoNav(input: {
  jobsQueued: number;
  hasEvidence: boolean;
  evidenceAtMs: number | null;
  nowMs: number;
  accumulatedVisibleMs?: number;
}): boolean {
  return communityHomeWatchDwellRemainingMs(input) === 0;
}

export function communityHomeWatchShouldStart(input: {
  jobsQueued: number;
  hasEvidence: boolean;
  findingCreatedAtMs: number | null;
  nowMs: number;
  source?: string | null;
  displayValidationState?: string | null;
}): boolean {
  if (input.jobsQueued !== 1 || !input.hasEvidence) {
    return false;
  }
  if (!input.source?.includes("gitleaks.repo_secrets")) {
    return false;
  }
  if (input.displayValidationState !== "Validated") {
    return false;
  }
  if (input.findingCreatedAtMs == null) {
    return false;
  }
  const ageMs = input.nowMs - input.findingCreatedAtMs;
  if (!Number.isFinite(ageMs) || ageMs > COMMUNITY_HOME_WATCH_FRESH_MS) {
    return false;
  }
  return true;
}

export function communityHomeWatchDwellStorageKey(findingId: string): string {
  return `${COMMUNITY_HOME_WATCH_DWELL_STORAGE_PREFIX}${findingId}`;
}

type HomeWatchDwellStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type CommunityHomeWatchDwellRecord = {
  startedAtMs: number;
  visibleMs: number;
};

export type HomeWatchDwellSample = {
  dwell_present?: boolean;
  finding_locator?: string | null;
  has_path_rule?: boolean;
  has_percent?: boolean;
  has_validated?: boolean;
  header_sign_in?: boolean;
  t_ms?: number;
  watch_label?: string | null;
};

function clampHomeWatchVisibleMs(visibleMs: number): number {
  if (!Number.isFinite(visibleMs) || visibleMs < 0) {
    return 0;
  }
  return Math.min(COMMUNITY_HOME_WATCH_DWELL_MS, visibleMs);
}

export function parseCommunityHomeWatchDwellRecord(
  raw: string | null | undefined,
  nowMs?: number
): CommunityHomeWatchDwellRecord | null {
  if (!raw) {
    return null;
  }
  try {
    if (raw.trim().startsWith("{")) {
      const parsed = JSON.parse(raw) as {
        startedAtMs?: unknown;
        visibleMs?: unknown;
      };
      const startedAtMs = Number(parsed.startedAtMs);
      if (!Number.isFinite(startedAtMs)) {
        return null;
      }
      return {
        startedAtMs,
        visibleMs: clampHomeWatchVisibleMs(Number(parsed.visibleMs))
      };
    }
    const startedAtMs = Number(raw);
    if (!Number.isFinite(startedAtMs)) {
      return null;
    }
    const visibleMs =
      nowMs != null && Number.isFinite(nowMs)
        ? clampHomeWatchVisibleMs(nowMs - startedAtMs)
        : 0;
    return { startedAtMs, visibleMs };
  } catch {
    return null;
  }
}

export function readCommunityHomeWatchDwellRecord(
  storage: Pick<HomeWatchDwellStorage, "getItem"> | null | undefined,
  findingId: string,
  nowMs?: number
): CommunityHomeWatchDwellRecord | null {
  if (!storage || !findingId) {
    return null;
  }
  try {
    return parseCommunityHomeWatchDwellRecord(
      storage.getItem(communityHomeWatchDwellStorageKey(findingId)),
      nowMs
    );
  } catch {
    return null;
  }
}

export function writeCommunityHomeWatchDwellRecord(
  storage: Pick<HomeWatchDwellStorage, "setItem"> | null | undefined,
  findingId: string,
  record: CommunityHomeWatchDwellRecord
): void {
  if (
    !storage ||
    !findingId ||
    !Number.isFinite(record.startedAtMs) ||
    !Number.isFinite(record.visibleMs)
  ) {
    return;
  }
  try {
    storage.setItem(
      communityHomeWatchDwellStorageKey(findingId),
      JSON.stringify({
        startedAtMs: record.startedAtMs,
        visibleMs: clampHomeWatchVisibleMs(record.visibleMs)
      })
    );
  } catch {
    // Private mode / quota: this mount still dwells via in-memory start.
  }
}

export function readCommunityHomeWatchDwellStartedAtMs(
  storage: Pick<HomeWatchDwellStorage, "getItem"> | null | undefined,
  findingId: string
): number | null {
  return (
    readCommunityHomeWatchDwellRecord(storage, findingId)?.startedAtMs ?? null
  );
}

export function writeCommunityHomeWatchDwellStartedAtMs(
  storage: Pick<HomeWatchDwellStorage, "setItem"> | null | undefined,
  findingId: string,
  startedAtMs: number
): void {
  if (!storage || !findingId || !Number.isFinite(startedAtMs)) {
    return;
  }
  try {
    storage.setItem(
      communityHomeWatchDwellStorageKey(findingId),
      String(startedAtMs)
    );
  } catch {
    // Private mode / quota: this mount still dwells via in-memory start.
  }
}

export function accumulateCommunityHomeWatchDwellVisibleMs(input: {
  accumulatedVisibleMs: number;
  thisMountAtMs: number;
  nowMs: number;
}): number {
  const sessionMs = input.nowMs - input.thisMountAtMs;
  if (!Number.isFinite(sessionMs) || sessionMs < 0) {
    return clampHomeWatchVisibleMs(input.accumulatedVisibleMs);
  }
  return clampHomeWatchVisibleMs(input.accumulatedVisibleMs + sessionMs);
}

export function resolveCommunityHomeWatchDwellStartedAtMs(input: {
  shouldStart: boolean;
  nowMs: number;
  storedStartedAtMs: number | null;
}): { startedAtMs: number | null; shouldPersist: boolean } {
  if (!input.shouldStart) {
    return { startedAtMs: input.storedStartedAtMs, shouldPersist: false };
  }
  if (input.storedStartedAtMs != null) {
    return { startedAtMs: input.storedStartedAtMs, shouldPersist: false };
  }
  return { startedAtMs: input.nowMs, shouldPersist: true };
}

export function resolveCommunityHomeWatchDwellMount(input: {
  shouldStart: boolean;
  nowMs: number;
  stored: CommunityHomeWatchDwellRecord | null;
}): {
  accumulatedVisibleMs: number;
  shouldPersist: boolean;
  startedAtMs: number | null;
  thisMountAtMs: number | null;
} {
  if (!input.shouldStart) {
    return {
      accumulatedVisibleMs: input.stored?.visibleMs ?? 0,
      shouldPersist: false,
      startedAtMs: input.stored?.startedAtMs ?? null,
      thisMountAtMs: null
    };
  }
  if (input.stored == null) {
    return {
      accumulatedVisibleMs: 0,
      shouldPersist: true,
      startedAtMs: input.nowMs,
      thisMountAtMs: input.nowMs
    };
  }
  const accumulatedVisibleMs = clampHomeWatchVisibleMs(input.stored.visibleMs);
  return {
    accumulatedVisibleMs,
    shouldPersist: false,
    startedAtMs: input.stored.startedAtMs,
    thisMountAtMs: input.nowMs
  };
}

export function scoreHomeWatchDwellSamples(
  samples: readonly HomeWatchDwellSample[]
): {
  dwell_observed: boolean;
  dwell_ok: boolean;
  finding_locator: string | null;
  header_sign_in: boolean;
  no_percent: boolean;
  validated_path_rule_observed: boolean;
  visible_span_ms: number;
  watch_is_watch: boolean;
} {
  let firstVisibleAt: number | null = null;
  let lastVisibleAt: number | null = null;
  let firstValidatedPathAt: number | null = null;
  let findingLocator: string | null = null;
  for (const snap of samples) {
    const tMs = Number(snap.t_ms);
    if (!Number.isFinite(tMs)) {
      continue;
    }
    if (snap.dwell_present) {
      if (firstVisibleAt == null) {
        firstVisibleAt = tMs;
      }
      lastVisibleAt = tMs;
    }
    if (snap.dwell_present && snap.has_validated && snap.has_path_rule) {
      if (firstValidatedPathAt == null) {
        firstValidatedPathAt = tMs;
      }
      if (!findingLocator && snap.finding_locator) {
        findingLocator = snap.finding_locator;
      }
    }
  }
  const visibleSpanMs =
    firstVisibleAt != null && lastVisibleAt != null
      ? lastVisibleAt - firstVisibleAt
      : 0;
  const dwellObserved = firstVisibleAt != null;
  const validatedPathRuleObserved = firstValidatedPathAt != null;
  const watchIsWatch = samples.some(
    (snap) => String(snap.watch_label || "").trim() === COMMUNITY_RUN_WATCH_LABEL
  );
  const noPercent = samples.every((snap) => !snap.has_percent);
  const headerSignIn = samples.some((snap) => snap.header_sign_in === true);
  return {
    dwell_observed: dwellObserved,
    dwell_ok:
      dwellObserved &&
      visibleSpanMs >= COMMUNITY_HOME_WATCH_WALKER_MIN_VISIBLE_MS &&
      visibleSpanMs <= COMMUNITY_HOME_WATCH_WALKER_MAX_VISIBLE_MS &&
      validatedPathRuleObserved &&
      watchIsWatch &&
      noPercent &&
      !headerSignIn,
    finding_locator: findingLocator,
    header_sign_in: headerSignIn,
    no_percent: noPercent,
    validated_path_rule_observed: validatedPathRuleObserved,
    visible_span_ms: visibleSpanMs,
    watch_is_watch: watchIsWatch
  };
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
  const initialWatchPollMs = communityWatchPollMs({
    status: communityRun.mission.status,
    hasEvidence: communityRunHasEvidence({
      missionEvidenceIds: communityRun.mission.evidenceIds,
      runs: communityRun.runs
    })
  });
  const [watchPollMs, setWatchPollMs] = useState<number | undefined>(
    initialWatchPollMs
  );
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
    { refetchIntervalMs: watchPollMs }
  );
  const livePrimary = progress.data?.find(
    (item) => item.group.kind === "primary"
  );
  const livePrimaryStatus =
    livePrimary?.mission.status ?? communityRun.mission.status;
  const hasEvidence = communityRunHasEvidence({
    missionEvidenceIds:
      livePrimary?.mission.evidenceIds ?? communityRun.mission.evidenceIds,
    runs: livePrimary?.runs ?? communityRun.runs
  });
  const nextWatchPollMs = communityWatchPollMs({
    status: livePrimaryStatus,
    hasEvidence
  });
  useEffect(() => {
    setWatchPollMs(nextWatchPollMs);
  }, [nextWatchPollMs]);
  const watching =
    communityRunIsInFlight(livePrimaryStatus) || nextWatchPollMs != null;
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
          data-testid="community-run-watch"
          className="text-[12px] font-semibold text-ink"
        >
          {COMMUNITY_RUN_WATCH_LABEL}
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
