"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  FindingDisposition,
  FindingDispositionReasonCode,
  RemediationTask,
  TenantMember,
  ValidatedFinding
} from "@periscan/shared";
import {
  FINDING_DISPOSITION_REASON_CODES,
  parseFindingDispositionReasonCode
} from "@periscan/shared";

import { projectFindingClaimDisplay } from "../lib/claim-safe-display";
import {
  browserPeriscanApiClient as api,
  type ListFindingsQuery
} from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  EmptyState,
  ErrorState,
  FilterEmpty,
  InfoPopover,
  LiveUpdatePill,
  LoadingSkeleton,
  MissingSignalCallout,
  PageHeader,
  PageShell,
  Panel,
  StateBadge,
  ValidationStateBadge,
  buttonClassName,
  cn,
  severityTone,
  type StateTone
} from "../ui";
import { RiskFactorBreakdown } from "./risk-factor-breakdown";
import { ProofLoopContext } from "./proof-loop-context";
import { ProofStageStrip } from "./proof-stage-strip";
import { formatSlaAge } from "./remediation-lib";

const SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Informational"];

// Finding STATUS is workflow state, not proof-strength. "Validated" means a
// confirmed, still-open exposure — attention, never success-green (reserved
// for Fixed / Revalidated).
const STATUS_TONE: Record<string, StateTone> = {
  New: "inconclusive",
  Validated: "approval",
  Routed: "blocked",
  InProgress: "approval",
  Fixed: "fixed",
  Revalidated: "fixed",
  Reopened: "missed",
  NeedsReview: "approval",
  Inconclusive: "inconclusive"
};

const EXPLOIT_TONE: Record<string, StateTone> = {
  Unknown: "neutral",
  NotReachable: "inconclusive",
  Reachable: "approval",
  Validated: "validated",
  Exploitable: "missed",
  Blocked: "blocked",
  Inconclusive: "inconclusive"
};

const OBJECTIVE_TONE: Record<string, StateTone> = {
  Reached: "missed",
  Blocked: "blocked",
  NotReached: "validated",
  Unknown: "inconclusive"
};

const DISPOSITION_TONE: Record<string, StateTone> = {
  Acknowledged: "inconclusive",
  Escalated: "missed",
  AcceptedRisk: "approval",
  FalsePositive: "neutral",
  Suppressed: "blocked"
};
const DISPOSITIONS = [
  "Acknowledged",
  "Escalated",
  "AcceptedRisk",
  "FalsePositive",
  "Suppressed"
] as const;
const DISPOSITION_LABEL: Record<string, string> = {
  Acknowledged: "Acknowledged",
  Escalated: "Escalated",
  AcceptedRisk: "Accepted risk",
  FalsePositive: "False positive",
  Suppressed: "Suppressed"
};
/**
 * Hop measurement honesty for path-linked findings (Wave A / A7).
 * Prefer structured pathProof counts; never invent FullyMeasured without them.
 */
function formatFindingHopFraction(
  finding: ValidatedFinding
): string | null {
  const proof = finding.pathProof;
  if (
    proof &&
    typeof proof.measuredEdgeCount === "number" &&
    typeof proof.totalEdgeCount === "number"
  ) {
    if (proof.totalEdgeCount === 0) {
      return "0/0 hops · no edges to measure";
    }
    const base = `${proof.measuredEdgeCount}/${proof.totalEdgeCount} hops measured`;
    if (proof.fullyMeasured) {
      return `${base} · fully measured`;
    }
    if (proof.measuredEdgeCount > 0) {
      return `${base} · partial`;
    }
    return `${base} · hypothesis`;
  }
  if (finding.relatedPathIds.length > 0 && finding.sourceEntityType === "AttackPath") {
    return "path-linked · hop fraction pending receipts";
  }
  return null;
}

const REASON_CODE_LABEL: Record<FindingDispositionReasonCode, string> = {
  OutOfScope: "Out of scope",
  DuplicateObservation: "Duplicate observation",
  Benign: "Benign",
  Lab: "Lab / test traffic",
  ToolNoise: "Tool noise",
  Other: "Other"
};
/** Server page size — advance offset while page.hasMore (P06-2). */
const PAGE_SIZE = 50;

function needsDispositionReason(
  disposition: FindingDisposition | "" | null
): boolean {
  return disposition === "FalsePositive" || disposition === "Suppressed";
}

/** Dispositions that leave the Active triage queue (noise / closed handling). */
const ACTIVE_EXCLUDED_DISPOSITIONS = ["FalsePositive", "Suppressed"] as const;
const ACTIVE_EXCLUDE_DISPOSITION_QUERY = ACTIVE_EXCLUDED_DISPOSITIONS.join(",");
const SEARCH_DEBOUNCE_MS = 250;

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function readMissionIdFromLocation(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = new URLSearchParams(window.location.search).get("missionId");
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/** Mono-truncated cause fingerprint for the triage queue (UX-W6 / punch 134). */
function shortFingerprint(fingerprint: string, max = 12): string {
  return fingerprint.length > max ? fingerprint.slice(0, max) : fingerprint;
}

/** Compact occurrence window for triage rows (ICP-P2-2). */
function formatSeenWindow(
  firstSeenAt: string | null | undefined,
  lastSeenAt: string | null | undefined
): string | null {
  if (!firstSeenAt && !lastSeenAt) return null;
  const fmt = (value: string) => {
    try {
      return new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      });
    } catch {
      return value.slice(0, 10);
    }
  };
  if (firstSeenAt && lastSeenAt) {
    if (firstSeenAt.slice(0, 10) === lastSeenAt.slice(0, 10)) {
      return `seen ${fmt(lastSeenAt)}`;
    }
    return `${fmt(firstSeenAt)} → ${fmt(lastSeenAt)}`;
  }
  if (lastSeenAt) return `last ${fmt(lastSeenAt)}`;
  return `first ${fmt(firstSeenAt!)}`;
}

/**
 * Operational ownership for Priority · unowned:
 * - remediation-projected ownerId / ownerDisplay
 * - non-AcceptedRisk disposition assignee (queue handoff)
 * AcceptedRisk disposition.ownerId is risk acceptor only — still unowned.
 */
function isUnownedFinding(finding: ValidatedFinding): boolean {
  if (finding.ownerId || finding.ownerDisplay?.trim()) {
    return false;
  }
  const disposition = finding.disposition;
  if (
    disposition?.ownerId &&
    disposition.disposition !== "AcceptedRisk"
  ) {
    return false;
  }
  return true;
}

