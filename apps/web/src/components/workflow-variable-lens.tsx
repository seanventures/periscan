"use client";

import { useEffect, useMemo, useState } from "react";

import {
  compareAgentWorkflowVariableSnapshots,
  type AgentWorkflowVariableDelta,
  type AgentWorkflowVariableNamespace
} from "@periscan/shared";

import { useApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  ErrorState,
  LoadingSkeleton,
  StateBadge,
  cn,
  type StateTone
} from "../ui";

const NAMESPACES: AgentWorkflowVariableNamespace[] = [
  "Input",
  "Context",
  "Policy",
  "Evidence",
  "Model",
  "Tool",
  "Transition",
  "Performance",
  "Control"
];

const CHANGE_TONE: Record<AgentWorkflowVariableDelta["changeType"], StateTone> =
  {
    Added: "validated",
    Changed: "approval",
    Removed: "missed",
    Unchanged: "neutral"
  };

function momentLabel(input: {
  eventType: string;
  sequence: string;
  stepKey: string | null;
}) {
  if (input.eventType === "Baseline") return "#0 · Run inputs";
  return `#${input.sequence} · ${input.stepKey ?? input.eventType}`;
}

function valueText(
  delta: AgentWorkflowVariableDelta,
  side: "before" | "after"
) {
  const value = delta[side];
  return value
    ? value.valuePreview
    : side === "before"
      ? "Not present"
      : "Removed";
}

