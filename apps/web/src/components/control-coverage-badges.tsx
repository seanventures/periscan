import { StateBadge, type StateTone } from "../ui";

const COVERAGE_TONE: Record<string, StateTone> = {
  Blocked: "blocked",
  Covered: "validated",
  LoggedOnly: "approval",
  NeedsTuning: "approval",
  Stale: "approval",
  Missed: "missed",
  NoEvidence: "inconclusive",
  NotTested: "neutral"
};

const TREND_TONE: Record<string, StateTone> = {
  Improved: "fixed",
  New: "neutral",
  Regressed: "missed",
  Unchanged: "neutral"
};

export function ControlCoverageBadge({
  className,
  status
}: {
  className?: string;
  status: string;
}) {
  return (
    <StateBadge className={className} tone={COVERAGE_TONE[status] ?? "neutral"}>
      {status}
    </StateBadge>
  );
}

export function ControlCoverageTrendBadge({
  previousStatus,
  trend
}: {
  previousStatus?: string | null;
  trend: string;
}) {
  if (trend === "Unchanged") return null;

  return (
    <StateBadge tone={TREND_TONE[trend] ?? "neutral"} dot={false}>
      {trend}
      {previousStatus ? ` from ${previousStatus}` : ""}
    </StateBadge>
  );
}
