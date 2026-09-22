"use client";

import Link from "next/link";
import { useMemo } from "react";

import type {
  CTEMProgramSummary,
  CTEMStage,
  CTEMStageSummary
} from "@periscan/shared";

import {
  activationHasRevalidation,
  ctemStageOccupancyLabel,
  resolveCtemBoardHonesty
} from "../lib/ctem-board-honesty";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  PageHeader,
  PageShell,
  StateBadge,
  type StateTone
} from "../ui";

/** Stage → product surface. Remediate lives at `/remediation` (no /remediations alias). */
export const CTEM_STAGE_DESTINATIONS = {
  Scope: "/scopes",
  Discover: "/missions",
  Prioritize: "/findings",
  Validate: "/missions",
  Mobilize: "/remediation",
  Verify: "/remediation"
} as const satisfies Record<CTEMStage, string>;

const STAGE_ORDER: readonly CTEMStage[] = [
  "Scope",
  "Discover",
  "Prioritize",
  "Validate",
  "Mobilize",
  "Verify"
];

const STAGE_BLURB: Record<CTEMStage, string> = {
  Scope: "Verify authorized targets before anything runs.",
  Discover: "Collect evidence on verified scope.",
  Prioritize: "Triage measured findings, not scanner noise.",
  Validate: "Prove exposure with a Validation Snapshot.",
  Mobilize: "Assign the smallest fix that breaks the path.",
  Verify: "Fixed only via retest."
};

const STAGE_STATUS_TONE: Record<CTEMStageSummary["status"], StateTone> = {
  OnTrack: "fixed",
  NeedsAttention: "approval",
  NotStarted: "inconclusive"
};

const POSITIONING =
  "AEV / CTEM proof layer on authorized scope. Not Gartner CTEM, not live BAS, not a Wiz replacement.";

function sourceLabel(source: CTEMProgramSummary["source"]) {
  return source === "Snapshot"
    ? "Snapshot-derived proof"
    : "Live tenant-state baseline";
}

export function CtemProgramBoard() {
  const ctem = useApiResource(() => api.getCTEMProgram(), []);
  const activation = useApiResource(() => api.getProductActivationState(), []);
  const findings = useApiResource(() => api.listFindings(), []);

  const honesty = useMemo(
    () =>
      resolveCtemBoardHonesty({
        maturity: activation.data?.maturity,
        nextActionLabel: activation.data?.nextAction.label,
        findingsCount:
          findings.loading && findings.data == null
            ? null
            : (findings.data?.length ?? 0),
        verifyStatus: ctem.data?.stages.find(
          (stage) => stage.stage === "Verify"
        )?.status,
        revalidated: activationHasRevalidation(activation.data)
      }),
    [activation.data, ctem.data, findings.data, findings.loading]
  );

  const stages = useMemo(() => {
    const byName = new Map(
      (ctem.data?.stages ?? []).map((stage) => [stage.stage, stage])
    );
    return STAGE_ORDER.map(
      (name) =>
        byName.get(name) ?? {
          stage: name,
          status: "NotStarted" as const,
          evidenceCount: 0,
          openItemCount: 0,
          trend: "Stable" as const
        }
    );
  }, [ctem.data]);

  const header = (
    <PageHeader
      eyebrow="AEV / CTEM proof"
      title="Proof program"
      description={POSITIONING}
    />
  );

  if (ctem.loading && ctem.data == null) {
    return (
      <PageShell>
        {header}
        <LoadingSkeleton rows={6} label="Loading CTEM program" />
      </PageShell>
    );
  }

  if (ctem.error && ctem.data == null) {
    return (
      <PageShell>
        {header}
        <ErrorState
          title="Couldn't load CTEM program"
          message={ctem.error}
          onRetry={ctem.refetch}
        />
      </PageShell>
    );
  }

  if (!ctem.data) {
    return (
      <PageShell>
        {header}
        <NotConfigured
          title="No CTEM program yet"
          message="Authorize scope and run a Validation Snapshot. Empty is honest — this board does not invent a program score."
          action={{ href: "/scopes", label: "Open Scope" }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div data-testid="ctem-program-board" className="flex flex-col gap-5">
        {header}

        {honesty.headline ? (
          <p
            role="status"
            data-testid="ctem-program-honesty"
            className="rounded-control border border-line bg-surface px-4 py-3 text-sm text-ink"
          >
            {honesty.headline}
          </p>
        ) : null}

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px] text-subtle">
          <span>{sourceLabel(ctem.data.source)}</span>
          {ctem.data.snapshotId ? (
            <span>snapshot {ctem.data.snapshotId.slice(0, 8)}</span>
          ) : (
            <span>no Snapshot report yet</span>
          )}
        </div>

        <ol
          aria-label="CTEM proof stages"
          className="relative m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-6"
        >
          {stages.map((stage, index) => {
            const href = CTEM_STAGE_DESTINATIONS[stage.stage];
            const occupancy = ctemStageOccupancyLabel(
              honesty,
              stage.openItemCount
            );
            return (
              <li key={stage.stage} className="min-w-0">
                <Link
                  href={href}
                  data-testid={`ctem-stage-${stage.stage}`}
                  className="group flex h-full flex-col gap-2 rounded-card border border-line bg-surface px-3.5 py-3 transition-colors hover:border-brand hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {honesty.showPercent ? (
                      <StateBadge
                        tone={STAGE_STATUS_TONE[stage.status]}
                        variant="outline"
                        dot={false}
                      >
                        {stage.status}
                      </StateBadge>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                        {occupancy}
                      </span>
                    )}
                  </span>
                  <span className="font-display text-[15px] font-semibold text-ink group-hover:text-brand">
                    {stage.stage}
                  </span>
                  <span className="text-[12.5px] leading-snug text-muted">
                    {STAGE_BLURB[stage.stage]}
                  </span>
                  {honesty.showPercent ? (
                    <span className="mt-auto flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] text-subtle">
                      <span>{occupancy}</span>
                      {stage.evidenceCount > 0 ? (
                        <span>{stage.evidenceCount} evidence</span>
                      ) : null}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </PageShell>
  );
}