export function WorkflowVariableLens({
  workflowRunId
}: {
  workflowRunId: string;
}) {
  const analysis = useApiResource(
    () => api.getAgentWorkflowVariableAnalysis(workflowRunId),
    [workflowRunId]
  );
  const [beforeSequence, setBeforeSequence] = useState("0");
  const [afterSequence, setAfterSequence] = useState("0");
  const [namespace, setNamespace] = useState<
    AgentWorkflowVariableNamespace | "All"
  >("All");
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    const snapshots = analysis.data?.snapshots ?? [];
    if (snapshots.length === 0) return;
    const last = snapshots.at(-1)!;
    const previous = snapshots.at(-2) ?? snapshots[0]!;
    setBeforeSequence(previous.sequence);
    setAfterSequence(last.sequence);
    setSelectedKey("");
  }, [analysis.data?.workflowRunId, analysis.data?.snapshots.length]);

  const comparison = useMemo(() => {
    const snapshots = analysis.data?.snapshots ?? [];
    const before =
      snapshots.find((snapshot) => snapshot.sequence === beforeSequence) ??
      snapshots[0];
    const after =
      snapshots.find((snapshot) => snapshot.sequence === afterSequence) ??
      snapshots.at(-1);
    if (!before || !after) return null;
    const all = compareAgentWorkflowVariableSnapshots(before, after);
    const visible = all.filter(
      (delta) =>
        (namespace === "All" || delta.namespace === namespace) &&
        (showUnchanged || delta.changeType !== "Unchanged")
    );
    return { after, all, before, visible };
  }, [
    afterSequence,
    analysis.data?.snapshots,
    beforeSequence,
    namespace,
    showUnchanged
  ]);

  if (analysis.loading) {
    return (
      <section
        aria-label="Historical variable analysis"
        className="border-y border-line py-4"
      >
        <LoadingSkeleton rows={4} className="p-0" />
      </section>
    );
  }

  if (analysis.error || !analysis.data || !comparison) {
    return (
      <section
        aria-label="Historical variable analysis"
        className="border-y border-line py-4"
      >
        <ErrorState
          message={analysis.error ?? "Historical variables are unavailable."}
          onRetry={analysis.refetch}
        />
      </section>
    );
  }

  const data = analysis.data;
  const selected =
    comparison.visible.find((delta) => delta.key === selectedKey) ??
    comparison.visible[0] ??
    null;
  const changed = comparison.all.filter(
    (delta) => delta.changeType === "Changed"
  ).length;
  const added = comparison.all.filter(
    (delta) => delta.changeType === "Added"
  ).length;
  const removed = comparison.all.filter(
    (delta) => delta.changeType === "Removed"
  ).length;
  const maxMomentChanges = Math.max(
    1,
    ...data.snapshots.map(
      (snapshot) =>
        snapshot.changeSummary.added +
        snapshot.changeSummary.changed +
        snapshot.changeSummary.removed
    )
  );

  return (
    <section
      aria-label="Historical variable analysis"
      data-testid="workflow-variable-lens"
      className="border-y border-line py-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Variable lens
          </p>
          <h3 className="mt-1 text-[15px] font-medium text-ink">
            Compare what the workflow knew at any two moments
          </h3>
          <p className="mt-1 max-w-2xl text-[12px] text-muted">
            Values come from the persisted redacted recorder. Hashes detect
            exact changes; omitted prompts and secrets remain unavailable by
            design.
          </p>
        </div>
        <StateBadge tone={data.integrityVerified ? "fixed" : "missed"}>
          {data.integrityVerified ? "History verified" : "History untrusted"}
        </StateBadge>
      </div>

      <dl className="mt-4 grid grid-cols-2 border-y border-line sm:grid-cols-4">
        {[
          ["Tracked variables", data.summary.variableCount],
          ["Changed over run", data.summary.changedVariableCount],
          ["Recorded events", data.summary.eventCount],
          ["Observed latency", `${data.summary.totalLatencyMs} ms`]
        ].map(([label, value], index) => (
          <div
            key={label}
            className={cn(
              "px-3 py-2.5",
              index % 2 === 0 ? "border-r border-line" : "",
              index === 1 ? "sm:border-r" : "",
              index > 1 ? "border-t border-line sm:border-t-0" : ""
            )}
          >
            <dt className="text-[10px] uppercase tracking-[0.06em] text-subtle">
              {label}
            </dt>
            <dd className="mt-1 font-mono text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 overflow-x-auto pb-1" aria-label="Recorded moments">
        <div className="flex min-w-max items-end gap-1">
          {data.snapshots.map((snapshot) => {
            const changes =
              snapshot.changeSummary.added +
              snapshot.changeSummary.changed +
              snapshot.changeSummary.removed;
            const active = snapshot.sequence === afterSequence;
            return (
              <button
                key={snapshot.sequence}
                type="button"
                title={`${momentLabel(snapshot)} · ${changes} change${changes === 1 ? "" : "s"}`}
                aria-label={`Compare through ${momentLabel(snapshot)}`}
                aria-pressed={active}
                onClick={() => setAfterSequence(snapshot.sequence)}
                className={cn(
                  "group flex h-14 w-8 flex-col items-center justify-end gap-1 border-b transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active
                    ? "border-brand bg-brand/5"
                    : "border-line hover:border-brand/50 hover:bg-surface-2"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "w-1.5 rounded-t transition-all duration-200",
                    active ? "bg-brand" : "bg-line group-hover:bg-brand/60"
                  )}
                  style={{
                    height: `${Math.max(4, Math.round((changes / maxMomentChanges) * 32))}px`
                  }}
                />
                <span className="font-mono text-[9px] text-subtle">
                  {snapshot.sequence}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-[11px] text-subtle">
          Compare from
          <select
            aria-label="Compare variables from"
            value={beforeSequence}
            onChange={(event) => setBeforeSequence(event.target.value)}
            className="min-h-9 border border-line bg-surface px-2 text-[12px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {data.snapshots.map((snapshot) => (
              <option key={snapshot.sequence} value={snapshot.sequence}>
                {momentLabel(snapshot)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-subtle">
          Compare to
          <select
            aria-label="Compare variables to"
            value={afterSequence}
            onChange={(event) => setAfterSequence(event.target.value)}
            className="min-h-9 border border-line bg-surface px-2 text-[12px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {data.snapshots.map((snapshot) => (
              <option key={snapshot.sequence} value={snapshot.sequence}>
                {momentLabel(snapshot)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-subtle">
          Variable family
          <select
            aria-label="Filter variable family"
            value={namespace}
            onChange={(event) =>
              setNamespace(
                event.target.value as AgentWorkflowVariableNamespace | "All"
              )
            }
            className="min-h-9 border border-line bg-surface px-2 text-[12px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <option value="All">All families</option>
            {NAMESPACES.map((item) => (
              <option key={item} value={item}>
                {item} ({data.namespaceCounts[item]})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-col items-start gap-x-4 gap-y-2 border-b border-line pb-3 text-[11px] sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-ink">
          {changed} changed · {added} added · {removed} removed
        </span>
        <label className="inline-flex min-h-8 items-center gap-2 text-muted sm:ml-auto">
          <input
            type="checkbox"
            checked={showUnchanged}
            onChange={(event) => setShowUnchanged(event.target.checked)}
            className="size-4 accent-brand"
          />
          Include unchanged
        </label>
      </div>

      <div className="grid min-h-52 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="divide-y divide-line lg:border-r lg:border-line">
          {comparison.visible.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-muted">
              No variables match this comparison and filter.
            </p>
          ) : (
            comparison.visible.map((delta) => (
              <button
                key={delta.key}
                type="button"
                aria-pressed={selected?.key === delta.key}
                onClick={() => setSelectedKey(delta.key)}
                className={cn(
                  "grid w-full gap-1 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:grid-cols-[6.5rem_minmax(0,1fr)_7rem] sm:items-center",
                  selected?.key === delta.key
                    ? "bg-brand/5"
                    : "hover:bg-surface-2"
                )}
              >
                <StateBadge tone={CHANGE_TONE[delta.changeType]}>
                  {delta.changeType}
                </StateBadge>
                <span className="min-w-0 truncate font-mono text-[11px] text-ink">
                  {delta.key}
                </span>
                <span className="text-[10px] uppercase tracking-[0.06em] text-subtle sm:text-right">
                  {delta.namespace}
                </span>
              </button>
            ))
          )}
        </div>

        <aside className="border-t border-line p-3 lg:border-t-0">
          {selected ? (
            <div key={selected.key} className="animate-in fade-in duration-150">
              <div className="flex items-start justify-between gap-2">
                <p className="break-all font-mono text-[11px] font-medium text-ink">
                  {selected.key}
                </p>
                <StateBadge tone={CHANGE_TONE[selected.changeType]}>
                  {selected.changeType}
                </StateBadge>
              </div>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.06em] text-subtle">
                    Before · #{comparison.before.sequence}
                  </dt>
                  <dd className="mt-1 break-words font-mono text-[11px] leading-5 text-muted">
                    {valueText(selected, "before")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.06em] text-subtle">
                    After · #{comparison.after.sequence}
                  </dt>
                  <dd className="mt-1 break-words font-mono text-[11px] leading-5 text-ink">
                    {valueText(selected, "after")}
                  </dd>
                </div>
                <div className="border-t border-line pt-3">
                  <dt className="text-[10px] uppercase tracking-[0.06em] text-subtle">
                    Exact-value proof
                  </dt>
                  <dd className="mt-1 font-mono text-[10px] leading-4 text-subtle">
                    {(selected.after ?? selected.before)?.valueHash.slice(
                      0,
                      24
                    )}
                    …
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="text-[12px] text-muted">
              Select a variable to inspect its persisted before and after state.
            </p>
          )}
        </aside>
      </div>

      <details className="mt-3 border-t border-line pt-3 text-[11px] text-muted">
        <summary className="cursor-pointer text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          Analysis boundary
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {data.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
