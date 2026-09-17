import type { ScheduleDiff, ValidationSnapshot } from "@periscan/shared";

function getSnapshotRiskScoreTotal(snapshot: ValidationSnapshot) {
  return snapshot.topAttackPaths.reduce(
    (total, path) => total + path.risk.score,
    0
  );
}

export function buildScheduleDiff(input: {
  current: ValidationSnapshot;
  previous: ValidationSnapshot | null;
}): ScheduleDiff {
  if (!input.previous) {
    return {
      addedPathIds: input.current.topAttackPaths.map(
        ({ attackPath }) => attackPath.pathId
      ),
      currentSnapshotId: input.current.snapshotId,
      previousSnapshotId: null,
      removedPathIds: [],
      reopenedPathIds: [],
      riskScoreDelta: getSnapshotRiskScoreTotal(input.current),
      status: "NoPreviousRun",
      summary:
        "This is the first scheduled validation result for this schedule."
    };
  }

  const previousPaths = new Map(
    input.previous.topAttackPaths.map(({ attackPath }) => [
      attackPath.pathId,
      attackPath
    ])
  );
  const currentPaths = new Map(
    input.current.topAttackPaths.map(({ attackPath }) => [
      attackPath.pathId,
      attackPath
    ])
  );
  const addedPathIds = [...currentPaths.keys()].filter(
    (pathId) => !previousPaths.has(pathId)
  );
  const removedPathIds = [...previousPaths.keys()].filter(
    (pathId) => !currentPaths.has(pathId)
  );
  const reopenedPathIds = [...currentPaths.entries()]
    .filter(([pathId, currentPath]) => {
      const previousPath = previousPaths.get(pathId);

      return (
        previousPath?.validationState === "Fixed" &&
        currentPath.validationState !== "Fixed"
      );
    })
    .map(([pathId]) => pathId);
  const riskScoreDelta =
    getSnapshotRiskScoreTotal(input.current) -
    getSnapshotRiskScoreTotal(input.previous);
  const status =
    reopenedPathIds.length > 0
      ? "ReopenedRiskDetected"
      : addedPathIds.length > 0 ||
          removedPathIds.length > 0 ||
          riskScoreDelta !== 0
        ? "Changed"
        : "Unchanged";

  return {
    addedPathIds,
    currentSnapshotId: input.current.snapshotId,
    previousSnapshotId: input.previous.snapshotId,
    removedPathIds,
    reopenedPathIds,
    riskScoreDelta,
    status,
    summary:
      status === "ReopenedRiskDetected"
        ? `${reopenedPathIds.length} previously fixed path${reopenedPathIds.length === 1 ? "" : "s"} reopened.`
        : status === "Changed"
          ? `Scheduled validation changed by ${riskScoreDelta} total risk points.`
          : "Scheduled validation result is unchanged from the previous run."
  };
}
