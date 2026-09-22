"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";

import type {
  AttackNavigatorFreshnessReceipt,
  AttackNavigatorLayerState
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ATTACK_NAVIGATOR_DISCLAIMER,
  ATTACK_NAVIGATOR_LAYER_STATES,
  ATTACK_NAVIGATOR_STATE_COLORS,
  ATTACK_NAVIGATOR_WORKBENCH_COPY,
  countNavigatorStates,
  emptyNavigatorWorkbench,
  overlayNavigatorFromCoverage,
  parseNavigatorLayerInput,
  receiptsFromControlCoverageItems,
  serializeNavigatorExport,
  workbenchNavigatorFreshness,
  type AttackNavigatorWorkbenchView
} from "../lib/attack-navigator-workbench";
import {
  EmptyState,
  InlineError,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  type StateTone
} from "../ui";

const STATE_LABELS: Record<AttackNavigatorLayerState, string> = {
  blocked: "Blocked",
  detected: "Detected",
  stale: "Stale",
  tested: "Tested"
};

const STATE_TONES: Record<AttackNavigatorLayerState, StateTone> = {
  blocked: "blocked",
  detected: "approval",
  stale: "inconclusive",
  tested: "brand"
};

export function AttackNavigatorWorkbench(
  props: {
    now?: string;
    receipts?: AttackNavigatorFreshnessReceipt[];
    supportedScenarioTechniqueIds?: string[];
    windowDays?: number;
  } = {}
) {
  const [draft, setDraft] = useState("");
  const [view, setView] = useState<AttackNavigatorWorkbenchView>(
    emptyNavigatorWorkbench
  );
  const [exportedJson, setExportedJson] = useState<string | null>(null);
  const [exportFilename, setExportFilename] = useState(
    "periscan-navigator-layer.json"
  );
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayReceipts, setOverlayReceipts] = useState<
    AttackNavigatorFreshnessReceipt[]
  >([]);

  function applyView(next: AttackNavigatorWorkbenchView) {
    setView(next);
    setExportedJson(null);
  }

  function onImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOverlayError(null);
    setOverlayReceipts([]);
    applyView(parseNavigatorLayerInput(draft));
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    setDraft(text);
    setOverlayError(null);
    setOverlayReceipts([]);
    applyView(parseNavigatorLayerInput(text));
    event.target.value = "";
  }

  async function overlayFromCoverage() {
    setOverlayError(null);
    setOverlayLoading(true);
    try {
      const coverage = await api.getControlRuleCoverage();
      setOverlayReceipts(receiptsFromControlCoverageItems(coverage.items));
      applyView(
        overlayNavigatorFromCoverage({
          items: coverage.items.map((item) => ({
            evidenceIds: item.evidenceIds,
            status: item.status,
            tacticName: item.tacticName,
            techniqueId: item.techniqueId
          })),
          name: "Tenant control-validation overlay"
        })
      );
    } catch (caught) {
      setOverlayError(
        `Control-validation coverage is unavailable. ${
          caught instanceof Error
            ? caught.message
            : "Sign in and connect a detection source — do not invent detections."
        }`
      );
    } finally {
      setOverlayLoading(false);
    }
  }

  function exportLayer() {
    if (view.kind !== "layer") {
      return;
    }
    const serialized = serializeNavigatorExport(view.layer);
    setExportedJson(serialized.json);
    setExportFilename(serialized.filename);
  }

  function clearOverlay() {
    setOverlayError(null);
    setOverlayReceipts([]);
    setDraft("");
    applyView(emptyNavigatorWorkbench());
  }

  const imported =
    view.kind === "layer" && view.source === "import"
      ? view.layer.techniques.map((technique) => ({
          state: technique.state,
          techniqueID: technique.techniqueID
        }))
      : [];
  const freshness = workbenchNavigatorFreshness({
    imported,
    now: props.now,
    receipts: [...(props.receipts ?? []), ...overlayReceipts],
    supportedScenarioTechniqueIds: props.supportedScenarioTechniqueIds ?? [],
    windowDays: props.windowDays
  });
  const counts =
    view.kind === "layer" ? countNavigatorStates(view.layer) : null;

  return (
    <PageShell
      data-testid="attack-navigator-workbench"
      data-executed-coverage={String(view.executedCoverage)}
    >
      <PageHeader
        eyebrow={ATTACK_NAVIGATOR_WORKBENCH_COPY.eyebrow}
        title={ATTACK_NAVIGATOR_WORKBENCH_COPY.title}
        description={ATTACK_NAVIGATOR_WORKBENCH_COPY.description}
        actions={
          <>
            <Link
              href="/controls"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Controls
            </Link>
            <Link
              href="/control-validation"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Control validation
            </Link>
            <Link
              href="/attack-techniques"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              ATT&CK catalog
            </Link>
          </>
        }
      />

      <div
        role="status"
        data-testid="attack-navigator-honesty"
        className="rounded-control border border-brand/35 bg-brand/8 px-4 py-3 text-sm text-ink"
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
          Overlay metadata · not executed coverage
        </p>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">
          {ATTACK_NAVIGATOR_DISCLAIMER} This overlay is{" "}
          {ATTACK_NAVIGATOR_WORKBENCH_COPY.notHundredPercent}. Scenario
          execution requires qualification.
        </p>
        <p
          className="mt-2 font-mono text-[12px] leading-5 text-ink"
          data-testid="attack-navigator-freshness"
        >
          {freshness.summary}
        </p>
      </div>

      <Panel aria-labelledby="navigator-import-title">
        <PanelHeader
          titleId="navigator-import-title"
          title="Import or overlay"
        />
        <form className="flex flex-col gap-3 p-4" onSubmit={onImport}>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Navigator layer JSON
            <textarea
              aria-label="Navigator layer JSON"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              spellCheck={false}
              className="min-h-40 w-full rounded-control border border-line bg-bg px-3 py-2 font-mono text-[12px] leading-5 text-ink"
              placeholder='{"name":"…","techniques":[{"techniqueID":"T1059"}]}'
            />
          </label>
          <label className="flex max-w-md flex-col gap-1 text-xs text-muted">
            Navigator layer JSON file
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Navigator layer JSON file"
              onChange={(event) => {
                void onFile(event);
              }}
              className="text-sm text-ink file:mr-3 file:rounded-control file:border file:border-line file:bg-surface file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={buttonClassName({ size: "sm" })}>
              {ATTACK_NAVIGATOR_WORKBENCH_COPY.importAction}
            </button>
            <button
              type="button"
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              onClick={() => {
                void overlayFromCoverage();
              }}
              disabled={overlayLoading}
            >
              {ATTACK_NAVIGATOR_WORKBENCH_COPY.overlayAction}
            </button>
            {view.kind !== "empty" ? (
              <button
                type="button"
                className={buttonClassName({ size: "sm", variant: "ghost" })}
                onClick={clearOverlay}
              >
                Clear overlay
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      {overlayError ? <InlineError message={overlayError} /> : null}
      {view.kind === "denied" ? <InlineError message={view.rationale} /> : null}

      {view.kind === "empty" ? (
        <EmptyState
          title={ATTACK_NAVIGATOR_WORKBENCH_COPY.emptyTitle}
          description={ATTACK_NAVIGATOR_WORKBENCH_COPY.emptyBody}
        />
      ) : null}

      {view.kind === "layer" ? (
        <Panel aria-labelledby="navigator-overlay-title">
          <PanelHeader
            titleId="navigator-overlay-title"
            title={view.layer.name}
            actions={
              <button
                type="button"
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
                onClick={exportLayer}
              >
                {ATTACK_NAVIGATOR_WORKBENCH_COPY.exportAction}
              </button>
            }
          />
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
            <p className="text-[12px] leading-5 text-muted">
              Provenance {view.layer.provenance}
              {view.source === "import"
                ? " · unlabeled imported techniques default to Tested on the layer, which is not Periscan-executed coverage"
                : " · derived from tenant control-validation coverage, still not executed coverage"}
              . liveSupported={String(view.layer.liveSupported)}.
            </p>
            <ul
              className="flex flex-wrap gap-4"
              aria-label="Navigator overlay legend"
            >
              {ATTACK_NAVIGATOR_LAYER_STATES.map((state) => (
                <li key={state} className="flex items-center gap-2 text-xs">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: ATTACK_NAVIGATOR_STATE_COLORS[state]
                    }}
                  />
                  <StateBadge tone={STATE_TONES[state]} dot={false}>
                    {STATE_LABELS[state]}
                  </StateBadge>
                  <span className="font-mono text-[11px] text-subtle">
                    {counts?.[state] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-x-auto">
            <table
              aria-label="Navigator overlay techniques"
              className="w-full min-w-[40rem] border-collapse text-left text-[12.5px]"
            >
              <thead>
                <tr className="border-b border-line font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                  <th className="px-4 py-2 font-medium">Technique</th>
                  <th className="px-4 py-2 font-medium">Tactic</th>
                  <th className="px-4 py-2 font-medium">State</th>
                  <th className="px-4 py-2 font-medium">Evidence</th>
                  <th className="px-4 py-2 font-medium">Comment</th>
                </tr>
              </thead>
              <tbody>
                {view.layer.techniques.map((technique) => (
                  <tr
                    key={`${technique.techniqueID}:${technique.tactic ?? ""}:${technique.state}`}
                    className="border-b border-line/70 last:border-b-0"
                  >
                    <td className="px-4 py-2 align-top font-mono text-ink">
                      {technique.techniqueID}
                    </td>
                    <td className="px-4 py-2 align-top text-muted">
                      {technique.tactic ?? "—"}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <StateBadge
                        tone={STATE_TONES[technique.state]}
                        dot={false}
                      >
                        {STATE_LABELS[technique.state]}
                      </StateBadge>
                    </td>
                    <td className="px-4 py-2 align-top">
                      {technique.evidenceLinks.length === 0 ? (
                        <span className="text-subtle">—</span>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {technique.evidenceLinks.map((link) => (
                            <li key={`${link.label}:${link.url}`}>
                              <a
                                className="text-brand underline-offset-2 hover:underline"
                                href={link.url}
                              >
                                {link.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top text-muted">
                      {technique.comment ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {exportedJson ? (
        <Panel aria-labelledby="navigator-export-title">
          <PanelHeader
            titleId="navigator-export-title"
            title="Exported layer"
          />
          <div className="flex flex-col gap-3 p-4">
            <a
              className={buttonClassName({ size: "sm", variant: "secondary" })}
              download={exportFilename}
              href={`data:application/json;charset=utf-8,${encodeURIComponent(exportedJson)}`}
            >
              Download JSON
            </a>
            <pre
              data-testid="navigator-export-json"
              className="max-h-80 overflow-auto font-mono text-[11px] leading-5 text-ink"
            >
              {exportedJson}
            </pre>
          </div>
        </Panel>
      ) : null}
    </PageShell>
  );
}
