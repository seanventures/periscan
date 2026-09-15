import { appendUniqueIds } from "./runtime-services.js";

/**
 * Aggregate mission status + evidence from sibling validation runs.
 *
 * Hybrid compile (and any multi-module mission) queues N runs under one mission.
 * A single run/task result must never stamp the mission Completed/Failed or
 * replace mission.evidenceIds — only the sibling aggregate may close the mission
 * (mirrors apps/worker reconcileMissionStatus; extends Running to cover
 * Leased/Accepted runner states and partial Completed progress).
 */
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
  const evidenceIds = appendUniqueIds(
    [],
    runs.flatMap((run) =>
      Array.isArray(run.evidenceIds) ? [...run.evidenceIds] : []
    )
  );

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
  // Partial success (some Completed, siblings still Queued) stays Running so the
  // mission is not falsely terminal and remains cancellable.
  const hasPartialProgress = runs.some((run) => run.status === "Completed");
  const status = hasFailed
    ? "Failed"
    : allCompleted
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
