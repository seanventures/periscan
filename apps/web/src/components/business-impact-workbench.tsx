"use client";

import { useEffect, useState } from "react";

import type {
  AssetValuationVersion,
  BusinessImpactPreview,
  BusinessImpactSource,
  SubmitAssetValuationVersionInput
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  InlineError,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  buttonClassName
} from "../ui";

type RangeDraft = { maximum: string; minimum: string; mostLikely: string };

const EMPTY_RANGE: RangeDraft = {
  maximum: "",
  minimum: "",
  mostLikely: ""
};

const ADMIN_ROLES = new Set(["Owner", "Admin", "MSSPOwner", "ClientAdmin"]);
const FIELD_CONTROL =
  "min-w-0 rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-line-strong";

function formatUsd(value: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact && value >= 1_000_000 ? "compact" : "standard",
    style: "currency"
  }).format(value);
}

function rangeDraft(
  range?: {
    maximum: number;
    minimum: number;
    mostLikely: number;
  } | null
): RangeDraft {
  return range
    ? {
        maximum: String(range.maximum),
        minimum: String(range.minimum),
        mostLikely: String(range.mostLikely)
      }
    : EMPTY_RANGE;
}

function parseRange(range: RangeDraft) {
  return {
    maximum: Number(range.maximum),
    minimum: Number(range.minimum),
    mostLikely: Number(range.mostLikely)
  };
}

