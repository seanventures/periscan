"use client";

import type {
  AgentBehaviorFinding,
  AgentBehaviorSeverity
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  StateBadge,
  type StateTone
} from "../ui";

// Align with apps/web/src/ui/severity-visual.ts (Critical≠High; Low neutral).
const SEVERITY_TONE: Record<AgentBehaviorSeverity, StateTone> = {
  Critical: "missed",
  High: "approval",
  Moderate: "blocked",
  Low: "inconclusive"
};

export function AgentBehaviorAnalytics() {
  const analysis = useApiResource(() => api.getAgentBehaviorAnalysis(), []);

  if (analysis.loading) {
    return (
      <Panel>
        <PanelHeader title="Agent behavior analytics" />
        <LoadingSkeleton rows={4} />
      </Panel>
    );
  }
  if (analysis.error || !analysis.data) {
    return (
      <Panel>
        <PanelHeader title="Agent behavior analytics" />
        <ErrorState
          message={analysis.error ?? "Behavior analysis is unavailable."}
          onRetry={analysis.refetch}
        />
      </Panel>
    );
  }

  const report = analysis.data;
  return (
    <Panel aria-label="Agent behavior analytics">
      <PanelHeader
        title="Agent behavior analytics"
        actions={
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#cfe0ff]">
            Explainable · 30-day baseline
          </span>
        }
      />
      <div className="grid gap-px border-b border-line bg-line sm:grid-cols-4">
        <Metric label="Runs analyzed" value={report.summary.runsAnalyzed} />
        <Metric
          label="Runs flagged"
          value={report.summary.runsWithFindings}
          tone={
            report.summary.runsWithFindings > 0 ? "text-approval" : "text-fixed"
          }
        />
        <Metric
          label="Critical rules"
          value={report.summary.critical}
          tone={report.summary.critical > 0 ? "text-missed" : undefined}
        />
        <Metric
          label="Median tool calls"
          value={report.baseline.medianToolRequests}
        />
      </div>

      {report.summary.runsAnalyzed === 0 ? (
        <div className="p-5">
          <NotConfigured
            title="No recorded workflows to baseline"
            message="Launch a governed workflow first. Periscan computes this view only from durable tenant events, tool requests, approvals, scopes, and normalized cost."
          />
        </div>
      ) : report.findings.length === 0 ? (
        <div className="flex items-start gap-3 p-5">
          <StateBadge tone="fixed">No rules triggered</StateBadge>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Every recorder chain is valid and no approval-integrity, denial,
            failure, scope, velocity, or cost rule crossed its displayed
            threshold. This is not a guarantee that agent behavior is benign.
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-line">
          {report.findings.map((item) => (
            <FindingRow key={item.findingKey} finding={item} />
          ))}
        </ol>
      )}

      <details className="group border-t border-line p-4">
        <summary className="cursor-pointer list-none text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          Method and limits{" "}
          <span className="text-subtle group-open:hidden">+</span>
        </summary>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-muted">
          {report.methodology} Baselines cover {report.baseline.runCount}{" "}
          run(s). Absolute safety thresholds still apply when history is sparse.
          A rule explains what crossed the threshold; it does not assign intent.
        </p>
      </details>
    </Panel>
  );
}

function Metric({
  label,
  tone,
  value
}: {
  label: string;
  tone?: string;
  value: number;
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-subtle">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${tone ?? "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}

function FindingRow({ finding }: { finding: AgentBehaviorFinding }) {
  return (
    <li className="grid gap-4 p-5 lg:grid-cols-[11rem_minmax(0,1fr)]">
      <div>
        <StateBadge tone={SEVERITY_TONE[finding.severity]}>
          {finding.severity}
        </StateBadge>
        <p className="mt-2 font-mono text-[10px] text-subtle">
          {finding.ruleId}
        </p>
        <p className="mt-1 font-mono text-[10px] text-subtle">
          Run {finding.workflowRunId.slice(0, 12)}
        </p>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{finding.title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          {finding.explanation}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <EvidenceFact label="Observed" value={finding.observed} />
          <EvidenceFact label="Baseline / invariant" value={finding.baseline} />
        </div>
        <p className="mt-3 border-l-2 border-brand px-3 text-xs leading-5 text-muted">
          <span className="font-semibold text-ink">Next action:</span>{" "}
          {finding.recommendedAction}
        </p>
        <div
          className="mt-3 flex flex-wrap gap-1.5"
          aria-label="Behavior evidence references"
        >
          {finding.evidenceRefs.slice(0, 8).map((reference) => (
            <code
              key={reference}
              className="rounded-control border border-line bg-elevated px-2 py-1 text-[10px] text-[#cfe0ff]"
            >
              {reference}
            </code>
          ))}
          {finding.evidenceRefs.length > 8 ? (
            <span className="px-1 py-1 text-[10px] text-subtle">
              +{finding.evidenceRefs.length - 8} more
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function EvidenceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-line bg-elevated px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-subtle">
        {label}
      </p>
      <p className="mt-1 text-xs text-ink">{value}</p>
    </div>
  );
}
