"use client";

import { useEffect, useState } from "react";

import type { ModelProvider } from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  cn
} from "../ui";

type PriceDraft = { cached: string; input: string; output: string };

function usd(microusd: string | null) {
  if (microusd === null) return "Unpriced";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(Number(microusd) / 1_000_000);
}

export function ModelFinOpsConsole({
  providers
}: {
  providers: ModelProvider[];
}) {
  const summary = useApiResource(() => api.getModelGatewayFinOps(), []);
  const [monthlyUsd, setMonthlyUsd] = useState("100");
  const [perMinute, setPerMinute] = useState("60");
  const [concurrentTurns, setConcurrentTurns] = useState("4");
  const [priorityLaneEnabled, setPriorityLaneEnabled] = useState(false);
  const [enforcement, setEnforcement] = useState(false);
  const [routes, setRoutes] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Record<string, PriceDraft>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!summary.data) return;
    setMonthlyUsd(
      String(Number(summary.data.config.monthlyLimitMicrousd) / 1_000_000)
    );
    setPerMinute(String(summary.data.config.perMinuteRequestLimit));
    setConcurrentTurns(String(summary.data.config.concurrentTurnLimit));
    setPriorityLaneEnabled(summary.data.config.priorityLaneEnabled);
    setEnforcement(summary.data.config.enforcementEnabled);
    setRoutes(new Set(summary.data.config.routingProviderIds));
    setPrices(
      Object.fromEntries(
        summary.data.config.providerPricing.map((price) => [
          price.modelProviderId,
          {
            cached: String(price.cachedInputMicrousdPerMillion / 1_000_000),
            input: String(price.inputMicrousdPerMillion / 1_000_000),
            output: String(price.outputMicrousdPerMillion / 1_000_000)
          }
        ])
      )
    );
  }, [summary.data]);

  function updatePrice(
    providerId: string,
    field: keyof PriceDraft,
    value: string
  ) {
    setPrices((current) => ({
      ...current,
      [providerId]: {
        cached: current[providerId]?.cached ?? "",
        input: current[providerId]?.input ?? "",
        output: current[providerId]?.output ?? "",
        [field]: value
      }
    }));
  }

  async function save() {
    setBusy(true);
    setFeedback(null);
    try {
      await api.updateModelGatewayFinOps({
        concurrentTurnLimit: Number(concurrentTurns),
        enforcementEnabled: enforcement,
        monthlyLimitMicrousd: Math.round(Number(monthlyUsd) * 1_000_000),
        perMinuteRequestLimit: Number(perMinute),
        priorityLaneEnabled,
        providerPricing: Object.entries(prices)
          .filter(([, price]) =>
            Object.values(price).every(
              (value) => value !== "" && Number.isFinite(Number(value))
            )
          )
          .map(([modelProviderId, price]) => ({
            cachedInputMicrousdPerMillion: Math.round(
              Number(price.cached) * 1_000_000
            ),
            inputMicrousdPerMillion: Math.round(
              Number(price.input) * 1_000_000
            ),
            modelProviderId,
            outputMicrousdPerMillion: Math.round(
              Number(price.output) * 1_000_000
            )
          })),
        routingProviderIds: [...routes]
      });
      await summary.refetch();
      setFeedback("Budget, price book, and safe routes saved.");
    } catch (caught) {
      setFeedback(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (summary.loading) {
    return (
      <Panel>
        <PanelHeader title="Model economics & routing" />
        <LoadingSkeleton rows={4} />
      </Panel>
    );
  }
  if (summary.error || !summary.data) {
    return (
      <Panel>
        <PanelHeader title="Model economics & routing" />
        <ErrorState
          message={summary.error ?? "Model economics are unavailable."}
          onRetry={summary.refetch}
        />
      </Panel>
    );
  }

  const data = summary.data;
  const used = Number(data.currentMonthCostMicrousd);
  const limit = Number(data.config.monthlyLimitMicrousd);
  const usedPercent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <Panel>
      <PanelHeader title="Model economics & routing" />
      <div className="grid lg:grid-cols-[minmax(19rem,0.78fr)_minmax(0,1.22fr)]">
        <section className="border-b border-line p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
                Decision · Managed providers
              </p>
              <h3 className="mt-1 text-lg font-semibold text-ink">
                Spend only when measured
              </h3>
            </div>
            <StateBadge
              tone={data.config.enforcementEnabled ? "fixed" : "approval"}
            >
              {data.config.enforcementEnabled ? "Enforced" : "Observe only"}
            </StateBadge>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Managed-provider turns use tenant fair-share admission, optional
            priority lanes, policy-safe local semantic reuse, and measured queue
            latency. Hardware-scale claims stay unqualified until a recorded
            load run proves them.
          </p>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10.5px] text-subtle">Month to date</p>
              <p className="font-mono text-2xl font-semibold text-ink">
                {usd(data.currentMonthCostMicrousd)}
              </p>
            </div>
            <p className="text-right text-[10.5px] text-muted">
              {data.currentMonthRequestCount} requests
              <br />
              {data.unpricedRequestCount} unpriced
            </p>
          </div>
          <div
            aria-label="Monthly model budget used"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(usedPercent)}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas"
            role="meter"
          >
            <div
              className={cn(
                "h-full rounded-full",
                usedPercent >= 90 ? "bg-missed" : "bg-brand"
              )}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-subtle">
            {usd(data.budgetRemainingMicrousd)} remaining of{" "}
            {usd(data.config.monthlyLimitMicrousd)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="text-[10.5px] text-muted">
              Monthly budget · USD
              <input
                aria-label="Monthly model budget in dollars"
                className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
                min="0.1"
                onChange={(event) => setMonthlyUsd(event.target.value)}
                step="0.01"
                type="number"
                value={monthlyUsd}
              />
            </label>
            <label className="text-[10.5px] text-muted">
              Requests / minute
              <input
                aria-label="Model requests per minute"
                className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
                min="1"
                onChange={(event) => setPerMinute(event.target.value)}
                type="number"
                value={perMinute}
              />
            </label>
            <label className="text-[10.5px] text-muted">
              Concurrent turns
              <input
                aria-label="Concurrent model turns per tenant"
                className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
                min="1"
                max="1000"
                onChange={(event) => setConcurrentTurns(event.target.value)}
                type="number"
                value={concurrentTurns}
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[11.5px] text-ink">
            <input
              checked={enforcement}
              className="accent-[color:var(--color-brand)]"
              onChange={(event) => setEnforcement(event.target.checked)}
              type="checkbox"
            />
            Return HTTP 429 when a limit is exhausted
          </label>
          <label className="mt-2 flex items-center gap-2 text-[11.5px] text-ink">
            <input
              checked={priorityLaneEnabled}
              className="accent-[color:var(--color-brand)]"
              onChange={(event) => setPriorityLaneEnabled(event.target.checked)}
              type="checkbox"
            />
            Enable the priority turn lane
          </label>
          {feedback ? (
            <p aria-live="polite" className="mt-2 text-[11px] text-muted">
              {feedback}
            </p>
          ) : null}
          <button
            className={cn(buttonClassName({ variant: "primary" }), "mt-3")}
            disabled={
              busy ||
              Number(monthlyUsd) < 0.1 ||
              !Number.isInteger(Number(perMinute)) ||
              Number(perMinute) < 1 ||
              !Number.isInteger(Number(concurrentTurns)) ||
              Number(concurrentTurns) < 1
            }
            onClick={save}
            type="button"
          >
            {busy ? "Saving…" : "Save enforcement policy"}
          </button>
        </section>

        <section className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-ink">
                Pre-turn routes & reconciled prices
              </h3>
              <p className="mt-1 text-[11px] text-muted">
                Failover occurs only before a turn. Provider calls are never
                swapped mid-response and tool side effects are never replayed.
              </p>
            </div>
            <span className="font-mono text-[9.5px] text-subtle">
              {data.currentMinuteRequestCount}/
              {data.config.perMinuteRequestLimit} rpm ·{" "}
              {data.currentInFlightRequestCount}/
              {data.config.concurrentTurnLimit} active
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {providers.length === 0 ? (
              <p className="text-[11.5px] text-subtle">
                Register a provider to configure prices and fallbacks.
              </p>
            ) : (
              providers.map((provider) => {
                const price = prices[provider.modelProviderId] ?? {
                  cached: "",
                  input: "",
                  output: ""
                };
                return (
                  <div
                    className="rounded-control border border-line p-2.5"
                    key={provider.modelProviderId}
                  >
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-[11.5px] font-medium text-ink">
                        <input
                          checked={routes.has(provider.modelProviderId)}
                          className="accent-[color:var(--color-brand)]"
                          onChange={(event) =>
                            setRoutes((current) => {
                              const next = new Set(current);
                              if (event.target.checked)
                                next.add(provider.modelProviderId);
                              else next.delete(provider.modelProviderId);
                              return next;
                            })
                          }
                          type="checkbox"
                        />
                        {provider.providerName}
                      </label>
                      <StateBadge
                        className="ml-auto"
                        dot={false}
                        tone={
                          provider.status === "Active"
                            ? "fixed"
                            : "inconclusive"
                        }
                      >
                        {provider.status}
                      </StateBadge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(
                        [
                          ["input", "Input $/1M"],
                          ["output", "Output $/1M"],
                          ["cached", "Cached $/1M"]
                        ] as const
                      ).map(([field, label]) => (
                        <label className="text-[9px] text-subtle" key={field}>
                          {label}
                          <input
                            aria-label={`${provider.providerName} ${label}`}
                            className="mt-1 w-full rounded-control border border-line bg-surface px-2 py-1.5 text-[10.5px] text-ink"
                            min="0"
                            onChange={(event) =>
                              updatePrice(
                                provider.modelProviderId,
                                field,
                                event.target.value
                              )
                            }
                            step="0.000001"
                            type="number"
                            value={price[field]}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 border-t border-line pt-3">
            <p className="font-display text-[9.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
              Request ledger
            </p>
            {data.recentUsage.length === 0 ? (
              <p className="mt-2 text-[11px] text-subtle">
                No model turns have been reserved yet.
              </p>
            ) : (
              <ol className="mt-2 space-y-1.5">
                {data.recentUsage.slice(0, 5).map((usage) => (
                  <li
                    className="grid grid-cols-[1fr_auto] gap-2 text-[10px]"
                    key={usage.modelUsageEventId}
                  >
                    <div>
                      <p className="text-ink">
                        {usage.model ?? "Awaiting worker"} · {usage.status}
                      </p>
                      <p className="text-subtle">
                        {usage.inputTokens} in / {usage.outputTokens} out /{" "}
                        {usage.cachedInputTokens} cached ·{" "}
                        {usage.latencyMs ?? "—"} ms · {usage.queueLane} · cache{" "}
                        {usage.cacheDisposition.toLowerCase()}
                      </p>
                    </div>
                    <span className="font-mono text-muted">
                      {usd(usage.costMicrousd)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </Panel>
  );
}
