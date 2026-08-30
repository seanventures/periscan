"use client";

import Link from "next/link";
import { Fragment, type FormEvent, useMemo, useState } from "react";

import {
  COMPLIANCE_CATALOG,
  COMPLIANCE_PACK_DISCLAIMER,
  COMPLIANCE_PACK_DISCLAIMER_SHORT,
  COMPLIANCE_PACK_TYPES,
  computeSnapshotComplianceTrace,
  type ComplianceControlStatus
} from "@periscan/reports/compliance-catalog";
import type {
  ComplianceControlGovernance,
  ComplianceFrameworkKey,
  ComplianceGovernanceChange,
  ComplianceSignoffStatus,
  ValidationSnapshot
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import {
  browserPeriscanApiClient as api,
  type ReportDownloadPayload
} from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  StateBadge,
  buttonClassName,
  type StateTone
} from "../ui";

const STATUS_TONE: Record<ComplianceControlStatus, StateTone> = {
  Met: "fixed",
  Partial: "approval",
  Unmet: "missed"
};

/** Wave-priority frameworks first (P13-12): depth over breadth for regulated buyers. */
const WAVE_PRIORITY_FRAMEWORKS: ComplianceFrameworkKey[] = [
  "DORAAttestation",
  "NIS2Attestation",
  "PCIDSSAttestation"
];

const ORDERED_COMPLIANCE_PACKS: ComplianceFrameworkKey[] = [
  ...WAVE_PRIORITY_FRAMEWORKS,
  ...COMPLIANCE_PACK_TYPES.filter(
    (pack) => !WAVE_PRIORITY_FRAMEWORKS.includes(pack as ComplianceFrameworkKey)
  )
] as ComplianceFrameworkKey[];

