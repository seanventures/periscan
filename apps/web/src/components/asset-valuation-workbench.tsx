"use client";

import { useEffect, useMemo, useState } from "react";

import type { Asset, AssetValuationInput } from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  InlineError,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  buttonClassName
} from "../ui";

type RangeDraft = { maximum: string; minimum: string; mostLikely: string };

const EMPTY_RANGE: RangeDraft = {
  maximum: "",
  minimum: "",
  mostLikely: ""
};

function rangeDraft(range?: {
  maximum: number;
  minimum: number;
  mostLikely: number;
}): RangeDraft {
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
    Object.values(range).every((value) => Number.isFinite(value) && value >= 0) &&
    range.minimum <= range.mostLikely &&
    range.mostLikely <= range.maximum
  );
}

export function AssetValuationWorkbench({
  onSaved
}: {
  onSaved: () => Promise<unknown>;
}) {
  const assets = useApiResource(() => api.listAssets(), []);
  const [selectedId, setSelectedId] = useState("");

  const selected = useMemo(
    () => assets.data?.find((asset) => asset.assetId === selectedId) ?? null,
    [assets.data, selectedId]
  );

  useEffect(() => {
    if (!selectedId && assets.data?.[0]) {
      setSelectedId(assets.data[0].assetId);
    }
  }, [assets.data, selectedId]);

  return (
    <Panel>
      <PanelHeader title="Financial exposure assumptions" />
      {assets.loading ? (
        <LoadingSkeleton rows={4} />
      ) : assets.error ? (
        <ErrorState message={assets.error} onRetry={assets.refetch} />
      ) : !assets.data?.length ? (
        <div className="p-4">
          <NotConfigured
            title="No discovered assets to value"
            message="Run a Validation Snapshot from connected systems first. Periscan never invents an asset or a dollar value."
            action={{ href: "/missions", label: "Run a snapshot" }}
          />
        </div>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(14rem,0.7fr)_minmax(0,2fr)]">
          <div>
            <p className="text-sm text-muted">
              Attach ranges to a real discovered asset. Periscan uses the selected
              path asset with the highest annualized exposure and labels every
              result as an assumption—not observed loss history.
            </p>
            <label className="mt-3 flex flex-col gap-1 text-xs text-muted">
              Discovered asset
              <select
                aria-label="Asset to value"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="min-w-0 rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
              >
                {assets.data.map((asset) => (
                  <option key={asset.assetId} value={asset.assetId}>
                    {asset.name} · {asset.businessCriticality}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-xs text-subtle">
              Formula: PERT frequency × PERT loss magnitude. PERT mean =
              (minimum + 4 × most likely + maximum) ÷ 6.
            </p>
          </div>
          {selected ? (
            <ValuationForm
              key={`${selected.assetId}-${selected.valuation?.updatedAt ?? "new"}`}
              asset={selected}
              onSaved={async () => {
                await assets.refetch();
                await onSaved();
              }}
            />
          ) : null}
        </div>
      )}
    </Panel>
  );
}

function ValuationForm({
  asset,
  onSaved
}: {
  asset: Asset;
  onSaved: () => Promise<unknown>;
}) {
  const valuation = asset.valuation;
  const [serviceName, setServiceName] = useState(
    valuation?.businessServiceName ?? ""
  );
  const [confidence, setConfidence] = useState<
    AssetValuationInput["confidence"]
  >(valuation?.confidence ?? "Medium");
  const [frequency, setFrequency] = useState<RangeDraft>(() =>
    rangeDraft(valuation?.lossEventFrequencyPerYear)
  );
  const [magnitude, setMagnitude] = useState<RangeDraft>(() =>
    rangeDraft(valuation?.lossMagnitudeUsd)
  );
  const [notes, setNotes] = useState(valuation?.assumptionNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    const parsedFrequency = parseRange(frequency);
    const parsedMagnitude = parseRange(magnitude);
    if (!serviceName.trim() || !notes.trim()) {
      setError("Add a business service and the assumptions behind these ranges.");
      return;
    }
    if (!isOrderedRange(parsedFrequency) || !isOrderedRange(parsedMagnitude)) {
      setError("Each range must use non-negative minimum ≤ most likely ≤ maximum values.");
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateAssetValuation(asset.assetId, {
        assumptionNotes: notes.trim(),
        businessServiceName: serviceName.trim(),
        confidence,
        currency: "USD",
        lossEventFrequencyPerYear: parsedFrequency,
        lossMagnitudeUsd: parsedMagnitude
      });
      setSaved(true);
      await onSaved();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't save the financial assumptions."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Business service
          <input
            aria-label="Business service name"
            value={serviceName}
            onChange={(event) => setServiceName(event.target.value)}
            placeholder="Payments, clinical operations, plant line 2…"
            className="min-w-0 rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Confidence
          <select
            aria-label="Valuation confidence"
            value={confidence}
            onChange={(event) =>
              setConfidence(event.target.value as typeof confidence)
            }
            className="rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
      </div>
      <RangeFields
        legend="Loss-event frequency per year"
        range={frequency}
        onChange={setFrequency}
        step="0.01"
      />
      <RangeFields
        legend="Loss magnitude (USD)"
        range={magnitude}
        onChange={setMagnitude}
        step="1000"
      />
      <label className="flex flex-col gap-1 text-xs text-muted">
        Assumption basis
        <textarea
          aria-label="Financial assumption notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={2_000}
          placeholder="What costs, downtime, revenue, response, regulatory, or recovery assumptions are included?"
          className="min-w-0 resize-y rounded-control border border-line bg-elevated px-3 py-2 text-sm text-ink"
        />
      </label>
      {error ? <InlineError message={error} onDismiss={() => setError(null)} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className={buttonClassName({ size: "sm", variant: "primary" })}
        >
          {busy ? "Saving…" : valuation ? "Update assumptions" : "Save assumptions"}
        </button>
        {saved ? (
          <span className="text-xs text-fixed">Saved and recalculated path exposure.</span>
        ) : valuation ? (
          <span className="text-xs text-subtle">
            Last updated {new Date(valuation.updatedAt).toLocaleString()}.
          </span>
        ) : null}
      </div>
    </div>
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
      <legend className="px-1 font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">
        {legend}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(["minimum", "mostLikely", "maximum"] as const).map((key) => (
          <label key={key} className="flex min-w-0 flex-col gap-1 text-xs text-muted">
            {key === "mostLikely" ? "Most likely" : key[0]!.toUpperCase() + key.slice(1)}
            <input
              aria-label={`${legend} ${key === "mostLikely" ? "most likely" : key}`}
              type="number"
              min="0"
              step={step}
              value={range[key]}
              onChange={(event) =>
                onChange({ ...range, [key]: event.target.value })
              }
              className="min-w-0 rounded-control border border-line bg-elevated px-2 py-1.5 font-mono text-sm text-ink"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
