"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  EmptyState,
  ErrorState,
  LiveUpdatePill,
  LoadingSkeleton,
  PageHeader,
  PageShell,
  Panel,
  StateBadge,
  buttonClassName
} from "../ui";
import {
  REMEDIATION_STATUS_TONE,
  VERIFICATION_OUTCOME_TONE,
  formatSlaAge,
  relTime,
  statusRank
} from "./remediation-lib";

const RESOLVED = new Set(["Fixed", "Mitigated"]);
const PAGE_SIZE = 25;

export function RemediationWorkbench() {
  const remediations = useApiResource(() => api.listRemediations(), []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState("all");
  const [page, setPage] = useState(0);

  const all = remediations.data ?? [];

  const statuses = useMemo(
    () => Array.from(new Set(all.map((r) => r.status))).sort(),
    [all]
  );

  const summary = useMemo(() => {
    let open = 0;
    let pending = 0;
    let resolved = 0;
    for (const r of all) {
      if (r.status === "VerificationPending") pending += 1;
      else if (RESOLVED.has(r.status)) resolved += 1;
      else open += 1;
    }
    return { open, pending, resolved };
  }, [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...all]
      .filter((r) => status === "all" || r.status === status)
      .filter((r) =>
        view === "overdue"
          ? Boolean(r.dueAt && Date.parse(r.dueAt) < Date.now()) &&
            !RESOLVED.has(r.status)
          : true
      )
      .filter((r) => !q || r.recommendedAction.toLowerCase().includes(q))
      .sort((a, b) => statusRank(a.status) - statusRank(b.status));
  }, [all, status, query, view]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") ?? "");
    setStatus(params.get("status") ?? "all");
    setView(params.get("view") ?? "all");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (view !== "all") params.set("view", view);
    if (query.trim()) params.set("q", query.trim());
    const value = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${value ? `?${value}` : ""}`
    );
  }, [query, status, view]);

  useEffect(() => {
    setPage(0);
  }, [query, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function exportCsv() {
    const quote = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [
      [
        "remediation_id",
        "recommended_action",
        "owner",
        "due_at",
        "status",
        "verification_method",
        "next_verification_at",
        "latest_outcome",
        "measured_revalidation",
        "ticket_system",
        "ticket_id",
        "evidence_count"
      ],
      ...filtered.map((remediation) => [
        remediation.remediationId,
        remediation.recommendedAction,
        remediation.owner ?? "",
        remediation.dueAt ?? "",
        remediation.status,
        remediation.verificationMethod,
        remediation.nextVerificationAt ?? "",
        remediation.latestVerification?.outcome ?? "",
        remediation.latestVerification?.measuredRevalidation ?? "",
        remediation.ticketSystem ?? "",
        remediation.ticketId ?? "",
        remediation.evidenceIds.length
      ])
    ].map((row) => row.map(quote).join(","));
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `periscan-remediations-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Remediate"
        title="Remediation"
        description='Fix plans and the proof they held. Mark a fix ready, run a targeted re-test, and a "Fixed" only lands when a real re-validation says so.'
        actions={
          <Link
            href="/findings?view=active"
            data-testid="remediation-header-primary-cta"
            className={buttonClassName({ size: "md", variant: "primary" })}
          >
            Open Active findings
          </Link>
        }
        meta={
          <LiveUpdatePill
            lastUpdatedAt={remediations.lastUpdatedAt}
            refreshing={remediations.refreshing}
          />
        }
      />

      {all.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile label="Open" value={summary.open} tone="approval" />
          <SummaryTile
            label="Awaiting verification"
            value={summary.pending}
            tone="blocked"
          />
          <SummaryTile
            label="Proven resolved"
            value={summary.resolved}
            tone="fixed"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          aria-pressed={view === "overdue"}
          onClick={() =>
            setView((current) => (current === "overdue" ? "all" : "overdue"))
          }
          className={buttonClassName({
            size: "sm",
            variant: view === "overdue" ? "primary" : "secondary"
          })}
        >
          Overdue only
        </button>
        <label className="flex min-w-0 flex-1 flex-col gap-1 md:max-w-xs">
          <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title or owner…"
            className="min-w-0 w-full rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <label className="flex items-center gap-1.5 rounded-control border border-line bg-surface pl-3 pr-1.5 text-sm focus-within:ring-2 focus-within:ring-brand">
          <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Status
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-transparent py-1.5 text-sm text-ink outline-none"
          >
            <option value="all">All</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          Export CSV
        </button>
      </div>

      <Panel>
        {remediations.loading ? (
          <LoadingSkeleton rows={6} />
        ) : remediations.error ? (
          <ErrorState
            message={remediations.error}
            onRetry={remediations.refetch}
          />
        ) : all.length === 0 ? (
          <div className="p-4" data-testid="remediation-empty">
            {/* P09: empty list — single primary CTA only (no competing secondary). */}
            <EmptyState
              title="No remediations yet"
              description="Remediation tasks are created when a validated exposure needs a fix. Fixed is only via re-measurement — never mark closed from status alone."
              action={
                <Link
                  href="/findings"
                  className={buttonClassName({
                    size: "sm",
                    variant: "primary"
                  })}
                  data-testid="remediation-empty-primary-cta"
                >
                  Review findings
                </Link>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-subtle">
            No remediations match these filters.
          </p>
        ) : (
          <>
            <ul className="list-none">
              {visible.map((r) => (
                <li
                  key={r.remediationId}
                  className="border-b border-line last:border-b-0"
                >
                  <Link
                    href={`/remediation/${r.remediationId}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink">
                        {r.recommendedAction}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-subtle">
                        {r.owner ? `${r.owner} · ` : "unowned · "}
                        {r.dueAt
                          ? `${formatSlaAge(r.dueAt, { prefix: "target" }).label} · `
                          : "no SLA date · "}
                        {r.verificationMethod}
                        {r.nextVerificationAt
                          ? ` · re-check ${relTime(r.nextVerificationAt)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.latestVerification ? (
                        <StateBadge
                          tone={
                            VERIFICATION_OUTCOME_TONE[
                              r.latestVerification.outcome
                            ] ?? "neutral"
                          }
                          dot={false}
                        >
                          {r.latestVerification.measuredRevalidation
                            ? "measured "
                            : ""}
                          {r.latestVerification.outcome}
                        </StateBadge>
                      ) : null}
                      <StateBadge
                        tone={REMEDIATION_STATUS_TONE[r.status] ?? "neutral"}
                      >
                        {r.status}
                      </StateBadge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {pageCount > 1 ? (
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
                <span>
                  Page {page + 1} of {pageCount}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                    disabled={page === 0}
                    className={buttonClassName({
                      size: "sm",
                      variant: "secondary"
                    })}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((value) => Math.min(pageCount - 1, value + 1))
                    }
                    disabled={page >= pageCount - 1}
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
          </>
        )}
      </Panel>
    </PageShell>
  );
}

function SummaryTile({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "approval" | "blocked" | "fixed";
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface p-3.5">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `var(--color-${tone})` }}
      />
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
      <p
        className="mt-1 font-mono text-2xl font-semibold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}
