"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  COMPLIANCE_CATALOG,
  COMPLIANCE_PACK_TYPES
} from "@periscan/reports/compliance-catalog";
import type {
  EvidencePack,
  EvidencePackType,
  ReportShareGrant,
  ReportShareLink
} from "@periscan/shared";

import { formatSnapshotPathClaimPreview } from "../lib/claim-safe-display";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import type { ReportDownloadPayload } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import { WorkflowFeedback } from "./workflow-feedback";
import {
  EmptyState,
  ErrorState,
  InfoPopover,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

const REDACTION_TONE: Record<string, StateTone> = {
  Low: "neutral",
  Moderate: "approval",
  High: "missed",
  Restricted: "missed"
};

const AUDIENCES = ["Executive", "Technical", "Auditor"] as const;
const TOP_ITEM_OPTIONS = [3, 5] as const;
/** ICP-P1-5: Board brief binds real ExecutiveRiskSummary pack type, not Snapshot. */
const REPORT_PRESETS = [
  {
    audience: "Executive" as const,
    label: "Board brief",
    maxTopItems: 3 as const,
    packType: "ExecutiveRiskSummary" as EvidencePackType
  },
  {
    audience: "Technical" as const,
    label: "Technical review",
    maxTopItems: 5 as const,
    packType: "ValidationSnapshotReport" as EvidencePackType
  },
  {
    audience: "Auditor" as const,
    label: "Assurance",
    maxTopItems: 5 as const,
    packType: "ValidationSnapshotReport" as EvidencePackType
  }
] as const;

const REPORT_TYPE_OPTIONS: Array<{
  label: string;
  value: EvidencePackType;
}> = [
  { label: "Board pack (Executive Risk Summary)", value: "ExecutiveRiskSummary" },
  { label: "Validation Snapshot", value: "ValidationSnapshotReport" },
  ...COMPLIANCE_PACK_TYPES.map((value) => ({
    label: COMPLIANCE_CATALOG[value]?.displayName ?? value,
    value
  }))
];

/** Deep-link from Executive "Build board pack" → board pack default path. */
function packTypeFromSearch(raw: string | null): EvidencePackType | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (
    value === "board" ||
    value === "executive" ||
    value === "executiverisksummary" ||
    value === "executive_risk_summary"
  ) {
    return "ExecutiveRiskSummary";
  }
  if (
    value === "snapshot" ||
    value === "validation" ||
    value === "validationsnapshotreport"
  ) {
    return "ValidationSnapshotReport";
  }
  const known = REPORT_TYPE_OPTIONS.find(
    (option) => option.value.toLowerCase() === value
  );
  return known?.value ?? null;
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function triggerDownload(payload: ReportDownloadPayload) {
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

function absoluteShareUrl(url: string) {
  return new URL(url, window.location.origin).toString();
}

export function ReportsWorkbench() {
  const snapshots = useApiResource(() => api.listSnapshots(), []);
  const packs = useApiResource(() => api.listReports({ limit: 50 }), []);
  const integrity = useApiResource(() => api.verifyEvidenceChain(), []);

  const [audience, setAudience] =
    useState<(typeof AUDIENCES)[number]>("Executive");
  // ICP-P1-5: default Board brief path uses real ExecutiveRiskSummary pack type.
  // Executive "Build board pack" deep-links with ?pack=board (applied below).
  const [packType, setPackType] = useState<EvidencePackType>(
    "ExecutiveRiskSummary"
  );
  const [maxTopItems, setMaxTopItems] = useState<number>(3);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromQuery = packTypeFromSearch(
      new URLSearchParams(window.location.search).get("pack")
    );
    if (fromQuery) {
      setPackType(fromQuery);
      if (fromQuery === "ExecutiveRiskSummary") {
        setAudience("Executive");
        setMaxTopItems(3);
      }
    }
  }, []);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);
  const [isolationBusy, setIsolationBusy] = useState(false);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [htmlBusy, setHtmlBusy] = useState(false);
  const [htmlError, setHtmlError] = useState<string | null>(null);

  async function preview(snapshotId: string) {
    setPreviewId(snapshotId);
    setHtmlBusy(true);
    setHtmlError(null);
    try {
      setHtml(await api.getSnapshotReportHtml(snapshotId));
    } catch (caught) {
      setHtml(null);
      setHtmlError(
        caught instanceof Error ? caught.message : "Unable to load the report."
      );
    } finally {
      setHtmlBusy(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setGenError(null);
    setGenSuccess(null);
    try {
      if (packType === "ValidationSnapshotReport") {
        const snapshot = await api.createSnapshot({ audience, maxTopItems });
        await Promise.all([snapshots.refetch(), packs.refetch()]);
        await preview(snapshot.snapshotId);
      } else {
        const sourceSnapshot = snapshots.data?.[0];
        const packTitle =
          packType === "ExecutiveRiskSummary"
            ? "Executive Risk Summary (board pack)"
            : `${COMPLIANCE_CATALOG[packType]?.displayName ?? packType} measured control trace`;
        const pack = await api.createReport({
          audience,
          maxTopItems,
          packType,
          snapshotId: sourceSnapshot?.snapshotId,
          title: packTitle
        });
        await Promise.all([snapshots.refetch(), packs.refetch()]);
        if (sourceSnapshot) await preview(sourceSnapshot.snapshotId);
        setGenSuccess(`${pack.title} is ready to export.`);
      }
    } catch (caught) {
      setGenError(
        caught instanceof Error
          ? caught.message
          : "Unable to generate the report."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function generateIsolationProof() {
    setIsolationBusy(true);
    setGenError(null);
    setGenSuccess(null);
    try {
      const proof = await api.createTenantIsolationProof();
      await packs.refetch();
      const failed = proof.controlResults.filter(
        (control) => control.status === "Fail"
      ).length;
      setGenSuccess(
        `Tenant isolation proof is ready: ${proof.rls.tenantScopedTableCount - proof.rls.uncoveredTables.length}/${proof.rls.tenantScopedTableCount} tenant tables covered, ${failed} failed controls.`
      );
    } catch (caught) {
      setGenError(
        caught instanceof Error
          ? caught.message
          : "Unable to generate tenant-isolation proof."
      );
    } finally {
      setIsolationBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Prove
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Proof composer
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Leadership-ready proof, built from validated evidence — never a raw
          module dump. Generate a Snapshot, preview it, and share or export the
          pack.
        </p>
        {/* UX-W9 / #199 — integrity watermark note for claim-safe exports */}
        <p
          data-testid="export-integrity-note"
          className="mt-2 max-w-2xl font-mono text-[11px] leading-snug text-subtle"
        >
          Exports use claim-safe language and include integrity hashes when
          available.
        </p>
        {/* P06 GRC: Compliance stays off Operate ≤10; discoverable from Reports. */}
        <p className="mt-2 text-sm text-muted">
          GRC control matrix and measured evidence packs:{" "}
          <Link
            href="/compliance"
            data-testid="reports-to-compliance"
            className="font-semibold text-brand hover:text-brand-2"
          >
            Open Compliance control trace →
          </Link>
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Left column: generate + snapshots + packs */}
        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <PanelHeader
              title={
                <span className="inline-flex items-center gap-2">
                  Compose audience variant
                  <InfoPopover label="report audience variant">
                    Audience and item limits change emphasis and presentation;
                    they do not change evidence state. Review inclusion,
                    freshness, integrity, redaction, and delivery before
                    generating.
                  </InfoPopover>
                </span>
              }
            />
            <div className="flex flex-col gap-3 p-4">
              <div className="grid grid-cols-2 gap-2 rounded-control border border-line bg-bg p-3 text-[11px] sm:grid-cols-3">
                <ComposerFact
                  label="Inclusion"
                  value={`${Math.min(maxTopItems, snapshots.data?.[0]?.topAttackPaths.length ?? 0)} priority paths · ${snapshots.data?.[0]?.evidenceIds.length ?? 0} evidence`}
                />
                <ComposerFact
                  label="Freshness"
                  value={
                    snapshots.data?.[0]
                      ? new Date(snapshots.data[0].updatedAt).toLocaleString()
                      : "No snapshot"
                  }
                />
                <ComposerFact
                  label="Integrity"
                  value={
                    integrity.loading
                      ? "Verifying…"
                      : integrity.data?.valid
                        ? `Verified · ${integrity.data.checked} links`
                        : integrity.error
                          ? "Unavailable"
                          : "Needs review"
                  }
                />
                <ComposerFact label="Audience" value={audience} />
                <ComposerFact
                  label="Redaction"
                  value={
                    packs.data?.[0]?.redactionLevel ??
                    "Applied at pack generation"
                  }
                />
                <ComposerFact
                  label="Delivery"
                  value="Tokenized · expiry visible before sharing"
                />
              </div>
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                Pack type
                <select
                  value={packType}
                  onChange={(event) =>
                    setPackType(event.target.value as EvidencePackType)
                  }
                  className="h-10 w-full min-w-0 max-w-full rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                >
                  {REPORT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">
                  Report preset
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {REPORT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      data-testid={`report-preset-${preset.label.toLowerCase().replace(/\s+/g, "-")}`}
                      onClick={() => {
                        setAudience(preset.audience);
                        setMaxTopItems(preset.maxTopItems);
                        setPackType(preset.packType);
                      }}
                      className={cn(
                        "rounded-control border px-3 py-1.5 text-[12.5px] transition-colors",
                        audience === preset.audience &&
                          maxTopItems === preset.maxTopItems &&
                          packType === preset.packType
                          ? "border-brand/60 bg-brand/12 text-ink"
                          : "border-line text-muted hover:text-ink"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AUDIENCES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAudience(a)}
                    className={cn(
                      "rounded-control border px-3 py-1.5 text-[12.5px] transition-colors",
                      audience === a
                        ? "border-brand/60 bg-brand/12 text-ink"
                        : "border-line text-muted hover:text-ink"
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <label className="flex max-w-44 flex-col gap-1.5 text-xs font-medium text-muted">
                Priority items shown
                <select
                  value={maxTopItems}
                  onChange={(event) =>
                    setMaxTopItems(Number(event.target.value))
                  }
                  className="h-9 rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
                >
                  {TOP_ITEM_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      Top {count}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[12px] text-subtle">
                {packType === "ExecutiveRiskSummary"
                  ? "Board pack: Executive Risk Summary with Measured/Heuristic path honesty and Fixed-only-via-verification. Not a certification or audit attestation."
                  : packType !== "ValidationSnapshotReport"
                    ? "Customer evidence-support pack: per-control Met, Partial, and Unmet status from the latest persisted snapshot. Not a certification and not an audit opinion; not a vendor SOC 2 Type II or formal framework attestation."
                    : audience === "Executive"
                      ? "Board-level snapshot variant: control effectiveness, validated exposure, path risk, remediation velocity. Prefer Board pack type for the dedicated executive pack."
                      : "Analyst-level: priority attack paths, evidence certainty, control observations, and artifact detail."}
              </p>
              <div>
                <button
                  type="button"
                  onClick={generate}
                  disabled={generating}
                  className={buttonClassName({ variant: "primary" })}
                >
                  {generating
                    ? "Generating…"
                    : packType === "ValidationSnapshotReport"
                      ? "Generate & preview"
                      : packType === "ExecutiveRiskSummary"
                        ? "Generate board pack"
                        : "Generate evidence pack"}
                </button>
              </div>
              {genError ? (
                <p role="alert" className="text-sm text-missed">
                  {genError}
                </p>
              ) : null}
              {genSuccess ? (
                <p role="status" className="text-sm text-fixed">
                  {genSuccess}
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel
            data-testid="isolation-proof-panel"
            className="border-brand/35 bg-[linear-gradient(180deg,rgba(34,63,160,0.12),rgba(9,20,47,0.04))]"
          >
            <PanelHeader
              title="Tenant isolation proof · MSSP / CISO diligence"
              actions={
                <StateBadge tone="approval" dot={false}>
                  Diligence pack
                </StateBadge>
              }
            />
            <div className="flex flex-col gap-3 p-4">
              <p
                className="rounded-control border border-brand/30 bg-brand/8 px-3 py-2 text-[12.5px] leading-relaxed text-ink"
                data-testid="isolation-proof-diligence-callout"
              >
                <strong className="text-brand">Primary diligence CTA.</strong>{" "}
                Generate a live isolation proof for procurement, MSSP
                multi-tenant review, and CISO security questionnaires. Records
                Fail / NotConfigured honestly — never assumes compliance or
                vendor SOC 2 Type II.
              </p>
              <p className="text-sm text-muted">
                Inspect live PostgreSQL RLS coverage, the tenant evidence chain,
                configured data region, encryption posture, and governed report
                sharing.
              </p>
              <div>
                <button
                  className={buttonClassName({ variant: "primary" })}
                  disabled={isolationBusy}
                  onClick={generateIsolationProof}
                  type="button"
                  data-testid="generate-isolation-proof"
                >
                  {isolationBusy
                    ? "Inspecting controls…"
                    : "Generate isolation proof"}
                </button>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Recent snapshots" />
            {snapshots.loading ? (
              <LoadingSkeleton rows={3} />
            ) : snapshots.error ? (
              <ErrorState
                message={snapshots.error}
                onRetry={snapshots.refetch}
              />
            ) : (snapshots.data ?? []).length === 0 ? (
              <EmptyState
                className="m-3 py-8"
                title="No snapshots yet"
                description="Generate a Validation Snapshot above to preview an evidence-backed report."
              />
            ) : (
              <ul className="m-0 list-none p-0">
                {(snapshots.data ?? []).map((snapshot) => (
                  <li key={snapshot.snapshotId}>
                    <button
                      type="button"
                      onClick={() => preview(snapshot.snapshotId)}
                      aria-current={previewId === snapshot.snapshotId}
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface",
                        previewId === snapshot.snapshotId && "bg-brand/5"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-ink">
                          {snapshot.evidencePack.title}
                        </p>
                        <p className="font-mono text-[11px] text-subtle">
                          {snapshot.evidencePack.audience} ·{" "}
                          {snapshot.metrics.highRiskPathCount} high-risk paths ·{" "}
                          {relTime(snapshot.createdAt)}
                        </p>
                        {/* UX-W11: claim-language preview for report list — never raw Validated */}
                        <p
                          className="mt-0.5 font-mono text-[10.5px] text-muted"
                          data-testid="reports-snapshot-claim-preview"
                        >
                          {formatSnapshotPathClaimPreview(
                            snapshot.topAttackPaths
                          )}
                        </p>
                      </div>
                      <span
                        aria-hidden
                        className="ml-auto font-mono text-xs text-brand"
                      >
                        view →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Evidence packs" />
            {packs.loading ? (
              <LoadingSkeleton rows={3} />
            ) : packs.error ? (
              <ErrorState message={packs.error} onRetry={packs.refetch} />
            ) : (packs.data ?? []).length === 0 ? (
              <div className="p-4">
                <NotConfigured
                  title="No evidence packs yet"
                  message="Packs are produced when you generate a report or run a scheduled validation."
                />
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {(packs.data ?? []).map((pack) => (
                  <PackRow key={pack.evidencePackId} pack={pack} />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Right column: preview */}
        <Panel className="flex min-w-0 flex-col">
          <PanelHeader
            title="Report preview"
            actions={
              html && previewId ? (
                <a
                  href={`/api/v1/snapshots/${previewId}/report`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand hover:text-brand-2"
                >
                  Open full report ↗
                </a>
              ) : null
            }
          />
          {htmlBusy ? (
            <LoadingSkeleton rows={8} />
          ) : htmlError ? (
            <ErrorState message={htmlError} />
          ) : html ? (
            <iframe
              title="Snapshot report preview"
              srcDoc={html}
              sandbox=""
              className="h-[640px] w-full bg-white"
            />
          ) : (
            <div className="flex h-[640px] flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="font-display text-sm font-semibold text-ink">
                Nothing to preview yet
              </p>
              <p className="max-w-xs text-[12.5px] text-muted">
                Generate a Snapshot or pick a recent one to preview the
                leadership-ready report here.
              </p>
            </div>
          )}
          <p className="border-t border-line px-4 py-2.5 text-[11px] text-subtle">
            Methodology &amp; safety: reports summarize only validated,
            evidence-backed results. Sensitive artifacts are redacted before
            they reach a pack; shared links are tokenized and expire.
          </p>
        </Panel>
      </div>
      {(packs.data?.length ?? 0) > 0 ? (
        <WorkflowFeedback
          route="/reports"
          stage="Prove"
          prompt="Was the evidence basis, audience, and governed delivery clear?"
        />
      ) : null}
    </div>
  );
}

function ComposerFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-display text-[9px] font-semibold uppercase tracking-wide text-subtle">
        {label}
      </p>
      <p className="mt-0.5 truncate text-muted" title={value}>
        {value}
      </p>
    </div>
  );
}

function PackRow({ pack }: { pack: EvidencePack }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<ReportShareLink | null>(null);
  const [shares, setShares] = useState<ReportShareGrant[]>([]);
  const [showShares, setShowShares] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setBusy("share");
    setError(null);
    try {
      const link = await api.createReportShareLink(pack.evidencePackId);
      setShareLink(link);
      setShares((current) => [
        link,
        ...current.filter((item) => item.reportShareId !== link.reportShareId)
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't create a link."
      );
    } finally {
      setBusy(null);
    }
  }

  async function manageShares() {
    if (showShares) {
      setShowShares(false);
      return;
    }
    setBusy("manage");
    setError(null);
    try {
      setShares(await api.listReportShareLinks(pack.evidencePackId));
      setShowShares(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't load links."
      );
    } finally {
      setBusy(null);
    }
  }

  async function revoke(share: ReportShareGrant) {
    setBusy(`revoke:${share.reportShareId}`);
    setError(null);
    try {
      const updated = await api.revokeReportShareLink(
        pack.evidencePackId,
        share.reportShareId
      );
      setShares((current) =>
        current.map((item) =>
          item.reportShareId === updated.reportShareId ? updated : item
        )
      );
      if (shareLink?.reportShareId === updated.reportShareId)
        setShareLink(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't revoke link."
      );
    } finally {
      setBusy(null);
    }
  }

  async function exportPack(format: "html" | "pdf") {
    setBusy(format);
    setError(null);
    try {
      triggerDownload(await api.exportReport(pack.evidencePackId, { format }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-col items-start gap-3 sm:flex-row">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink">{pack.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-subtle">
            {pack.packType} · {pack.evidenceIds.length} evidence
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-control border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
              {pack.audience}
            </span>
            <StateBadge
              tone={REDACTION_TONE[pack.redactionLevel] ?? "neutral"}
              dot={false}
            >
              {pack.redactionLevel}
            </StateBadge>
            <StateBadge tone="neutral" dot={false}>
              {pack.status}
            </StateBadge>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5 sm:ml-auto">
          <button
            type="button"
            onClick={share}
            disabled={busy !== null}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {busy === "share" ? "…" : "Share"}
          </button>
          <button
            type="button"
            onClick={manageShares}
            disabled={busy !== null}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {busy === "manage" ? "…" : showShares ? "Hide links" : "Manage"}
          </button>
          <button
            type="button"
            onClick={() => exportPack("html")}
            disabled={busy !== null}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {busy === "html" ? "…" : "HTML"}
          </button>
          <button
            type="button"
            onClick={() => exportPack("pdf")}
            disabled={busy !== null}
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            {busy === "pdf" ? "…" : "PDF"}
          </button>
        </div>
      </div>
      {shareLink ? (
        <div className="mt-2 flex items-center gap-2 rounded-control border border-line bg-surface px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11px] text-brand">
              {absoluteShareUrl(shareLink.url)}
            </p>
            <p className="mt-0.5 text-[10px] text-subtle">
              Expires {new Date(shareLink.expiresAt).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  absoluteShareUrl(shareLink.url)
                );
                setCopied(true);
              } catch {
                setError("Copy is unavailable. Select the link text instead.");
              }
            }}
            className={buttonClassName({ size: "sm", variant: "ghost" })}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}
      {showShares ? (
        <div className="mt-2 rounded-control border border-line bg-surface">
          <p className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
            Share grants
          </p>
          {shares.length === 0 ? (
            <p className="px-3 py-3 text-xs text-subtle">
              No share links issued.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {shares.map((share) => {
                const expired =
                  new Date(share.expiresAt).getTime() <= Date.now();
                const active = !share.revokedAt && !expired;
                return (
                  <li
                    key={share.reportShareId}
                    className="flex flex-col gap-2 border-b border-line px-3 py-2.5 last:border-b-0 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1 text-[11px] text-muted">
                      <p className="font-medium text-ink">
                        {active
                          ? "Active"
                          : share.revokedAt
                            ? "Revoked"
                            : "Expired"}
                        {` · ${share.accessCount} ${share.accessCount === 1 ? "open" : "opens"}`}
                      </p>
                      <p>
                        Expires {new Date(share.expiresAt).toLocaleString()}
                        {share.lastAccessedAt
                          ? ` · last opened ${new Date(share.lastAccessedAt).toLocaleString()}`
                          : " · never opened"}
                      </p>
                    </div>
                    {active ? (
                      <button
                        type="button"
                        onClick={() => revoke(share)}
                        disabled={busy !== null}
                        className={buttonClassName({
                          size: "sm",
                          variant: "ghost"
                        })}
                      >
                        {busy === `revoke:${share.reportShareId}`
                          ? "Revoking…"
                          : "Revoke"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
      {error ? <p className="mt-1.5 text-[12px] text-missed">{error}</p> : null}
    </li>
  );
}
