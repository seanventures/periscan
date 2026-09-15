"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AuditEventActionSchema, type AuditEvent } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { entityHref } from "../lib/entity-routes";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  buttonClassName,
  type StateTone
} from "../ui";

const PAGE_SIZE = 50;
const ACTORS = ["User", "System", "Service", "Runner"];
const CATEGORIES = Array.from(
  new Set(AuditEventActionSchema.options.map((action) => category(action)))
).sort();

function dateBoundary(
  value: string,
  edge: "start" | "end"
): string | undefined {
  if (!value) return undefined;
  return `${value}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z`;
}

function category(action: string): string {
  const head = action.split(".")[0] ?? action;
  return head.charAt(0).toUpperCase() + head.slice(1);
}

function optionLabel(value: string): string {
  const words = value.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function actionTone(action: string): StateTone {
  if (/denied|failed|blocked|revoked|locked|reject/i.test(action))
    return "missed";
  if (/approved|completed|created|fixed|verified|enabled/i.test(action))
    return "fixed";
  if (/requested|pending|paused|updated/i.test(action)) return "approval";
  return "inconclusive";
}

function shortId(id?: string | null): string {
  if (!id) return "";
  return id.length > 8 ? id.slice(0, 8) : id;
}

function fmt(iso: string): { rel: string; abs: string } {
  const then = new Date(iso).getTime();
  const abs = new Date(iso).toISOString().replace("T", " ").slice(0, 19);
  if (Number.isNaN(then)) return { rel: "", abs: iso };
  const mins = Math.round((Date.now() - then) / 60000);
  const rel =
    mins < 1
      ? "just now"
      : mins < 60
        ? `${mins}m ago`
        : mins < 1440
          ? `${Math.round(mins / 60)}h ago`
          : `${Math.round(mins / 1440)}d ago`;
  return { rel, abs };
}

export function AuditWorkbench() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [actor, setActor] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const events = useApiResource(
    () =>
      api.listAuditEventPage({
        actorType: actor === "all" ? undefined : actor,
        category: cat === "all" ? undefined : cat,
        from: dateBoundary(fromDate, "start"),
        limit: PAGE_SIZE,
        offset,
        search: search || undefined,
        to: dateBoundary(toDate, "end")
      }),
    [actor, cat, fromDate, offset, search, toDate]
  );

  async function exportLog(format: "json" | "csv") {
    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const result = await api.createAuditExport(format, {
        actorType: actor === "all" ? undefined : actor,
        category: cat === "all" ? undefined : cat,
        from: dateBoundary(fromDate, "start"),
        search: search || undefined,
        to: dateBoundary(toDate, "end")
      });
      window.open(result.downloadPath, "_blank", "noopener");
      setExportSuccess(
        `${result.eventCount} filtered events exported${"truncated" in result && result.truncated ? " (export limit reached)" : ""}.`
      );
    } catch (caught) {
      setExportError(
        caught instanceof Error ? caught.message : "Export failed (admin only)."
      );
    } finally {
      setExporting(false);
    }
  }

  const all = useMemo(
    () =>
      [...(events.data?.items ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [events.data?.items]
  );
  const hasFilters = Boolean(
    search || cat !== "all" || actor !== "all" || fromDate || toDate
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Govern
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Audit log
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Every consequential action — auth, scopes, policy decisions, missions,
          evidence, remediation, runners and tool governance — with who did it
          and when.
        </p>
      </header>

      <Panel>
        <div className="flex flex-col gap-1.5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-[12px] font-semibold text-ink">
              Continuous SIEM audit stream
            </p>
            <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
              NotConfigured
            </span>
            <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
              PullExportOnly · max 5000/export
            </span>
          </div>
          <p className="max-w-3xl text-[12.5px] text-muted">
            Audit is admin pull-export (JSON/CSV). Continuous SIEM-native
            streaming (Splunk HEC / Sentinel / OCSF for every security-relevant
            action) is not shipped. Outbound webhooks cover discrete proof-loop
            events with HMAC signing — not a full continuous audit bus. Trust
            &amp; Safety surfaces the same honesty for RFP answers.
          </p>
        </div>
      </Panel>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setOffset(0);
          setSearch(query.trim());
        }}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 md:max-w-xs">
          <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Action, actor, or full ID…"
            className="min-w-0 w-full rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <button
          type="submit"
          className={buttonClassName({ size: "sm", variant: "secondary" })}
        >
          Search
        </button>
        <Select
          label="Area"
          value={cat}
          onChange={(value) => {
            setCat(value);
            setOffset(0);
          }}
          options={CATEGORIES}
        />
        <Select
          label="Actor"
          value={actor}
          onChange={(value) => {
            setActor(value);
            setOffset(0);
          }}
          options={ACTORS}
        />
        <label className="flex flex-col gap-1">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            From · UTC
          </span>
          <input
            type="date"
            aria-label="Audit events from date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => {
              setFromDate(event.target.value);
              setOffset(0);
            }}
            className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-line-strong"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
            To · UTC
          </span>
          <input
            type="date"
            aria-label="Audit events to date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => {
              setToDate(event.target.value);
              setOffset(0);
            }}
            className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-line-strong"
          />
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => exportLog("json")}
            disabled={exporting}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {exporting ? "…" : "Export JSON"}
          </button>
          <button
            type="button"
            onClick={() => exportLog("csv")}
            disabled={exporting}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            CSV
          </button>
        </div>
      </form>
      {exportError ? (
        <p role="alert" className="text-sm text-missed">
          {exportError}
        </p>
      ) : null}
      {exportSuccess ? (
        <p role="status" className="text-sm text-fixed">
          {exportSuccess}
        </p>
      ) : null}

      <Panel>
        <PanelHeader
          title={
            all.length > 0
              ? `Events ${offset + 1}–${offset + all.length} · Page ${Math.floor(offset / PAGE_SIZE) + 1}`
              : "Events"
          }
        />
        {events.loading ? (
          <LoadingSkeleton rows={8} />
        ) : events.error ? (
          <ErrorState message={events.error} onRetry={events.refetch} />
        ) : all.length === 0 && !hasFilters && offset === 0 ? (
          <div className="p-4">
            <NotConfigured
              title="No audit events yet"
              message="Actions across the platform are recorded here as they happen."
            />
          </div>
        ) : all.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-subtle">
            No events match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line font-display text-[10px] uppercase tracking-[0.06em] text-subtle">
                  <th className="px-4 py-2.5 font-semibold">When</th>
                  <th className="px-2 py-2.5 font-semibold">Action</th>
                  <th className="px-2 py-2.5 font-semibold">Actor</th>
                  <th className="px-4 py-2.5 font-semibold">Entity</th>
                </tr>
              </thead>
              <tbody>
                {all.map((event) => (
                  <Row key={event.auditEventId} event={event} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!events.loading &&
        !events.error &&
        (offset > 0 || events.data?.page.hasMore) ? (
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() =>
                setOffset((current) => Math.max(0, current - PAGE_SIZE))
              }
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Previous
            </button>
            <span className="font-mono text-[11px] text-subtle">
              {PAGE_SIZE} events per page
            </span>
            <button
              type="button"
              disabled={!events.data?.page.hasMore}
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Next
            </button>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function Row({ event }: { event: AuditEvent }) {
  const t = fmt(event.createdAt);
  const route = event.entityId
    ? entityHref(event.entityType, event.entityId)
    : null;
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-2.5 font-mono text-subtle" title={t.abs}>
        {t.rel}
      </td>
      <td className="px-2 py-2.5">
        <span
          className="font-mono"
          style={{ color: `var(--color-${actionTone(event.action)})` }}
        >
          {event.action}
        </span>
      </td>
      <td className="px-2 py-2.5 text-muted">
        {event.actorType}
        {event.userId ? (
          <span className="ml-1 font-mono text-[10.5px] text-subtle">
            {shortId(event.userId)}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2.5">
        {route ? (
          <Link href={route} className="text-brand hover:text-brand-2">
            {event.entityType}
          </Link>
        ) : (
          <span className="text-muted">{event.entityType}</span>
        )}
        {event.entityId ? (
          <span className="ml-1 font-mono text-[10.5px] text-subtle">
            {shortId(event.entityId)}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
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
        className="max-w-[10rem] bg-transparent py-1.5 text-sm text-ink outline-none"
      >
        <option value="all">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
    </label>
  );
}
