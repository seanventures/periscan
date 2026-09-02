"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type {
  Asset,
  AssetLineage,
  AssetOwnershipEntry,
  AssetOwnershipReview,
  AssetOwnershipReviewDisposition,
  AssetOwnershipSurface,
  AssetSourceObservation,
  DataFabricQualitySurface,
  DataFabricSourceQualityState,
  ScanFileImportHonesty,
  ScanImportFormat,
  ScanImportResult
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  Button,
  InlineError,
  LoadingSkeleton,
  NotConfigured,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName
} from "../ui";
import { cn } from "../ui/cn";

const SCAN_IMPORT_FORMATS: ScanImportFormat[] = ["nessus", "csv", "sarif"];

function formatObservedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatPercent(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    style: "percent"
  }).format(value);
}

function assetSubtitle(asset: Asset) {
  return [asset.assetType, asset.environment, asset.businessCriticality]
    .filter(Boolean)
    .join(" · ");
}

function resolutionTone(status: AssetSourceObservation["resolutionStatus"]) {
  if (status === "Matched") return "validated" as const;
  if (status === "Created") return "brand" as const;
  if (status === "ConflictMatched") return "approval" as const;
  return "missed" as const;
}

function ownershipTone(status: AssetOwnershipEntry["ownershipStatus"]) {
  if (status === "ExactScope") return "validated" as const;
  if (status === "InheritedDomain") return "brand" as const;
  return "approval" as const;
}

function ownershipLabel(status: AssetOwnershipEntry["ownershipStatus"]) {
  if (status === "ExactScope") return "Exact verified scope";
  if (status === "InheritedDomain") return "Verified domain descendant";
  return "Ownership unconfirmed";
}

