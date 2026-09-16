"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { ReportDownloadPayload } from "../lib/periscan-api-client";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  SafetyLevelBadge,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

const ADVISORY_TONE: Record<string, StateTone> = {
  Imported: "inconclusive",
  Assessed: "approval",
  PlanReady: "validated",
  Closed: "neutral"
};
const READINESS_TONE: Record<string, StateTone> = {
  Ready: "fixed",
  MissingSignals: "approval",
  RequiresApproval: "approval",
  NotConfigured: "inconclusive"
};

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function download(payload: ReportDownloadPayload) {
  const blob = new Blob([payload.content], { type: payload.contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = payload.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ThreatCenterWorkbench() {
  const advisories = useApiResource(() => api.listThreatAdvisories(), []);
  const [selected, setSelected] = useState<string | null>(null);

  const items = advisories.data ?? [];
  useEffect(() => {
    if (!selected && items.length > 0) setSelected(items[0]!.threatAdvisoryId);
  }, [items, selected]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Labs · Threats
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Threats
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          One door for advisories, feed alerts, and signal activity (deep links
          below). Import an advisory and Periscan extracts its CVEs, IoCs and
          techniques, assesses exposure against your own evidence, and drafts a
          validation plan — a plan; it never runs anything on its own.
        </p>
        {/* UX-W2 hub join: single nav entry lands here; peers stay deep-linked. */}
        <nav
          aria-label="Threat surfaces"
          data-testid="threats-hub-panel"
          className="mt-4 flex flex-wrap gap-2"
        >
          <span
            className="inline-flex items-center rounded-control border border-brand bg-brand/10 px-3 py-1.5 text-xs font-semibold text-ink"
            aria-current="page"
          >
            Program
          </span>
          <Link
            href="/threat-feed"
            className="inline-flex items-center rounded-control border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            Threat feed
          </Link>
          <Link
            href="/signal-activity"
            className="inline-flex items-center rounded-control border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            Signal activity
          </Link>
          <Link
            href="/attack-techniques"
            className="inline-flex items-center rounded-control border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            ATT&amp;CK catalog
          </Link>
        </nav>
      </header>

      <ImportPanel
        onImported={async () => {
          await advisories.refetch();
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Panel>
          <PanelHeader title={`Advisories (${items.length})`} />
          {advisories.loading ? (
            <LoadingSkeleton rows={4} />
          ) : advisories.error ? (
            <ErrorState
              message={advisories.error}
              onRetry={advisories.refetch}
            />
          ) : items.length === 0 ? (
            <div className="p-4">
              <NotConfigured
                title="No advisories yet"
                message="Import one above — paste an advisory's text and Periscan extracts the indicators."
              />
            </div>
          ) : (
            <ul>
              {items.map((a) => (
                <li key={a.threatAdvisoryId}>
                  <button
                    type="button"
                    onClick={() => setSelected(a.threatAdvisoryId)}
                    aria-current={selected === a.threatAdvisoryId}
                    className={cn(
                      "flex w-full flex-col items-start gap-1 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface",
                      selected === a.threatAdvisoryId && "bg-brand/5"
                    )}
                  >
                    <div className="flex w-full items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {a.title}
                      </span>
                      <StateBadge
                        tone={ADVISORY_TONE[a.status] ?? "neutral"}
                        dot={false}
                      >
                        {a.status}
                      </StateBadge>
                    </div>
                    <span className="font-mono text-[11px] text-subtle">
                      {a.sourceName} · {a.cveIds.length} CVE ·{" "}
                      {a.iocValues.length} IoC · {a.techniqueIds.length} TTP ·{" "}
                      {relTime(a.receivedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {selected ? (
          <AdvisoryDetail id={selected} />
        ) : (
          <Panel>
            <p className="p-6 text-center text-sm text-subtle">
              Select an advisory to see its impact and validation plan.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function ImportPanel({ onImported }: { onImported: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [summary, setSummary] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const canSubmit =
    title.trim() && sourceName.trim() && summary.trim() && raw.trim();

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await api.importThreatAdvisory({
        title: title.trim(),
        sourceName: sourceName.trim(),
        summary: summary.trim(),
        rawContent: raw.trim()
      });
      setTitle("");
      setSourceName("");
      setSummary("");
      setRaw("");
      setOk(true);
      await onImported();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title="Import an advisory" />
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Advisory title"
          aria-label="Advisory title"
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong"
        />
        <input
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          placeholder="Source (e.g. CISA, vendor)"
          aria-label="Source"
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong"
        />
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="One-line summary"
          aria-label="Summary"
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong sm:col-span-2"
        />
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          placeholder="Paste the advisory text — CVEs, IoCs and techniques are extracted automatically."
          aria-label="Advisory content"
          className="resize-y rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong sm:col-span-2"
        />
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !canSubmit}
            className={buttonClassName({ size: "sm", variant: "primary" })}
          >
            {busy ? "Importing…" : "Import & extract"}
          </button>
          {ok ? <span className="text-sm text-fixed">Imported.</span> : null}
          {error ? <span className="text-sm text-missed">{error}</span> : null}
        </div>
      </div>
    </Panel>
  );
}

function AdvisoryDetail({ id }: { id: string }) {
  const detail = useApiResource(() => api.getThreatAdvisory(id), [id]);
  const [exporting, setExporting] = useState(false);

  const data = detail.data;
  const missingByType = useMemo(() => data?.missingSignals ?? [], [data]);

  async function exportReadiness() {
    setExporting(true);
    try {
      download(await api.exportThreatAdvisoryReadinessReport(id));
    } catch {
      /* ignore */
    } finally {
      setExporting(false);
    }
  }

  if (detail.loading) {
    return (
      <Panel>
        <LoadingSkeleton rows={8} />
      </Panel>
    );
  }
  if (detail.error || !data) {
    return (
      <Panel>
        <ErrorState
          message={detail.error ?? "Not found."}
          onRetry={detail.refetch}
        />
      </Panel>
    );
  }

  const { advisory, impactAssessment, readinessReport, validationPlan } = data;

  return (
    <Panel>
      <PanelHeader
        title={advisory.title}
        actions={
          <StateBadge
            tone={READINESS_TONE[readinessReport.readinessStatus] ?? "neutral"}
            dot={false}
          >
            {readinessReport.readinessStatus}
          </StateBadge>
        }
      />
      <div className="flex flex-col gap-4 p-4">
        <p className="text-[13px] text-muted">{advisory.summary}</p>

        {/* Extracted intel */}
        <Section title="Extracted indicators">
          <Chips label="CVEs" items={advisory.cveIds} tone="missed" />
          <Chips label="IoCs" items={advisory.iocValues} tone="approval" mono />
          <div>
            <ChipLabel>Techniques</ChipLabel>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {advisory.techniqueIds.length ? (
                advisory.techniqueIds.map((t) => (
                  <Link
                    key={t}
                    href={`/attack-techniques?technique=${encodeURIComponent(t)}`}
                    className="rounded-control border border-blocked/40 px-1.5 py-0.5 font-mono text-[11px] text-blocked hover:opacity-80"
                  >
                    {t}
                  </Link>
                ))
              ) : (
                <span className="text-[12px] text-subtle">none</span>
              )}
            </div>
          </div>
          <div className="mt-2">
            <ChipLabel>Evidence</ChipLabel>
            <div
              className="mt-1 flex flex-wrap gap-1.5"
              aria-label="Linked evidence"
            >
              {advisory.evidenceIds.length ? (
                advisory.evidenceIds.map((evidenceId) => (
                  <Link
                    key={evidenceId}
                    href={`/evidence?evidenceId=${encodeURIComponent(evidenceId)}`}
                    title={evidenceId}
                    className="rounded-control border border-line bg-surface-strong px-1.5 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    ev·{evidenceId.slice(0, 8)}
                  </Link>
                ))
              ) : (
                <span className="text-[12px] text-subtle">none</span>
              )}
            </div>
          </div>
        </Section>

        {/* Impact */}
        <Section title="Impact assessment">
          <p className="text-[13px] text-muted">{impactAssessment.summary}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-subtle">
            <span>confidence {impactAssessment.confidence.toFixed(2)}</span>
            <span>
              {impactAssessment.affectedAssetIds.length} affected assets
            </span>
            <span>{impactAssessment.affectedFindingIds.length} findings</span>
          </div>
        </Section>

        {/* Missing signals */}
        {missingByType.length ? (
          <Section title="Missing signals">
            <ul className="flex flex-col gap-1.5">
              {missingByType.map((m) => (
                <li key={m.missingSignalId} className="text-[12.5px]">
                  <span className="text-ink">{m.signalType}</span>{" "}
                  <span className="text-subtle">— {m.reason}</span>
                  {m.requiredIntegrationCategory ? (
                    <Link
                      href="/integrations"
                      className="ml-1.5 text-brand hover:text-brand-2"
                    >
                      connect {m.requiredIntegrationCategory} →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Readiness */}
        <Section title="Readiness report">
          <p className="text-[13px] text-muted">{readinessReport.summary}</p>
          <button
            type="button"
            onClick={exportReadiness}
            disabled={exporting}
            className={cn(
              buttonClassName({ size: "sm", variant: "secondary" }),
              "mt-2"
            )}
          >
            {exporting ? "Exporting…" : "Export readiness report"}
          </button>
        </Section>

        {/* Validation plan — non-executing */}
        <Section title="Validation plan · does not execute">
          <p className="text-[13px] text-muted">{validationPlan.summary}</p>
          {validationPlan.planItems.length ? (
            <ul className="mt-2 flex flex-col gap-2">
              {validationPlan.planItems.map((item) => (
                <li
                  key={item.threatValidationPlanItemId}
                  className="rounded-control border border-line bg-surface p-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-ink">{item.title}</span>
                    <span className="font-mono text-[10px] text-subtle">
                      {item.missionType}
                    </span>
                    <SafetyLevelBadge level={item.safetyLevel} dot={false} />
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    {item.rationale}
                  </p>
                  {item.requiredIntegrationCategories.length ? (
                    <p className="mt-1 font-mono text-[10.5px] text-subtle">
                      needs: {item.requiredIntegrationCategories.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12px] text-subtle">No plan items.</p>
          )}
        </Section>
      </div>
    </Panel>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <p className="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {title}
      </p>
      {children}
    </div>
  );
}

function Chips({
  label,
  items,
  tone,
  mono
}: {
  label: string;
  items: string[];
  tone: StateTone;
  mono?: boolean;
}) {
  return (
    <div className="mb-2">
      <ChipLabel>{label}</ChipLabel>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.length ? (
          items.map((item) => (
            <span
              key={item}
              className={cn(
                "rounded-control px-1.5 py-0.5 text-[11px]",
                mono && "font-mono"
              )}
              style={{
                color: `var(--color-${tone})`,
                border: `1px solid color-mix(in srgb, var(--color-${tone}) 40%, transparent)`
              }}
            >
              {item}
            </span>
          ))
        ) : (
          <span className="text-[12px] text-subtle">none</span>
        )}
      </div>
    </div>
  );
}

function ChipLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-wider text-subtle">
      {children}
    </span>
  );
}
