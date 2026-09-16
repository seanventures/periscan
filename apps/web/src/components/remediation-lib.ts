import type { StateTone } from "../ui";

export const REMEDIATION_STATUS_TONE: Record<string, StateTone> = {
  Open: "inconclusive",
  InProgress: "approval",
  VerificationPending: "approval",
  Fixed: "fixed",
  PartiallyFixed: "approval",
  StillExposed: "missed",
  Mitigated: "fixed",
  Inconclusive: "inconclusive",
  Reopened: "missed",
  ClosedWithoutEvidence: "inconclusive"
};

export const VERIFICATION_OUTCOME_TONE: Record<string, StateTone> = {
  Fixed: "fixed",
  PartiallyFixed: "approval",
  StillExposed: "missed",
  Mitigated: "fixed",
  Inconclusive: "inconclusive",
  Reopened: "missed",
  ClosedWithoutEvidence: "inconclusive"
};

// Rank for sorting a queue: unresolved work first, resolved last.
const STATUS_RANK: Record<string, number> = {
  StillExposed: 0,
  Reopened: 1,
  VerificationPending: 2,
  InProgress: 3,
  Open: 4,
  PartiallyFixed: 5,
  Inconclusive: 6,
  Mitigated: 7,
  Fixed: 8,
  ClosedWithoutEvidence: 9
};

export function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 5;
}

export function relTime(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const past = diff >= 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  const fmt =
    mins < 1
      ? "just now"
      : mins < 60
        ? `${mins}m`
        : mins < 1440
          ? `${Math.round(mins / 60)}h`
          : `${Math.round(mins / 1440)}d`;
  if (fmt === "just now") return fmt;
  return past ? `${fmt} ago` : `in ${fmt}`;
}

export type SlaAgeTone = "missed" | "approval" | "neutral";

/**
 * Honest SLA aging for findings / remediations.
 * Never invents a due date — call only when dueAt/slaDueAt is present.
 */
export function formatSlaAge(
  dueAt: string,
  options?: { now?: number; prefix?: string }
): { label: string; tone: SlaAgeTone; overdue: boolean; dueSoon: boolean } {
  const due = Date.parse(dueAt);
  const now = options?.now ?? Date.now();
  const prefix = options?.prefix ?? "SLA";
  if (Number.isNaN(due)) {
    return {
      label: `${prefix} date unavailable`,
      tone: "neutral",
      overdue: false,
      dueSoon: false
    };
  }
  const ms = due - now;
  const dayMs = 86_400_000;
  if (ms < 0) {
    const days = Math.max(1, Math.round(-ms / dayMs));
    return {
      label: `${prefix} overdue ${days}d`,
      tone: "missed",
      overdue: true,
      dueSoon: false
    };
  }
  if (ms < 3 * dayMs) {
    return {
      label: `${prefix} due ${relTime(dueAt)}`,
      tone: "approval",
      overdue: false,
      dueSoon: true
    };
  }
  return {
    label: `${prefix} ${new Date(dueAt).toLocaleDateString()}`,
    tone: "neutral",
    overdue: false,
    dueSoon: false
  };
}
