"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  AtomicTestCatalogPin,
  AtomicTestCatalogSection,
  AtomicTestResultKind,
  RunnerRecord,
  Scope,
  StartAtomicTestResult
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  EmptyState,
  ErrorState,
  InlineError,
  LoadingSkeleton,
  NotConfigured,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName,
  type StateTone
} from "../ui";

const AUTHORIZED_SAFETY = new Set(["BASLite", "AdvancedAdversarial"]);
const SECTIONS: readonly AtomicTestCatalogSection[] = [
  "Qualified",
  "Qualification required",
  "High danger"
];

function isAuthorizedScope(scope: Scope): boolean {
  return (
    scope.verificationStatus === "Verified" &&
    AUTHORIZED_SAFETY.has(scope.effectiveMaxSafetyLevel)
  );
}

function isBoundRunner(runner: RunnerRecord): boolean {
  return runner.status === "Active" || runner.status === "Degraded";
}

function resultTone(result: AtomicTestResultKind): StateTone {
  switch (result) {
    case "Validated":
      return "validated";
    case "Prevented":
      return "fixed";
    case "Logged":
      return "approval";
    case "Inconclusive":
      return "inconclusive";
  }
}

function dangerAckDigest(pinId: string): string {
  return `high-danger-ack:${pinId}`;
}

