"use client";

import Link from "next/link";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  StateBadge,
  buttonClassName,
  cn,
  type StateTone
} from "../ui";
import { ProofLoopMap } from "./proof-loop-map";

const MILESTONE_TONE: Record<string, StateTone> = {
  Blocked: "missed",
  Completed: "fixed",
  Current: "approval",
  Upcoming: "inconclusive"
};

export function GettingStartedGuide() {
  const activation = useApiResource(() => api.getProductActivationState(), []);

  if (activation.loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-8">
        <LoadingSkeleton rows={8} />
      </div>
    );
  }

  if (activation.error || !activation.data) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-8">
        <ErrorState
          message={
            activation.error ?? "Getting-started progress is unavailable."
          }
          onRetry={activation.refetch}
        />
      </div>
    );
  }

  const data = activation.data;
  const percentage = Math.round(
    (data.completedMilestones / data.totalMilestones) * 100
  );
  const diagnostics = data.diagnostics.filter(
    (item) => item.code !== "experience_profile_incomplete"
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-5 py-7">
      <header className="grid gap-5 border-b border-line pb-7 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle-2">
            Getting started
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
            Complete your first proof loop
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            This guide reads your saved workspace state. A step completes only
            when Periscan can point to the persisted source, scope, decision,
            run, fix, verification, or delivered proof behind it.
          </p>
        </div>
        <Link
          href="/demo/workspace"
          className={buttonClassName({ variant: "secondary" })}
        >
          Practice in demo mode
        </Link>
      </header>

      <section aria-labelledby="getting-started-progress">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
              Workspace progress
            </p>
            <h2
              id="getting-started-progress"
              className="mt-1 text-lg font-semibold text-ink"
            >
              {data.completedMilestones} of {data.totalMilestones} milestones
            </h2>
          </div>
          <span className="font-mono text-sm text-brand-2">{percentage}%</span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-pill bg-surface-strong"
          role="progressbar"
          aria-label="Getting-started progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <div
            className="h-full rounded-pill bg-brand transition-[width] duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </section>

      <section className="border-l-2 border-brand bg-brand/[0.05] px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-2">
          Recommended next action
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">
              {data.nextAction.label}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              {data.nextAction.reason}
            </p>
          </div>
          <Link
            href={data.nextAction.href}
            className={buttonClassName({ variant: "primary" })}
          >
            Continue
          </Link>
        </div>
      </section>

      {/* P02-18: spatial product map — same activation milestones as the checklist. */}
      <ProofLoopMap activation={data} variant="panel" />

      <section aria-labelledby="proof-loop-milestones">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
              Evidence-backed checklist
            </p>
            <h2
              id="proof-loop-milestones"
              className="mt-1 text-lg font-semibold text-ink"
            >
              From account to delivered proof
            </h2>
          </div>
          <span className="font-mono text-xs text-subtle">
            maturity · {data.maturity}
          </span>
        </div>

        <ol className="mt-4 list-none border-y border-line">
          {data.milestones.map((milestone, index) => (
            <li
              key={milestone.key}
              className="grid gap-3 border-b border-line py-4 last:border-b-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-start"
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full font-mono text-xs font-semibold",
                  milestone.state === "Completed"
                    ? "bg-fixed text-bg"
                    : milestone.state === "Current"
                      ? "bg-brand-fill text-white"
                      : "bg-surface-strong text-muted"
                )}
              >
                {milestone.state === "Completed" ? "✓" : index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">
                    {milestone.label}
                  </h3>
                  <StateBadge
                    tone={MILESTONE_TONE[milestone.state] ?? "neutral"}
                    dot={false}
                  >
                    {milestone.state}
                  </StateBadge>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-subtle">
                    {milestone.stage}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {milestone.evidenceBasis}
                </p>
              </div>
              <Link
                href={milestone.href}
                className="text-xs font-semibold text-brand hover:text-brand-2"
              >
                {milestone.state === "Completed" ? "Review" : "Open"} →
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {diagnostics.length > 0 ? (
        <section aria-labelledby="getting-started-blockers">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
            Prerequisites
          </p>
          <h2
            id="getting-started-blockers"
            className="mt-1 text-lg font-semibold text-ink"
          >
            Resolve these before the next measured result
          </h2>
          <ul className="mt-3 list-none divide-y divide-line border-y border-line">
            {diagnostics.map((diagnostic) => (
              <li
                key={diagnostic.code}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">
                      {diagnostic.title}
                    </h3>
                    <span className="font-mono text-[10px] uppercase text-subtle">
                      {diagnostic.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {diagnostic.detail}
                  </p>
                </div>
                {diagnostic.href ? (
                  <Link
                    href={diagnostic.href}
                    className="text-xs font-semibold text-brand"
                  >
                    Resolve →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="operate-at-scale">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
          After the first proof loop
        </p>
        <h2
          id="operate-at-scale"
          className="mt-1 text-lg font-semibold text-ink"
        >
          Make continuous proof operational
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Turn the first result into a repeatable security program: establish
          asset ownership, schedule governed re-validation, and keep execution
          capacity healthy.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/attack-paths",
              label: "Measure multi-hop paths",
              detail:
                "Flagship journey: open a correlated path, Measure hop (safe) on Eligible edges, and confirm edge receipts with evidence IDs. Empty receipts stay honest — never fake Measured."
            },
            {
              href: "/assets",
              label: "Qualify assets and scope",
              detail:
                "Review ownership candidates, source lineage, freshness, and the exact boundary Periscan is authorized to validate."
            },
            {
              href: "/schedules",
              label: "Schedule continuous validation",
              detail:
                "Choose the validation pack, policy, runner pool, recovery behavior, and notification route for recurring proof."
            },
            {
              href: "/runners",
              label: "Harden runner coverage",
              detail:
                "Confirm runner liveness, eligibility, signed-task capacity, redundancy, and kill-switch readiness."
            }
          ].map((item) => (
            <article
              key={item.href}
              className="border-t-2 border-brand bg-surface/40 p-4"
            >
              <h3 className="text-sm font-semibold text-ink">{item.label}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
              <Link
                href={item.href}
                className="mt-3 inline-block text-xs font-semibold text-brand hover:text-brand-2"
              >
                Open →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-line pt-4 text-xs leading-5 text-subtle">
        Milestones are derived from the current tenant only. Demo progress is
        intentionally separate and never completes a real workspace milestone.
      </footer>
    </div>
  );
}
