"use client";

import Link from "next/link";
import { useState } from "react";

import type { BasAtomicScenarioRunResult } from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  Button,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  PageShell,
  Panel,
  StateBadge,
  buttonClassName
} from "../ui";

export function BasAtomicScenarioCatalog() {
  const catalog = useApiResource(() => api.listBasAtomicScenarios(), []);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<BasAtomicScenarioRunResult | null>(
    null
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runLive(scenarioId: string) {
    setRunningId(scenarioId);
    setRunError(null);
    try {
      const result = await api.runBasAtomicScenario(scenarioId, {
        executionMode: "live"
      });
      setRunResult(result);
    } catch (caught) {
      setRunResult(null);
      setRunError(
        caught instanceof Error
          ? caught.message
          : "Unable to evaluate the Atomic catalog run."
      );
    } finally {
      setRunningId(null);
    }
  }

  const items = catalog.data ?? [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Control validation"
        title="Atomic scenario catalog"
        description="Allowlisted Atomic Red Team YAML (SPDX MIT) imported as dry-run content. This is not live inject BAS — Invoke-AtomicRedTeam stays off. Run still goes through policy and live execution is denied."
        actions={
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            href="/controls"
          >
            Controls
          </Link>
        }
      />

      <div className="rounded-control border border-brand/35 bg-brand/8 px-4 py-3 text-sm text-ink">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
          Live execution disabled
        </p>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-muted">
          Catalog rows are dry-run content import only (
          <span className="font-mono text-[11px]">
            atomic.control_validation_safe
          </span>
          ). Clicking Run evaluates policy and remains denied for live (
          <span className="font-mono text-[11px]">atomic_live_disabled</span>
          ). Jobs are never queued.
        </p>
      </div>

      <Panel>
        {catalog.loading ? (
          <LoadingSkeleton rows={4} label="Loading Atomic catalog…" />
        ) : catalog.error ? (
          <ErrorState message={catalog.error} onRetry={catalog.refetch} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                  <th className="px-3 py-2 font-medium">Technique</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Mode</th>
                  <th className="px-3 py-2 font-medium">License</th>
                  <th className="px-3 py-2 font-medium">Live</th>
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">Run</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.scenarioId}
                    className="border-b border-line/70 last:border-b-0"
                  >
                    <td className="px-3 py-2 align-middle font-mono text-ink">
                      {item.techniqueId}
                    </td>
                    <td className="px-3 py-2 align-middle text-ink">
                      {item.name}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <StateBadge tone="inconclusive" dot={false}>
                        {item.executionMode}
                      </StateBadge>
                    </td>
                    <td className="px-3 py-2 align-middle font-mono text-muted">
                      SPDX {item.spdxLicenseId}
                    </td>
                    <td className="px-3 py-2 align-middle text-muted">
                      {item.liveExecutionLabel}
                    </td>
                    <td className="px-3 py-2 align-middle text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={runningId === item.scenarioId}
                        loading={runningId === item.scenarioId}
                        onClick={() => {
                          void runLive(item.scenarioId);
                        }}
                      >
                        Run {item.techniqueId}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {runError ? (
        <p className="text-sm text-danger" role="status">
          {runError}
        </p>
      ) : null}
      {runResult ? (
        <p
          className="rounded-control border border-line bg-surface px-4 py-3 text-sm text-ink"
          role="status"
        >
          <span className="font-mono text-[11px]">{runResult.code}</span>
          {" · "}
          {runResult.liveExecutionDisabled
            ? "live execution disabled"
            : runResult.rationale}
          {runResult.jobsQueued === 0 ? " · no jobs queued" : null}
        </p>
      ) : null}
    </PageShell>
  );
}