export function AtomicTestingWorkbench() {
  const catalog = useApiResource(() => api.listAtomicTests(), []);
  const scopes = useApiResource(() => api.listScopes(), []);
  const runners = useApiResource(() => api.listRunners(), []);
  const assets = useApiResource(() => api.listAssets(), []);

  const authorizedScopes = useMemo(
    () => (scopes.data ?? []).filter(isAuthorizedScope),
    [scopes.data]
  );
  const boundRunners = useMemo(
    () => (runners.data ?? []).filter(isBoundRunner),
    [runners.data]
  );
  const boundAssets = assets.data ?? [];
  const pins = catalog.data?.items ?? [];

  const [pinId, setPinId] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [runnerId, setRunnerId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [dangerAck, setDangerAck] = useState(false);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<StartAtomicTestResult | null>(
    null
  );

  const selectedPin: AtomicTestCatalogPin | undefined =
    pins.find((pin) => pin.pinId === pinId) ??
    pins.find((pin) => pin.startable) ??
    pins[0];
  const selectedScopeId = scopeId || authorizedScopes[0]?.scopeId || "";
  const selectedRunnerId = runnerId || boundRunners[0]?.runnerId || "";
  const selectedAssetId = assetId || boundAssets[0]?.assetId || "";
  const hasBoundTarget = Boolean(selectedRunnerId || selectedAssetId);
  const highDanger = selectedPin?.section === "High danger";
  const canRun =
    Boolean(selectedPin) &&
    Boolean(selectedScopeId) &&
    hasBoundTarget &&
    (selectedPin?.startable === true || (highDanger && dangerAck));

  async function runSelected() {
    if (!selectedPin || !canRun) return;
    setRunning(true);
    setRunError(null);
    try {
      const started = await api.startAtomicTest({
        assetId: selectedRunnerId ? undefined : selectedAssetId || undefined,
        dangerAckDigest: highDanger
          ? dangerAckDigest(selectedPin.pinId)
          : undefined,
        dangerAcknowledged: highDanger ? dangerAck : undefined,
        runnerId: selectedRunnerId || undefined,
        scenarioPin: {
          provider: selectedPin.provider,
          typedInputs: {},
          upstreamId: selectedPin.upstreamId
        },
        scopeId: selectedScopeId
      });
      setLastResult(started);
    } catch (caught) {
      setLastResult(null);
      setRunError(
        caught instanceof Error
          ? caught.message
          : "Unable to start the atomic test."
      );
    } finally {
      setRunning(false);
    }
  }

  function selectPin(next: AtomicTestCatalogPin) {
    setPinId(next.pinId);
    setDangerAck(false);
    setLastResult(null);
    setRunError(null);
  }

  return (
    <PageShell data-testid="atomic-testing-workbench">
      <PageHeader
        eyebrow="Validate"
        title="Atomic testing"
        description="One qualified pin, one bound runner or asset, immediate result. Live Atomic is not executable."
        actions={
          <Link
            href="/bas"
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            BAS operator workspace
          </Link>
        }
      />

      <div
        role="status"
        data-testid="atomic-testing-honesty"
        className="rounded-control border border-brand/35 bg-brand/8 px-4 py-3 text-sm text-ink"
      >
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
          one pin · bound host · immediate result
        </p>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">
          Run is a policy-gated start of a single catalog pin. Live Atomic is
          not executable and never queues. High-danger techniques stay
          in-product with extra acknowledgement — they still do not execute
          without a qualified adapter.{" "}
          <span className="font-mono text-[11px] text-ink">
            liveSupported=false
          </span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <Panel aria-labelledby="atomic-test-pins-title">
          <PanelHeader titleId="atomic-test-pins-title" title="Pins" />
          {catalog.loading ? (
            <LoadingSkeleton rows={5} />
          ) : catalog.error ? (
            <ErrorState message={catalog.error} onRetry={catalog.refetch} />
          ) : pins.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No atomic-test pins"
                description="The catalog is empty. This is not a sample list."
              />
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-label="Atomic test pins"
              className="flex flex-col gap-4 p-4"
            >
              {SECTIONS.map((section) => {
                const items = pins.filter((pin) => pin.section === section);
                if (items.length === 0) return null;
                return (
                  <section key={section} className="flex flex-col gap-2">
                    <h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                      {section}
                    </h3>
                    <ul className="divide-y divide-line rounded-control border border-line">
                      {items.map((pin) => {
                        const checked = selectedPin?.pinId === pin.pinId;
                        return (
                          <li key={pin.pinId}>
                            <label
                              className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 ${
                                checked ? "bg-brand/8" : "bg-surface"
                              }`}
                            >
                              <input
                                type="radio"
                                name="atomic-test-pin"
                                className="mt-1"
                                checked={checked}
                                onChange={() => selectPin(pin)}
                                aria-label={pin.title}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-ink">
                                    {pin.title}
                                  </span>
                                  <StateBadge
                                    tone={
                                      pin.startable
                                        ? "validated"
                                        : pin.section === "High danger"
                                          ? "missed"
                                          : "inconclusive"
                                    }
                                  >
                                    {pin.startable ? "Startable" : pin.section}
                                  </StateBadge>
                                </span>
                                <span className="mt-0.5 block text-[12px] leading-5 text-muted">
                                  {pin.description}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel aria-labelledby="atomic-test-run-title">
          <PanelHeader titleId="atomic-test-run-title" title="Run" />
          <div className="flex flex-col gap-3 p-4">
            {scopes.loading || runners.loading || assets.loading ? (
              <LoadingSkeleton rows={3} />
            ) : (
              <>
                {authorizedScopes.length === 0 ? (
                  <NotConfigured
                    title="Verify a scope that permits BAS-lite"
                    message="Atomic testing starts only on a verified scope. Denied tasks are never queued."
                    action={{ href: "/scopes", label: "Verify scope" }}
                  />
                ) : (
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    Scope
                    <select
                      aria-label="Atomic test scope"
                      value={selectedScopeId}
                      onChange={(event) => setScopeId(event.target.value)}
                      className="rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink"
                    >
                      {authorizedScopes.map((scope) => (
                        <option key={scope.scopeId} value={scope.scopeId}>
                          {scope.scopeType} · {scope.value}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {!hasBoundTarget ? (
                  <NotConfigured
                    title="Bind an active runner or asset"
                    message="OpenAEV-style atomic testing targets one bound host. Pair a runner or select an inventory asset."
                    action={{ href: "/runners", label: "Pair runner" }}
                  />
                ) : (
                  <>
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      Runner
                      <select
                        aria-label="Atomic test runner"
                        value={selectedRunnerId}
                        onChange={(event) => setRunnerId(event.target.value)}
                        className="rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink"
                      >
                        <option value="">No runner</option>
                        {boundRunners.map((item) => (
                          <option key={item.runnerId} value={item.runnerId}>
                            {item.name} · {item.status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted">
                      Asset
                      <select
                        aria-label="Atomic test asset"
                        value={selectedAssetId}
                        onChange={(event) => setAssetId(event.target.value)}
                        className="rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink"
                      >
                        <option value="">No asset</option>
                        {boundAssets.map((item) => (
                          <option key={item.assetId} value={item.assetId}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </>
            )}

            {highDanger ? (
              <label className="flex items-start gap-2 rounded-control border border-missed/40 bg-missed/8 px-3 py-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={dangerAck}
                  onChange={(event) => setDangerAck(event.target.checked)}
                  aria-label="Acknowledge high danger"
                />
                <span>
                  Acknowledge High danger for {selectedPin?.title}. Extra
                  acknowledgement is required; this still does not enable live
                  ransomware or unqualified execution.
                </span>
              </label>
            ) : null}

            {!selectedPin?.startable && !highDanger && selectedPin ? (
              <p className="text-[12px] leading-5 text-muted">
                {selectedPin.denyReason ?? "Qualification required."}
              </p>
            ) : null}

            <button
              type="button"
              disabled={running || !canRun}
              onClick={() => void runSelected()}
              className={buttonClassName({ size: "md", variant: "primary" })}
            >
              {running ? "Running…" : "Run"}
            </button>

            {runError ? <InlineError message={runError} /> : null}

            {lastResult ? (
              <div
                data-testid="atomic-test-result"
                className="rounded-control border border-line bg-[#0b1018] px-4 py-5 text-center"
              >
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
                  Immediate result
                </p>
                <p
                  className={`mt-2 font-display text-3xl font-semibold tracking-tight ${
                    resultTone(lastResult.result) === "validated"
                      ? "text-validated"
                      : resultTone(lastResult.result) === "fixed"
                        ? "text-fixed"
                        : resultTone(lastResult.result) === "approval"
                          ? "text-approval"
                          : "text-inconclusive-text"
                  }`}
                >
                  {lastResult.result}
                </p>
                <p className="mt-2 text-[12px] text-muted">
                  {lastResult.denyReason ?? lastResult.rationale}
                </p>
                <p
                  data-testid="atomic-test-jobs-queued"
                  className="mt-3 font-mono text-[11px] text-subtle"
                >
                  jobsQueued={lastResult.jobsQueued} · liveSupported=false
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-subtle">
                Result will be Validated, Prevented, Logged, or Inconclusive.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
