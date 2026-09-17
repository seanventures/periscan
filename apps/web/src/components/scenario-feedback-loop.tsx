"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  EngagementResult,
  ExecuteScenarioInput,
  ScenarioBundle,
  StopScenarioFeedbackInput
} from "@periscan/shared";

import { Badge, Button } from "../ui";

const fieldClass = "flex flex-col gap-1 text-sm text-muted";
const inputClass =
  "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function statusTone(status: ScenarioBundle["feedbackLastStatus"]) {
  if (status === "Completed") return "success" as const;
  if (status === "Running") return "info" as const;
  if (status === "Failed" || status === "Stopped") return "danger" as const;
  if (status === "Exhausted") return "warning" as const;
  return "neutral" as const;
}

function cycleState(
  scenario: ScenarioBundle,
  cycles: EngagementResult[],
  cycleNumber: number
) {
  const engagement = cycles.find(
    (item) => item.feedbackCycleNumber === cycleNumber
  );
  if (engagement) return engagement.status;
  if (
    cycleNumber === scenario.feedbackCycleCount &&
    scenario.feedbackLastStatus === "Running"
  ) {
    return "Running";
  }
  if (
    cycleNumber === scenario.feedbackCycleCount &&
    scenario.feedbackLastError
  ) {
    return "Failed";
  }
  if (
    cycleNumber === scenario.feedbackCycleCount + 1 &&
    !scenario.feedbackStoppedAt &&
    scenario.feedbackCycleCount < scenario.maximumIterations
  ) {
    return "Ready";
  }
  return scenario.feedbackStoppedAt ? "Stopped" : "Locked";
}