function download(payload: ReportDownloadPayload) {
  const blob = new Blob([payload.content], { type: payload.contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payload.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value: string | null) {
  if (!value) return "Not validated";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCatalogDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

function latestSnapshot(items: ValidationSnapshot[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function ComplianceWorkbench() {
  const snapshots = useApiResource(() => api.listSnapshots(), []);
  const schedules = useApiResource(() => api.listSchedules(), []);
  const integrity = useApiResource(() => api.verifyEvidenceChain(), []);
  const [framework, setFramework] =
    useState<ComplianceFrameworkKey>("DORAAttestation");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [multiExporting, setMultiExporting] = useState(false);
  const [selectedControl, setSelectedControl] =
    useState<ComplianceControlGovernance | null>(null);
  /** Trace-table drill-down control id (Met/Partial/Unmet → evidence + sign-off). */
  const [drillControlId, setDrillControlId] = useState<string | null>(null);
  const [governanceSaving, setGovernanceSaving] = useState(false);
  const [governanceError, setGovernanceError] = useState<string | null>(null);
  const multiSummary = useApiResource(
    () => api.getComplianceGovernanceSummary(),
    []
  );
  const governance = useApiResource(
    () => api.getComplianceGovernance(framework),
    [framework]
  );
  const history = useApiResource(
    () =>
      api.listComplianceGovernanceChanges(
        framework,
        selectedControl?.controlId
      ),
    [framework, selectedControl?.controlId]
  );

  const snapshot = latestSnapshot(snapshots.data ?? []);
  const trace = useMemo(() => {
    if (!snapshot) return null;
    const matchingSchedule = (schedules.data?.items ?? []).find(
      (schedule) =>
        schedule.status === "Active" &&
        schedule.lastSnapshotId === snapshot.snapshotId &&
        Boolean(schedule.lastRunAt)
    );
    return computeSnapshotComplianceTrace(snapshot, framework, {
      continuousValidation: matchingSchedule?.lastRunAt
        ? {
            evidenceIds: snapshot.evidenceIds,
            validatedAt: matchingSchedule.lastRunAt
          }
        : null,
      evidenceIntegrity:
        integrity.data?.valid && integrity.data.checked > 0
          ? {
              evidenceIds: snapshot.evidenceIds,
              validatedAt: integrity.data.verifiedAt,
              verified: true
            }
          : null
    });
  }, [framework, integrity.data, schedules.data, snapshot]);

  const governanceByControlId = useMemo(() => {
    const map = new Map<string, ComplianceControlGovernance>();
    for (const control of governance.data?.controls ?? []) {
      map.set(control.controlId, control);
    }
    return map;
  }, [governance.data?.controls]);

  async function exportEvidencePack() {
    if (!snapshot || !trace) return;
    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const pack = await api.createReport({
        audience: "Auditor",
        packType: framework,
        snapshotId: snapshot.snapshotId,
        title: `${trace.displayName} measured control trace`
      });
      download(await api.exportReport(pack.evidencePackId, { format: "pdf" }));
      setExportSuccess(
        `${trace.displayName} PDF downloaded. Hand to auditor as measured-control evidence support — not a certification or audit opinion.`
      );
    } catch (caught) {
      setExportError(
        caught instanceof Error
          ? caught.message
          : "Unable to export evidence pack."
      );
    } finally {
      setExporting(false);
    }
  }

  async function exportMultiFrameworkPacks() {
    if (!snapshot) return;
    setMultiExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const result = await api.exportMultiFrameworkCompliancePacks({
        audience: "Auditor",
        frameworks: WAVE_PRIORITY_FRAMEWORKS,
        snapshotId: snapshot.snapshotId,
        titlePrefix: "Multi-framework evidence support"
      });
      // Download first wave-priority pack PDF as operator convenience; all pack
      // IDs remain available for auditor hand-off.
      const primary = result.packs[0];
      if (primary) {
        download(
          await api.exportReport(primary.evidencePackId, { format: "pdf" })
        );
      }
      setExportSuccess(
        `Created ${result.packs.length} multi-framework evidence packs (not certification). Primary PDF downloaded; governance sign-off remains customer evidence-support only.`
      );
      await multiSummary.refetch();
    } catch (caught) {
      setExportError(
        caught instanceof Error
          ? caught.message
          : "Unable to export multi-framework packs."
      );
    } finally {
      setMultiExporting(false);
    }
  }

  async function saveGovernance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedControl) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "").trim();
    const exceptionDate = value("exceptionExpiresAt");
    setGovernanceSaving(true);
    setGovernanceError(null);
    try {
      await api.updateComplianceControlGovernance({
        controlId: selectedControl.controlId,
        evidenceRequest: value("evidenceRequest") || null,
        exceptionExpiresAt: exceptionDate
          ? new Date(`${exceptionDate}T23:59:59.000Z`).toISOString()
          : null,
        exceptionRationale: value("exceptionRationale") || null,
        framework,
        owner: value("owner") || null,
        reviewNotes: value("reviewNotes") || null,
        signoffStatus: value("signoffStatus") as ComplianceSignoffStatus
      });
      await Promise.all([governance.refetch(), history.refetch()]);
      setSelectedControl(null);
    } catch (caught) {
      setGovernanceError(
        caught instanceof Error
          ? caught.message
          : "Unable to update compliance governance."
      );
    } finally {
      setGovernanceSaving(false);
    }
  }

  const loading = snapshots.loading || schedules.loading || integrity.loading;
  const error = snapshots.error;

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6"
      role="region"
      aria-label="Compliance control trace"
      data-testid="compliance-workbench"
    >
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Prove
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Compliance control trace
        </h1>
        <p className="max-w-3xl text-sm text-muted">
          Map measured validation evidence to a control matrix with last-validated
          dates. Wave diligence focuses on DORA, NIS2, and PCI DSS first — other
          packs remain representative scaffolds. Exports are customer
          evidence-support packs — not a certification, not an audit opinion,
          not a Periscan vendor SOC 2 Type II report, formal framework
          attestation, or Leading compliance claim.
        </p>
      </header>

      <div
        role="note"
        className="rounded-control border border-approval/40 bg-approval/10 px-4 py-3 text-sm text-ink"
      >
        <p className="font-medium text-ink">
          {COMPLIANCE_PACK_DISCLAIMER_SHORT}
        </p>
        <p className="mt-1 text-muted">{COMPLIANCE_PACK_DISCLAIMER}</p>
        <p className="mt-2 text-muted">
          PDF/HTML packs link measured Periscan evidence to a representative
          control matrix (control ID → evidence kinds → evidence IDs → last
          validated). They do not certify your organization, do not assert
          compliance status, and are not Periscan&apos;s own SOC 2 / ISO / PCI
          vendor attestation. Do not present these packs as Leading compliance
          coverage in RFIs until program-complete catalogs ship.
        </p>
      </div>

      {multiSummary.data ? (
        <div
          className="rounded-control border border-line bg-surface-2 px-4 py-3 text-sm"
          data-testid="compliance-multi-framework-summary"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
            Multi-framework governance (scorecard #80)
          </p>
          <p className="mt-1 text-muted">{multiSummary.data.honestyNote}</p>
          <dl className="mt-2 flex flex-wrap gap-4 text-xs text-ink">
            <div>
              <dt className="text-subtle">Frameworks</dt>
              <dd className="font-semibold">
                {multiSummary.data.totals.frameworkCount}
              </dd>
            </div>
            <div>
              <dt className="text-subtle">Controls</dt>
              <dd className="font-semibold">
                {multiSummary.data.totals.totalControls}
              </dd>
            </div>
            <div>
              <dt className="text-subtle">Approved sign-offs</dt>
              <dd className="font-semibold">
                {multiSummary.data.totals.approved}
              </dd>
            </div>
            <div>
              <dt className="text-subtle">Owned</dt>
              <dd className="font-semibold">
                {multiSummary.data.totals.owned}
              </dd>
            </div>
          </dl>
          <p className="mt-2 font-mono text-[11px] text-subtle">
            GET /api/v1/compliance/governance/summary · POST
            /api/v1/compliance/exports/multi-framework · notCertification=true
          </p>
        </div>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-medium text-muted">
            Framework evidence pack
            <select
              value={framework}
              onChange={(event) => {
                setFramework(event.target.value as ComplianceFrameworkKey);
                setSelectedControl(null);
                setDrillControlId(null);
                setExportSuccess(null);
                setExportError(null);
              }}
              className="h-10 w-full max-w-xl rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand"
            >
              {ORDERED_COMPLIANCE_PACKS.map((packType) => {
                const priority = WAVE_PRIORITY_FRAMEWORKS.includes(packType);
                const name =
                  COMPLIANCE_CATALOG[packType]?.displayName ?? packType;
                return (
                  <option key={packType} value={packType}>
                    {priority ? `★ ${name}` : name}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={exportEvidencePack}
                disabled={!snapshot || exporting || multiExporting}
                aria-describedby={
                  !snapshot ? "compliance-export-disabled-reason" : undefined
                }
                className={buttonClassName({ variant: "primary" })}
                data-testid="export-evidence-pack"
              >
                {exporting ? "Building PDF…" : "Export evidence pack"}
              </button>
              <button
                type="button"
                onClick={exportMultiFrameworkPacks}
                disabled={!snapshot || exporting || multiExporting}
                className={buttonClassName({ variant: "secondary" })}
                data-testid="export-multi-framework-packs"
              >
                {multiExporting
                  ? "Building multi-framework…"
                  : "Export DORA+NIS2+PCI packs"}
              </button>
            </div>
            {!snapshot && !loading ? (
              <p
                id="compliance-export-disabled-reason"
                data-testid="compliance-export-disabled-reason"
                className="max-w-xs text-right text-[11px] leading-4 text-subtle"
              >
                Export disabled — no validation snapshot yet. Run a Validation
                Snapshot first; packs never invent sample claims.
              </p>
            ) : null}
          </div>
        </div>

        {exportSuccess ? (
          <div
            role="status"
            aria-live="polite"
            data-testid="compliance-export-success"
            className="border-b border-fixed/30 bg-fixed/5 px-4 py-3 text-sm text-fixed"
          >
            <p className="font-medium">{exportSuccess}</p>
            <p className="mt-1 text-[12px] text-muted">
              Hand to auditor with your control owner notes. Packs support
              evidence conversation — they do not certify compliance.
            </p>
          </div>
        ) : null}
        {exportError ? (
          <p
            role="alert"
            data-testid="compliance-export-error"
            className="border-b border-missed/30 bg-missed/5 px-4 py-3 text-sm text-missed"
          >
            {exportError}
          </p>
        ) : null}

        <div className="border-b border-line bg-surface/40">
          {governance.loading ? (
            <LoadingSkeleton rows={4} />
          ) : governance.error ? (
            <div className="p-4">
              <ErrorState message={governance.error} onRetry={governance.refetch} />
            </div>
          ) : governance.data ? (
            <>
              <div className="grid border-b border-line sm:grid-cols-[1.4fr_repeat(4,minmax(0,0.7fr))]">
                <div className="border-b border-line p-4 sm:border-b-0 sm:border-r">
                  <p className="text-xs text-subtle">Governance catalog</p>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {governance.data.catalogVersion}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-subtle">
                    reviewed {formatCatalogDate(governance.data.catalogLastReviewedAt)}
                  </p>
                </div>
                <Metric label="Controls" value={String(governance.data.summary.total)} />
                <Metric label="Owned" value={String(governance.data.summary.owned)} />
                <Metric label="In review" value={String(governance.data.summary.inReview)} tone="text-approval" />
                <Metric label="Signed off" value={String(governance.data.summary.approved)} tone="text-fixed" />
              </div>
              <div className="max-h-[min(28rem,70vh)] overflow-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <caption className="sr-only">
                    Governance catalog for {framework}: owners, evidence
                    requests, exceptions, and sign-off status per control
                  </caption>
                  <thead className="sticky top-0 z-10 border-b border-line bg-surface text-[10px] uppercase tracking-[0.08em] text-subtle shadow-[0_1px_0_0_var(--color-line,rgba(148,163,184,0.25))]">
                    <tr>
                      <th scope="col" className="bg-surface px-4 py-3 font-semibold">
                        Catalog control
                      </th>
                      <th scope="col" className="bg-surface px-4 py-3 font-semibold">
                        Owner
                      </th>
                      <th scope="col" className="bg-surface px-4 py-3 font-semibold">
                        Evidence request
                      </th>
                      <th scope="col" className="bg-surface px-4 py-3 font-semibold">
                        Exception
                      </th>
                      <th scope="col" className="bg-surface px-4 py-3 font-semibold">
                        Sign-off
                      </th>
                      <th scope="col" className="bg-surface px-4 py-3 font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {governance.data.controls.map((control) => (
                      <tr className="align-top" key={control.controlId}>
                        <th
                          scope="row"
                          className="max-w-sm px-4 py-4 text-left font-normal"
                        >
                          <p className="font-medium text-ink">{control.controlId}</p>
                          <p className="mt-1 text-xs leading-5 text-muted">{control.controlTitle}</p>
                          {control.catalogVersion !== governance.data?.catalogVersion ? (
                            <p className="mt-1 text-[10px] uppercase tracking-wide text-approval">
                              Re-review for {governance.data?.catalogVersion}
                            </p>
                          ) : null}
                        </th>
                        <td className="px-4 py-4 text-xs text-muted">{control.owner ?? "Unassigned"}</td>
                        <td className="max-w-xs px-4 py-4 text-xs text-muted">
                          {control.evidenceRequest ?? "None recorded"}
                        </td>
                        <td className="px-4 py-4">
                          {control.exceptionActive ? (
                            <StateBadge tone="approval">Active exception</StateBadge>
                          ) : control.exceptionRationale ? (
                            <StateBadge tone="inconclusive">Expired</StateBadge>
                          ) : (
                            <span className="text-xs text-subtle">None</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StateBadge
                            tone={
                              control.signoffStatus === "Approved"
                                ? "fixed"
                                : control.signoffStatus === "Rejected"
                                  ? "missed"
                                  : control.signoffStatus === "InReview"
                                    ? "approval"
                                    : "neutral"
                            }
                          >
                            {control.signoffStatus}
                          </StateBadge>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            aria-label={`Govern ${control.controlId}`}
                            className={buttonClassName({ size: "sm", variant: "secondary" })}
                            onClick={() => setSelectedControl(control)}
                            type="button"
                          >
                            Govern
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        {selectedControl ? (
          <GovernanceEditor
            control={selectedControl}
            error={governanceError}
            history={history.data ?? []}
            onCancel={() => setSelectedControl(null)}
            onSubmit={saveGovernance}
            saving={governanceSaving}
          />
        ) : null}

        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={snapshots.refetch} />
        ) : !snapshot || !trace ? (
          <div
            className="p-5"
            data-testid="compliance-empty-not-configured"
            role="region"
            aria-labelledby="compliance-empty-heading"
          >
            <h3 id="compliance-empty-heading" className="sr-only">
              Compliance empty — no validation snapshot
            </h3>
            <NotConfigured
              title="NotConfigured — no validation snapshot"
              message="Compliance control traces are NotConfigured until a Validation Snapshot exists. Status is derived only from persisted evidence — never sample Met claims or certification theater."
              action={{
                href: "/missions",
                label: "Connect validation — run a Validation Snapshot"
              }}
            />
          </div>
        ) : (
          <>
            <div className="grid border-b border-line sm:grid-cols-[1.3fr_repeat(4,minmax(0,0.7fr))]">
              <div className="border-b border-line p-4 sm:border-b-0 sm:border-r">
                <p className="text-xs text-subtle">Evidence baseline</p>
                <p className="mt-1 text-sm font-medium text-ink">{snapshot.evidencePack.title}</p>
                <p className="mt-1 font-mono text-[11px] text-subtle">
                  {formatDate(snapshot.createdAt)} · {snapshot.evidenceIds.length} evidence IDs
                </p>
              </div>
              <Metric label="Coverage" value={`${Math.round(trace.coverageRatio * 100)}%`} />
              <Metric label="Met" value={String(trace.metCount)} tone="text-fixed" />
              <Metric label="Partial" value={String(trace.partialCount)} tone="text-approval" />
              <Metric label="Unmet" value={String(trace.unmetCount)} tone="text-missed" />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left text-sm">
                <caption className="sr-only">
                  Measured control trace for {trace.displayName}: status,
                  evidence deep-links, and last validated dates
                </caption>
                <thead className="border-b border-line bg-surface text-[11px] uppercase tracking-[0.08em] text-subtle">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Control
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Measured support
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Evidence
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Last validated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {trace.controls.map((control) => {
                    const drilled = drillControlId === control.controlId;
                    const signoff = governanceByControlId.get(control.controlId);
                    return (
                      <Fragment key={control.controlId}>
                        <tr className="align-top">
                          <th
                            scope="row"
                            className="max-w-sm px-4 py-4 text-left font-normal"
                          >
                            <p className="font-medium text-ink">
                              {control.controlId}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted">
                              {control.title}
                            </p>
                          </th>
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              data-testid={`trace-status-${control.status}`}
                              aria-expanded={drilled}
                              aria-controls={`control-drill-${control.controlId}`}
                              aria-label={`${control.status} status for ${control.controlId}. ${drilled ? "Collapse" : "Open"} evidence deep-links and sign-off.`}
                              onClick={() =>
                                setDrillControlId((current) =>
                                  current === control.controlId
                                    ? null
                                    : control.controlId
                                )
                              }
                              className="min-h-11 min-w-11 rounded-control px-1 py-1 text-left outline-none transition-shadow focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-bg focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                              title="Open evidence deep-links and sign-off adjacency"
                            >
                              <StateBadge tone={STATUS_TONE[control.status]}>
                                {control.status}
                              </StateBadge>
                            </button>
                          </td>
                          <td className="max-w-xs px-4 py-4 text-xs text-muted">
                            {control.satisfiedBy.length > 0
                              ? control.satisfiedBy.join(" · ")
                              : "No measured support"}
                            {control.missing.length > 0 ? (
                              <p className="mt-1 text-subtle">
                                Missing: {control.missing.join(" · ")}
                              </p>
                            ) : null}
                          </td>
                          <td className="max-w-xs px-4 py-4">
                            {control.evidenceIds.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {control.evidenceIds
                                  .slice(0, 3)
                                  .map((evidenceId) => (
                                    <Link
                                      key={evidenceId}
                                      href={`/evidence?q=${encodeURIComponent(evidenceId)}`}
                                      title={evidenceId}
                                      className="font-mono text-[11px] text-brand hover:text-brand-2"
                                    >
                                      {evidenceId.length > 20
                                        ? `${evidenceId.slice(0, 20)}…`
                                        : evidenceId}
                                    </Link>
                                  ))}
                                {control.evidenceIds.length > 3 ? (
                                  <span className="text-[11px] text-subtle">
                                    +{control.evidenceIds.length - 3} more
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-subtle">
                                None linked
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-mono text-[11px] text-muted">
                            {formatDate(control.lastValidatedAt)}
                          </td>
                        </tr>
                        {drilled ? (
                          <tr
                            id={`control-drill-${control.controlId}`}
                            className="bg-brand/[0.04]"
                            data-testid="control-drill-panel"
                          >
                            <td colSpan={5} className="px-4 py-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-brand">
                                    Evidence deep-links
                                  </p>
                                  {control.evidenceIds.length > 0 ? (
                                    <ul className="mt-1.5 flex list-none flex-col gap-1 p-0">
                                      {control.evidenceIds.map((evidenceId) => (
                                        <li key={evidenceId}>
                                          <Link
                                            href={`/evidence?q=${encodeURIComponent(evidenceId)}`}
                                            className="font-mono text-[11px] text-brand hover:text-brand-2"
                                          >
                                            {evidenceId}
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="mt-1.5 text-xs text-muted">
                                      No evidence IDs linked for this control
                                      yet — status is derived from measured
                                      kinds only.
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-brand">
                                    Sign-off adjacency
                                  </p>
                                  {signoff ? (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                      <StateBadge
                                        tone={
                                          signoff.signoffStatus === "Approved"
                                            ? "fixed"
                                            : signoff.signoffStatus === "Rejected"
                                              ? "missed"
                                              : signoff.signoffStatus ===
                                                  "InReview"
                                                ? "approval"
                                                : "neutral"
                                        }
                                      >
                                        {signoff.signoffStatus}
                                      </StateBadge>
                                      <span className="text-xs text-muted">
                                        Owner: {signoff.owner ?? "Unassigned"}
                                      </span>
                                      <button
                                        type="button"
                                        className={buttonClassName({
                                          size: "sm",
                                          variant: "secondary"
                                        })}
                                        onClick={() =>
                                          setSelectedControl(signoff)
                                        }
                                      >
                                        Govern sign-off
                                      </button>
                                    </div>
                                  ) : (
                                    <p className="mt-1.5 text-xs text-muted">
                                      No governance row for this control yet.
                                      Use the catalog above to assign owner and
                                      sign-off after review.
                                    </p>
                                  )}
                                  <p className="mt-2 text-[11px] leading-4 text-subtle">
                                    Met is measured support only — not a formal
                                    attestation. Sign-off is a separate
                                    governance decision.
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {integrity.data && !integrity.data.valid ? (
        <p role="alert" className="text-sm text-missed">
          Evidence integrity is not counted because the chain failed verification at sequence {integrity.data.brokenAtSeq ?? "unknown"}.
        </p>
      ) : null}

      {/* P06: after Met/status drill-down, sticky auditor export when a real snapshot exists. */}
      {snapshot && drillControlId ? (
        <div
          data-testid="compliance-export-sticky-cta"
          className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-control border border-brand/40 bg-elevated/95 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur"
          role="region"
          aria-label="Export pack for auditor"
        >
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-ink">
              Export pack for auditor
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-subtle">
              Hand the measured control PDF with evidence IDs. Not certification
              or an audit opinion.
            </p>
          </div>
          <button
            type="button"
            onClick={exportEvidencePack}
            disabled={exporting}
            className={buttonClassName({ variant: "primary" })}
            data-testid="compliance-export-sticky-button"
          >
            {exporting ? "Building PDF…" : "Export pack for auditor"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, tone = "text-ink", value }: { label: string; tone?: string; value: string }) {
  return (
    <div className="border-b border-line p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="text-xs text-subtle">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function GovernanceEditor({
  control,
  error,
  history,
  onCancel,
  onSubmit,
  saving
}: {
  control: ComplianceControlGovernance;
  error: string | null;
  history: ComplianceGovernanceChange[];
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const fieldClass =
    "h-10 rounded-control border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand";
  return (
    <div className="border-b border-brand/40 bg-[linear-gradient(180deg,rgba(34,63,160,0.16),rgba(9,20,47,0.08))] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-brand">Govern control</p>
          <h2 className="mt-1 text-base font-semibold text-ink">{control.controlId}</h2>
          <p className="mt-1 text-xs text-muted">{control.controlTitle}</p>
        </div>
        <button className={buttonClassName({ size: "sm", variant: "secondary" })} onClick={onCancel} type="button">
          Close
        </button>
      </div>
      <form className="mt-4 grid gap-3 lg:grid-cols-2" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Control owner
          <input className={fieldClass} defaultValue={control.owner ?? ""} name="owner" placeholder="GRC Engineering" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Sign-off status
          <select className={fieldClass} defaultValue={control.signoffStatus} name="signoffStatus">
            <option value="Draft">Draft</option>
            <option value="InReview">In review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted lg:col-span-2">
          Evidence request
          <textarea
            className="min-h-20 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
            defaultValue={control.evidenceRequest ?? ""}
            name="evidenceRequest"
            placeholder="Describe the specific fresh evidence needed for review."
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Exception rationale
          <textarea
            className="min-h-20 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
            defaultValue={control.exceptionRationale ?? ""}
            name="exceptionRationale"
            placeholder="Required only for a time-boxed exception."
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Exception expires
          <input
            className={fieldClass}
            defaultValue={control.exceptionExpiresAt?.slice(0, 10) ?? ""}
            name="exceptionExpiresAt"
            type="date"
          />
          <span className="font-normal text-subtle">Rationale and a future expiry are required together.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted lg:col-span-2">
          Review notes
          <textarea
            className="min-h-20 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-brand"
            defaultValue={control.reviewNotes ?? ""}
            name="reviewNotes"
            placeholder="Record reviewer reasoning. Required for Approved sign-off."
          />
        </label>
        {error ? <p role="alert" className="text-sm text-missed lg:col-span-2">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
          <p className="text-xs text-subtle">
            Saving appends a change-history entry; earlier states are not overwritten.
          </p>
          <button className={buttonClassName({ variant: "primary" })} disabled={saving} type="submit">
            {saving ? "Saving governance…" : "Save governance"}
          </button>
        </div>
      </form>
      <div className="mt-4 border-t border-line pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">Change history</p>
        {history.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No saved changes for this control.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1">
            {history.slice(0, 5).map((change) => (
              <p className="font-mono text-[10px] text-muted" key={change.complianceGovernanceChangeId}>
                {formatDate(change.changedAt)} · {change.action} · {change.changedBy.slice(0, 8)}…
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
