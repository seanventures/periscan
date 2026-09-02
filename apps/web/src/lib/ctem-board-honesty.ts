import { COMMUNITY_FIRST_RUN_WATCH_LABEL } from "@periscan/shared";

/** Empty-tenant CTEM copy — not a completeness score. */
export const CTEM_NOT_MEASURED_YET = "Not measured yet";
/** In-flight CTEM copy — Watch / Activating is not a board number. */
export const CTEM_RUN_IN_FLIGHT = "Run in flight — not a board number";

export type CtemBoardHonestyMode = "percent" | "not-measured" | "in-flight";

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

/**
 * Board-unsafe CTEM percents: New/Activating, Watch, or empty Verify-OnTrack
 * (live baseline stamps Verify complete from a canned verification plan).
 */
export function resolveCtemBoardHonesty(input: {
  maturity?: "New" | "Activating" | "Measured" | "Operating" | null;
  nextActionLabel?: string | null;
  /** Omit or null while findings are still loading so empty is not assumed. */
  findingsCount?: number | null;
  verifyStatus?: "OnTrack" | "NeedsAttention" | "NotStarted" | null;
}): CtemBoardHonesty {
  const watch = isWatchNextAction(input.nextActionLabel);
  const immature =
    input.maturity === "New" || input.maturity === "Activating";
  const emptyVerifyComplete =
    input.findingsCount === 0 && input.verifyStatus === "OnTrack";

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
    return honesty.mode === "in-flight" ? "in flight" : "not measured";
  }
  return openItemCount > 0 ? `${openItemCount} open` : "clear";
}
