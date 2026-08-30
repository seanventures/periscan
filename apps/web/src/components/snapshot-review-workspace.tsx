"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { buildAttackPathRiskSummary } from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  AttackPathClaimBadge,
  AttackPathGraph,
  ErrorState,
  EvidenceBasisBadge,
  InfoPopover,
  LoadingSkeleton,
  Panel,
  PanelHeader,
  RiskBandBadge,
  StateBadge,
  buttonClassName,
  cn
} from "../ui";
import { ProofLoopContext } from "./proof-loop-context";
import { RiskFactorBreakdown } from "./risk-factor-breakdown";
import { WorkflowFeedback } from "./workflow-feedback";

function shortId(value: string) {
  return value.slice(0, 8);
}

export function SnapshotReviewWorkspace({
  snapshotId
}: {
  snapshotId: string;
}) {
  const snapshot = useApiResource(
    () => api.getSnapshot(snapshotId),
    [snapshotId]
  );
  const integrity = useApiResource(() => api.verifyEvidenceChain(), []);
  const [activeReplayStep, setActiveReplayStep] = useState(0);

  const topPath = snapshot.data?.topAttackPaths[0] ?? null;
  const replayNodes = useMemo(
    () =>
      [...(topPath?.attackPath.pathNodes ?? [])].sort(
        (left, right) => left.sequence - right.sequence
      ),
    [topPath]
  );

  if (snapshot.loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-6">
        <LoadingSkeleton rows={10} />
      </div>
    );
  }
  if (snapshot.error || !snapshot.data) {
    return (
      <div className="mx-auto w-full max-w-7xl px-5 py-6">
        <ErrorState
          title="Snapshot review is unavailable"
          message={
            snapshot.error ??
            "This snapshot was not found for the current tenant."
          }
          onRetry={snapshot.refetch}
        />
      </div>
    );
  }

  const data = snapshot.data;
  const activeNode = replayNodes[activeReplayStep] ?? null;
  const activeEdge = activeNode
    ? (topPath?.attackPath.pathEdges.find(
        (edge) => edge.sourceNodeId === activeNode.pathNodeId
      ) ?? null)
    : null;
  const firstBreaker = topPath?.attackPath.pathBreakers
    .slice()
    .sort((left, right) => left.priority - right.priority)[0];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/reports"
          className="w-fit text-xs text-brand hover:text-brand-2"
        >
          ← Reports
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
          Snapshot review
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {data.evidencePack.title}
          </h1>
          <StateBadge tone="validated" dot={false}>
            {data.evidencePack.status}
          </StateBadge>
        </div>
        <p className="max-w-3xl text-sm text-muted">{data.summary.overview}</p>
      </header>

      <ProofLoopContext
        entityLabel="Validation snapshot"
        stage="Understand"
        evidenceBasis={
          topPath?.attackPath.evidenceBasis ??
          `${data.evidenceIds.length} linked evidence`
        }
        freshness={new Date(data.updatedAt).toLocaleString()}
        status={data.evidencePack.status}
        nextAction={
          data.remediationPriorities[0]
            ? {
                href: `/remediation/${data.remediationPriorities[0].remediationId}`,
                label: "Open priority fix"
              }
            : {
                href: `/snapshots/${data.snapshotId}/report`,
                label: "Compose proof"
              }
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <PanelHeader
              title="Top measured path"
              actions={
                topPath ? (
                  <div className="flex items-center gap-2">
                    <RiskBandBadge band={topPath.risk.band} dot={false} />
                    <EvidenceBasisBadge
                      basis={topPath.attackPath.evidenceBasis}
                      dot={false}
                    />
                  </div>
                ) : null
              }
            />
            {topPath ? (
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/attack-paths/${topPath.attackPath.pathId}`}
                      className="text-base font-semibold text-ink hover:text-brand"
                    >
                      {topPath.attackPath.name}
                    </Link>
                    <p className="mt-1 max-w-3xl text-sm text-muted">
                      {buildAttackPathRiskSummary(
                        topPath.attackPath,
                        topPath.risk.band
                      )}
                    </p>
                  </div>
                  <AttackPathClaimBadge attackPath={topPath.attackPath} />
                </div>
                <div className="mt-4">
                  <AttackPathGraph
                    attackPath={topPath.attackPath}
                    height={300}
                    title=""
                  />
                </div>
                <RiskFactorBreakdown
                  factors={topPath.risk.factors}
                  formula="Risk = clamp(sum of atomic factor contributions, 0, 100)."
                  score={topPath.risk.score}
                />
              </div>
            ) : (
              <p className="p-4 text-sm text-subtle">
                This snapshot does not contain a correlated attack path.
              </p>
            )}
          </Panel>

          <GroundedAnalyst evidenceIds={data.evidenceIds} />

          {topPath && replayNodes.length > 0 ? (
            <Panel>
              <PanelHeader title="Interactive attack replay" />
              <div className="grid gap-4 p-4 lg:grid-cols-[0.7fr_1.3fr]">
                <ol
                  className="flex list-none flex-col gap-1"
                  aria-label="Attack replay steps"
                >
                  {replayNodes.map((node, index) => (
                    <li key={node.pathNodeId}>
                      <button
                        type="button"
                        aria-current={
                          index === activeReplayStep ? "step" : undefined
                        }
                        onClick={() => setActiveReplayStep(index)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-control border px-3 py-2 text-left",
                          index === activeReplayStep
                            ? "border-brand bg-brand/10"
                            : "border-line hover:border-line-strong"
                        )}
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-strong font-mono text-[10px] text-muted">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink">
                            {node.label}
                          </span>
                          <span className="block font-mono text-[10px] uppercase text-subtle">
                            {node.entityType}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="rounded-card border border-line bg-bg p-4">
                  <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-brand">
                    Step {activeReplayStep + 1} of {replayNodes.length}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-ink">
                    {activeNode?.label}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {activeEdge?.rationale ??
                      (activeReplayStep === replayNodes.length - 1
                        ? "The measured or correlated path reaches its recorded objective here."
                        : "This node is linked by the normalized evidence graph; open the path for its full edge record.")}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-subtle">Relationship</dt>
                      <dd className="mt-1 font-mono text-ink">
                        {activeEdge?.relationship ?? "OBJECTIVE"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-subtle">Evidence basis</dt>
                      <dd className="mt-1 text-ink">
                        {topPath.attackPath.evidenceBasis}
                      </dd>
                    </div>
                  </dl>
                  {firstBreaker ? (
                    <div className="mt-4 rounded-control border border-fixed/30 bg-fixed/[0.05] p-3">
                      <p className="text-xs font-semibold text-ink">
                        First proposed path breaker
                      </p>
                      <p className="mt-1 text-[12px] text-muted">
                        {firstBreaker.title} — {firstBreaker.description}
                      </p>
                      <p className="mt-1 text-[11px] text-subtle">
                        Proposed interruption only. Risk reduction remains
                        unverified until a fresh re-test records the path as
                        blocked or gone.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader title="Control interactions" />
            {data.controlObservations.length > 0 ? (
              <ul className="list-none divide-y divide-line">
                {data.controlObservations.map((signal) => (
                  <li
                    key={signal.signalId}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink">
                        {signal.sourceVendor} · {signal.sourceType}
                      </p>
                      <p className="mt-0.5 text-[11px] text-subtle">
                        {signal.signalCategory} · observed{" "}
                        {new Date(signal.timestampObserved).toLocaleString()}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-muted">
                      confidence{" "}
                      {signal.confidence?.toFixed(2) ?? "not recorded"}
                    </span>
                    <span className="font-mono text-[11px] text-brand">
                      {signal.evidenceIds.length} evidence
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-subtle">
                No control observations are linked to this snapshot.
              </p>
            )}
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Panel>
            <PanelHeader title="Business impact" />
            <div className="p-4">
              {topPath?.financialExposure ? (
                <>
                  <p className="font-display text-2xl font-semibold text-ink">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0
                    }).format(
                      topPath.financialExposure.annualizedLossExposureUsd
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    assumption-based annualized exposure ·{" "}
                    {topPath.financialExposure.confidence.toLowerCase()}{" "}
                    confidence
                  </p>
                  <p className="mt-3 text-xs leading-5 text-subtle">
                    {topPath.financialExposure.methodology}. This is planning
                    context, not a predicted breach probability or loss claim.
                  </p>
                </>
              ) : (
                <p className="text-sm text-subtle">
                  No tenant-supplied valuation is linked. Periscan will not
                  invent financial impact.
                </p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Fix-impact workspace" />
            {data.remediationPriorities.length > 0 ? (
              <ul className="list-none divide-y divide-line">
                {data.remediationPriorities.map((remediation) => (
                  <li key={remediation.remediationId} className="p-4">
                    <Link
                      href={`/remediation/${remediation.remediationId}`}
                      className="text-[13px] font-semibold text-ink hover:text-brand"
                    >
                      {remediation.recommendedAction}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {remediation.relatedPathId
                        ? "Targets one recorded path"
                        : "Path impact is not linked"}
                      {remediation.owner
                        ? ` · ${remediation.owner}`
                        : " · unassigned"}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StateBadge tone="approval" dot={false}>
                        {remediation.status}
                      </StateBadge>
                      <span className="text-[10px] text-subtle">
                        Fresh validation required
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-subtle">
                No remediation choice is linked to this snapshot.
              </p>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Evidence drawer"
              actions={
                integrity.loading ? (
                  <span className="text-[10px] text-subtle">Verifying…</span>
                ) : integrity.data?.valid ? (
                  <StateBadge tone="fixed" dot={false}>
                    Chain verified
                  </StateBadge>
                ) : (
                  <StateBadge tone="missed" dot={false}>
                    Needs review
                  </StateBadge>
                )
              }
            />
            <div className="p-4">
              <p className="text-xs leading-5 text-muted">
                {data.evidenceIds.length} normalized evidence references · pack{" "}
                {shortId(data.evidencePack.evidencePackId)} ·{" "}
                {data.evidencePack.redactionLevel} redaction
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-brand">
                  Inspect evidence references
                </summary>
                <ul className="mt-2 flex max-h-56 list-none flex-col gap-1 overflow-auto">
                  {data.evidenceIds.map((evidenceId) => (
                    <li key={evidenceId}>
                      <Link
                        href={`/evidence?evidenceId=${encodeURIComponent(evidenceId)}`}
                        className="block rounded-control border border-line px-2 py-1.5 font-mono text-[11px] text-muted hover:border-line-strong hover:text-ink"
                      >
                        ev·{evidenceId}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href={`/snapshots/${data.snapshotId}/report`}
                  className={buttonClassName({ variant: "primary" })}
                >
                  Compose and deliver proof
                </Link>
                <Link
                  href={`/reports?evidencePackId=${data.evidencePack.evidencePackId}`}
                  className={buttonClassName({ variant: "secondary" })}
                >
                  Open evidence pack
                </Link>
              </div>
            </div>
          </Panel>
        </aside>
      </div>

      <WorkflowFeedback
        evidencePackId={data.evidencePack.evidencePackId}
        missionId={data.missionId ?? undefined}
        route={`/snapshots/${data.snapshotId}`}
        stage="Understand"
      />
    </div>
  );
}

type GroundedSummary = Awaited<ReturnType<typeof api.generateEvidenceSummary>>;

function GroundedAnalyst({ evidenceIds }: { evidenceIds: string[] }) {
  const [summary, setSummary] = useState<GroundedSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modes = [
    ["AttackPathExplanation", "Explain path"],
    ["RemediationSummary", "Draft fix plan"],
    ["ExecutiveSummary", "Leadership brief"],
    ["EvidencePackSummary", "Assemble report"]
  ] as const;

  async function generate(useCase: (typeof modes)[number][0]) {
    setBusy(useCase);
    setError(null);
    try {
      setSummary(await api.generateEvidenceSummary({ evidenceIds, useCase }));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The grounded summary could not be generated."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="inline-flex items-center gap-2">
            Grounded analyst
            <InfoPopover label="grounded analyst">
              Factual claims link to persisted evidence IDs. Text labeled as
              inference is interpretation, and generated output never performs
              workflow actions or bypasses approval.
            </InfoPopover>
          </span>
        }
        actions={
          <StateBadge tone="validated" dot={false}>
            Typed evidence tools
          </StateBadge>
        }
      />
      <div className="p-4">
        <p className="max-w-3xl text-sm text-muted">
          Explain, plan, or draft only from the normalized evidence selected in
          this snapshot. Factual claims cite evidence IDs; workflow actions
          remain separately approval-gated.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {modes.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => generate(value)}
              disabled={busy !== null || evidenceIds.length === 0}
              className={buttonClassName({
                size: "sm",
                variant: value === summary?.useCase ? "primary" : "secondary"
              })}
            >
              {busy === value ? "Grounding…" : label}
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-missed">
            {error}
          </p>
        ) : null}
        {summary ? (
          <div className="mt-4 rounded-card border border-line bg-bg p-4">
            <p className="text-sm leading-6 text-ink">{summary.summary}</p>
            {summary.claims.length > 0 ? (
              <ol className="mt-3 flex list-none flex-col gap-3">
                {summary.claims.map((claim, index) => (
                  <li
                    key={`${claim.text}-${index}`}
                    className="border-l-2 border-brand/40 pl-3"
                  >
                    <p className="text-[13px] leading-5 text-muted">
                      {claim.text}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {claim.evidenceIds.map((id) => (
                        <Link
                          key={id}
                          href={`/evidence?evidenceId=${encodeURIComponent(id)}`}
                          className="font-mono text-[10px] text-brand hover:text-brand-2"
                        >
                          ev·{shortId(id)}
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
            {summary.warnings.length > 0 ? (
              <div className="mt-3 rounded-control border border-approval/30 bg-approval/[0.05] px-3 py-2 text-xs text-muted">
                <span className="font-semibold text-ink">
                  Inference and limits:{" "}
                </span>
                {summary.warnings.join(" ")}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
