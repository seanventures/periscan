"use client";

import Link from "next/link";
import { useState } from "react";

import {
  summarizeCommunityMissionRuns,
  type CommunityValidationCompanion,
  type ProofLoopStage,
  type ValidationMission,
  type ValidationRun
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import { WorkflowFeedback } from "./workflow-feedback";
import { ProofLoopContext } from "./proof-loop-context";
import { ValidationMissionActivity } from "./validation-mission-activity";
import { communityMissionHref } from "./community-run-progress";
import {
  ErrorState,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  PartialLoadBanner,
  SafetyLevelBadge,
  StateBadge,
  ValidationStateBadge,
  buttonClassName
} from "../ui";

const ACTIVE_STATUSES = new Set([
  "Draft",
  "Queued",
  "Running",
  "RequiresApproval"
]);

/** Finer mission → proof-loop stage map (P02-13). */
function missionProofStage(status: string): ProofLoopStage {
  switch (status) {
    case "RequiresApproval":
    case "DeniedByPolicy":
      return "Authorize";
    case "Draft":
    case "Queued":
    case "Running":
      return "Validate";
    case "Completed":
      return "Understand";
    case "Failed":
      return "Validate";
    case "Cancelled":
      return "Validate";
    default:
      return "Validate";
  }
}

function missionProofNextAction(status: string): {
  href: string;
  label: string;
} {
  switch (status) {
    case "RequiresApproval":
      return {
        href: "/policies?approvalState=Pending",
        label: "Review approval"
      };
    case "DeniedByPolicy":
      return { href: "/scopes", label: "Fix scope or policy" };
    case "Completed":
      return { href: "/findings?status=New", label: "Review results" };
    case "Failed":
      return { href: "/missions", label: "Re-run or diagnose" };
    case "Cancelled":
      return { href: "/missions", label: "Start another mission" };
    case "Running":
    case "Queued":
      return { href: "#mission-activity", label: "Watch run activity" };
    default:
      return { href: "/missions", label: "Open mission queue" };
  }
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

/** Verify can earn Fixed only with a verification event; missing path+evidence stays compare-only. */
const COMMUNITY_REMEDIATIONS_HONESTY =
  "Fixed still requires a verification event. Community remediations keep originating evidence/path when the finding has them. Findings without relatedPathIds and evidenceIds retest as compare-only and may stay Inconclusive.";

function communityRemediationsOpenedNote(createdCount: number): string {
  if (createdCount === 0) {
    return "No Community findings with fingerprints yet — remediations stay empty until evidence exists.";
  }
  const noun = createdCount === 1 ? "remediation" : "remediations";
  return `Opened ${createdCount} ${noun}. Fixed still requires a verification event. Originating evidence/path is kept when the finding has them. Findings without relatedPathIds and evidenceIds retest as compare-only and may stay Inconclusive.`;
}

export function MissionDetail({ missionId }: { missionId: string }) {
  const detail = useApiResource(
    async () => {
      const [mission, runs, auditResult, companionResult] = await Promise.all([
        api.getMission(missionId),
        api.listMissionRuns(missionId),
        api.listAuditEvents({ limit: 50, search: missionId }).then(
          (events) => ({ ok: true as const, events }),
          () => ({
            ok: false as const,
            events: [] as Awaited<ReturnType<typeof api.listAuditEvents>>
          })
        ),
        api.getCommunityValidationCompanion(missionId).then(
          (companion) => ({ ok: true as const, companion }),
          () => ({
            ok: false as const,
            companion: {
              nucleiMissionId: null,
              nucleiSkipReason: null
            } satisfies CommunityValidationCompanion
          })
        )
      ]);
      let nucleiMission: ValidationMission | null = null;
      let nucleiRuns: ValidationRun[] = [];
      const nucleiMissionId = companionResult.companion.nucleiMissionId;
      if (nucleiMissionId) {
        const [loadedMission, loadedRuns] = await Promise.all([
          api.getMission(nucleiMissionId).then(
            (value) => value,
            () => null
          ),
          api.listMissionRuns(nucleiMissionId).then(
            (value) => value,
            () => [] as ValidationRun[]
          )
        ]);
        nucleiMission = loadedMission;
        nucleiRuns = loadedRuns;
      }
      return {
        auditDegraded: !auditResult.ok,
        auditEvents: auditResult.events,
        companion: companionResult.companion,
        mission,
        nucleiMission,
        nucleiRuns,
        runs
      };
    },
    [missionId],
    { refetchIntervalMs: 6_000 }
  );
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [creatingRemediations, setCreatingRemediations] = useState(false);
  const [remediationNote, setRemediationNote] = useState<string | null>(null);

  async function cancelMission() {
    setCancelling(true);
    setCancelError(null);
    try {
      await api.cancelMission(missionId);
      await detail.refetch();
    } catch (error) {
      setCancelError(
        error instanceof Error
          ? error.message
          : "Unable to cancel this mission."
      );
    } finally {
      setCancelling(false);
    }
  }

  async function createCommunityRemediations() {
    setCreatingRemediations(true);
    setRemediationNote(null);
    try {
      const result = await api.createCommunityMissionRemediations(missionId);
      setRemediationNote(communityRemediationsOpenedNote(result.createdCount));
    } catch (error) {
      setRemediationNote(
        error instanceof Error
          ? error.message
          : "Unable to create remediations from this Community mission."
      );
    } finally {
      setCreatingRemediations(false);
    }
  }

  if (detail.loading) {
    return <LoadingSkeleton rows={8} />;
  }
  if (detail.error || !detail.data) {
    return (
      <ErrorState
        message={detail.error ?? "Mission not found."}
        onRetry={detail.refetch}
      />
    );
  }

  const {
    auditDegraded,
    auditEvents,
    companion,
    mission,
    nucleiMission,
    nucleiRuns,
    runs
  } = detail.data;
  const community = summarizeCommunityMissionRuns(runs);
  const nucleiCommunity = summarizeCommunityMissionRuns(nucleiRuns);
  const showNucleiCompanion =
    community.hasCommunityPack &&
    !community.mixed &&
    Boolean(companion.nucleiMissionId);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6">
      {auditDegraded ? (
        <PartialLoadBanner
          rails={["Audit timeline"]}
          detail="Mission and run data below are live; the activity rail is degraded."
        />
      ) : null}
      <header className="flex flex-col gap-1">
        <Link
          href="/missions"
          className="w-fit text-xs text-brand hover:text-brand-2"
        >
          ← Validation Snapshot
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Validation mission
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {mission.missionType}
          </h1>
          <StateBadge tone="neutral" dot={false}>
            {mission.status}
          </StateBadge>
          {community.hasCommunityPack ? (
            <StateBadge
              tone={community.mixed ? "approval" : "brand"}
              dot={false}
            >
              {community.mixed ? "Mixed mission" : "Community pack"}
            </StateBadge>
          ) : null}
          <SafetyLevelBadge level={mission.safetyLevel} dot={false} />
        </div>
        <p className="font-mono text-xs text-subtle">{mission.missionId}</p>
      </header>

      {community.hasCommunityPack ? (
        <Panel
          data-testid="community-pack-banner"
          aria-labelledby="community-pack-title"
        >
          <PanelHeader titleId="community-pack-title" title="Community pack" />
          <div className="flex flex-col gap-3 p-4">
            <p className="text-sm text-muted">
              {community.mixed
                ? "This mission is mixed: Community pack engines ran with modules that are not in the Community suite."
                : community.valueLine}
            </p>
            <ul className="flex flex-col gap-1.5">
              {community.engines.map((engine, index) => (
                <li
                  key={`${engine.moduleId}:${engine.status}:${index}`}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="text-ink">{engine.title}</span>
                  {engine.secondMission ? (
                    <span className="font-mono text-[11px] text-subtle">
                      second mission
                    </span>
                  ) : null}
                  <StateBadge tone="neutral" dot={false}>
                    {engine.status}
                  </StateBadge>
                </li>
              ))}
            </ul>
            {companion.nucleiSkipReason ? (
              <p
                data-testid="community-nuclei-skip"
                className="text-sm text-muted"
              >
                {companion.nucleiSkipReason}
              </p>
            ) : null}
            {showNucleiCompanion && companion.nucleiMissionId ? (
              <div
                data-testid="community-nuclei-companion"
                className="flex flex-col gap-1.5 border-t border-line pt-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-ink">
                    Nuclei second mission
                  </p>
                  {nucleiMission ? (
                    <StateBadge tone="neutral" dot={false}>
                      {nucleiMission.status}
                    </StateBadge>
                  ) : null}
                  <Link
                    href={communityMissionHref(companion.nucleiMissionId)}
                    className="text-sm font-medium text-brand hover:text-brand-2"
                  >
                    Open Nuclei mission
                  </Link>
                </div>
                {nucleiCommunity.engines.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nuclei run records have not appeared yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {nucleiCommunity.engines.map((engine, index) => (
                      <li
                        key={`${engine.moduleId}:${engine.status}:${index}`}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <span className="text-ink">{engine.title}</span>
                        <span className="font-mono text-[11px] text-subtle">
                          second mission
                        </span>
                        <StateBadge tone="neutral" dot={false}>
                          {engine.status}
                        </StateBadge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            {mission.status === "Failed" ? (
              <div role="alert" className="text-sm text-missed">
                {community.failedErrors.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {community.failedErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    This Community pack mission failed. No run error summary was
                    recorded.
                  </p>
                )}
              </div>
            ) : null}
            {mission.status === "Completed" ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/findings?missionId=${mission.missionId}`}
                    className={buttonClassName({ size: "sm" })}
                  >
                    Review findings
                  </Link>
                  <button
                    type="button"
                    data-testid="community-create-remediations"
                    disabled={creatingRemediations}
                    onClick={() => void createCommunityRemediations()}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    {creatingRemediations
                      ? "Creating remediations…"
                      : "Create remediations"}
                  </button>
                </div>
                <p
                  data-testid="community-remediations-honesty"
                  className="text-sm text-muted"
                >
                  {COMMUNITY_REMEDIATIONS_HONESTY}
                </p>
              </>
            ) : null}
            {remediationNote ? (
              <p className="text-sm text-muted" role="status">
                {remediationNote}
              </p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <ProofLoopContext
        entityLabel="Validation mission"
        stage={missionProofStage(mission.status)}
        evidenceBasis={
          runs.some((run) => run.evidenceIds.length > 0)
            ? "Measured"
            : "Pending measured evidence"
        }
        owner={mission.requestedBy}
        freshness={formatTimestamp(mission.completedAt ?? mission.updatedAt)}
        status={mission.status}
        nextAction={
          community.hasCommunityPack && mission.status === "Completed"
            ? {
                href: `/findings?missionId=${mission.missionId}`,
                label: "Review results"
              }
            : missionProofNextAction(mission.status)
        }
      />

      <ValidationMissionActivity
        auditEvents={auditEvents}
        mission={mission}
        refreshing={detail.refreshing}
        runs={runs}
      />

      <Panel>
        <PanelHeader
          title="Authorization & scope"
          actions={
            ACTIVE_STATUSES.has(mission.status) ? (
              <button
                type="button"
                onClick={cancelMission}
                disabled={cancelling}
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
              >
                {cancelling ? "Cancelling…" : "Cancel mission"}
              </button>
            ) : null
          }
        />
        <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-subtle">Policy decision</dt>
            <dd className="mt-1 font-mono text-ink">
              {mission.policyDecisionId ?? "Not linked"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Policy profile</dt>
            <dd className="mt-1 text-ink">
              {mission.policyProfile ?? "Default"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Authorized scopes</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {mission.scopeIds.map((scopeId) => (
                <span key={scopeId} className="font-mono text-ink">
                  {scopeId}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Timeline</dt>
            <dd className="mt-1 text-ink">
              {formatTimestamp(mission.startedAt)} →{" "}
              {formatTimestamp(mission.completedAt)}
            </dd>
          </div>
        </dl>
        {cancelError ? (
          <p
            role="alert"
            className="border-t border-line px-4 py-2 text-sm text-missed"
          >
            {cancelError}
          </p>
        ) : null}
      </Panel>

      <Panel>
        <PanelHeader title={`Runs (${runs.length})`} />
        {runs.length === 0 ? (
          <p className="p-4 text-sm text-subtle">
            No runs recorded for this mission.
          </p>
        ) : (
          <ul>
            {runs.map((run) => {
              const communityTitle = community.engines.find(
                (engine) => engine.moduleId === run.moduleId
              )?.title;
              return (
                <li
                  key={run.runId}
                  className="border-b border-line p-4 last:border-b-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StateBadge tone="neutral" dot={false}>
                      {run.status}
                    </StateBadge>
                    {run.validationState ? (
                      <ValidationStateBadge
                        state={run.validationState}
                        dot={false}
                      />
                    ) : null}
                    {communityTitle ? (
                      <span className="text-sm text-ink">{communityTitle}</span>
                    ) : null}
                    <span className="font-mono text-xs text-ink">
                      {run.moduleId}
                    </span>
                    <span className="ml-auto text-xs text-subtle">
                      {formatTimestamp(run.completedAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {run.outcome ?? run.errorSummary ?? "No outcome recorded."}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {(run.techniqueIds ?? []).map((techniqueId) => (
                      <Link
                        key={techniqueId}
                        href={`/attack-techniques?technique=${encodeURIComponent(techniqueId)}`}
                        className="font-mono text-brand hover:text-brand-2"
                      >
                        {techniqueId}
                      </Link>
                    ))}
                    {run.evidenceIds.map((evidenceId) => (
                      <Link
                        key={evidenceId}
                        href={`/evidence?evidenceId=${encodeURIComponent(evidenceId)}`}
                        className="font-mono text-brand hover:text-brand-2"
                      >
                        evidence {evidenceId.slice(0, 8)}
                      </Link>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {mission.status === "Completed" || runs.some((run) => run.completedAt) ? (
        <WorkflowFeedback
          missionId={mission.missionId}
          route={`/missions/${mission.missionId}`}
          stage="Understand"
          prompt="Could you distinguish measured evidence, inference, and the next safe action?"
        />
      ) : null}
    </div>
  );
}
