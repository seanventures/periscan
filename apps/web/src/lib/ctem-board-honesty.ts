import { COMMUNITY_FIRST_RUN_WATCH_LABEL } from "@periscan/shared";

/** Empty-tenant CTEM copy — not a completeness score. */
export const CTEM_NOT_MEASURED_YET = "Not measured yet";
/** In-flight CTEM copy — Watch / Activating is not a board number. */
export const CTEM_RUN_IN_FLIGHT = "Run in flight — not a board number";
/** First measured Community result is not a CTEM program score (541). */
export const CTEM_FIRST_MEASURE_NOT_BOARD = "First measure is not a CTEM score";

export type CtemBoardHonestyMode =
  | "percent"
  | "not-measured"
  | "in-flight"
  | "first-measure";

export type CtemBoardHonesty = {
  mode: CtemBoardHonestyMode;
  showPercent: boolean;
  boardPackEnabled: boolean;
  headline: string | null;
};

function isWatchNextAction(label: string | null | undefined): boolean {
  if (!label) return false;
  if (label === COMMUNITY_FIRST_RUN_WATCH_LABEL) return true;
  return /^Watch\b/u.test(label.trim());
}

/** True only when the Revalidated milestone is Completed (a real retest). */
export function activationHasRevalidation(
  activation:
    | {
        milestones?: ReadonlyArray<{ key: string; state: string }>;
      }
    | null
    | undefined
): boolean {
  return (
    activation?.milestones?.some(
      (milestone) =>
        milestone.key === "Revalidated" && milestone.state === "Completed"
    ) ?? false
  );
}

/**
 * Board-unsafe CTEM percents: New/Activating, Watch, empty Verify-OnTrack,
 * or first measured Community result with canned Verify OnTrack (no retest).
 * Live baseline stamps Verify complete from a verification plan — that is
 * not CTEM 33 / Verify 100 after Gitleaks.
 */
export function resolveCtemBoardHonesty(input: {
  maturity?: "New" | "Activating" | "Measured" | "Operating" | null;
  nextActionLabel?: string | null;
  /** Omit or null while findings are still loading so empty is not assumed. */
  findingsCount?: number | null;
  verifyStatus?: "OnTrack" | "NeedsAttention" | "NotStarted" | null;
  /** True only after the Revalidated activation milestone is Completed. */
  revalidated?: boolean | null;
}): CtemBoardHonesty {
  const watch = isWatchNextAction(input.nextActionLabel);
  const immature =
    input.maturity === "New" || input.maturity === "Activating";
  const emptyVerifyComplete =
    input.findingsCount === 0 && input.verifyStatus === "OnTrack";
  const cannedVerifyOnTrack =
    input.verifyStatus === "OnTrack" && input.revalidated !== true;

  if (watch) {
    return {
      mode: "in-flight",
      showPercent: false,
      boardPackEnabled: false,
      headline: CTEM_RUN_IN_FLIGHT
    };
  }

  if (immature || emptyVerifyComplete) {
    return {
      mode: "not-measured",
      showPercent: false,
      boardPackEnabled: false,
      headline: CTEM_NOT_MEASURED_YET
    };
  }

  if (cannedVerifyOnTrack) {
    return {
      mode: "first-measure",
      showPercent: false,
      boardPackEnabled: false,
      headline: CTEM_FIRST_MEASURE_NOT_BOARD
    };
  }

  return {
    mode: "percent",
    showPercent: true,
    boardPackEnabled: true,
    headline: null
  };
}

export function ctemStageOccupancyLabel(
  honesty: Pick<CtemBoardHonesty, "mode" | "showPercent">,
  openItemCount: number
): string {
  if (!honesty.showPercent) {
    if (honesty.mode === "in-flight") return "in flight";
    if (honesty.mode === "first-measure") return "first measure";
    return "not measured";
  }
  return openItemCount > 0 ? `${openItemCount} open` : "clear";
}
