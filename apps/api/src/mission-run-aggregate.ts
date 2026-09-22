/**
 * Aggregate mission status + evidence from sibling validation runs.
 *
 * Hybrid compile (and any multi-module mission) queues N runs under one mission.
 * A single run/task result must never stamp the mission Completed/Failed or
 * replace mission.evidenceIds — only the sibling aggregate may close the mission
 * (mirrors apps/worker reconcileMissionStatus; extends Running to cover
 * Leased/Accepted runner states and partial Completed progress).
 *
 * First-hour unpinned Gitleaks is one run. When that run has persisted
 * evidenceIds, the parent Completes even if the row is still Running — findings
 * must not sit next to an eternal Running parent. A 41-engine pack with some
 * Completed/evidenced siblings and others still Queued/Running stays Running.
 */
const OPEN_RUN_STATUSES = new Set([
  "Accepted",
  "Leased",
  "Queued",
  "Running"
]);

function runHasPersistedEvidence(run: {
  evidenceIds?: readonly string[] | null;
}): boolean {
  return Array.isArray(run.evidenceIds) && run.evidenceIds.length > 0;
}

export function reconcileMissionAggregateFromRuns(
  runs: ReadonlyArray<{
    evidenceIds?: readonly string[] | null;
    status: string;
  }>
): {
  completedAt: Date | null;
  evidenceIds: string[];
  isTerminal: boolean;
  status: "Completed" | "Failed" | "Queued" | "Running";
} {
  const evidenceIds = [
    ...new Set(
      runs.flatMap((run) =>
        Array.isArray(run.evidenceIds) ? [...run.evidenceIds] : []
      )
    )
  ];

  if (runs.length === 0) {
    return {
      completedAt: null,
      evidenceIds,
      isTerminal: false,
      status: "Queued"
    };
  }

  const hasFailed = runs.some((run) => run.status === "Failed");
  const allCompleted = runs.every((run) => run.status === "Completed");
  const hasActive = runs.some((run) =>
    ["Running", "Leased", "Accepted"].includes(run.status)
  );
  // Partial success (some Completed, siblings still Queued without evidence)
  // stays Running so a 41-engine pack is not falsely terminal and remains
  // cancellable. A 1-engine run with evidence is not partial progress.
  const hasPartialProgress = runs.some((run) => run.status === "Completed");
  const hasOpenWithoutEvidence = runs.some(
    (run) =>
      OPEN_RUN_STATUSES.has(run.status) && !runHasPersistedEvidence(run)
  );
  const allEvidenceComplete = runs.every(
    (run) => run.status === "Completed" || runHasPersistedEvidence(run)
  );
  const status = hasFailed
    ? "Failed"
    : allCompleted || (allEvidenceComplete && !hasOpenWithoutEvidence)
      ? "Completed"
      : hasActive || hasPartialProgress
        ? "Running"
        : "Queued";
  const isTerminal = status === "Failed" || status === "Completed";

  return {
    completedAt: isTerminal ? new Date() : null,
    evidenceIds,
    isTerminal,
    status
  };
}