function isOrderedRange(range: ReturnType<typeof parseRange>) {
  return (
    Object.values(range).every(
      (value) => Number.isFinite(value) && value >= 0
    ) &&
    range.minimum <= range.mostLikely &&
    range.mostLikely <= range.maximum
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newSource(): BusinessImpactSource {
  return {
    asOfDate: today(),
    note: "",
    owner: "",
    reference: "",
    sourceType: "CustomerEstimate"
  };
}

function statusClass(status: AssetValuationVersion["status"]) {
  if (status === "Approved") return "border-fixed/40 bg-fixed/10 text-fixed";
  if (status === "PendingReview")
    return "border-warning/40 bg-warning/10 text-warning";
  if (status === "Rejected") return "border-danger/40 bg-danger/10 text-danger";
  return "border-line bg-canvas text-muted";
}

export function BusinessImpactWorkbench({
  onActivated
}: {
  onActivated: () => Promise<unknown>;
}) {
  const workspace = useApiResource(() => api.getBusinessImpactWorkspace(), []);
  const session = useApiResource(() => api.getMe(), []);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!selectedAssetId && workspace.data?.assets[0]) {
      setSelectedAssetId(workspace.data.assets[0].asset.assetId);
    }
  }, [selectedAssetId, workspace.data]);

  const selected = workspace.data?.assets.find(
    (entry) => entry.asset.assetId === selectedAssetId
  );
  const canReview = session.data
    ? ADMIN_ROLES.has(session.data.membership.role)
    : false;

  return (
    <Panel aria-labelledby="business-impact-title">
      <div className="border-b border-line px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-subtle">
              Assumption governance
            </p>
            <h2
              id="business-impact-title"
              className="mt-1 font-display text-lg font-semibold text-ink"
            >
              Business impact desk
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Model planning ranges from named customer sources, preview the
              result, and activate it only after a recorded review. No scenario
              supplies benchmark dollars.
            </p>
          </div>
          {workspace.data ? (
            <div
              className="grid grid-cols-2 gap-x-6 gap-y-3 border-l border-line pl-4 sm:grid-cols-4"
              aria-label="Business impact governance summary"
            >
              <SummaryMetric
                label="Active ALE"
                value={formatUsd(
                  workspace.data.summary.assumptionBasedAnnualizedExposureUsd,
                  true
                )}
              />
              <SummaryMetric
                label="Assets valued"
                value={`${workspace.data.summary.valuedAssetCount}/${workspace.data.assets.length}`}
              />
              <SummaryMetric
                label="Needs review"
                value={String(workspace.data.summary.pendingReviewCount)}
              />
              <SummaryMetric
                label="Integrity"
                value={
                  workspace.data.summary.failedIntegrityCount === 0
                    ? "Verified"
                    : `${workspace.data.summary.failedIntegrityCount} failed`
                }
                tone={
                  workspace.data.summary.failedIntegrityCount === 0
                    ? "good"
                    : "bad"
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      {workspace.loading ? (
        <LoadingSkeleton rows={4} />
      ) : workspace.error ? (
        <div className="p-4">
          <ErrorState message={workspace.error} onRetry={workspace.refetch} />
        </div>
      ) : !workspace.data?.assets.length ? (
        <div className="p-4">
          <NotConfigured
            title="No discovered assets to model"
            message="Run a Validation Snapshot from a connected system first. Periscan never creates an asset or a dollar assumption for you."
            action={{ href: "/missions", label: "Run a snapshot" }}
          />
        </div>
      ) : (
        <div>
          <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_minmax(0,1.6fr)] sm:items-end">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Discovered asset
                <select
                  aria-label="Business impact asset"
                  value={selectedAssetId}
                  onChange={(event) => {
                    setSelectedAssetId(event.target.value);
                    setEditorOpen(false);
                  }}
                  className="min-w-0 rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
                >
                  {workspace.data.assets.map((entry) => (
                    <option
                      key={entry.asset.assetId}
                      value={entry.asset.assetId}
                    >
                      {entry.asset.name} · {entry.asset.businessCriticality}
                    </option>
                  ))}
                </select>
              </label>
              {selected ? (
                <div className="min-w-0 border-l border-line pl-3">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-subtle">
                    Current approved exposure
                  </p>
                  {selected.currentExposure ? (
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="font-mono text-xl font-semibold text-ink">
                        {formatUsd(
                          selected.currentExposure.annualizedLossExposureUsd
                        )}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {selected.currentExposure.businessServiceName} ·{" "}
                        {selected.currentExposure.confidence} confidence
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-subtle">
                      No approved assumption version. Paths remain unvalued.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setEditorOpen((open) => !open)}
              className={buttonClassName({ size: "sm", variant: "primary" })}
              aria-expanded={editorOpen}
            >
              {editorOpen ? "Close editor" : "Create assumption version"}
            </button>
          </div>

          {selected && editorOpen ? (
            <ValuationEditor
              key={`${selected.asset.assetId}-${selected.versions[0]?.sequence ?? 0}`}
              assetEntry={selected}
              scenarios={workspace.data.scenarios}
              onSubmitted={async () => {
                setEditorOpen(false);
                await workspace.refetch();
              }}
            />
          ) : null}

          {selected ? (
            <ReviewAndHistory
              canReview={canReview}
              versions={selected.versions}
              onReviewed={async (activated) => {
                await workspace.refetch();
                if (activated) await onActivated();
              }}
            />
          ) : null}

          <details className="border-t border-line px-4 py-3 sm:px-5">
            <summary className="cursor-pointer text-xs font-medium text-muted">
              Method and boundaries
            </summary>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-subtle">
              {workspace.data.limitations.map((limitation) => (
                <li key={limitation}>• {limitation}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </Panel>
  );
}

function SummaryMetric({
  label,
  tone,
  value
}: {
  label: string;
  tone?: "good" | "bad";
  value: string;
}) {
  return (
    <div className="min-w-20">
      <p
        className={`font-mono text-sm font-semibold ${
          tone === "good"
            ? "text-fixed"
            : tone === "bad"
              ? "text-danger"
              : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
    </div>
  );
}

function ValuationEditor({
  assetEntry,
  onSubmitted,
  scenarios
}: {
  assetEntry: NonNullable<
    Awaited<ReturnType<typeof api.getBusinessImpactWorkspace>>["assets"][number]
  >;
  onSubmitted: () => Promise<void>;
  scenarios: Awaited<
    ReturnType<typeof api.getBusinessImpactWorkspace>
  >["scenarios"];
}) {
  const current = assetEntry.asset.valuation;
  const [scenarioId, setScenarioId] = useState<
    SubmitAssetValuationVersionInput["scenarioId"]
  >("availability-disruption");
  const [serviceName, setServiceName] = useState(
    current?.businessServiceName ?? ""
  );
  const [confidence, setConfidence] = useState<
    SubmitAssetValuationVersionInput["confidence"]
  >(current?.confidence ?? "Medium");
  const [frequency, setFrequency] = useState<RangeDraft>(() =>
    rangeDraft(current?.lossEventFrequencyPerYear)
  );
  const [magnitude, setMagnitude] = useState<RangeDraft>(() =>
    rangeDraft(current?.lossMagnitudeUsd)
  );
  const [notes, setNotes] = useState(current?.assumptionNotes ?? "");
  const [changeReason, setChangeReason] = useState("");
  const [sources, setSources] = useState<BusinessImpactSource[]>([newSource()]);
  const [preview, setPreview] = useState<BusinessImpactPreview | null>(null);
  const [busy, setBusy] = useState<"preview" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scenario = scenarios.find((entry) => entry.scenarioId === scenarioId)!;

  function changed() {
    setPreview(null);
    setError(null);
  }

  function buildInput(): SubmitAssetValuationVersionInput | null {
    const parsedFrequency = parseRange(frequency);
    const parsedMagnitude = parseRange(magnitude);
    if (
      !serviceName.trim() ||
      !notes.trim() ||
      changeReason.trim().length < 10
    ) {
      setError(
        "Add the business service, assumption basis, and a change reason of at least 10 characters."
      );
      return null;
    }
    if (!isOrderedRange(parsedFrequency) || !isOrderedRange(parsedMagnitude)) {
      setError(
        "Each range must use non-negative minimum ≤ most likely ≤ maximum values."
      );
      return null;
    }
    if (
      sources.some(
        (source) =>
          !source.asOfDate ||
          source.owner.trim().length < 2 ||
          source.reference.trim().length < 3 ||
          source.note.trim().length < 3
      )
    ) {
      setError(
        "Each source needs a type, owner, reference, as-of date, and a short note."
      );
      return null;
    }
    return {
      assumptionNotes: notes.trim(),
      businessServiceName: serviceName.trim(),
      changeReason: changeReason.trim(),
      confidence,
      currency: "USD",
      lossEventFrequencyPerYear: parsedFrequency,
      lossMagnitudeUsd: parsedMagnitude,
      scenarioId,
      sources: sources.map((source) => ({
        ...source,
        note: source.note.trim(),
        owner: source.owner.trim(),
        reference: source.reference.trim()
      }))
    };
  }

  async function runPreview() {
    const input = buildInput();
    if (!input) return;
    setBusy("preview");
    setError(null);
    try {
      setPreview(
        await api.previewAssetValuation(assetEntry.asset.assetId, input)
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preview failed.");
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    const input = buildInput();
    if (!input || !preview) {
      setError(
        "Preview the current assumptions before submitting this version."
      );
      return;
    }
    setBusy("submit");
    setError(null);
    try {
      await api.submitAssetValuationVersion(assetEntry.asset.assetId, input);
      await onSubmitted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Submission failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-t border-line bg-canvas/45 px-4 py-5 sm:px-5">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.65fr)]">
        <div className="min-w-0 space-y-4">
          <div>
            <p className="font-display text-sm font-semibold text-ink">
              1 · Define the scenario
            </p>
            <div className="mt-2 grid gap-px overflow-hidden rounded-control border border-line bg-line sm:grid-cols-2">
              {scenarios.map((entry) => (
                <button
                  key={entry.scenarioId}
                  type="button"
                  onClick={() => {
                    setScenarioId(entry.scenarioId);
                    changed();
                  }}
                  className={`min-h-20 bg-elevated px-3 py-2 text-left transition-colors hover:bg-surface ${
                    scenarioId === entry.scenarioId
                      ? "relative z-10 outline outline-1 outline-brand"
                      : ""
                  }`}
                >
                  <span className="block text-xs font-semibold text-ink">
                    {entry.name}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted">
                    {entry.description}
                  </span>
                </button>
              ))}
            </div>
            <ul className="mt-2 space-y-1 text-[11px] leading-4 text-subtle">
              {scenario.questionPrompts.map((prompt) => (
                <li key={prompt}>• {prompt}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-display text-sm font-semibold text-ink">
              2 · Enter customer assumptions
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="Business service">
                <input
                  aria-label="Business service name"
                  value={serviceName}
                  onChange={(event) => {
                    setServiceName(event.target.value);
                    changed();
                  }}
                  placeholder="Payments, clinical operations…"
                  className={FIELD_CONTROL}
                />
              </Field>
              <Field label="Confidence">
                <select
                  aria-label="Valuation confidence"
                  value={confidence}
                  onChange={(event) => {
                    setConfidence(
                      event.target
                        .value as SubmitAssetValuationVersionInput["confidence"]
                    );
                    changed();
                  }}
                  className={FIELD_CONTROL}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </Field>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <RangeFields
                legend="Loss-event frequency / year"
                range={frequency}
                onChange={(next) => {
                  setFrequency(next);
                  changed();
                }}
                step="0.01"
              />
              <RangeFields
                legend="Loss magnitude (USD)"
                range={magnitude}
                onChange={(next) => {
                  setMagnitude(next);
                  changed();
                }}
                step="1000"
              />
            </div>
            <Field label="Assumption basis" className="mt-3">
              <textarea
                aria-label="Financial assumption notes"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  changed();
                }}
                rows={2}
                placeholder="State included costs, boundaries, downtime, response, regulatory, and recovery assumptions."
                className={`${FIELD_CONTROL} resize-y`}
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-sm font-semibold text-ink">
                3 · Cite the source
              </p>
              <button
                type="button"
                onClick={() => {
                  setSources((items) => [...items, newSource()]);
                  changed();
                }}
                disabled={sources.length >= 10}
                className="text-xs font-medium text-brand hover:underline disabled:text-subtle"
              >
                Add source
              </button>
            </div>
            <div className="mt-2 divide-y divide-line border-y border-line">
              {sources.map((source, index) => (
                <SourceFields
                  key={index}
                  index={index}
                  source={source}
                  canRemove={sources.length > 1}
                  onChange={(next) => {
                    setSources((items) =>
                      items.map((item, itemIndex) =>
                        itemIndex === index ? next : item
                      )
                    );
                    changed();
                  }}
                  onRemove={() => {
                    setSources((items) =>
                      items.filter((_, itemIndex) => itemIndex !== index)
                    );
                    changed();
                  }}
                />
              ))}
            </div>
            <Field label="Why this version" className="mt-3">
              <textarea
                aria-label="Valuation change reason"
                value={changeReason}
                onChange={(event) => {
                  setChangeReason(event.target.value);
                  changed();
                }}
                rows={2}
                placeholder="Explain why this assumption version should enter review."
                className={`${FIELD_CONTROL} resize-y`}
              />
            </Field>
          </div>
        </div>

        <aside className="min-w-0 border-t border-line pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
          <p className="font-display text-sm font-semibold text-ink">
            4 · Preview, then submit
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            PERT mean = (minimum + 4 × most likely + maximum) ÷ 6. Preview does
            not change current path exposure.
          </p>
          {preview ? (
            <div className="mt-4 border-y border-line py-4">
              <p className="text-[10px] uppercase tracking-[0.1em] text-subtle">
                Assumption-based annualized exposure
              </p>
              <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-ink">
                {formatUsd(preview.estimate.annualizedLossExposureUsd)}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-subtle">Expected frequency</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {preview.estimate.expectedLossEventFrequencyPerYear}/yr
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">Expected magnitude</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {formatUsd(preview.estimate.expectedLossMagnitudeUsd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">Low boundary</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {formatUsd(preview.estimate.lowerBoundUsd)}
                  </dd>
                </div>
                <div>
                  <dt className="text-subtle">High boundary</dt>
                  <dd className="mt-0.5 font-mono text-ink">
                    {formatUsd(preview.estimate.upperBoundUsd)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-[11px] leading-4 text-warning">
                Customer planning estimate · not measured loss history
              </p>
            </div>
          ) : (
            <div className="mt-4 border-y border-dashed border-line py-8 text-center text-xs text-subtle">
              Complete all fields and preview the estimate.
            </div>
          )}
          {error ? (
            <div className="mt-3">
              <InlineError message={error} onDismiss={() => setError(null)} />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runPreview}
              disabled={busy !== null}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              {busy === "preview" ? "Calculating…" : "Preview estimate"}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy !== null || !preview}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy === "submit" ? "Submitting…" : "Submit for review"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  children,
  className = "",
  label
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label
      className={`flex min-w-0 flex-col gap-1 text-xs text-muted ${className}`}
    >
      {label}
      {children}
    </label>
  );
}

function RangeFields({
  legend,
  onChange,
  range,
  step
}: {
  legend: string;
  onChange: (range: RangeDraft) => void;
  range: RangeDraft;
  step: string;
}) {
  return (
    <fieldset className="rounded-control border border-line p-3">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
        {legend}
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {(["minimum", "mostLikely", "maximum"] as const).map((key) => (
          <label key={key} className="min-w-0 text-[10px] text-muted">
            {key === "mostLikely"
              ? "Likely"
              : key === "minimum"
                ? "Low"
                : "High"}
            <input
              aria-label={`${legend} ${key === "mostLikely" ? "most likely" : key}`}
              type="number"
              min="0"
              step={step}
              value={range[key]}
              onChange={(event) =>
                onChange({ ...range, [key]: event.target.value })
              }
              className={`${FIELD_CONTROL} mt-1 px-2 font-mono`}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SourceFields({
  canRemove,
  index,
  onChange,
  onRemove,
  source
}: {
  canRemove: boolean;
  index: number;
  onChange: (source: BusinessImpactSource) => void;
  onRemove: () => void;
  source: BusinessImpactSource;
}) {
  return (
    <div className="py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] text-subtle">
          SOURCE {index + 1}
        </span>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-[11px] text-danger hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Type">
          <select
            aria-label={`Source ${index + 1} type`}
            value={source.sourceType}
            onChange={(event) =>
              onChange({
                ...source,
                sourceType: event.target
                  .value as BusinessImpactSource["sourceType"]
              })
            }
            className={FIELD_CONTROL}
          >
            <option value="CustomerEstimate">Customer estimate</option>
            <option value="FinanceModel">Finance model</option>
            <option value="InsuranceAssessment">Insurance assessment</option>
            <option value="IncidentHistory">Incident history</option>
            <option value="ContractOrSla">Contract or SLA</option>
            <option value="RegulatoryAnalysis">Regulatory analysis</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Owner">
          <input
            aria-label={`Source ${index + 1} owner`}
            value={source.owner}
            onChange={(event) =>
              onChange({ ...source, owner: event.target.value })
            }
            placeholder="Finance operations"
            className={FIELD_CONTROL}
          />
        </Field>
        <Field label="Reference">
          <input
            aria-label={`Source ${index + 1} reference`}
            value={source.reference}
            onChange={(event) =>
              onChange({ ...source, reference: event.target.value })
            }
            placeholder="FIN-RISK-2026-Q3"
            className={FIELD_CONTROL}
          />
        </Field>
        <Field label="As of">
          <input
            aria-label={`Source ${index + 1} as of date`}
            type="date"
            value={source.asOfDate}
            onChange={(event) =>
              onChange({ ...source, asOfDate: event.target.value })
            }
            className={FIELD_CONTROL}
          />
        </Field>
      </div>
      <Field label="Source note" className="mt-2">
        <input
          aria-label={`Source ${index + 1} note`}
          value={source.note}
          onChange={(event) =>
            onChange({ ...source, note: event.target.value })
          }
          placeholder="Describe which frequency, cost, or boundary this source supports."
          className={FIELD_CONTROL}
        />
      </Field>
    </div>
  );
}

function ReviewAndHistory({
  canReview,
  onReviewed,
  versions
}: {
  canReview: boolean;
  onReviewed: (activated: boolean) => Promise<void>;
  versions: AssetValuationVersion[];
}) {
  const pending = versions.filter(
    (version) => version.status === "PendingReview"
  );

  return (
    <div className="border-t border-line">
      {pending.length > 0 ? (
        <div className="bg-warning/[0.04] px-4 py-4 sm:px-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-sm font-semibold text-ink">
              Review queue
            </h3>
            <span className="font-mono text-[10px] text-warning">
              {pending.length} PENDING
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {pending.map((version) => (
              <ReviewRow
                key={version.valuationVersionId}
                canReview={canReview}
                version={version}
                onReviewed={onReviewed}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-sm font-semibold text-ink">
            Version ledger
          </h3>
          <span className="text-[10px] uppercase tracking-[0.08em] text-subtle">
            Content hash verified on read
          </span>
        </div>
        {versions.length === 0 ? (
          <p className="mt-3 text-xs text-subtle">
            No versions yet. Preview and submit the first source-backed
            estimate.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-line border-y border-line">
            {versions.map((version) => (
              <div
                key={version.valuationVersionId}
                className="grid gap-2 py-3 text-xs sm:grid-cols-[3.5rem_minmax(0,1.4fr)_minmax(8rem,0.6fr)_auto] sm:items-center"
              >
                <p className="font-mono font-semibold text-ink">
                  v{version.sequence}
                </p>
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {version.scenario.name} ·{" "}
                    {version.input.businessServiceName}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-subtle">
                    {version.input.sources.length} named source
                    {version.input.sources.length === 1 ? "" : "s"} · digest{" "}
                    {version.inputDigest.slice(0, 12)}…
                  </p>
                </div>
                <div>
                  <p className="font-mono text-ink">
                    {formatUsd(version.annualizedLossExposureUsd)}
                  </p>
                  <p
                    className={`mt-0.5 text-[10px] ${
                      version.integrityVerified ? "text-fixed" : "text-danger"
                    }`}
                  >
                    {version.integrityVerified
                      ? "Integrity verified"
                      : "Integrity failed"}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-control border px-2 py-1 text-[10px] font-semibold ${statusClass(
                    version.status
                  )}`}
                >
                  {version.status.replace(/([a-z])([A-Z])/gu, "$1 $2")}
                </span>
                {version.reviewReference ? (
                  <p className="text-[11px] text-subtle sm:col-start-2 sm:col-span-3">
                    Review {version.reviewReference} · {version.reviewNote}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewRow({
  canReview,
  onReviewed,
  version
}: {
  canReview: boolean;
  onReviewed: (activated: boolean) => Promise<void>;
  version: AssetValuationVersion;
}) {
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"Approve" | "Reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(decision: "Approve" | "Reject") {
    if (reference.trim().length < 3 || note.trim().length < 10) {
      setError(
        "Add a durable review reference and a note of at least 10 characters."
      );
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      await api.reviewAssetValuationVersion(
        version.assetId,
        version.valuationVersionId,
        {
          decision,
          reviewNote: note.trim(),
          reviewReference: reference.trim()
        }
      );
      await onReviewed(decision === "Approve");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-l-2 border-warning/60 pl-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            v{version.sequence} · {version.scenario.name}
          </p>
          <p className="mt-1 text-xs text-muted">
            {formatUsd(version.annualizedLossExposureUsd)} ALE ·{" "}
            {version.input.sources.length} named source
            {version.input.sources.length === 1 ? "" : "s"} ·{" "}
            {version.integrityVerified
              ? "integrity verified"
              : "integrity failed"}
          </p>
          <p className="mt-1 text-[11px] text-subtle">{version.changeReason}</p>
        </div>
      </div>
      {canReview ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(10rem,0.65fr)_minmax(14rem,1fr)_auto] lg:items-end">
          <Field label="Review reference">
            <input
              aria-label={`Review reference for version ${version.sequence}`}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="RISK-COMMITTEE-2026-07"
              className={FIELD_CONTROL}
            />
          </Field>
          <Field label="Review note">
            <input
              aria-label={`Review note for version ${version.sequence}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Confirm source, range, and scenario boundary."
              className={FIELD_CONTROL}
            />
          </Field>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null || !version.integrityVerified}
              onClick={() => review("Approve")}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              {busy === "Approve" ? "Approving…" : "Approve & activate"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => review("Reject")}
              className={buttonClassName({ size: "sm", variant: "danger" })}
            >
              {busy === "Reject" ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-subtle">
          An Owner, Admin, MSSP Owner, or Client Admin must record the decision.
        </p>
      )}
      {error ? (
        <div className="mt-2">
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}
    </div>
  );
}
