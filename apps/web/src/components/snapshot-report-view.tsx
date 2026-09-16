"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import type { ReportShareLink, ValidationSnapshot } from "@periscan/shared";

import { browserPeriscanApiClient } from "../lib/periscan-api-client";
import type { ReportDownloadPayload } from "../lib/periscan-api-client";
import { StatusPanel } from "./status-panel";
import { ProofLoopContext } from "./proof-loop-context";
import { WorkflowFeedback } from "./workflow-feedback";

async function loadSnapshotReportPreview(snapshotId: string) {
  const [html, designPartner, note, snapshot] = await Promise.all([
    browserPeriscanApiClient.getSnapshotReportHtml(snapshotId),
    browserPeriscanApiClient.getDesignPartnerWorkspace(),
    browserPeriscanApiClient.getReportAnalystNote(snapshotId),
    browserPeriscanApiClient.getSnapshot(snapshotId).catch(() => null)
  ]);

  return {
    designPartnerEnabled: designPartner.settings.enabled,
    html,
    note,
    snapshot
  };
}

function reportErrorTitle(errorMessage: string | null) {
  if (!errorMessage) {
    return "Snapshot report unavailable.";
  }

  if (/authentication required|unauthorized|401/iu.test(errorMessage)) {
    return "Sign in to view this report.";
  }

  if (/not found|404/iu.test(errorMessage)) {
    return "Snapshot report was not found.";
  }

  return "Snapshot report unavailable.";
}

