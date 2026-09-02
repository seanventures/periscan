"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  EvidenceArtifact,
  EvidenceArtifactVerification,
  EvidenceChainVerificationReport
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ConfirmDialog,
  ErrorState,
  FilterEmpty,
  InlineError,
  LoadingSkeleton,
  NotConfigured,
  PageHeader,
  PageShell,
  Panel,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";

const SENSITIVITY_TONE: Record<string, StateTone> = {
  Low: "neutral",
  Moderate: "approval",
  High: "missed",
  Restricted: "missed"
};
const REDACTION_TONE: Record<string, StateTone> = {
  NotRequired: "neutral",
  Redacted: "fixed",
  Blocked: "missed"
};

// Related entity → the route that shows it (only entities with a real page).
const ENTITY_ROUTE: Record<string, (id: string) => string> = {
  AttackPath: (id) => `/attack-paths/${id}`,
  Finding: (id) => `/findings?q=${encodeURIComponent(id)}`,
  ValidatedFinding: (id) => `/findings?q=${encodeURIComponent(id)}`,
  Signal: (id) => `/signal-activity?q=${encodeURIComponent(id)}`,
  RemediationTask: (id) => `/remediation/${id}`,
  EvidencePack: () => "/reports",
  ValidationMission: () => "/missions",
  AIApplication: () => "/ai-apps",
  ControlSource: () => "/controls",
  ThreatAdvisory: () => "/threat-center",
  Runner: () => "/runners",
  RunnerTask: () => "/runners",
  Integration: () => "/integrations",
  ThirdPartyTool: () => "/registries"
};

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}
function shortHash(hash: string): string {
  return hash.length > 14 ? `${hash.slice(0, 14)}…` : hash;
}
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
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