export function FindingsWorkbench() {
  const members = useApiResource(() => api.listTenantMembers(), []);
  const session = useApiResource(() => api.getMe(), []);
  // Light detection-eng feedback strip (P18 disposition-feedback client usage).
  const dispositionFeedback = useApiResource(
    () => api.listDispositionFeedback(),
    []
  );
  const [query, setQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [disposition, setDisposition] = useState("all");
  const [missionId, setMissionId] = useState<string | null>(
    readMissionIdFromLocation
  );
  // Default Active excludes FP/Suppressed so shift start is not a noise dump.
  const [savedView, setSavedView] = useState("active");
  const [copiedView, setCopiedView] = useState(false);
  const urlReady = useRef(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Server offset (0-based); Next advances by PAGE_SIZE while hasMore. */
  const [offset, setOffset] = useState(0);
  const [bulkDisposition, setBulkDisposition] = useState<
    FindingDisposition | ""
  >("");
  const [bulkNote, setBulkNote] = useState("");
  const [bulkReasonCode, setBulkReasonCode] = useState<
    FindingDispositionReasonCode | ""
  >("");
  const [bulkOwnerId, setBulkOwnerId] = useState("");
  const [bulkExpiresAt, setBulkExpiresAt] = useState("");
  /** FP/Suppressed: mute cause fingerprint (server default on). ICP-P1-1. */
  const [bulkApplyToFingerprint, setBulkApplyToFingerprint] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [sarifBusy, setSarifBusy] = useState(false);
  const [sarifError, setSarifError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  // Server-side filters so limit/offset pages are not dominated by noise the
  // Active view would have dropped client-side after a full pull.
  const listQuery = useMemo((): ListFindingsQuery => {
    const next: ListFindingsQuery = {
      limit: PAGE_SIZE,
      offset
    };

    if (severity !== "all") {
      next.severity = severity;
    }
    if (status !== "all") {
      next.status = status as ListFindingsQuery["status"];
    }
    if (disposition !== "all") {
      next.disposition = disposition;
    } else if (
      savedView === "active" ||
      savedView === "priority-unowned" ||
      savedView === "my-queue"
    ) {
      // Operational queues drop FP/Suppressed noise unless the operator picked
      // a disposition filter explicitly (P18-2).
      next.excludeDisposition = ACTIVE_EXCLUDE_DISPOSITION_QUERY;
    }
    if (savedView === "priority-unowned") {
      next.priorityMin = 70;
      // Server-side unowned uses operational ownership (remediation + non-AR assignee).
      next.owner = "unassigned";
    }
    if (savedView === "my-queue") {
      // My queue = findings assigned to the signed-in member (operational owner).
      const me = session.data?.user.userId;
      if (me) {
        next.owner = me;
      }
    }
    if (debouncedSearch) {
      next.search = debouncedSearch;
    }
    if (missionId) {
      next.missionId = missionId;
    }

    return next;
  }, [
    debouncedSearch,
    disposition,
    missionId,
    offset,
    savedView,
    session.data?.user.userId,
    severity,
    status
  ]);

  const findings = useApiResource(
    () => api.listFindingsPage(listQuery),
    [listQuery],
    {
      refetchIntervalMs: 45_000
    }
  );

  const all = findings.data?.items ?? [];
  const hasFindings = all.length > 0;
  const pageMeta = findings.data?.page;

  const severities = useMemo(
    () => SEVERITY_ORDER.filter((s) => all.some((f) => f.severity === s)),
    [all]
  );
  const statuses = useMemo(
    () => Array.from(new Set(all.map((f) => f.status))).sort(),
    [all]
  );

  const severityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of all)
      counts.set(f.severity, (counts.get(f.severity) ?? 0) + 1);
    return counts;
  }, [all]);

  const filtered = useMemo(() => {
    // Severity/status/disposition/search/Active exclude are applied server-side.
    // Keep lightweight client predicates for operational ownership views and as
    // a safety net while search debounce catches up.
    const q = query.trim().toLowerCase();
    const me = session.data?.user.userId;
    return [...all]
      .filter((f) => {
        if (savedView === "priority-unowned") {
          return isUnownedFinding(f);
        }
        if (savedView === "my-queue" && me) {
          if (f.ownerId === me) return true;
          // Non-AcceptedRisk disposition assignee counts as My queue ownership.
          const d = f.disposition;
          return Boolean(
            d?.ownerId === me && d.disposition !== "AcceptedRisk"
          );
        }
        return true;
      })
      .filter(
        (f) =>
          !q ||
          `${f.title} ${f.impact} ${f.remediation}`.toLowerCase().includes(q)
      )
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }, [all, query, savedView, session.data?.user.userId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (view === "priority-unowned" || view === "my-queue") {
      setSavedView(view);
    } else if (view === "new-untriaged") {
      setSavedView(view);
      setStatus("New");
      setDisposition("none");
    } else if (view === "reopened") {
      setSavedView(view);
      setStatus("Reopened");
    } else if (view === "all") {
      setSavedView("all");
    } else if (view === "active" || !view) {
      setSavedView("active");
    }
    setQuery(params.get("q") ?? "");
    setSeverity(params.get("severity") ?? "all");
    setStatus((current) => params.get("status") ?? current);
    setDisposition((current) => params.get("disposition") ?? current);
    const scopedMissionId = params.get("missionId")?.trim() ?? "";
    setMissionId(scopedMissionId.length > 0 ? scopedMissionId : null);
    urlReady.current = true;
  }, []);

  useEffect(() => {
    if (!urlReady.current) return;
    const params = new URLSearchParams();
    // Active is the default landing — omit view= for a clean /findings URL.
    if (savedView !== "active" && savedView !== "custom") {
      params.set("view", savedView);
    }
    if (query.trim()) params.set("q", query.trim());
    if (severity !== "all") params.set("severity", severity);
    if (status !== "all") params.set("status", status);
    if (disposition !== "all") params.set("disposition", disposition);
    if (missionId) params.set("missionId", missionId);
    const queryString = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${queryString ? `?${queryString}` : ""}`
    );
  }, [disposition, missionId, query, savedView, severity, status]);

  function applySavedView(view: string) {
    setSavedView(view);
    setQuery("");
    setSeverity("all");
    setStatus(
      view === "new-untriaged"
        ? "New"
        : view === "reopened"
          ? "Reopened"
          : "all"
    );
    setDisposition(view === "new-untriaged" ? "none" : "all");
  }

  async function copyView() {
    await navigator.clipboard.writeText(window.location.href);
    setCopiedView(true);
    window.setTimeout(() => setCopiedView(false), 1500);
  }

  useEffect(() => {
    setOffset(0);
    setSelected(new Set());
  }, [disposition, query, savedView, severity, status]);

  // Server already pages; client only applies lightweight operational ownership
  // safety nets on the current page.
  const visible = filtered;
  const allVisibleSelected =
    visible.length > 0 &&
    visible.every((finding) => selected.has(finding.findingId));
  const hasMore = pageMeta?.hasMore === true;
  const pageLimit = pageMeta?.limit ?? PAGE_SIZE;
  const pageOffset = pageMeta?.offset ?? offset;
  const rangeStart = all.length === 0 ? 0 : pageOffset + 1;
  const rangeEnd = pageOffset + all.length;

  // ICP 5.0 residual: dual-pane keyboard — ArrowUp/Down move selection, Escape clears.
  // Skip when focus is in form fields so filters/disposition still type normally.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (event.key === "Escape" && expanded) {
        event.preventDefault();
        setExpanded(null);
        return;
      }
      if (!expanded || visible.length === 0) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const idx = visible.findIndex((f) => f.findingId === expanded);
      if (idx < 0) return;
      const nextIdx =
        event.key === "ArrowDown"
          ? Math.min(visible.length - 1, idx + 1)
          : Math.max(0, idx - 1);
      const nextId = visible[nextIdx]?.findingId;
      if (!nextId || nextId === expanded) return;
      setExpanded(nextId);
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-finding-row="${nextId}"]`)
          ?.focus();
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded, visible]);

  const governedAcceptances = useMemo(
    () =>
      all
        .filter(
          (finding) => finding.disposition?.disposition === "AcceptedRisk"
        )
        .sort(
          (left, right) =>
            new Date(left.disposition?.expiresAt ?? 0).getTime() -
            new Date(right.disposition?.expiresAt ?? 0).getTime()
        ),
    [all]
  );

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const finding of visible) next.delete(finding.findingId);
      } else {
        for (const finding of visible) next.add(finding.findingId);
      }
      return next;
    });
  }

  async function applyBulk() {
    if (!bulkDisposition || selected.size === 0) return;
    if (
      bulkDisposition === "AcceptedRisk" &&
      (!bulkOwnerId || !bulkExpiresAt)
    ) {
      setBulkError("Accepted risk requires an owner and expiry.");
      setBulkStatus(null);
      return;
    }
    if (needsDispositionReason(bulkDisposition) && !bulkReasonCode) {
      setBulkError(
        "False positive and suppressed require a reason code (e.g. ToolNoise)."
      );
      setBulkStatus(null);
      return;
    }
    const count = selected.size;
    const dispositionLabel =
      DISPOSITION_LABEL[bulkDisposition] ?? bulkDisposition;
    setBulkBusy(true);
    setBulkError(null);
    setBulkStatus(null);
    try {
      await Promise.all(
        [...selected].map((findingId) =>
          api.transitionFinding(findingId, {
            disposition: bulkDisposition,
            expiresAt:
              (bulkDisposition === "AcceptedRisk" ||
                bulkDisposition === "Suppressed") &&
              bulkExpiresAt
                ? new Date(`${bulkExpiresAt}T23:59:59`).toISOString()
                : undefined,
            note: bulkNote.trim() || undefined,
            // Optional owner on any disposition (P06-3); required for AcceptedRisk.
            ownerId: bulkOwnerId || undefined,
            reasonCode: bulkReasonCode || undefined,
            // Fingerprint mute for FP/Suppressed (ICP-P1-1); server defaults true.
            ...(needsDispositionReason(bulkDisposition)
              ? { applyToFingerprint: bulkApplyToFingerprint }
              : {})
          })
        )
      );
      setSelected(new Set());
      setBulkDisposition("");
      setBulkNote("");
      setBulkReasonCode("");
      setBulkOwnerId("");
      setBulkExpiresAt("");
      setBulkApplyToFingerprint(true);
      const muteNote =
        needsDispositionReason(bulkDisposition) && bulkApplyToFingerprint
          ? " Fingerprint mute applied where fingerprints were present."
          : needsDispositionReason(bulkDisposition)
            ? " Fingerprint mute was off — selected findings only."
            : "";
      setBulkStatus(
        `Applied ${dispositionLabel} to ${count} finding${count === 1 ? "" : "s"}.${muteNote}`
      );
      await Promise.all([findings.refetch(), dispositionFeedback.refetch()]);
    } catch (caught) {
      setBulkError(
        caught instanceof Error ? caught.message : "Bulk update failed."
      );
    } finally {
      setBulkBusy(false);
    }
  }

  async function refreshFindingsAndFeedback() {
    await Promise.all([findings.refetch(), dispositionFeedback.refetch()]);
  }

  function exportCsv() {
    const quote = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [
      [
        "finding_id",
        "title",
        "severity",
        "priority",
        "status",
        "validation_state",
        "disposition",
        "approval_state",
        "expires_at",
        "evidence_count",
        "fingerprint",
        "occurrence_count",
        "first_seen_at",
        "last_seen_at",
        "root_cause_summary",
        "owner_display",
        "owner_id"
      ],
      ...filtered.map((finding) => [
        finding.findingId,
        finding.title,
        finding.severity,
        finding.priorityScore,
        finding.status,
        projectFindingClaimDisplay(finding).displayValidationState,
        finding.disposition?.disposition ?? "",
        finding.disposition?.approvalState ?? "",
        finding.disposition?.expiresAt ?? "",
        finding.evidenceIds.length,
        finding.fingerprint ?? "",
        finding.occurrenceCount ?? 1,
        finding.firstSeenAt ?? "",
        finding.lastSeenAt ?? "",
        finding.rootCauseSummary ?? "",
        finding.ownerDisplay ?? "",
        finding.ownerId ?? ""
      ])
    ].map((row) => row.map(quote).join(","));
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `periscan-findings-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportSarif() {
    setSarifBusy(true);
    setSarifError(null);
    try {
      const payload = await api.fetchFindingsSarif(
        missionId ? { missionId } : {}
      );
      const url = URL.createObjectURL(
        new Blob([payload.content], { type: payload.contentType })
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payload.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setSarifError(
        error instanceof Error
          ? error.message
          : "Unable to export findings SARIF"
      );
    } finally {
      setSarifBusy(false);
    }
  }

  return (
    <PageShell
      role="region"
      aria-label="Findings workbench"
      data-testid="findings-workbench"
    >
      <PageHeader
        eyebrow="Investigate"
        title="Findings"
        description="Prioritize validated exposure in one evidence-backed results layer, assign a disposition, and route the work that needs action."
        actions={
          <Link
            href="/missions"
            data-testid="findings-header-primary-cta"
            className={buttonClassName({ size: "md", variant: "primary" })}
          >
            Run a Validation Snapshot
          </Link>
        }
        meta={
          <div className="flex flex-col gap-2">
            <details className="max-w-2xl text-[11px] text-subtle">
              <summary className="w-fit cursor-pointer text-brand hover:text-brand-2">
                How this queue works
              </summary>
              <p className="mt-1">
                The /api/v1/findings API links validation state, priority factors,
                attack paths, remediation, and evidence. Raw scanner output stays
                in technical appendices rather than this operator queue.
              </p>
            </details>
            <div className="flex flex-wrap items-center gap-2">
              {missionId ? (
                <span
                  data-testid="findings-community-mission-chip"
                  className="rounded-pill border border-brand/40 bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand"
                >
                  This Community mission
                </span>
              ) : null}
              <LiveUpdatePill
                lastUpdatedAt={findings.lastUpdatedAt}
                refreshing={findings.refreshing}
              />
            </div>
          </div>
        }
      />

      {/* UX-W8 proof-stage chips. Empty queue omits hop next-action. */}
      <ProofStageStrip
        stage="Understand"
        basis={null}
        showOwner={false}
        nextCta={
          hasFindings
            ? { href: "/attack-paths", label: "Measure path hops" }
            : null
        }
      />

      {/* Severity distribution — clickable filter chips (ICP-P2-2). */}
      {all.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Severity distribution"
        >
          <span className="font-mono text-xs text-subtle">
            {all.length} finding{all.length === 1 ? "" : "s"}
            {severity !== "all" ? " (page)" : ""}
          </span>
          {severities.map((sev) => {
            const active = severity === sev;
            return (
              <button
                key={sev}
                type="button"
                aria-pressed={active}
                aria-label={`Filter severity ${sev} (${severityCounts.get(sev) ?? 0})`}
                data-testid={`findings-severity-chip-${sev}`}
                onClick={() => {
                  setSeverity(active ? "all" : sev);
                  setSavedView("custom");
                  setOffset(0);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active
                    ? "border-brand bg-brand/15 shadow-[inset_0_0_0_1px_rgba(60,150,255,0.35)]"
                    : "border-transparent hover:border-line"
                )}
              >
                <StateBadge tone={severityTone(sev)} dot={false}>
                  {sev}
                </StateBadge>
                <span className="font-mono text-xs text-muted">
                  {severityCounts.get(sev)}
                </span>
              </button>
            );
          })}
          {severity !== "all" ? (
            <button
              type="button"
              onClick={() => {
                // Select all currently visible rows matching the severity filter.
                setSelected(
                  new Set(
                    visible
                      .filter((f) => f.severity === severity)
                      .map((f) => f.findingId)
                  )
                );
              }}
              data-testid="findings-select-matching-severity"
              className="text-xs font-semibold text-brand hover:text-brand-2"
            >
              Select matching
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Hide detection-eng strip when the findings queue is empty. */}
      {hasFindings && dispositionFeedback.error ? (
        <div
          role="status"
          aria-label="Disposition feedback summary"
          className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-elevated px-3 py-2 text-[12px] text-muted"
        >
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Detection-eng feedback
          </span>
          <span className="text-subtle">
            Summary unavailable — open Blue shift for program health.
          </span>
          <Link
            href="/shift"
            className="ml-auto text-xs font-semibold text-brand hover:text-brand-2"
          >
            Blue shift →
          </Link>
        </div>
      ) : hasFindings && dispositionFeedback.data ? (
        <div
          role="status"
          aria-label="Disposition feedback summary"
          className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-elevated px-3 py-2 text-[12px] text-muted"
        >
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Detection-eng feedback
          </span>
          <span>
            FP {dispositionFeedback.data.totalFalsePositive} · Suppressed{" "}
            {dispositionFeedback.data.totalSuppressed}
          </span>
          {dispositionFeedback.data.byReason.length === 0 ? (
            <span className="text-subtle">
              No FP/Suppressed reason codes yet — require a reason on dispose.
            </span>
          ) : (
            dispositionFeedback.data.byReason.slice(0, 5).map((row) => (
              <span
                key={row.reasonCode ?? "unspecified"}
                className="rounded-pill border border-line bg-surface px-2 py-0.5 text-[11px] text-ink"
              >
                {row.reasonCode ?? "Unspecified"} ×{row.count}
              </span>
            ))
          )}
          <Link
            href="/shift"
            className="ml-auto text-xs font-semibold text-brand hover:text-brand-2"
          >
            Blue shift →
          </Link>
        </div>
      ) : null}

      {/* Filters — UX-W6 / punch 135: Active is default; exclude FP/Suppressed. */}
      <div
        className="flex flex-wrap items-center gap-2"
        aria-label="Saved finding views"
      >
        <span className="mr-1 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
          Views
        </span>
        {(
          [
            ["active", "Active"],
            ["all", "All"],
            ["priority-unowned", "Priority · unowned"],
            ["my-queue", "My queue"],
            ["new-untriaged", "New · untriaged"],
            ["reopened", "Reopened"]
          ] as const
        ).map(([value, label]) => {
          const selected = savedView === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              data-selected={selected ? "true" : "false"}
              data-testid={
                value === "active" ? "findings-view-active" : undefined
              }
              onClick={() => applySavedView(value)}
              className={cn(
                "rounded-pill border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                selected
                  ? "border-brand bg-brand/25 font-semibold text-brand shadow-[inset_0_0_0_1px_rgba(60,150,255,0.45)]"
                  : "border-line text-muted hover:border-line-strong hover:text-ink"
              )}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={copyView}
          className="ml-auto text-xs font-semibold text-brand hover:text-brand-2"
        >
          {copiedView ? "Link copied" : "Copy view link"}
        </button>
      </div>
      {savedView === "active" ? (
        <p
          className="text-[11px] text-subtle"
          data-testid="findings-active-filter-note"
        >
          Active is the default triage queue — False positive and Suppressed
          are excluded until you open All or set Disposition.
        </p>
      ) : null}

      {/* P09: phone collapses severity/status/disposition filters behind
          Filters; md+ always shows the full row (CSS force-open body). */}
      <details
        data-testid="findings-filters-details"
        className="findings-filters-details rounded-control border border-line bg-surface/40 px-3 py-1 md:border-0 md:bg-transparent md:px-0 md:py-0"
      >
        <summary
          className="cursor-pointer list-none py-2 text-sm font-semibold text-brand marker:content-none md:hidden [&::-webkit-details-marker]:hidden"
          data-testid="findings-filters-summary"
        >
          Filters
        </summary>
        <div
          className="findings-filters-body flex flex-wrap items-center gap-2 pb-2 pt-1 md:pb-0 md:pt-0"
          data-testid="findings-filters-body"
        >
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSavedView("custom");
            }}
            placeholder="Search title, impact, remediation…"
            aria-label="Search findings by title, impact, or remediation"
            className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand md:max-w-xs"
          />
          <FilterSelect
            label="Severity"
            value={severity}
            onChange={(value) => {
              setSeverity(value);
              setSavedView("custom");
            }}
            options={severities.length > 0 ? severities : SEVERITY_ORDER}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setSavedView("custom");
            }}
            options={
              statuses.length > 0 ? statuses : Object.keys(STATUS_TONE).sort()
            }
          />
          <FilterSelect
            label="Disposition"
            value={disposition}
            onChange={(value) => {
              setDisposition(value);
              setSavedView("custom");
            }}
            options={[
              { label: "New / un-dispositioned", value: "none" },
              ...DISPOSITIONS.map((value) => ({
                label: DISPOSITION_LABEL[value] ?? value,
                value
              }))
            ]}
          />
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void exportSarif()}
            disabled={sarifBusy}
            aria-busy={sarifBusy || undefined}
            aria-describedby="findings-sarif-honesty"
            data-testid="findings-export-sarif"
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {sarifBusy ? "Exporting SARIF…" : "Export SARIF (evidence-backed)"}
          </button>
          <p
            id="findings-sarif-honesty"
            data-testid="findings-sarif-honesty"
            className="text-[11px] text-subtle"
          >
            Not a certification or pentest.
          </p>
        </div>
      </details>
      {sarifError ? (
        <p
          role="alert"
          data-testid="findings-sarif-error"
          className="text-sm text-missed"
        >
          {sarifError}
        </p>
      ) : null}

      {governedAcceptances.length > 0 ? (
        <div className="rounded-card border border-line bg-surface px-4 py-3">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Risk acceptance governance
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
            {(["Pending", "Approved", "Expired"] as const).map((state) => (
              <span
                key={state}
                className="rounded-control border border-line px-2 py-1"
              >
                {state} ·{" "}
                {
                  governedAcceptances.filter(
                    (finding) => finding.disposition?.approvalState === state
                  ).length
                }
              </span>
            ))}
          </div>
          <ul className="mt-3 list-none divide-y divide-line border-t border-line">
            {governedAcceptances.slice(0, 5).map((finding) => (
              <li
                key={finding.findingId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(finding.findingId)}
                  className="min-w-0 flex-1 truncate text-left font-medium text-ink hover:text-brand"
                >
                  {finding.title}
                </button>
                <span className="text-muted">
                  {finding.disposition?.approvalState}
                </span>
                <span className="text-subtle">
                  {finding.disposition?.expiresAt
                    ? `expires ${new Date(finding.disposition.expiresAt).toLocaleDateString()}`
                    : "expiry missing"}
                </span>
              </li>
            ))}
          </ul>
          {governedAcceptances.length > 5 ? (
            <p className="mt-2 text-[11px] text-subtle">
              Showing the five soonest expiries of {governedAcceptances.length}{" "}
              accepted-risk decisions.
            </p>
          ) : null}
        </div>
      ) : null}

      {bulkStatus ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-control border border-fixed/30 bg-fixed/5 px-3 py-2 text-sm text-fixed"
        >
          {bulkStatus}
        </p>
      ) : null}

      {selected.size > 0 ? (
        <div
          data-testid="findings-bulk-bar"
          className="sticky top-2 z-20 rounded-card border border-brand/40 bg-elevated p-3 shadow-lg sm:p-3.5"
        >
          {/* Thumb-first bulk bar: larger selects/buttons (min 44px touch) on phone */}
          <div className="flex flex-wrap items-end gap-2.5">
            <p className="mr-auto self-center text-sm font-medium text-ink">
              {selected.size} selected
            </p>
            <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted">
              Bulk disposition
              <select
                value={bulkDisposition}
                onChange={(event) => {
                  const next = event.target.value as FindingDisposition | "";
                  setBulkDisposition(next);
                  if (!needsDispositionReason(next)) {
                    setBulkReasonCode("");
                  }
                }}
                className="min-h-11 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink sm:min-h-9 sm:py-1.5"
              >
                <option value="">Select…</option>
                {DISPOSITIONS.map((disposition) => (
                  <option key={disposition} value={disposition}>
                    {DISPOSITION_LABEL[disposition]}
                  </option>
                ))}
              </select>
            </label>
            {needsDispositionReason(bulkDisposition) ? (
              <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted">
                Reason code
                <select
                  value={bulkReasonCode}
                  onChange={(event) =>
                    setBulkReasonCode(
                      event.target.value as FindingDispositionReasonCode | ""
                    )
                  }
                  aria-label="Bulk disposition reason code"
                  className="min-h-11 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink sm:min-h-9 sm:py-1.5"
                >
                  <option value="">Select reason…</option>
                  {FINDING_DISPOSITION_REASON_CODES.map((code) => (
                    <option key={code} value={code}>
                      {REASON_CODE_LABEL[code]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex min-w-44 flex-1 flex-col gap-1 text-xs text-muted">
              Shared note
              <input
                value={bulkNote}
                onChange={(event) => setBulkNote(event.target.value)}
                placeholder={
                  needsDispositionReason(bulkDisposition)
                    ? "Optional detail"
                    : "Optional note"
                }
                className="min-h-11 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink sm:min-h-9 sm:py-1.5"
              />
            </label>
            {bulkDisposition ? (
              <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted">
                {bulkDisposition === "AcceptedRisk"
                  ? "Risk owner"
                  : "Queue owner (optional)"}
                <select
                  value={bulkOwnerId}
                  onChange={(event) => setBulkOwnerId(event.target.value)}
                  className="min-h-11 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink sm:min-h-9 sm:py-1.5"
                >
                  <option value="">
                    {bulkDisposition === "AcceptedRisk"
                      ? "Select owner…"
                      : "Unassigned"}
                  </option>
                  {(members.data ?? []).map((member) => (
                    <option
                      key={member.user.userId}
                      value={member.user.userId}
                    >
                      {member.user.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {bulkDisposition === "AcceptedRisk" ||
            bulkDisposition === "Suppressed" ? (
              <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted">
                {bulkDisposition === "AcceptedRisk"
                  ? "Expires"
                  : "Revisit on (optional)"}
                <input
                  type="date"
                  value={bulkExpiresAt}
                  onChange={(event) => setBulkExpiresAt(event.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  aria-label={
                    bulkDisposition === "AcceptedRisk"
                      ? "Expires"
                      : "Suppress revisit date"
                  }
                  className="min-h-11 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink sm:min-h-9 sm:py-1.5"
                />
              </label>
            ) : null}
            {needsDispositionReason(bulkDisposition) ? (
              <label className="flex min-h-11 items-center gap-2.5 self-end pb-1 text-xs text-muted sm:min-h-0 sm:pb-1.5">
                <input
                  type="checkbox"
                  checked={bulkApplyToFingerprint}
                  onChange={(event) =>
                    setBulkApplyToFingerprint(event.target.checked)
                  }
                  aria-label="Mute fingerprint (default on)"
                  data-testid="bulk-mute-fingerprint"
                  className="size-5 sm:size-4"
                />
                <span>
                  Mute fingerprint
                  <span className="text-subtle"> (default on)</span>
                </span>
              </label>
            ) : null}
            <button
              type="button"
              onClick={applyBulk}
              disabled={
                bulkBusy ||
                !bulkDisposition ||
                (bulkDisposition === "AcceptedRisk" &&
                  (!bulkOwnerId || !bulkExpiresAt)) ||
                (needsDispositionReason(bulkDisposition) && !bulkReasonCode)
              }
              className={buttonClassName({
                size: "md",
                variant: "primary",
                className: "min-h-11 min-w-[5.5rem] sm:min-h-9"
              })}
            >
              {bulkBusy ? "Applying…" : "Apply"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
              className={buttonClassName({
                size: "md",
                variant: "ghost",
                className: "min-h-11 sm:min-h-9"
              })}
            >
              Clear
            </button>
          </div>
          {bulkDisposition === "AcceptedRisk" ? (
            <p className="mt-2 text-[11px] text-subtle">
              Requests remain pending until a different tenant member approves
              them.
            </p>
          ) : null}
          {bulkDisposition === "Suppressed" ? (
            <p className="mt-2 text-[11px] text-subtle">
              Optional revisit clears the suppress when the date passes — not a
              dual-control risk accept, and never claims Fixed.
            </p>
          ) : null}
          {needsDispositionReason(bulkDisposition) &&
          bulkApplyToFingerprint ? (
            <p className="mt-2 text-[11px] text-subtle">
              Fingerprint mute applies the same disposition to sibling findings
              that share the cause fingerprint.
            </p>
          ) : needsDispositionReason(bulkDisposition) ? (
            <p className="mt-2 text-[11px] text-subtle">
              Mute fingerprint is off — only the selected findings are
              dispositioned; siblings stay in the queue.
            </p>
          ) : null}
          {bulkError ? (
            <p role="alert" className="mt-2 text-xs text-missed">
              {bulkError}
            </p>
          ) : null}
        </div>
      ) : null}

      {(() => {
        const listBody = findings.loading ? (
          /* UX-W7/#49: list-row skeleton; count ≈ first-screen queue (not PAGE_SIZE). */
          <LoadingSkeleton
            rows={8}
            variant="rows"
            label="Loading findings…"
          />
        ) : findings.error ? (
          <ErrorState message={findings.error} onRetry={findings.refetch} />
        ) : all.length === 0 ? (
          <div className="p-4" data-testid="findings-empty">
            {/* P09 mid-market: one primary CTA only — no competing secondary buttons. */}
            <EmptyState
              title="No findings yet"
              description="Findings appear here once a validation run correlates evidence to an exposure. Empty is NotConfigured program state — not a clean bill of health."
              action={
                <Link
                  href="/missions"
                  data-testid="findings-empty-primary-cta"
                  className={buttonClassName({
                    size: "md",
                    variant: "primary",
                    className: "min-h-11 px-4 py-2.5"
                  })}
                >
                  Run a Validation Snapshot
                </Link>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <FilterEmpty
            title="No findings match these filters"
            description="Try another saved view, severity, or search term."
          />
        ) : (
          <div className="ps-table ps-table--compact">
            <div className="ps-table__header">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleVisible}
                aria-label="Select all findings on this page"
              />
              <span>Select page</span>
            </div>
            <ul className="m-0 list-none p-0">
              {visible.map((finding) => (
                <FindingRow
                  key={finding.findingId}
                  finding={finding}
                  selected={selected.has(finding.findingId)}
                  open={expanded === finding.findingId}
                  compact={Boolean(expanded)}
                  onSelected={(checked) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (checked) next.add(finding.findingId);
                      else next.delete(finding.findingId);
                      return next;
                    })
                  }
                  onToggle={() =>
                    setExpanded((cur) =>
                      cur === finding.findingId ? null : finding.findingId
                    )
                  }
                />
              ))}
            </ul>
            {offset > 0 || hasMore || all.length > 0 ? (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
                <span>
                  Showing {rangeStart}–{rangeEnd}
                  {hasMore ? " of many+" : ""}
                  {" · "}
                  {pageLimit} per page
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setOffset((value) => Math.max(0, value - PAGE_SIZE))
                    }
                    disabled={offset === 0}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset((value) => value + PAGE_SIZE)}
                    disabled={!hasMore}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );

        const selectedFinding =
          expanded == null
            ? null
            : (visible.find((finding) => finding.findingId === expanded) ??
              all.find((finding) => finding.findingId === expanded) ??
              null);

        // ICP-P1-2 / UX-W14: lg+ dual-pane (list | sticky detail). Below lg the
        // grid stacks (mobile fallback); row expand still drives selection.
        // ArrowUp/Down + Escape handle keyboard selection (see effect above).
        if (selectedFinding) {
          return (
            <div
              data-testid="findings-dual-pane"
              className="grid gap-4 pb-28 lg:grid-cols-[minmax(20rem,23.75rem)_minmax(0,1fr)] lg:items-start lg:pb-0"
              aria-keyshortcuts="ArrowUp ArrowDown Escape"
            >
              <Panel className="min-w-0 overflow-hidden lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                {listBody}
              </Panel>
              <Panel
                className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-5.5rem)] lg:overflow-y-auto"
                id={`finding-panel-${selectedFinding.findingId}`}
                role="region"
                aria-label={selectedFinding.title}
                aria-keyshortcuts="ArrowUp ArrowDown Escape"
                data-testid="findings-detail-pane"
              >
                <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
                      Selected finding
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-ink">
                      {selectedFinding.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted">
                      Keys: ↑/↓ next · Esc clear
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded(null)}
                    className={buttonClassName({
                      size: "sm",
                      variant: "ghost",
                      className:
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    })}
                  >
                    Close
                  </button>
                </div>
                <FindingDetail
                  finding={selectedFinding}
                  onChanged={refreshFindingsAndFeedback}
                  members={members.data ?? []}
                  currentUserId={session.data?.user.userId ?? null}
                  stickyMobileDisposition
                />
              </Panel>
            </div>
          );
        }

        return <Panel>{listBody}</Panel>;
      })()}
    </PageShell>
  );
}

function FindingRow({
  finding,
  selected,
  open,
  compact,
  onToggle,
  onSelected
}: {
  finding: ValidatedFinding;
  selected: boolean;
  open: boolean;
  /** Dual-pane list mode: denser row chrome when a finding is selected. */
  compact: boolean;
  onToggle: () => void;
  onSelected: (checked: boolean) => void;
}) {
  return (
    <li
      className={cn(
        "last:border-b-0",
        open && "border-l-2 border-l-brand bg-brand/[0.06]"
      )}
    >
      <div
        className={cn(
          "ps-table__row hover:bg-surface",
          compact && "py-2"
        )}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelected(event.target.checked)}
          aria-label={`Select ${finding.title}`}
        />
        <button
          type="button"
          data-finding-row={finding.findingId}
          data-selected={open ? "true" : "false"}
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`finding-panel-${finding.findingId}`}
          aria-label={`Expand finding: ${finding.title}`}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            open && "ring-1 ring-brand/40"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "font-mono text-xs text-subtle transition-transform",
              open && "rotate-90"
            )}
          >
            ›
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p
                className={cn(
                  "truncate text-[13px] text-ink",
                  open && "font-semibold"
                )}
              >
                {finding.title}
              </p>
              {/* UX-W6 / punch 134: surface occurrence whenever the field exists. */}
              {finding.occurrenceCount != null ? (
                <StateBadge tone="approval" dot={false}>
                  <span data-testid={`finding-occurrence-${finding.findingId}`}>
                    ×{finding.occurrenceCount}
                  </span>
                </StateBadge>
              ) : null}
              {finding.fingerprint ? (
                <span
                  data-testid={`finding-fingerprint-${finding.findingId}`}
                  title={finding.fingerprint}
                  className="shrink-0 font-mono text-[11px] tracking-tight text-subtle"
                >
                  fp·{shortFingerprint(finding.fingerprint)}
                </span>
              ) : null}
              {finding.disposition?.inheritedFromFingerprint ? (
                <StateBadge
                  tone="blocked"
                  variant="outline"
                  dot={false}
                  title="Disposition inherited from a fingerprint mute"
                  data-testid={`finding-muted-via-fp-${finding.findingId}`}
                >
                  Muted via fingerprint
                </StateBadge>
              ) : null}
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-subtle">
              priority {finding.priorityScore} · motion {finding.sourceMotion} ·{" "}
              {finding.evidenceIds.length} evidence
              {(() => {
                const hopFraction = formatFindingHopFraction(finding);
                return hopFraction ? ` · ${hopFraction}` : "";
              })()}
              {(() => {
                const seen = formatSeenWindow(
                  finding.firstSeenAt,
                  finding.lastSeenAt
                );
                return seen ? (
                  <>
                    {" · "}
                    <span
                      data-testid={`finding-seen-${finding.findingId}`}
                      title={
                        [
                          finding.firstSeenAt
                            ? `first ${finding.firstSeenAt}`
                            : null,
                          finding.lastSeenAt
                            ? `last ${finding.lastSeenAt}`
                            : null
                        ]
                          .filter(Boolean)
                          .join(" · ") || undefined
                      }
                    >
                      {seen}
                    </span>
                  </>
                ) : null;
              })()}
              {finding.measuredInNetwork ? " · in-network" : ""}
              {finding.ownerDisplay
                ? ` · owner ${finding.ownerDisplay}`
                : finding.ownerId
                  ? ` · owner ${shortId(finding.ownerId)}`
                  : " · unowned"}
              {finding.slaDueAt
                ? ` · ${formatSlaAge(finding.slaDueAt).label}`
                : ""}
            </p>
            {!compact && finding.rootCauseSummary ? (
              <p className="mt-0.5 truncate text-[11px] text-muted">
                {finding.rootCauseSummary}
              </p>
            ) : null}
          </div>
          {/* Collapsed row: severity + status only (detail panel holds the rest). */}
          <div
            className={cn(
              "shrink-0 items-center gap-2",
              compact ? "hidden" : "hidden sm:flex"
            )}
          >
            <StateBadge tone={severityTone(finding.severity)} dot={false}>
              {finding.severity}
            </StateBadge>
            <StateBadge
              tone={STATUS_TONE[finding.status] ?? "neutral"}
              dot={false}
            >
              {finding.status}
            </StateBadge>
          </div>
        </button>
      </div>
    </li>
  );
}

function FindingDetail({
  finding,
  onChanged,
  members,
  currentUserId,
  stickyMobileDisposition = false
}: {
  finding: ValidatedFinding;
  onChanged: () => void;
  members: TenantMember[];
  currentUserId: string | null;
  /**
   * When true (dual-pane selection on phone, lg dual-pane off): primary
   * disposition is fixed to the thumb zone so triage does not require scrolling
   * the full detail column.
   */
  stickyMobileDisposition?: boolean;
}) {
  const pr = finding.priorityReason;
  const proof = finding.pathProof;
  // UX-W11: never show raw Validated/Reachable/Exploitable for path-linked
  // findings when hop proof does not support the claim.
  const claimDisplay = projectFindingClaimDisplay(finding);
  const dispositionOwner = members.find(
    (member) => member.user.userId === finding.disposition?.ownerId
  )?.user.name;
  const operationalOwner =
    finding.ownerDisplay ??
    (finding.ownerId
      ? (members.find((member) => member.user.userId === finding.ownerId)?.user
          .name ?? shortId(finding.ownerId))
      : undefined);
  const owner = operationalOwner ?? dispositionOwner;
  return (
    <div className="flex flex-col gap-4 bg-surface/40 px-4 py-4">
      <ProofLoopContext
        entityLabel="Validated finding"
        stage={finding.relatedRemediationIds.length > 0 ? "Act" : "Understand"}
        evidenceBasis={`${claimDisplay.displayValidationState} · ${finding.evidenceIds.length} evidence`}
        owner={owner}
        freshness={new Date(finding.updatedAt).toLocaleString()}
        status={finding.status}
        nextAction={
          finding.relatedRemediationIds[0]
            ? {
                href: `/remediation/${finding.relatedRemediationIds[0]}`,
                label: "Open owned remediation"
              }
            : { href: "#finding-fix-workflow", label: "Route smallest fix" }
        }
      />
      {/* Mobile collapsed-equivalent chips when row is open: full set lives here. */}
      <div className="flex flex-wrap gap-2">
        <StateBadge
          tone={EXPLOIT_TONE[finding.exploitability] ?? "neutral"}
          dot={false}
        >
          {finding.exploitability}
        </StateBadge>
        <StateBadge tone={severityTone(finding.severity)} dot={false}>
          {finding.severity}
        </StateBadge>
        <ValidationStateBadge
          state={claimDisplay.displayValidationState}
          title={claimDisplay.ariaLabel}
          aria-label={claimDisplay.ariaLabel}
          data-testid="finding-claim-safe-validation-state"
        />
        {claimDisplay.remapped ? (
          <StateBadge
            tone="inconclusive"
            variant="outline"
            dot={false}
            title={claimDisplay.remapReason ?? claimDisplay.ariaLabel}
            aria-label={`Claim-safe remap: ${claimDisplay.remapReason ?? claimDisplay.ariaLabel}`}
            data-testid="finding-claim-safe-remap-note"
          >
            claim-safe remap
          </StateBadge>
        ) : null}
        <StateBadge tone={STATUS_TONE[finding.status] ?? "neutral"} dot={false}>
          {finding.status}
        </StateBadge>
        {finding.disposition ? (
          <StateBadge
            tone={
              DISPOSITION_TONE[finding.disposition.disposition] ?? "neutral"
            }
            dot={false}
          >
            {DISPOSITION_LABEL[finding.disposition.disposition] ??
              finding.disposition.disposition}
          </StateBadge>
        ) : null}
        {finding.disposition?.inheritedFromFingerprint ? (
          <StateBadge
            tone="blocked"
            variant="outline"
            dot={false}
            data-testid="finding-detail-muted-via-fp"
          >
            Muted via fingerprint
          </StateBadge>
        ) : null}
      </div>

      {/* Owner / SLA always visible — never hide aging behind group identity. */}
      <div className="rounded-card border border-line p-3">
        <Label>Owner &amp; SLA</Label>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
          <Meta
            label="Owner"
            value={
              finding.ownerDisplay || finding.ownerId
                ? (finding.ownerDisplay ??
                  (finding.ownerId ? shortId(finding.ownerId) : ""))
                : "Unassigned — route owner + SLA"
            }
          />
          <Meta
            label="SLA"
            value={
              finding.slaDueAt
                ? formatSlaAge(finding.slaDueAt).label
                : "No target date — set on remediation"
            }
          />
        </div>
      </div>

      {(finding.fingerprint ||
        finding.occurrenceCount != null ||
        finding.firstSeenAt ||
        finding.lastSeenAt ||
        finding.rootCauseSummary) && (
        <div className="rounded-card border border-line p-3">
          <Label>Group identity</Label>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
            {finding.fingerprint ? (
              <Meta
                label="Fingerprint"
                value={`fp·${shortFingerprint(finding.fingerprint)}`}
              />
            ) : null}
            {finding.occurrenceCount != null ? (
              <Meta
                label="Occurrences"
                value={String(finding.occurrenceCount)}
              />
            ) : null}
            {finding.firstSeenAt ? (
              <Meta
                label="First seen"
                value={new Date(finding.firstSeenAt).toLocaleString()}
              />
            ) : null}
            {finding.lastSeenAt ? (
              <Meta
                label="Last seen"
                value={new Date(finding.lastSeenAt).toLocaleString()}
              />
            ) : null}
          </div>
          {finding.rootCauseSummary ? (
            <p className="mt-2 text-[13px] text-muted">
              {finding.rootCauseSummary}
            </p>
          ) : null}
        </div>
      )}

      {/*
        Phone thumb-first (lg dual-pane off): fixed bottom disposition strip.
        Single mount so AT/tests see one Analyst disposition control; lg+ reverts
        to static in-flow placement.
      */}
      <div
        data-testid={
          stickyMobileDisposition
            ? "findings-mobile-disposition-sticky"
            : "finding-disposition-inline"
        }
        className={cn(
          stickyMobileDisposition &&
            "fixed inset-x-0 bottom-0 z-30 border-t border-brand/35 bg-elevated/95 p-3 shadow-[0_-10px_28px_rgba(0,0,0,0.45)] backdrop-blur-sm lg:static lg:inset-auto lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
        )}
      >
        <DispositionControl
          finding={finding}
          onChanged={onChanged}
          members={members}
          currentUserId={currentUserId}
          compact={stickyMobileDisposition}
        />
      </div>

      <RemediationRouting
        finding={finding}
        members={members}
        currentUserId={currentUserId}
        onChanged={onChanged}
      />

      <DetailBlock label="Impact">{finding.impact}</DetailBlock>
      <DetailBlock label="Remediation">{finding.remediation}</DetailBlock>

      {pr ? (
        <div>
          <Label>Why this priority ({finding.priorityScore})</Label>
          <p className="mt-1 text-[13px] text-muted">{pr.summary}</p>
          <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <Dim label="Exploitability" value={pr.exploitability} />
            <Dim
              label="Control effectiveness"
              value={pr.controlEffectiveness}
            />
            <Dim label="Path context" value={pr.pathContext} />
            <Dim label="Business context" value={pr.businessContext} />
          </div>
        </div>
      ) : null}

      <div>
        <Label>Scoring factors</Label>
        <div
          aria-label={`Priority ${finding.priorityScore} scoring factors`}
          className="mt-2 overflow-hidden rounded-card border border-line bg-surface"
          role="region"
        >
          <RiskFactorBreakdown
            factors={finding.riskFactors}
            formula={finding.priorityFormula}
            score={finding.priorityScore}
          />
        </div>
      </div>

      {proof ? (
        <div className="rounded-card border border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label>Path proof</Label>
            <StateBadge
              tone={OBJECTIVE_TONE[proof.objectiveState] ?? "neutral"}
              dot={false}
            >
              {proof.objectiveState}
            </StateBadge>
            <StateBadge tone="neutral" dot={false}>
              motion {finding.sourceMotion}
            </StateBadge>
            {proof.claimDisplayLabel || claimDisplay.claimDisplayLabel ? (
              <StateBadge
                tone={
                  claimDisplay.fullyMeasured || proof.fullyMeasured
                    ? "validated"
                    : "inconclusive"
                }
                dot={false}
                title={claimDisplay.ariaLabel}
                aria-label={
                  claimDisplay.remapped
                    ? `Path claim ${proof.claimDisplayLabel ?? claimDisplay.claimDisplayLabel}, claim-safe; remapped from recorded ${claimDisplay.recordedValidationState}`
                    : `Path claim ${proof.claimDisplayLabel ?? claimDisplay.claimDisplayLabel}, claim-safe`
                }
                data-testid="finding-path-claim-label"
              >
                {proof.claimDisplayLabel ?? claimDisplay.claimDisplayLabel}
              </StateBadge>
            ) : null}
          </div>
          {typeof proof.measuredEdgeCount === "number" &&
          typeof proof.totalEdgeCount === "number" ? (
            <p
              className="mt-1.5 font-mono text-[12px] text-ink"
              data-testid="finding-hop-fraction"
              aria-label={`${proof.measuredEdgeCount} of ${proof.totalEdgeCount} hops measured`}
            >
              {proof.measuredEdgeCount}/{proof.totalEdgeCount} hops measured
              {proof.fullyMeasured
                ? " · fully measured (receipts on every hop)"
                : proof.totalEdgeCount === 0
                  ? " · no hop edges yet"
                  : proof.measuredEdgeCount > 0
                    ? " · partial — launch never upgrades certainty"
                    : " · hypothesis until edge receipts land"}
            </p>
          ) : finding.relatedPathIds.length > 0 ? (
            <p className="mt-1.5 text-[12px] text-muted">
              Path-linked finding — hop fraction unavailable until path proof
              includes measured edge counts. Open the path to Measure path hops.
            </p>
          ) : null}
          <p className="mt-1.5 text-[13px] text-ink">
            <span className="text-subtle">entry</span> {proof.entryPoint}{" "}
            <span className="text-subtle">→ objective</span> {proof.objective}
          </p>
          {proof.intermediateSteps.length ? (
            <p className="mt-1 text-[12px] text-muted">
              via {proof.intermediateSteps.join(" → ")}
            </p>
          ) : null}
          <p className="mt-1 text-[12px] text-subtle">
            blast radius: {proof.blastRadiusSummary}
            {proof.chokePoints.length
              ? ` · evidence-backed path breakers: ${proof.chokePoints.join(", ")}`
              : ""}
          </p>
          {finding.relatedPathIds[0] ? (
            <p className="mt-2">
              <Link
                href={`/attack-paths/${finding.relatedPathIds[0]}#hop-measurement`}
                className="text-[12px] font-semibold text-brand hover:text-brand-2"
              >
                {proof.fullyMeasured
                  ? "Open path hop receipts →"
                  : "Measure path hops →"}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {finding.missingSignalImpact ? (
        <MissingSignalCallout
          title="Confidence reduced by a missing signal"
          action={{ href: "/integrations", label: "Connect a source" }}
        >
          {finding.missingSignalImpact.recommendation}
        </MissingSignalCallout>
      ) : null}

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
        <Meta
          label="Affected assets"
          value={String(finding.relatedAssetIds.length)}
        />
        {finding.relatedPathIds.length ? (
          <div>
            <Label>Attack paths</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {finding.relatedPathIds.map((pid) => (
                <Link
                  key={pid}
                  href={`/attack-paths/${pid}`}
                  className="font-mono text-[11px] text-brand hover:text-brand-2"
                >
                  path·{shortId(pid)}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {finding.relatedRemediationIds.length ? (
          <Meta
            label="Remediations"
            value={String(finding.relatedRemediationIds.length)}
            href="/remediation"
          />
        ) : null}
      </div>

      {finding.evidenceIds.length ? (
        <div>
          <Label>Evidence</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {finding.evidenceIds.map((eid) => (
              <Link
                key={eid}
                href={`/evidence?evidenceId=${encodeURIComponent(eid)}`}
                className="rounded-control border border-line bg-brand/5 px-2 py-0.5 font-mono text-[11px] text-muted"
              >
                ev·{shortId(eid)}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-subtle">
          No evidence artifacts linked — this finding is not yet
          evidence-backed.
        </p>
      )}
    </div>
  );
}

function RemediationRouting({
  finding,
  members,
  currentUserId,
  onChanged
}: {
  finding: ValidatedFinding;
  members: TenantMember[];
  currentUserId: string | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState(
    members.find((member) => member.user.userId === currentUserId)?.user.name ??
      ""
  );
  const [slaDays, setSlaDays] = useState("14");
  // P14-17: multi-path findings pick the re-test target instead of silent [0].
  const [selectedPathId, setSelectedPathId] = useState(
    finding.relatedPathIds[0] ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<RemediationTask | null>(null);
  const pathId =
    selectedPathId || finding.relatedPathIds[0] || null;
  const multiPath = finding.relatedPathIds.length > 1;
  const existingRemediationId =
    created?.remediationId ?? finding.relatedRemediationIds[0] ?? null;

  async function createTask() {
    if (!pathId || !owner) return;
    setBusy(true);
    setError(null);
    try {
      const dueAt = new Date(
        Date.now() + Number(slaDays) * 24 * 60 * 60 * 1000
      ).toISOString();
      const remediation = await api.createRemediation({
        dueAt,
        owner,
        pathId
      });
      setCreated(remediation);
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't create the remediation task."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="finding-fix-workflow"
      className="scroll-mt-6 rounded-card border border-brand/30 bg-brand/5 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <Label>Fix workflow</Label>
          <p className="mt-1 text-[12px] text-muted">
            Turn this attack path into an owned task with a target SLA.
          </p>
        </div>
        {existingRemediationId ? (
          <Link
            href={`/remediation/${existingRemediationId}`}
            className={buttonClassName({ size: "sm", variant: "primary" })}
          >
            Open remediation task
          </Link>
        ) : pathId ? (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className={buttonClassName({ size: "sm", variant: "primary" })}
          >
            {open ? "Cancel" : "Route to remediation"}
          </button>
        ) : (
          <span className="text-[11px] text-subtle">
            No attack path is linked to this finding yet.
          </span>
        )}
      </div>
      {created ? (
        <p className="mt-2 text-xs text-fixed">
          Task created for {created.owner ?? "an unassigned owner"}
          {created.dueAt
            ? ` · target ${new Date(created.dueAt).toLocaleDateString()}`
            : ""}
          .
        </p>
      ) : null}
      {open ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
          {multiPath ? (
            <label className="flex min-w-[12rem] flex-col gap-1 text-xs text-muted">
              Attack path
              <select
                value={selectedPathId}
                onChange={(event) => setSelectedPathId(event.target.value)}
                aria-label="Select attack path for remediation"
                className="rounded-control border border-line bg-elevated px-3 py-2 font-mono text-sm text-ink"
              >
                {finding.relatedPathIds.map((pid) => (
                  <option key={pid} value={pid}>
                    path·{shortId(pid)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-xs text-muted">
            Owner
            <select
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
            >
              <option value="">Choose owner…</option>
              {members.map((member) => (
                <option key={member.user.userId} value={member.user.name}>
                  {member.user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Target SLA
            <select
              value={slaDays}
              onChange={(event) => setSlaDays(event.target.value)}
              className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          <button
            type="button"
            onClick={createTask}
            disabled={busy || !owner || !pathId}
            className={buttonClassName({ size: "sm", variant: "primary" })}
          >
            {busy ? "Creating…" : "Create remediation task"}
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-missed">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DispositionControl({
  finding,
  onChanged,
  members,
  currentUserId,
  compact = false
}: {
  finding: ValidatedFinding;
  onChanged: () => void;
  members: TenantMember[];
  currentUserId: string | null;
  /** Thumb-zone mobile strip: denser chrome, larger touch targets. */
  compact?: boolean;
}) {
  const current = finding.disposition;
  const [choice, setChoice] = useState<FindingDisposition | "">(
    current?.disposition ?? ""
  );
  const parsedReason = parseFindingDispositionReasonCode(current?.note);
  const freeNoteFromStored = (() => {
    const raw = current?.note ?? "";
    if (!parsedReason) return raw;
    return raw.replace(/^\[[A-Za-z]+\]\s*/u, "").trim();
  })();
  const [note, setNote] = useState(freeNoteFromStored);
  const [reasonCode, setReasonCode] = useState<
    FindingDispositionReasonCode | ""
  >(parsedReason ?? "");
  const [ownerId, setOwnerId] = useState(
    current?.ownerId ?? currentUserId ?? ""
  );
  const [expiresAt, setExpiresAt] = useState(
    current?.expiresAt?.slice(0, 10) ?? ""
  );
  // ICP-P1-1: mute fingerprint for FP/Suppressed (server default true).
  const [applyToFingerprint, setApplyToFingerprint] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const hasFingerprint = Boolean(finding.fingerprint?.trim());

  async function save() {
    if (!choice) return;
    if (needsDispositionReason(choice) && !reasonCode) {
      setError("Select a reason code for false positive or suppressed.");
      setStatusMessage(null);
      return;
    }
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      await api.transitionFinding(finding.findingId, {
        disposition: choice,
        expiresAt:
          (choice === "AcceptedRisk" || choice === "Suppressed") && expiresAt
            ? new Date(`${expiresAt}T23:59:59`).toISOString()
            : undefined,
        note: note.trim() || undefined,
        // Optional queue owner on any disposition (P06-3); required for AcceptedRisk.
        ownerId: ownerId || undefined,
        reasonCode: reasonCode || undefined,
        ...(needsDispositionReason(choice)
          ? { applyToFingerprint }
          : {})
      });
      const muteNote =
        needsDispositionReason(choice) && applyToFingerprint && hasFingerprint
          ? " Fingerprint muted for sibling findings."
          : needsDispositionReason(choice) && !applyToFingerprint
            ? " This finding only (fingerprint not muted)."
            : "";
      setStatusMessage(
        `Disposition saved: ${DISPOSITION_LABEL[choice] ?? choice}.${muteNote}`
      );
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      await api.approveFindingRisk(finding.findingId);
      setStatusMessage("Accepted risk approved.");
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't approve risk."
      );
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      await api.transitionFinding(finding.findingId, { disposition: null });
      setChoice("");
      setNote("");
      setReasonCode("");
      setStatusMessage("Disposition cleared.");
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't clear.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-card border border-line p-3",
        compact && "border-brand/30 bg-elevated p-2.5"
      )}
    >
      <div className="flex items-center gap-2">
        <Label>
          <span className="inline-flex items-center gap-1.5">
            Analyst disposition
            <span className={cn(compact && "hidden lg:inline-flex")}>
              <InfoPopover label="analyst disposition">
                A handling decision such as escalated, false positive (with a
                reason code, e.g. DuplicateObservation or ToolNoise), suppressed,
                or accepted risk. It does not rewrite the measured validation
                state or prove that the exposure is fixed.
              </InfoPopover>
            </span>
          </span>
        </Label>
        {current ? (
          <>
            <StateBadge
              tone={DISPOSITION_TONE[current.disposition] ?? "neutral"}
              dot={false}
            >
              {DISPOSITION_LABEL[current.disposition] ?? current.disposition}
            </StateBadge>
            {current.disposition === "AcceptedRisk" ? (
              <StateBadge
                tone={
                  current.approvalState === "Approved"
                    ? "fixed"
                    : current.approvalState === "Expired"
                      ? "missed"
                      : "approval"
                }
                dot={false}
              >
                {current.approvalState}
              </StateBadge>
            ) : null}
            {current.inheritedFromFingerprint ? (
              <StateBadge
                tone="blocked"
                variant="outline"
                dot={false}
                data-testid="disposition-muted-via-fingerprint"
              >
                Muted via fingerprint
              </StateBadge>
            ) : null}
          </>
        ) : (
          <span className="text-[12px] text-subtle">none — purely derived</span>
        )}
      </div>
      <p
        className={cn(
          "mt-1 text-[12px] text-muted",
          compact && "hidden lg:block"
        )}
      >
        A disposition records a human triage decision (accepted risk, false
        positive, suppressed…). It never marks a finding Fixed — only a real
        verification event can.
      </p>
      {current?.inheritedFromFingerprint ? (
        <p
          className="mt-1 text-[11px] text-subtle"
          data-testid="disposition-inherited-note"
        >
          This disposition was inherited from a fingerprint mute on{" "}
          <span className="font-mono">
            fp·{shortFingerprint(finding.fingerprint ?? current.fingerprint ?? "")}
          </span>
          . Clear removes the finding-scoped overlay and the fingerprint mute
          for this cause.
        </p>
      ) : null}
      {current?.disposition === "AcceptedRisk" ? (
        <div className="mt-2 rounded-control border border-line bg-elevated px-3 py-2 text-xs text-muted">
          <p>
            Owner{" "}
            {members.find((member) => member.user.userId === current.ownerId)
              ?.user.name ?? "Unknown"}
            {current.expiresAt
              ? ` · expires ${new Date(current.expiresAt).toLocaleDateString()}`
              : ""}
          </p>
          {current.approvalState === "Pending" ? (
            current.updatedBy === currentUserId ? (
              <p className="mt-1 text-subtle">
                Another tenant member must approve this request.
              </p>
            ) : (
              <button
                type="button"
                onClick={approve}
                disabled={busy}
                className={
                  buttonClassName({ size: "sm", variant: "primary" }) + " mt-2"
                }
              >
                {busy ? "Approving…" : "Approve accepted risk"}
              </button>
            )
          ) : current.approvalState === "Expired" ? (
            <p className="mt-1 text-missed">
              Expired — the finding is reopened for active triage.
            </p>
          ) : null}
        </div>
      ) : null}
      {current?.disposition === "Suppressed" && current.expiresAt ? (
        <p className="mt-2 text-[11px] text-subtle">
          Revisit on {new Date(current.expiresAt).toLocaleDateString()} — suppress
          clears after that date without claiming Fixed.
        </p>
      ) : null}
      {choice === "Suppressed" ? (
        <p className="mt-1 text-[11px] text-subtle">
          Optional revisit date snoozes noise (change windows / lab); leave blank
          for permanent suppress until cleared.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={choice}
          onChange={(event) => {
            const next = event.target.value as FindingDisposition | "";
            setChoice(next);
            if (!needsDispositionReason(next)) {
              setReasonCode("");
            }
          }}
          aria-label="Disposition"
          className={cn(
            "rounded-control border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand",
            compact && "min-h-11 min-w-[8.5rem] px-3 py-2.5"
          )}
        >
          <option value="">Select…</option>
          {DISPOSITIONS.map((disposition) => (
            <option key={disposition} value={disposition}>
              {DISPOSITION_LABEL[disposition]}
            </option>
          ))}
        </select>
        {needsDispositionReason(choice) ? (
          <select
            value={reasonCode}
            onChange={(event) =>
              setReasonCode(
                event.target.value as FindingDispositionReasonCode | ""
              )
            }
            aria-label="Disposition reason code"
            className={cn(
              "rounded-control border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand",
              compact && "min-h-11 min-w-[8.5rem] px-3 py-2.5"
            )}
          >
            <option value="">Select reason…</option>
            {FINDING_DISPOSITION_REASON_CODES.map((code) => (
              <option key={code} value={code}>
                {REASON_CODE_LABEL[code]}
              </option>
            ))}
          </select>
        ) : null}
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            needsDispositionReason(choice)
              ? "Optional detail"
              : "Note (optional)"
          }
          aria-label="Disposition note"
          className={cn(
            "min-w-0 flex-1 rounded-control border border-line bg-elevated px-2.5 py-1.5 text-sm text-ink outline-none focus:border-line-strong md:max-w-xs",
            compact && "min-h-11 px-3 py-2.5"
          )}
        />
        {choice ? (
          <select
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
            aria-label={
              choice === "AcceptedRisk" ? "Risk owner" : "Queue owner"
            }
            className={cn(
              "rounded-control border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand",
              compact && "min-h-11 px-3 py-2.5"
            )}
          >
            <option value="">
              {choice === "AcceptedRisk" ? "Select owner…" : "Unassigned"}
            </option>
            {members.map((member) => (
              <option key={member.user.userId} value={member.user.userId}>
                {member.user.name}
              </option>
            ))}
          </select>
        ) : null}
        {choice === "AcceptedRisk" || choice === "Suppressed" ? (
          <input
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            aria-label={
              choice === "AcceptedRisk"
                ? "Risk acceptance expiry"
                : "Suppress revisit date"
            }
            title={
              choice === "Suppressed"
                ? "Optional revisit — suppress clears after this date without claiming Fixed"
                : undefined
            }
            className="rounded-control border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
          />
        ) : null}
        {needsDispositionReason(choice) ? (
          <label
            className={cn(
              "inline-flex items-center gap-2 rounded-control border border-line bg-elevated px-2.5 py-1.5 text-xs text-muted",
              !hasFingerprint && "opacity-60"
            )}
          >
            <input
              type="checkbox"
              checked={applyToFingerprint}
              onChange={(event) => setApplyToFingerprint(event.target.checked)}
              disabled={!hasFingerprint}
              aria-label="Mute fingerprint (default on)"
              data-testid="mute-fingerprint-checkbox"
            />
            <span>
              Mute fingerprint
              <span className="text-subtle"> (default on)</span>
            </span>
          </label>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={
            busy ||
            !choice ||
            (choice === "AcceptedRisk" && (!ownerId || !expiresAt)) ||
            (needsDispositionReason(choice) && !reasonCode)
          }
          className={buttonClassName({ size: "sm", variant: "primary" })}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {current ? (
          <button
            type="button"
            onClick={clear}
            disabled={busy}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Clear
          </button>
        ) : null}
      </div>
      {statusMessage ? (
        <p
          role="status"
          aria-live="polite"
          data-testid="disposition-save-status"
          className="mt-2 rounded-control border border-fixed/30 bg-fixed/5 px-2.5 py-1.5 text-[12px] font-medium text-fixed"
        >
          {statusMessage}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-[11px] text-missed">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DetailBlock({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="mt-1 text-[13px] text-muted">{children}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
      {children}
    </span>
  );
}

function Dim({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[12.5px]">
      <span className="text-subtle">{label}:</span>{" "}
      <span className="text-muted">{value}</span>
    </p>
  );
}

function Meta({
  label,
  value,
  href
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <Label>{label}</Label>
      <p className="mt-1 font-mono text-[13px] text-ink">{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="hover:opacity-80">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { label: string; value: string }>;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-control border border-line bg-surface pl-3 pr-1.5 text-sm">
      <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Filter by ${label}`}
        className="bg-transparent py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option
            key={typeof option === "string" ? option : option.value}
            value={typeof option === "string" ? option : option.value}
          >
            {typeof option === "string" ? option : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