function saveReportDownload(download: ReportDownloadPayload) {
  const blob = new Blob([download.content], {
    type: download.contentType
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = download.filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toAbsoluteShareUrl(url: string) {
  if (/^https?:\/\//iu.test(url)) {
    return url;
  }

  if (typeof window === "undefined") {
    return url;
  }

  return new URL(url, window.location.origin).toString();
}

export function SnapshotReportView(props: { snapshotId: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ValidationSnapshot | null>(null);
  const [designPartnerEnabled, setDesignPartnerEnabled] = useState(false);
  const [noteForm, setNoteForm] = useState({
    authorLabel: "Periscan Analyst",
    body: "",
    title: ""
  });
  const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(
    null
  );
  const [noteErrorMessage, setNoteErrorMessage] = useState<string | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [isRefreshingReport, setIsRefreshingReport] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [deliveryErrorMessage, setDeliveryErrorMessage] = useState<
    string | null
  >(null);
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);
  const [noteSavedMessage, setNoteSavedMessage] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<ReportShareLink | null>(null);

  useEffect(() => {
    let active = true;

    setIsLoadingReport(true);
    setReportErrorMessage(null);
    setNoteErrorMessage(null);
    setDeliveryErrorMessage(null);
    setDeliveryMessage(null);
    setShareLink(null);

    void loadSnapshotReportPreview(props.snapshotId)
      .then((preview) => {
        if (!active) {
          return;
        }

        setHtml(preview.html);
        setSnapshot(preview.snapshot);
        setDesignPartnerEnabled(preview.designPartnerEnabled);
        setNoteForm({
          authorLabel: preview.note?.authorLabel ?? "Periscan Analyst",
          body: preview.note?.body ?? "",
          title: preview.note?.title ?? ""
        });
        setIsLoadingReport(false);
      })
      .catch((error: unknown) => {
        if (active) {
          setReportErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load snapshot report."
          );
          setIsLoadingReport(false);
        }
      });

    return () => {
      active = false;
    };
  }, [props.snapshotId]);

  async function retryLoadReport() {
    setIsLoadingReport(true);
    setReportErrorMessage(null);
    setDeliveryErrorMessage(null);
    setDeliveryMessage(null);
    setShareLink(null);

    try {
      const preview = await loadSnapshotReportPreview(props.snapshotId);

      setHtml(preview.html);
      setSnapshot(preview.snapshot);
      setDesignPartnerEnabled(preview.designPartnerEnabled);
      setNoteForm({
        authorLabel: preview.note?.authorLabel ?? "Periscan Analyst",
        body: preview.note?.body ?? "",
        title: preview.note?.title ?? ""
      });
    } catch (error: unknown) {
      setReportErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load snapshot report."
      );
    } finally {
      setIsLoadingReport(false);
    }
  }

  async function saveAnalystNote() {
    setNoteErrorMessage(null);
    setNoteSavedMessage(null);
    setIsSavingNote(true);

    try {
      const nextNote = await browserPeriscanApiClient.updateReportAnalystNote(
        props.snapshotId,
        {
          authorLabel: noteForm.authorLabel,
          body: noteForm.body,
          title: noteForm.title || null
        }
      );
      const nextHtml = await browserPeriscanApiClient.getSnapshotReportHtml(
        props.snapshotId
      );

      setNoteForm({
        authorLabel: nextNote.authorLabel,
        body: nextNote.body,
        title: nextNote.title ?? ""
      });
      setHtml(nextHtml);
      setNoteSavedMessage("Analyst note saved and report preview refreshed.");
    } catch (error: unknown) {
      setNoteErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update analyst note."
      );
    } finally {
      setIsSavingNote(false);
    }
  }

  async function reloadReportPreviewInPlace() {
    setDeliveryErrorMessage(null);
    setDeliveryMessage(null);
    setShareLink(null);
    setIsRefreshingReport(true);

    try {
      const preview = await loadSnapshotReportPreview(props.snapshotId);

      setHtml(preview.html);
      setDesignPartnerEnabled(preview.designPartnerEnabled);
      setNoteForm({
        authorLabel: preview.note?.authorLabel ?? "Periscan Analyst",
        body: preview.note?.body ?? "",
        title: preview.note?.title ?? ""
      });
      setDeliveryMessage("Report preview reloaded from the API.");
    } catch (error: unknown) {
      setDeliveryErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to reload report preview."
      );
    } finally {
      setIsRefreshingReport(false);
    }
  }

  async function exportReport(format: "html" | "pdf") {
    setDeliveryErrorMessage(null);
    setDeliveryMessage(null);
    setIsExportingReport(true);

    try {
      const download = await browserPeriscanApiClient.exportReport(
        props.snapshotId,
        {
          format
        }
      );

      saveReportDownload(download);
      setDeliveryMessage(`Exported ${download.filename}.`);
    } catch (error: unknown) {
      setDeliveryErrorMessage(
        error instanceof Error ? error.message : "Unable to export report."
      );
    } finally {
      setIsExportingReport(false);
    }
  }

  async function createShareLink() {
    setDeliveryErrorMessage(null);
    setDeliveryMessage(null);
    setIsCreatingShareLink(true);

    try {
      const nextShareLink =
        await browserPeriscanApiClient.createReportShareLink(props.snapshotId);

      setShareLink(nextShareLink);
      setDeliveryMessage("Created a 7-day report share link.");
    } catch (error: unknown) {
      setDeliveryErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create report share link."
      );
    } finally {
      setIsCreatingShareLink(false);
    }
  }

  const canDeliverReport =
    !isLoadingReport && !reportErrorMessage && Boolean(html);
  const shareUrl = shareLink ? toAbsoluteShareUrl(shareLink.url) : null;
  const isReportBusy =
    isLoadingReport ||
    isRefreshingReport ||
    isExportingReport ||
    isCreatingShareLink ||
    isSavingNote;

  return (
    <div aria-busy={isReportBusy} className="report-page">
      <div className="report-toolbar">
        <Link className="secondary-button link-button" href="/">
          Back to workspace
        </Link>
        <Link className="secondary-button link-button" href="/validation-ops">
          Validation Ops
        </Link>
        <Link className="secondary-button link-button" href="/trust-safety">
          Trust &amp; Safety
        </Link>
        <Link className="secondary-button link-button" href="/api-reference">
          API reference
        </Link>
        {reportErrorMessage ? (
          <button
            className="secondary-button"
            onClick={() => {
              startTransition(() => {
                void retryLoadReport();
              });
            }}
            type="button"
          >
            Retry report load
          </button>
        ) : null}
      </div>
      {snapshot ? (
        <ProofLoopContext
          entityLabel="Validation snapshot"
          stage="Prove"
          evidenceBasis={
            snapshot.topAttackPaths[0]?.attackPath.evidenceBasis ??
            (snapshot.evidenceIds.length > 0
              ? "Measured evidence set"
              : "No evidence linked")
          }
          freshness={new Date(snapshot.updatedAt).toLocaleString()}
          status={snapshot.evidencePack.status}
          nextAction={{ href: "/reports", label: "Open proof composer" }}
        />
      ) : null}
      {canDeliverReport ? (
        <section className="panel report-delivery-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Evidence Delivery</span>
              <h2>Export or share this evidence pack</h2>
            </div>
            <span
              aria-label="Report delivery status: API-backed report"
              className="status-pill status-pill--ok"
              role="status"
            >
              API-backed report
            </span>
          </div>
          <p className="muted-copy">
            Delivery actions call the report API and use the generated evidence
            pack. No raw scanner output is exposed as the primary report.
          </p>
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={isExportingReport}
              onClick={() => {
                startTransition(() => {
                  void exportReport("html");
                });
              }}
              type="button"
            >
              {isExportingReport ? "Exporting..." : "Export report HTML"}
            </button>
            <button
              className="secondary-button"
              disabled={isExportingReport}
              onClick={() => {
                startTransition(() => {
                  void exportReport("pdf");
                });
              }}
              type="button"
            >
              {isExportingReport ? "Exporting..." : "Export report PDF"}
            </button>
            <button
              className="primary-button"
              disabled={isCreatingShareLink}
              onClick={() => {
                startTransition(() => {
                  void createShareLink();
                });
              }}
              type="button"
            >
              {isCreatingShareLink
                ? "Creating share link..."
                : "Create share link"}
            </button>
          </div>
          {shareLink && shareUrl ? (
            <dl className="report-share-details">
              <div>
                <dt>Share URL</dt>
                <dd>
                  <a href={shareUrl}>{shareUrl}</a>
                </dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{new Date(shareLink.expiresAt).toLocaleString()}</dd>
              </div>
            </dl>
          ) : null}
          {deliveryMessage ? (
            <p aria-live="polite" className="success-copy">
              {deliveryMessage}
            </p>
          ) : null}
          {deliveryErrorMessage ? (
            <div className="error-banner" role="alert" aria-live="assertive">
              <p className="message">{deliveryErrorMessage}</p>
              <button
                className="secondary-button"
                disabled={isRefreshingReport}
                onClick={() => {
                  startTransition(() => {
                    void reloadReportPreviewInPlace();
                  });
                }}
                type="button"
              >
                {isRefreshingReport ? "Reloading..." : "Reload report preview"}
              </button>
              <button
                aria-label="Dismiss report delivery error"
                className="dismiss"
                onClick={() => setDeliveryErrorMessage(null)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
      {canDeliverReport && snapshot ? (
        <WorkflowFeedback
          evidencePackId={snapshot.evidencePack.evidencePackId}
          missionId={snapshot.missionId ?? undefined}
          route={`/snapshots/${snapshot.snapshotId}`}
          stage="Prove"
          prompt="Could you trace the report claims to evidence and choose the right delivery action?"
        />
      ) : null}
      {designPartnerEnabled ? (
        <section className="panel analyst-note-panel">
          <div className="panel-header">
            <h2>Periscan Analyst Note</h2>
            <span
              aria-label="Analyst note report status: Report preview"
              className="status-pill status-pill--ok"
              role="status"
            >
              Report preview
            </span>
          </div>
          <p className="muted-copy">
            Founder and operator notes are inserted into the report preview
            below and regenerated through the report API when you save.
          </p>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(() => {
                void saveAnalystNote();
              });
            }}
          >
            <label htmlFor="report-note-title" className="field">
              <span>Note title</span>
              <input
                id="report-note-title"
                onChange={(event) =>
                  setNoteForm((current) => ({
                    ...current,
                    title: event.target.value
                  }))
                }
                value={noteForm.title}
              />
            </label>
            <label htmlFor="report-author" className="field">
              <span>Author label</span>
              <input
                id="report-author"
                onChange={(event) =>
                  setNoteForm((current) => ({
                    ...current,
                    authorLabel: event.target.value
                  }))
                }
                value={noteForm.authorLabel}
              />
            </label>
            <label htmlFor="report-note-body" className="field">
              <span>Analyst note</span>
              <textarea
                id="report-note-body"
                onChange={(event) =>
                  setNoteForm((current) => ({
                    ...current,
                    body: event.target.value
                  }))
                }
                rows={6}
                value={noteForm.body}
              />
            </label>
            <div className="action-row">
              <button
                className="primary-button"
                disabled={isSavingNote || noteForm.body.trim().length === 0}
                type="submit"
              >
                {isSavingNote ? "Saving note..." : "Save analyst note"}
              </button>
            </div>
            {noteSavedMessage ? (
              <p aria-live="polite" className="success-copy">
                {noteSavedMessage}
              </p>
            ) : null}
            {noteErrorMessage ? (
              <div className="error-banner" role="alert" aria-live="assertive">
                <p className="message">{noteErrorMessage}</p>
                <button
                  aria-label="Dismiss analyst note error"
                  className="dismiss"
                  onClick={() => setNoteErrorMessage(null)}
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </form>
        </section>
      ) : null}
      {isLoadingReport ? (
        <StatusPanel
          body="Periscan is loading the evidence-backed report, design-partner settings, and analyst note from the API."
          eyebrow="Validation Snapshot"
          kind="loading"
          title="Loading validation snapshot report."
        />
      ) : reportErrorMessage ? (
        <StatusPanel
          actions={
            <>
              <button
                className="primary-button"
                onClick={() => {
                  startTransition(() => {
                    void retryLoadReport();
                  });
                }}
                type="button"
              >
                Retry report load
              </button>
              <Link className="secondary-button link-button" href="/">
                Return to workspace
              </Link>
            </>
          }
          body={
            <>
              <p className="error-copy">{reportErrorMessage}</p>
            </>
          }
          eyebrow="Validation Snapshot"
          kind="error"
          title={reportErrorTitle(reportErrorMessage)}
        />
      ) : html ? (
        <section
          aria-label="Validation Snapshot report preview"
          className="report-shell"
          dangerouslySetInnerHTML={{
            __html: html
          }}
        />
      ) : (
        <StatusPanel
          actions={
            <>
              <button
                className="primary-button"
                onClick={() => {
                  startTransition(() => {
                    void retryLoadReport();
                  });
                }}
                type="button"
              >
                Retry report load
              </button>
              <Link className="secondary-button link-button" href="/">
                Return to workspace
              </Link>
            </>
          }
          body="The API returned no report HTML for this Snapshot. Return to the workspace to run or export a Snapshot before previewing it."
          eyebrow="Validation Snapshot"
          kind="empty"
          title="No report content available."
        />
      )}
    </div>
  );
}