export function EvidenceLedger({ initialQuery = "" }: { initialQuery?: string }) {
  const evidence = useApiResource(() => api.listEvidence(), []);
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState("all");
  const [sensitivity, setSensitivity] = useState("all");
  const [chainVerification, setChainVerification] =
    useState<EvidenceChainVerificationReport | null>(null);
  const [chainBusy, setChainBusy] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);

  const all = evidence.data ?? [];

  const types = useMemo(
    () => Array.from(new Set(all.map((e) => e.artifactType))).sort(),
    [all]
  );
  const sensitivities = useMemo(
    () => Array.from(new Set(all.map((e) => e.sensitivityLevel))).sort(),
    [all]
  );
  const redactedCount = all.filter(
    (e) => e.redactionStatus === "Redacted"
  ).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...all]
      .filter((e) => type === "all" || e.artifactType === type)
      .filter((e) => sensitivity === "all" || e.sensitivityLevel === sensitivity)
      .filter(
        (e) =>
          !q ||
          e.evidenceId.toLowerCase().includes(q) ||
          e.sha256.toLowerCase().includes(q) ||
          e.relatedEntityId.toLowerCase().includes(q)
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [all, type, sensitivity, query]);

  async function verifyChain() {
    setChainBusy(true);
    setChainError(null);
    try {
      setChainVerification(await api.verifyEvidenceChain());
    } catch (err) {
      setChainError(
        errorMessage(err, "Evidence chain verification failed. Please try again.")
      );
    } finally {
      setChainBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Investigate · Evidence explorer"
        title="Evidence ledger"
        description="Inspect artifact provenance, integrity, redaction lineage, and claims that cite each receipt. Sensitive raw scanner output stays out of primary UX — controlled download only after you choose it."
        actions={
          <button
            type="button"
            onClick={verifyChain}
            disabled={chainBusy || evidence.loading}
            className={buttonClassName({ variant: "primary" })}
            aria-busy={chainBusy || undefined}
          >
            {chainBusy ? "Verifying chain…" : "Verify chain"}
          </button>
        }
      />

      {chainError ? (
        <InlineError
          message={chainError}
          onDismiss={() => setChainError(null)}
        />
      ) : null}
      {chainVerification ? (
        <ChainVerificationPanel report={chainVerification} />
      ) : null}

      {all.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-mono text-subtle">
            {all.length} artifact{all.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StateBadge tone="fixed" dot={false}>
              Redacted
            </StateBadge>
            <span className="font-mono text-muted">{redactedCount}</span>
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 md:max-w-sm">
          <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Evidence ID, hash, or entity…"
            className="min-w-0 w-full rounded-control border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        <FilterSelect label="Type" value={type} onChange={setType} options={types} />
        <FilterSelect
          label="Sensitivity"
          value={sensitivity}
          onChange={setSensitivity}
          options={sensitivities}
        />
      </div>

      <Panel className="min-w-0 max-w-full">
        {evidence.loading ? (
          <LoadingSkeleton rows={8} />
        ) : evidence.error ? (
          <ErrorState message={evidence.error} onRetry={evidence.refetch} />
        ) : all.length === 0 ? (
          <div className="p-4">
            <NotConfigured
              title="No evidence yet"
              message="Evidence artifacts are recorded as validation runs produce them."
              action={{ href: "/missions", label: "Run a Validation Snapshot" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <FilterEmpty
            title="No artifacts match this search"
            description="Clear the search or sensitivity filter to see the full ledger."
          />
        ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line font-display text-[10px] uppercase tracking-[0.06em] text-subtle">
                  <th className="px-4 py-2.5 font-semibold">Evidence</th>
                  <th className="px-2 py-2.5 font-semibold">Type</th>
                  <th className="px-2 py-2.5 font-semibold">Sensitivity</th>
                  <th className="px-2 py-2.5 font-semibold">Redaction</th>
                  <th className="px-2 py-2.5 font-semibold">Linked entity</th>
                  <th className="px-2 py-2.5 font-semibold">SHA-256</th>
                  <th className="px-2 py-2.5 font-semibold">Created</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((artifact) => (
                  <EvidenceRow
                    key={artifact.evidenceId}
                    artifact={artifact}
                    onChanged={evidence.refetch}
                    autoInspect={
                      Boolean(initialQuery) &&
                      (artifact.evidenceId
                        .toLowerCase()
                        .includes(initialQuery.toLowerCase()) ||
                        artifact.sha256
                          .toLowerCase()
                          .includes(initialQuery.toLowerCase()))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageShell>
  );
}

function collectionMethodLabel(artifactType: string): string {
  if (/normalized/i.test(artifactType)) {
    return "Normalized ingest (structured claim input; not raw scanner dump)";
  }
  if (/raw|scanner/i.test(artifactType)) {
    return "Controlled raw capture (download gated; never primary UX)";
  }
  if (/report|pack/i.test(artifactType)) {
    return "Report / pack composition";
  }
  if (/attest|receipt/i.test(artifactType)) {
    return "Cryptographic or policy receipt";
  }
  return `Module collection · ${artifactType}`;
}

type LinkedClaim = {
  href: string;
  kind: "Finding" | "AttackPath";
  label: string;
};

function EvidenceRow({
  artifact,
  onChanged,
  autoInspect = false
}: {
  artifact: EvidenceArtifact;
  onChanged: () => void;
  autoInspect?: boolean;
}) {
  const route = ENTITY_ROUTE[artifact.relatedEntityType]?.(
    artifact.relatedEntityId
  );
  const [busy, setBusy] = useState<"download" | "redact" | "verify" | "claims" | null>(
    null
  );
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [redactError, setRedactError] = useState<string | null>(null);
  const [verification, setVerification] =
    useState<EvidenceArtifactVerification | null>(null);
  const [inspectOpen, setInspectOpen] = useState(autoInspect);
  const [preview, setPreview] = useState<{
    content: string;
    integrityVerified: boolean;
  } | null>(null);
  const [linkedClaims, setLinkedClaims] = useState<LinkedClaim[] | null>(null);
  const [claimsError, setClaimsError] = useState<string | null>(null);

  async function verifyIntegrity() {
    setBusy("verify");
    setFeedback(null);
    try {
      setVerification(await api.verifyEvidenceIntegrity(artifact.evidenceId));
      setInspectOpen(true);
    } catch (err) {
      setFeedback({
        tone: "error",
        message: errorMessage(
          err,
          "Evidence integrity verification failed. Please try again."
        )
      });
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("download");
    setFeedback(null);
    try {
      const r = await api.downloadEvidence(artifact.evidenceId);
      const blob = new Blob([r.content], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evidence-${artifact.evidenceId.slice(0, 8)}-${artifact.artifactType}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPreview({
        content: r.content.slice(0, 2400),
        integrityVerified: r.integrityVerified
      });
      setInspectOpen(true);
      // Surface the integrity check — never discard it. The download still
      // succeeds either way; a failed check is a loud warning, not a block.
      setFeedback(
        r.integrityVerified
          ? {
              tone: "success",
              message: "Integrity verified — content matches the recorded SHA-256 hash."
            }
          : {
              tone: "error",
              message:
                "Integrity check FAILED — stored content does not match the recorded hash."
            }
      );
    } catch (err) {
      setFeedback({
        tone: "error",
        message: errorMessage(err, "Download failed. Please try again.")
      });
    } finally {
      setBusy(null);
    }
  }

  async function loadLinkedClaims() {
    setBusy("claims");
    setClaimsError(null);
    try {
      const [findings, paths] = await Promise.all([
        api.listFindings({ limit: 100 }),
        api.listAttackPaths()
      ]);
      const claims: LinkedClaim[] = [];
      for (const finding of findings) {
        if (finding.evidenceIds?.includes(artifact.evidenceId)) {
          claims.push({
            href: `/findings?q=${encodeURIComponent(finding.findingId)}`,
            kind: "Finding",
            label: finding.title || finding.findingId
          });
        }
      }
      for (const assessment of paths) {
        const path = assessment.attackPath;
        if (path.evidenceIds?.includes(artifact.evidenceId)) {
          claims.push({
            href: `/attack-paths/${path.pathId}`,
            kind: "AttackPath",
            label: path.name || path.pathId
          });
        }
      }
      setLinkedClaims(claims);
      setInspectOpen(true);
    } catch (err) {
      setClaimsError(
        errorMessage(err, "Unable to load linked claims for this artifact.")
      );
      setInspectOpen(true);
    } finally {
      setBusy(null);
    }
  }

  async function confirmRedact() {
    setBusy("redact");
    setRedactError(null);
    try {
      await api.redactEvidence(artifact.evidenceId);
      setConfirmOpen(false);
      setFeedback({
        tone: "success",
        message: "Evidence redacted — sensitive content permanently removed from storage."
      });
      onChanged();
    } catch (err) {
      setRedactError(errorMessage(err, "Redaction failed. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
    <tr className="border-b border-line last:border-b-0">
      <td className="px-4 py-2.5 font-mono text-brand">
        ev·{shortId(artifact.evidenceId)}
      </td>
      <td className="px-2 py-2.5 text-ink">{artifact.artifactType}</td>
      <td className="px-2 py-2.5">
        <StateBadge
          tone={SENSITIVITY_TONE[artifact.sensitivityLevel] ?? "neutral"}
          dot={false}
        >
          {artifact.sensitivityLevel}
        </StateBadge>
      </td>
      <td className="px-2 py-2.5">
        <StateBadge
          tone={REDACTION_TONE[artifact.redactionStatus] ?? "neutral"}
          dot={false}
        >
          {artifact.redactionStatus}
        </StateBadge>
      </td>
      <td className="px-2 py-2.5">
        {route ? (
          <Link href={route} className="text-brand hover:text-brand-2">
            {artifact.relatedEntityType}
          </Link>
        ) : (
          <span className="text-muted">{artifact.relatedEntityType}</span>
        )}
        <span className="ml-1 font-mono text-[10.5px] text-subtle">
          {shortId(artifact.relatedEntityId)}
        </span>
      </td>
      <td className="px-2 py-2.5 font-mono text-subtle" title={artifact.sha256}>
        {shortHash(artifact.sha256)}
      </td>
      <td
        className="px-2 py-2.5 font-mono text-subtle"
        title={artifact.createdAt}
      >
        {relTime(artifact.createdAt)}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setInspectOpen((open) => !open);
                if (!linkedClaims && !claimsError) {
                  void loadLinkedClaims();
                }
              }}
              disabled={busy !== null}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              aria-expanded={inspectOpen}
            >
              {inspectOpen ? "Hide" : "Inspect"}
            </button>
            <button
              type="button"
              onClick={verifyIntegrity}
              disabled={busy !== null}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              {busy === "verify" ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={busy !== null}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              {busy === "download" ? "…" : "Download"}
            </button>
            {artifact.redactionStatus !== "Redacted" ? (
              <button
                type="button"
                onClick={() => {
                  setRedactError(null);
                  setConfirmOpen(true);
                }}
                disabled={busy !== null}
                className={cn(
                  buttonClassName({ size: "sm", variant: "secondary" }),
                  "text-approval"
                )}
              >
                {busy === "redact" ? "…" : "Redact"}
              </button>
            ) : null}
          </div>
          {feedback ? (
            <InlineError
              message={feedback.message}
              tone={feedback.tone}
              onDismiss={() => setFeedback(null)}
              className="w-full max-w-xs text-left"
            />
          ) : null}
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title="Redact this evidence?"
          description={`Redaction permanently removes the sensitive content of ev·${shortId(
            artifact.evidenceId
          )} from storage. This is irreversible — the original artifact content cannot be recovered. Type the evidence ID to confirm.`}
          confirmLabel="Redact"
          destructive
          confirmPhrase={artifact.evidenceId.slice(0, 8)}
          busy={busy === "redact"}
          error={redactError}
          onConfirm={confirmRedact}
          onCancel={() => {
            if (busy === "redact") return;
            setConfirmOpen(false);
            setRedactError(null);
          }}
        />
      </td>
    </tr>
    {inspectOpen ? (
      <tr className="border-b border-line bg-surface/45">
        <td colSpan={8} className="px-4 py-3">
          <section
            aria-label={`Provenance for ev·${shortId(artifact.evidenceId)}`}
            className="flex flex-col gap-3"
          >
            <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-subtle">Collection method</dt>
                <dd className="mt-1 text-ink">
                  {collectionMethodLabel(artifact.artifactType)}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Provenance relation</dt>
                <dd className="mt-1 text-ink">
                  {artifact.relatedEntityType} ·{" "}
                  <span className="font-mono">
                    {shortId(artifact.relatedEntityId)}
                  </span>
                </dd>
                {route ? (
                  <dd className="mt-1">
                    <Link href={route} className="text-brand hover:text-brand-2">
                      Open related entity
                    </Link>
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="text-subtle">Integrity commitment</dt>
                <dd className="mt-1 font-mono text-ink" title={artifact.sha256}>
                  sha256 {shortHash(artifact.sha256)}
                </dd>
                <dd className="mt-1 text-subtle">
                  {artifact.storageUri ? "Stored object present" : "No storage URI"}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Redaction lineage</dt>
                <dd className="mt-1 text-ink">{artifact.redactionStatus}</dd>
                {artifact.redactedAt ? (
                  <dd className="mt-1 font-mono text-subtle">
                    redacted {relTime(artifact.redactedAt)} ·{" "}
                    {artifact.redactedSha256
                      ? shortHash(artifact.redactedSha256)
                      : "hash n/a"}
                  </dd>
                ) : (
                  <dd className="mt-1 text-subtle">Ingest copy retained</dd>
                )}
              </div>
            </dl>
            <div className="rounded-control border border-line bg-elevated/40 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  Linked claims
                </p>
                <button
                  type="button"
                  onClick={() => void loadLinkedClaims()}
                  disabled={busy === "claims"}
                  className={buttonClassName({ size: "sm", variant: "secondary" })}
                >
                  {busy === "claims"
                    ? "Loading…"
                    : linkedClaims
                      ? "Refresh claims"
                      : "Load claims"}
                </button>
              </div>
              {claimsError ? (
                <p className="mt-2 text-xs text-missed" role="alert">
                  {claimsError}
                </p>
              ) : null}
              {linkedClaims ? (
                linkedClaims.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    No findings or attack paths currently cite this evidence ID.
                    The related entity above may still own the claim.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {linkedClaims.map((claim) => (
                      <li key={`${claim.kind}-${claim.href}`}>
                        <Link
                          href={claim.href}
                          className="text-sm text-brand hover:text-brand-2"
                        >
                          <span className="font-mono text-[10px] uppercase text-subtle">
                            {claim.kind}
                          </span>{" "}
                          {claim.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <p className="mt-2 text-xs text-subtle">
                  Load claims to reverse-index findings and paths that include
                  this evidence ID.
                </p>
              )}
            </div>
            {preview ? (
              <div className="rounded-control border border-line bg-elevated/40 px-3 py-2">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  Controlled content preview
                </p>
                <p className="mt-1 text-xs text-muted">
                  First 2.4k characters after explicit download. Integrity{" "}
                  {preview.integrityVerified ? "matched" : "FAILED"}.
                </p>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-ink">
                  {preview.content}
                </pre>
              </div>
            ) : null}
          </section>
        </td>
      </tr>
    ) : null}
    {verification ? (
      <tr className="border-b border-line bg-surface/45">
        <td colSpan={8} className="px-4 py-3">
          <ArtifactVerificationDetail
            verification={verification}
            onClose={() => setVerification(null)}
          />
        </td>
      </tr>
    ) : null}
    </>
  );
}

function ChainVerificationPanel({
  report
}: {
  report: EvidenceChainVerificationReport;
}) {
  const hasChain = report.chainedArtifacts > 0;
  const tone: StateTone = !hasChain
    ? "approval"
    : report.valid
      ? "fixed"
      : "missed";
  const title = !hasChain
    ? "No chained artifacts"
    : report.valid
      ? "Evidence chain intact"
      : `Evidence chain broken at sequence ${report.brokenAtSeq ?? "unknown"}`;

  return (
    <Panel className="min-w-0 max-w-full">
      <section
        aria-live="polite"
        className="flex min-w-0 max-w-full flex-col gap-4 p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1 size-2.5 shrink-0 rounded-full ring-4",
                tone === "fixed"
                  ? "bg-fixed ring-fixed/15"
                  : tone === "missed"
                    ? "bg-missed ring-missed/15"
                    : "bg-approval ring-approval/15"
              )}
            />
            <div>
              <h2 className="font-display text-base font-semibold text-ink">
                {title}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-muted">
                {!hasChain
                  ? "Artifacts exist, but none carry tenant-chain metadata. Verify individual legacy artifacts by content hash."
                  : report.valid
                    ? `${report.checked} chained artifact${report.checked === 1 ? "" : "s"} verified in sequence with no altered, deleted, or reordered link detected.`
                    : report.reason}
              </p>
            </div>
          </div>
          <StateBadge tone={tone} dot={false}>
            {!hasChain ? "Content checks only" : report.valid ? "Passed" : "Failed"}
          </StateBadge>
        </div>

        <dl className="grid gap-3 border-y border-line py-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-subtle">Artifacts</dt>
            <dd className="mt-1 font-mono text-ink">
              {report.chainedArtifacts} chained · {report.legacyUnchainedArtifacts} legacy
            </dd>
          </div>
          <div>
            <dt className="text-subtle">Verified at</dt>
            <dd className="mt-1 font-mono text-ink">
              {new Date(report.verifiedAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">Verification authority</dt>
            <dd className="mt-1 text-ink">{report.method.authority}</dd>
          </div>
          <div>
            <dt className="text-subtle">Method</dt>
            <dd className="mt-1 text-ink">
              {report.method.algorithm} hash chain · external signature not present
            </dd>
          </div>
        </dl>

        {report.links.length > 0 ? (
          <details open={!report.valid} className="min-w-0 max-w-full">
            <summary className="cursor-pointer font-display text-sm font-semibold text-ink">
              Inspect chain linkage
            </summary>
            <p className="mt-2 text-xs text-subtle">
              Each current hash commits to the previous hash, artifact identity,
              relation, and recorded content hash.
            </p>
            <div className="mt-3 w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-[0.08em] text-subtle">
                    <th className="py-2 pr-3 font-semibold">Sequence</th>
                    <th className="py-2 pr-3 font-semibold">Evidence</th>
                    <th className="py-2 pr-3 font-semibold">Previous hash</th>
                    <th className="py-2 pr-3 font-semibold">Current hash</th>
                    <th className="py-2 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {report.links.map((link) => (
                    <tr key={link.evidenceId} className="border-b border-line/70">
                      <td className="py-2 pr-3 font-mono text-ink">#{link.chainSeq}</td>
                      <td className="py-2 pr-3 font-mono text-brand">
                        ev·{shortId(link.evidenceId)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-subtle" title={link.prevChainHash ?? "Genesis"}>
                        {link.prevChainHash ? shortHash(link.prevChainHash) : "Genesis"}
                      </td>
                      <td className="py-2 pr-3 font-mono text-subtle" title={link.chainHash}>
                        {shortHash(link.chainHash)}
                      </td>
                      <td className="py-2">
                        <StateBadge
                          tone={
                            link.status === "Verified"
                              ? "fixed"
                              : link.status === "Broken"
                                ? "missed"
                                : "approval"
                          }
                          dot={false}
                        >
                          {link.status}
                        </StateBadge>
                        {link.reason ? (
                          <span className="ml-2 text-subtle">{link.reason}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </section>
    </Panel>
  );
}

function ArtifactVerificationDetail({
  verification,
  onClose
}: {
  verification: EvidenceArtifactVerification;
  onClose: () => void;
}) {
  const tone: StateTone =
    verification.status === "Verified"
      ? "fixed"
      : verification.status === "Broken" ||
          verification.status === "Unavailable"
        ? "missed"
        : "approval";

  return (
    <section
      role={tone === "missed" ? "alert" : "status"}
      aria-label={`Evidence integrity ${verification.status}`}
      className="flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <StateBadge tone={tone} dot={false}>
            {verification.status}
          </StateBadge>
          <p className="text-sm text-ink">
            {verification.status === "Verified"
              ? "Content and tenant-chain linkage verified."
              : verification.reason}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-subtle hover:text-ink"
        >
          Close
        </button>
      </div>

      <dl className="grid gap-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-subtle">Content commitment</dt>
          <dd className="mt-1 text-ink">
            {verification.content.commitment === "RedactedCopy"
              ? "Authorized redacted copy"
              : "Original ingest"}
          </dd>
          <dd className="mt-1 font-mono text-subtle">
            recorded {shortHash(verification.content.recordedSha256)}
          </dd>
          <dd className="font-mono text-subtle">
            computed {verification.content.computedSha256 ? shortHash(verification.content.computedSha256) : "unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">Chain linkage</dt>
          {verification.chain ? (
            <dd className="mt-1 font-mono text-ink">
              #{verification.chain.chainSeq} · {verification.chain.prevChainHash ? shortHash(verification.chain.prevChainHash) : "Genesis"} → {shortHash(verification.chain.chainHash)}
            </dd>
          ) : (
            <dd className="mt-1 text-approval">Legacy artifact · no chain link</dd>
          )}
        </div>
        <div>
          <dt className="text-subtle">Verification method</dt>
          <dd className="mt-1 text-ink">
            {verification.method.authority} · {verification.method.algorithm}
          </dd>
          <dd className="mt-1 text-subtle">External signature not present</dd>
        </div>
      </dl>
    </section>
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
  options: string[];
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-control border border-line bg-surface pl-3 pr-1.5 text-sm focus-within:ring-2 focus-within:ring-brand">
      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent py-1.5 text-sm text-ink outline-none"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