export function ScenarioFeedbackLoop({
  busy,
  cycles,
  onRun,
  onStop,
  scenario
}: {
  busy: boolean;
  cycles: EngagementResult[];
  onRun: (input: ExecuteScenarioInput) => Promise<void>;
  onStop: (input: StopScenarioFeedbackInput) => Promise<void>;
  scenario: ScenarioBundle;
}) {
  const orderedCycles = useMemo(
    () =>
      [...cycles].sort(
        (left, right) =>
          (left.feedbackCycleNumber ?? 0) - (right.feedbackCycleNumber ?? 0)
      ),
    [cycles]
  );
  const [selectedCycleNumber, setSelectedCycleNumber] = useState<number | null>(
    orderedCycles.at(-1)?.feedbackCycleNumber ?? null
  );
  const [reason, setReason] = useState("");
  const [reviewReference, setReviewReference] = useState("");

  useEffect(() => {
    const latest = orderedCycles.at(-1)?.feedbackCycleNumber ?? null;
    if (latest !== null) setSelectedCycleNumber(latest);
  }, [orderedCycles]);

  const selectedCycle = orderedCycles.find(
    (cycle) => cycle.feedbackCycleNumber === selectedCycleNumber
  );
  const remaining = Math.max(
    0,
    scenario.maximumIterations - scenario.feedbackCycleCount
  );
  const canDecide =
    scenario.status === "Approved" &&
    scenario.feedbackLastStatus !== "Running" &&
    scenario.feedbackLastStatus !== "Stopped" &&
    scenario.feedbackLastStatus !== "Exhausted" &&
    remaining > 0;
  const rationaleReady =
    reason.trim().length >= 12 && reviewReference.trim().length >= 3;
  const latestEvidenceCount = orderedCycles.at(-1)?.evidenceIds.length ?? 0;

  return (
    <section
      aria-labelledby="scenario-feedback-title"
      className="border-t border-line bg-surface/35"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            Human-triggered · evidence-gated
          </p>
          <h4
            className="mt-1 text-base font-semibold text-ink"
            id="scenario-feedback-title"
          >
            Feedback loop
          </h4>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
            Each cycle reruns the approved graph against fresh observations.
            Branches can consume only the preceding step result, and the signed
            cycle budget cannot expand at runtime.
          </p>
        </div>
        <Badge tone={statusTone(scenario.feedbackLastStatus)}>
          {scenario.feedbackLastStatus}
        </Badge>
      </div>

      <dl className="grid border-y border-line sm:grid-cols-3">
        {[
          [
            "Cycle budget",
            `${scenario.feedbackCycleCount} / ${scenario.maximumIterations}`,
            `${remaining} remaining`
          ],
          [
            "Latest evidence",
            String(latestEvidenceCount),
            orderedCycles.length > 0
              ? "fresh cycle artifacts"
              : "awaiting cycle 1"
          ],
          [
            "Failed cycles",
            String(scenario.feedbackFailedCycleCount),
            "each attempt consumes budget"
          ]
        ].map(([label, value, detail], index) => (
          <div
            className={`px-4 py-3 ${index > 0 ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}
            key={label}
          >
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
              {label}
            </dt>
            <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
            <dd className="mt-0.5 text-[11px] text-muted">{detail}</dd>
          </div>
        ))}
      </dl>

      <div className="px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          Signed cycle rail
        </p>
        <ol
          aria-label="Scenario feedback cycles"
          className="mt-3 grid gap-2 sm:grid-cols-3"
        >
          {Array.from(
            { length: scenario.maximumIterations },
            (_, index) => index + 1
          ).map((cycleNumber) => {
            const state = cycleState(scenario, orderedCycles, cycleNumber);
            const selectable = orderedCycles.some(
              (cycle) => cycle.feedbackCycleNumber === cycleNumber
            );
            const selected = selectedCycleNumber === cycleNumber;
            return (
              <li key={cycleNumber}>
                <button
                  aria-pressed={selected}
                  className={`flex w-full items-center gap-3 border-l-2 px-3 py-2 text-left transition-colors ${
                    selected
                      ? "border-brand bg-brand/10"
                      : state === "Ready"
                        ? "border-success bg-success/5"
                        : "border-line bg-transparent"
                  } ${selectable ? "hover:bg-surface" : "cursor-default"}`}
                  disabled={!selectable}
                  onClick={() => setSelectedCycleNumber(cycleNumber)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${
                      state === "Running"
                        ? "bg-brand motion-safe:animate-pulse"
                        : state === "Completed"
                          ? "bg-success"
                          : state === "Failed" || state === "Denied"
                            ? "bg-danger"
                            : state === "Ready"
                              ? "bg-success"
                              : "bg-line"
                    }`}
                  />
                  <span>
                    <span className="block text-xs font-semibold text-ink">
                      Cycle {cycleNumber}
                    </span>
                    <span className="block text-[11px] uppercase tracking-[0.1em] text-subtle">
                      {state}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid border-t border-line lg:grid-cols-[1.15fr_0.85fr]">
        <div className="px-4 py-4 lg:border-r lg:border-line">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Branch evidence
          </p>
          {selectedCycle ? (
            <ol className="mt-3 divide-y divide-line border-y border-line">
              {selectedCycle.steps.map((step, index) => {
                const definition = scenario.steps.find(
                  (item) => item.stepId === step.stepId
                );
                return (
                  <li
                    className="grid gap-2 py-3 sm:grid-cols-[2rem_1fr_auto] sm:items-start"
                    key={`${selectedCycle.engagementId}-${step.stepId ?? index}`}
                  >
                    <span className="font-mono text-xs text-brand">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-ink">
                        {definition?.name ?? step.moduleId}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-5 text-muted">
                        {step.branchDecision
                          ? step.branchDecision.evidence.join(" · ")
                          : "No branch predicate was evaluated."}
                      </span>
                    </span>
                    <span className="text-right font-mono text-[10px] uppercase tracking-[0.1em] text-subtle">
                      {step.status}
                      <span className="mt-0.5 block normal-case tracking-normal">
                        {step.evidenceIds.length} evidence · {step.signalCount}{" "}
                        signals
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 border-y border-line py-5 text-sm text-muted">
              No cycle has run. The first decision will evaluate the approved
              graph against fresh module results and persist every branch fact.
            </p>
          )}
        </div>

        <div className="px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Next decision
          </p>
          {scenario.feedbackStoppedAt ? (
            <div className="mt-3 border-l-2 border-danger pl-3 text-sm">
              <p className="font-semibold text-ink">Loop stopped</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {scenario.feedbackStopReason}
              </p>
              <p className="mt-1 font-mono text-[10px] text-subtle">
                {scenario.feedbackStopReviewReference}
              </p>
            </div>
          ) : remaining === 0 ? (
            <div className="mt-3 border-l-2 border-warning pl-3 text-sm">
              <p className="font-semibold text-ink">Signed limit reached</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Compile and approve a new bundle to continue. This graph cannot
                silently extend itself.
              </p>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <label className={fieldClass}>
                Decision reason
                <textarea
                  aria-label="Feedback decision reason"
                  className={`${inputClass} min-h-20 resize-y`}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain why fresh evidence is needed or why the loop should stop."
                  value={reason}
                />
              </label>
              <label className={fieldClass}>
                Review reference
                <input
                  aria-label="Feedback review reference"
                  className={inputClass}
                  onChange={(event) => setReviewReference(event.target.value)}
                  placeholder="CHANGE-1234 or incident reference"
                  value={reviewReference}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!canDecide || !rationaleReady || busy}
                  onClick={() =>
                    void onRun({
                      compiledHash: scenario.compiledHash,
                      expectedFeedbackCycleCount: scenario.feedbackCycleCount,
                      reason: reason.trim(),
                      reviewReference: reviewReference.trim()
                    })
                  }
                >
                  {busy ? "Recording cycle…" : "Run next governed cycle"}
                </Button>
                <Button
                  disabled={!canDecide || !rationaleReady || busy}
                  onClick={() =>
                    void onStop({
                      expectedFeedbackCycleCount: scenario.feedbackCycleCount,
                      reason: reason.trim(),
                      reviewReference: reviewReference.trim()
                    })
                  }
                  variant="secondary"
                >
                  Stop loop
                </Button>
              </div>
              <p className="text-[11px] leading-5 text-subtle">
                Running consumes one signed cycle even when execution fails.
                Stopping is terminal for this bundle; approval of a new hash is
                required to continue.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