export function DataFabricWorkbench() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [lineage, setLineage] = useState<AssetLineage | null>(null);
  const [ownership, setOwnership] = useState<AssetOwnershipSurface | null>(
    null
  );
  const [quality, setQuality] = useState<DataFabricQualitySurface | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [loadingLineage, setLoadingLineage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAssets() {
    setLoadingAssets(true);
    setError(null);
    try {
      const [nextAssets, nextOwnership, nextQuality] = await Promise.all([
        api.listAssets(),
        api.getAssetOwnershipSurface(),
        api.getDataFabricQualitySurface()
      ]);
      setAssets(nextAssets);
      setOwnership(nextOwnership);
      setQuality(nextQuality);
      setSelectedId((current) =>
        current && nextAssets.some((asset) => asset.assetId === current)
          ? current
          : (nextAssets[0]?.assetId ?? "")
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load the data fabric."
      );
    } finally {
      setLoadingAssets(false);
    }
  }

  useEffect(() => {
    void loadAssets();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setLineage(null);
      return;
    }
    let active = true;
    setLoadingLineage(true);
    setError(null);
    void api
      .getAssetLineage(selectedId)
      .then((nextLineage) => {
        if (active) setLineage(nextLineage);
      })
      .catch((caught: unknown) => {
        if (active) {
          setLineage(null);
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load asset lineage."
          );
        }
      })
      .finally(() => {
        if (active) setLoadingLineage(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.assetId === selectedId) ?? null,
    [assets, selectedId]
  );

  async function reviewOwnershipCandidate(
    assetId: string,
    disposition: AssetOwnershipReviewDisposition,
    note: string
  ) {
    const review = await api.reviewAssetOwnershipCandidate(assetId, {
      disposition,
      note
    });
    setOwnership((current) =>
      current
        ? {
            ...current,
            entries: current.entries.map((entry) =>
              entry.asset.assetId === assetId ? { ...entry, review } : entry
            )
          }
        : current
    );
    return review;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Setup / Assets & ownership"
        title="What you know, own, and may test"
        description="Canonical inventory, ownership confidence, and source lineage. Authorize and verify customer scope on Scope (/scopes); this workspace is inventory, not the authorize home."
        actions={
          <Link
            href="/scopes"
            className="inline-flex items-center gap-1.5 rounded-control bg-brand-fill px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-2"
          >
            Open Scope
          </Link>
        }
      />

      {loadingAssets ? (
        <LoadingSkeleton rows={7} />
      ) : error && assets.length === 0 ? (
        <ErrorState message={error} onRetry={loadAssets} />
      ) : assets.length === 0 ? (
        <NotConfigured
          title="No source observations yet"
          message="Connect and sync a supported source, then authorize verified scope. Periscan builds this inventory from persisted connector observations and does not generate sample assets in a customer workspace."
          action={{ href: "/integrations", label: "Connect a source" }}
        />
      ) : (
        <div className="space-y-5">
          {quality ? <SourceQualitySurface surface={quality} /> : null}
          {quality?.scanFileImport ? (
            <ScanFileImportHonestyPanel honesty={quality.scanFileImport} />
          ) : null}
          {ownership ? (
            <OwnershipSurface
              surface={ownership}
              onSelectAsset={setSelectedId}
              onReview={reviewOwnershipCandidate}
            />
          ) : null}
          <div className="grid min-w-0 gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
            <Panel className="self-start xl:sticky xl:top-6">
              <PanelHeader
                title="Canonical assets"
                actions={
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#cfe0ff]">
                    {assets.length} observed
                  </span>
                }
              />
              <div className="max-h-[68vh] overflow-y-auto p-2">
                {assets.map((asset) => {
                  const active = asset.assetId === selectedId;
                  return (
                    <button
                      key={asset.assetId}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedId(asset.assetId)}
                      className={cn(
                        "w-full rounded-control border px-3 py-3 text-left transition-colors",
                        active
                          ? "border-brand bg-brand/[0.1] shadow-[inset_2px_0_0_#5aa7ff]"
                          : "border-transparent hover:border-line hover:bg-elevated"
                      )}
                    >
                      <span className="block truncate text-sm font-semibold text-ink">
                        {asset.name}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[10px] uppercase tracking-[0.06em] text-subtle">
                        {assetSubtitle(asset)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <div className="min-w-0 space-y-5">
              {loadingLineage ? (
                <LoadingSkeleton rows={7} />
              ) : error ? (
                <ErrorState
                  message={error}
                  onRetry={async () => {
                    if (!selectedId) return;
                    setLoadingLineage(true);
                    try {
                      setLineage(await api.getAssetLineage(selectedId));
                      setError(null);
                    } finally {
                      setLoadingLineage(false);
                    }
                  }}
                />
              ) : lineage && selectedAsset ? (
                <LineageDetail lineage={lineage} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function qualityTone(state: DataFabricSourceQualityState) {
  if (state === "Qualified") return "validated" as const;
  if (state === "Degraded" || state === "Stale") return "approval" as const;
  if (state === "Disconnected") return "missed" as const;
  return "neutral" as const;
}

/**
 * P11R-4 / P19-r4: BYO scan import on Assets workbench.
 * API path is real (productPath=ApiAvailable); web upload is shipped
 * (uiUpload=true). Status stays Partial while raw EvidenceArtifact chain is
 * incomplete. Imported ≠ Measured — never claim full evidence chain.
 */
function ScanFileImportHonestyPanel({
  honesty
}: {
  honesty: ScanFileImportHonesty;
}) {
  const [format, setFormat] = useState<ScanImportFormat>(
    honesty.formats[0] ?? "csv"
  );
  const [content, setContent] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanImportResult | null>(null);

  const apiAvailable = honesty.productPath === "ApiAvailable";
  const uploadAvailable = apiAvailable && honesty.uiUpload;

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      setContent(text);
      if (!label.trim()) {
        setLabel(file.name.slice(0, 240));
      }
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".nessus") || lower.endsWith(".xml")) {
        setFormat("nessus");
      } else if (lower.endsWith(".sarif") || lower.endsWith(".json")) {
        setFormat("sarif");
      } else if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
        setFormat("csv");
      }
    } catch {
      setError("Unable to read the selected file as UTF-8 text.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!uploadAvailable || !content.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const next = await api.importScanFile({
        content,
        format,
        label: label.trim() || null
      });
      setResult(next);
      setContent("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to import scan file."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!apiAvailable) {
    return (
      <Panel aria-label="Scan file import">
        <PanelHeader title="Scan file import" />
        <div className="p-5">
          <NotConfigured
            title="Scan import API not configured"
            message="The data-fabric scan-import product path is not available in this deployment. Connect live inventory sources instead of BYO files."
            action={{ href: "/integrations", label: "Connect a source" }}
          />
        </div>
      </Panel>
    );
  }

  return (
    <Panel aria-label="Scan file import">
      <PanelHeader
        title="Scan file import"
        actions={
          <StateBadge tone="approval">{honesty.status}</StateBadge>
        }
      />
      <div className="space-y-4 p-5">
        <div
          className="rounded-control border border-line bg-elevated/60 px-3 py-2 text-xs leading-5 text-muted"
          role="status"
        >
          <span className="font-semibold text-ink">
            API available · product path {honesty.productPath}
          </span>
          {" · "}
          <span className="font-semibold text-ink">
            Imported ≠ Measured
          </span>
          {" · "}
          evidenceBasis={honesty.evidenceBasis} (never Measured / Validated).
          Honesty status is{" "}
          <span className="font-semibold text-ink">{honesty.status}</span>
          {" — "}
          raw-file EvidenceArtifact integrity chain may be incomplete; do not
          treat import as a full evidence chain, living map, or validated
          exposure. Prefer live connectors for continuous inventory.
        </div>
        <p className="text-sm leading-6 text-muted">{honesty.detail}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle">
          Formats · {honesty.formats.join(" · ")} · library available ·
          uiUpload={String(honesty.uiUpload)}
        </p>

        {uploadAvailable ? (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
            <label className="grid gap-1 text-sm text-muted">
              Format
              <select
                aria-label="Scan file format"
                className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-line-strong"
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as ScanImportFormat)
                }
              >
                {SCAN_IMPORT_FORMATS.filter((item) =>
                  honesty.formats.includes(item)
                ).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm text-muted">
              Label (optional)
              <input
                aria-label="Import label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Filename or ticket ref"
                maxLength={240}
                className="rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong"
              />
            </label>
            <label className="grid gap-1 text-sm text-muted sm:col-span-2">
              Scan file
              <input
                aria-label="Scan file upload"
                type="file"
                accept=".nessus,.xml,.csv,.tsv,.sarif,.json,text/csv,application/json,text/xml"
                onChange={(event) =>
                  void onFileSelected(event.target.files?.[0] ?? null)
                }
                className="block w-full text-sm text-muted file:mr-3 file:rounded-control file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink"
              />
            </label>
            <label className="grid gap-1 text-sm text-muted sm:col-span-2">
              Or paste JSON / CSV / Nessus body
              <textarea
                aria-label="Scan file content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={6}
                placeholder="Paste scoped export contents (UTF-8, max ~5 MiB)."
                className="resize-y rounded-control border border-line bg-surface px-3 py-2 font-mono text-xs text-ink outline-none placeholder:text-subtle focus:border-line-strong"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={busy || !content.trim()}
                className={buttonClassName({ size: "sm", variant: "primary" })}
              >
                {busy ? "Importing…" : "Import as Imported signals"}
              </button>
              <Link
                href="/integrations"
                className="inline-flex items-center rounded-control border border-line px-3 py-1.5 text-sm font-semibold text-muted hover:border-line-strong hover:text-ink"
              >
                Prefer live connectors
              </Link>
              {result ? (
                <span className="text-sm text-fixed" role="status">
                  Imported {result.signalCount} signal
                  {result.signalCount === 1 ? "" : "s"} from{" "}
                  {result.findingCount} finding
                  {result.findingCount === 1 ? "" : "s"} ({result.format}).
                  evidenceBasis={result.evidenceBasis} — prioritization input
                  only, not Measured.
                </span>
              ) : null}
              {error ? (
                <span className="text-sm text-missed" role="alert">
                  {error}
                </span>
              ) : null}
            </div>
            {result?.disclaimer ? (
              <p className="text-xs leading-5 text-muted sm:col-span-2">
                {result.disclaimer}
              </p>
            ) : null}
          </form>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Link
              href="/integrations"
              className="inline-flex items-center rounded-control bg-brand-fill px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-2"
            >
              Use live connectors
            </Link>
            <span className="inline-flex items-center rounded-control border border-line px-3 py-1.5 text-sm text-muted">
              Upload path not available
            </span>
          </div>
        )}
      </div>
    </Panel>
  );
}

function SourceQualitySurface({
  surface
}: {
  surface: DataFabricQualitySurface;
}) {
  const { entries, summary } = surface;
  return (
    <Panel aria-label="Data source quality">
      <PanelHeader
        title="Data source quality"
        actions={
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#cfe0ff]">
            {summary.qualified}/{summary.total} qualified
          </span>
        }
      />
      <div className="grid gap-px border-b border-line bg-line sm:grid-cols-4">
        <Metric label="Qualified" value={String(summary.qualified)} />
        <Metric
          attention={summary.degraded > 0}
          label="Degraded"
          value={String(summary.degraded)}
        />
        <Metric
          attention={summary.stale > 0}
          label="Stale"
          value={String(summary.stale)}
        />
        <Metric
          attention={summary.pendingFirstSync + summary.disconnected > 0}
          label="Not producing"
          value={String(summary.pendingFirstSync + summary.disconnected)}
        />
      </div>
      <div className="border-b border-line px-5 py-3 text-xs leading-5 text-muted">
        Qualification requires a connected, healthy source inside its sync
        budget with normalized observations or signals. It is current operating
        evidence, not a claim that every vendor feature was live-tested.
      </div>
      {entries.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-muted">
          <p>No connector quality records are available.</p>
          <a
            className="font-semibold text-brand hover:text-brand-2"
            href="/integrations"
          >
            Connect a source
          </a>
        </div>
      ) : (
        <ol className="divide-y divide-line">
          {entries.map((entry) => (
            <li
              key={entry.integrationId}
              className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_10rem_12rem] md:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {entry.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {entry.issues[0] ??
                    `${entry.assetObservationCount} asset observations and ${entry.signalCount} signals are current.`}
                </p>
              </div>
              <StateBadge tone={qualityTone(entry.state)}>
                {entry.state === "PendingFirstSync"
                  ? "First sync pending"
                  : entry.state}
              </StateBadge>
              <div className="md:text-right">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                  {entry.lastSyncAt
                    ? `${entry.ageHours ?? 0}h old / ${entry.freshnessBudgetHours}h budget`
                    : "No completed sync"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {entry.healthStatus} ·{" "}
                  {entry.assetObservationCount + entry.signalCount} evidence
                  records
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function OwnershipSurface({
  onSelectAsset,
  onReview,
  surface
}: {
  onSelectAsset: (assetId: string) => void;
  onReview: (
    assetId: string,
    disposition: AssetOwnershipReviewDisposition,
    note: string
  ) => Promise<AssetOwnershipReview>;
  surface: AssetOwnershipSurface;
}) {
  const { entries, summary } = surface;
  return (
    <Panel aria-label="External ownership confidence">
      <PanelHeader
        title="External ownership confidence"
        actions={
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#cfe0ff]">
            {summary.verifiedRootCount} verified roots
          </span>
        }
      />
      <div className="grid gap-px border-b border-line bg-line sm:grid-cols-4">
        <Metric
          label="Attributed"
          value={String(summary.attributedAssetCount)}
        />
        <Metric
          label="Internet-facing"
          value={String(summary.internetFacingAssetCount)}
        />
        <Metric
          label="Mean confidence"
          value={formatPercent(summary.averageAttributedConfidence)}
        />
        <Metric
          attention={summary.unattributedCandidateCount > 0}
          label="Review candidates"
          value={String(summary.unattributedCandidateCount)}
        />
      </div>
      <div className="border-b border-line px-5 py-3 text-xs leading-5 text-muted">
        Periscan confirms ownership only from verified domain scope. Descendants
        inherit that authorization boundary; unmatched internet-facing records
        stay visible as candidates and are never presented as customer-owned.
      </div>
      {entries.length === 0 ? (
        <div className="p-5 text-sm text-muted">
          No internet-facing or verified-domain assets are present in the
          persisted inventory.
        </div>
      ) : (
        <ol className="divide-y divide-line">
          {entries.map((entry) => (
            <li
              key={entry.asset.assetId}
              className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_12rem_9rem] lg:items-center"
            >
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectAsset(entry.asset.assetId)}
                  className="truncate text-left text-sm font-semibold text-ink hover:text-brand-2"
                >
                  {entry.asset.name}
                </button>
                <p className="mt-1 break-words text-xs leading-5 text-muted">
                  {entry.basis}
                </p>
              </div>
              <div>
                <StateBadge tone={ownershipTone(entry.ownershipStatus)}>
                  {ownershipLabel(entry.ownershipStatus)}
                </StateBadge>
                <p className="mt-2 font-mono text-[10px] text-subtle">
                  {entry.sourceCount} sources · {entry.evidenceIds.length}{" "}
                  evidence
                </p>
              </div>
              <div className="lg:text-right">
                <p className="font-display text-xl font-semibold text-ink">
                  {formatPercent(entry.confidence)}
                </p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle">
                  {entry.lifecycle} · ownership
                </p>
              </div>
              {entry.ownershipStatus === "UnattributedCandidate" ? (
                <OwnershipCandidateReview entry={entry} onReview={onReview} />
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function OwnershipCandidateReview({
  entry,
  onReview
}: {
  entry: AssetOwnershipEntry;
  onReview: (
    assetId: string,
    disposition: AssetOwnershipReviewDisposition,
    note: string
  ) => Promise<AssetOwnershipReview>;
}) {
  const [disposition, setDisposition] =
    useState<AssetOwnershipReviewDisposition | null>(null);
  const [note, setNote] = useState(entry.review?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const review = entry.review;

  function begin(next: AssetOwnershipReviewDisposition) {
    setDisposition(next);
    setNote(review?.note ?? "");
    setFeedback(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disposition) return;
    setSaving(true);
    setFeedback(null);
    try {
      await onReview(entry.asset.assetId, disposition, note.trim());
      setDisposition(null);
      setFeedback({
        message:
          disposition === "NeedsVerification"
            ? "Verification requested. Authorized scope has not changed."
            : "Candidate dismissed. Authorized scope has not changed.",
        tone: "success"
      });
    } catch (caught) {
      setFeedback({
        message:
          caught instanceof Error
            ? caught.message
            : "Unable to record the ownership review.",
        tone: "error"
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-line/70 pt-3 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ink">Candidate decision</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Review the source evidence. This decision never creates or verifies
            scope.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => begin("NeedsVerification")}
          >
            Request verification
          </Button>
          <Button size="sm" variant="ghost" onClick={() => begin("Dismissed")}>
            Dismiss candidate
          </Button>
        </div>
      </div>
      {review ? (
        <div className="mt-3 flex flex-wrap items-start gap-3 rounded-control bg-elevated px-3 py-2 text-xs">
          <StateBadge
            tone={review.disposition === "Dismissed" ? "neutral" : "approval"}
          >
            {review.disposition === "Dismissed"
              ? "Dismissed"
              : "Verification requested"}
          </StateBadge>
          <p className="min-w-0 flex-1 leading-5 text-muted">{review.note}</p>
          <time className="font-mono text-[10px] text-subtle">
            {formatObservedAt(review.reviewedAt)}
          </time>
        </div>
      ) : null}
      {disposition ? (
        <form className="mt-3 space-y-3" onSubmit={submit}>
          <label
            className="block text-xs font-semibold text-ink"
            htmlFor={`ownership-review-${entry.asset.assetId}`}
          >
            Review note
          </label>
          <textarea
            id={`ownership-review-${entry.asset.assetId}`}
            autoFocus
            minLength={8}
            maxLength={1000}
            required
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              disposition === "NeedsVerification"
                ? "Name the ownership evidence or verification step needed."
                : "Explain why this source observation is not customer-owned."
            }
            className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-subtle focus:border-brand focus:ring-2 focus:ring-brand/25"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={saving} type="submit">
              Record decision
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => setDisposition(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {feedback ? (
        <InlineError
          className="mt-3"
          message={feedback.message}
          tone={feedback.tone}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}
    </div>
  );
}

function LineageDetail({ lineage }: { lineage: AssetLineage }) {
  const { asset, observations, resolutionSummary } = lineage;
  return (
    <>
      <Panel aria-label="Selected asset resolution summary">
        <div className="border-b border-line bg-[radial-gradient(circle_at_80%_0%,rgba(60,150,255,0.18),transparent_38%),linear-gradient(135deg,#101e43,#0b142b)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-success">
                Canonical record
              </p>
              <h2 className="mt-2 break-words font-display text-2xl font-semibold text-ink">
                {asset.name}
              </h2>
              <p className="mt-1 text-sm text-muted">{assetSubtitle(asset)}</p>
            </div>
            <StateBadge
              tone={asset.status === "Active" ? "validated" : "neutral"}
            >
              {asset.status}
            </StateBadge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-4">
            <Metric
              label="Source systems"
              value={String(resolutionSummary.sourceCount)}
            />
            <Metric label="Observations" value={String(observations.length)} />
            <Metric
              label="Mean confidence"
              value={formatPercent(resolutionSummary.averageConfidence)}
            />
            <Metric
              label="Conflicting reads"
              value={String(lineage.conflictCount)}
              attention={lineage.conflictCount > 0}
            />
          </div>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <FactList title="Canonical identifiers" values={asset.identifiers} />
          <div>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              Resolution contract
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Strong identifiers resolve first. Exact weak identifiers and
              type/name matches follow. Equal candidates create a separate
              ambiguous record; conflicting source values stay in lineage
              instead of replacing the canonical value.
            </p>
          </div>
        </div>
      </Panel>

      {lineage.conflictCount > 0 ? (
        <section className="border-l-2 border-approval bg-approval/[0.06] px-4 py-3">
          <p className="text-sm font-semibold text-ink">
            Source disagreement preserved
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Review the highlighted fields below. Periscan retained the existing
            canonical value and recorded the new observation with its evidence
            link.
          </p>
        </section>
      ) : null}

      <Panel>
        <PanelHeader
          title="Source-to-canonical activity"
          actions={
            lineage.latestObservedAt ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#cfe0ff]">
                Latest {formatObservedAt(lineage.latestObservedAt)}
              </span>
            ) : null
          }
        />
        {observations.length === 0 ? (
          <div className="p-5">
            <NotConfigured
              title="No durable lineage for this asset"
              message="This asset predates source-lineage capture or was created outside a connector sync. Sync its source again to add an evidence-linked observation."
              action={{ href: "/integrations", label: "Open integrations" }}
            />
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {observations.map((observation) => (
              <ObservationRow
                key={observation.sourceObservationId}
                observation={observation}
                canonicalName={asset.name}
              />
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}

function Metric({
  attention = false,
  label,
  value
}: {
  attention?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#0b142b] px-3 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold",
          attention ? "text-approval" : "text-ink"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FactList({
  title,
  values
}: {
  title: string;
  values: Record<string, unknown>;
}) {
  const entries = Object.entries(values);
  return (
    <div>
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
        {title}
      </h3>
      {entries.length ? (
        <dl className="mt-2 divide-y divide-line border-y border-line">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-2 text-xs"
            >
              <dt className="truncate font-mono text-subtle">{key}</dt>
              <dd className="break-all text-ink">{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted">
          No canonical identifiers recorded.
        </p>
      )}
    </div>
  );
}

function ObservationRow({
  canonicalName,
  observation
}: {
  canonicalName: string;
  observation: AssetSourceObservation;
}) {
  return (
    <li className="grid gap-4 p-5 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <div>
        <p className="text-sm font-semibold text-ink">
          {observation.sourceName}
        </p>
        <p className="mt-1 font-mono text-[10px] text-subtle">
          {formatObservedAt(observation.observedAt)}
        </p>
        <div className="mt-3">
          <StateBadge tone={resolutionTone(observation.resolutionStatus)}>
            {observation.resolutionStatus}
          </StateBadge>
        </div>
        <p className="mt-2 text-xs text-muted">
          {formatPercent(observation.resolutionConfidence)} confidence
        </p>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3 text-sm">
          <span className="min-w-0 truncate text-muted">
            {observation.observedName}
          </span>
          <span aria-hidden className="shrink-0 text-brand">
            →
          </span>
          <span className="min-w-0 truncate font-semibold text-ink">
            {canonicalName}
          </span>
        </div>
        {observation.conflictFields.length ? (
          <div
            className="mt-3 flex flex-wrap gap-2"
            aria-label="Conflicting fields"
          >
            {observation.conflictFields.map((field) => (
              <span
                key={field}
                className="rounded-control border border-approval/50 bg-approval/[0.06] px-2 py-1 font-mono text-[10px] text-approval"
              >
                conflict · {field}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <FactList
            title="Observed identifiers"
            values={observation.observedIdentifiers}
          />
          <div>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
              Canonical match keys
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {observation.canonicalKeys.length ? (
                observation.canonicalKeys.map((key) => (
                  <code
                    key={key}
                    className="max-w-full break-all rounded-control border border-line bg-elevated px-2 py-1 text-[10px] text-[#cfe0ff]"
                  >
                    {key}
                  </code>
                ))
              ) : (
                <span className="text-xs text-muted">
                  Type and name fallback
                </span>
              )}
            </div>
            <p className="mt-3 font-mono text-[10px] text-subtle">
              Evidence {observation.evidenceId}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}
