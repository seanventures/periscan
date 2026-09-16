"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  buildAttackPathRiskSummary,
  type ValidationSnapshot
} from "@periscan/shared";

import {
  AttackPathClaimBadge,
  Brandmark,
  StateBadge,
  buttonClassName,
  cn
} from "../ui";

const DEMO_PROGRESS_KEY = "periscan.demo.guide.v1";

const DEMO_STEPS = [
  {
    id: "start",
    label: "Start here",
    title: "Understand the sample",
    note: "Confirm what demo mode can and cannot prove."
  },
  {
    id: "path",
    label: "Attack path",
    title: "Follow entry to impact",
    note: "Read the path state, risk summary, and evidence basis."
  },
  {
    id: "control",
    label: "Control proof",
    title: "Check what the control observed",
    note: "Separate a control observation from a control assumption."
  },
  {
    id: "fix",
    label: "Smallest fix",
    title: "Choose the path breaker",
    note: "Review the technical steps and ownership."
  },
  {
    id: "verify",
    label: "Re-test",
    title: "Require fresh verification",
    note: "See what must run before Fixed is earned."
  },
  {
    id: "report",
    label: "Deliver proof",
    title: "Review the governed output",
    note: "Confirm audience, redaction, and included evidence."
  }
] as const;

type DemoStepId = (typeof DEMO_STEPS)[number]["id"];

export function DemoWorkspace({ snapshot }: { snapshot: ValidationSnapshot }) {
  const [active, setActive] = useState<DemoStepId>("start");
  const [visited, setVisited] = useState<Set<DemoStepId>>(
    () => new Set(["start"])
  );
  const activeHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousActiveRef = useRef<DemoStepId>("start");

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(DEMO_PROGRESS_KEY) ?? "[]"
      );
      if (Array.isArray(stored)) {
        const valid = stored.filter((value): value is DemoStepId =>
          DEMO_STEPS.some((step) => step.id === value)
        );
        setVisited(new Set(["start", ...valid]));
      }
    } catch {
      // Demo progress is optional and never affects sample or customer data.
    }
  }, []);

  useEffect(() => {
    if (previousActiveRef.current === active) return;
    previousActiveRef.current = active;

    const heading = activeHeadingRef.current;
    if (!heading) return;

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start"
    });
  }, [active]);

  const activeIndex = DEMO_STEPS.findIndex((step) => step.id === active);
  const activeStep = DEMO_STEPS[activeIndex] ?? DEMO_STEPS[0]!;
  const nextStep = DEMO_STEPS[activeIndex + 1];

  function openStep(id: DemoStepId) {
    setActive(id);
    setVisited((current) => {
      const next = new Set(current).add(id);
      try {
        localStorage.setItem(DEMO_PROGRESS_KEY, JSON.stringify([...next]));
      } catch {
        // Progress persistence is best effort in the isolated demo.
      }
      return next;
    });
  }

  function restart() {
    setActive("start");
    setVisited(new Set(["start"]));
    try {
      localStorage.removeItem(DEMO_PROGRESS_KEY);
    } catch {
      // Nothing else depends on this key.
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      data-demo-mode="true"
      className="public-main min-h-screen max-w-[100vw] overflow-x-hidden bg-bg text-ink"
    >
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="flex min-h-12 min-w-0 items-center gap-2 px-3 sm:gap-3 sm:px-6">
          <Brandmark size={21} />
          <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
          <StateBadge tone="approval" dot={false}>
            Demo mode
          </StateBadge>
          <span className="hidden min-w-0 truncate text-xs text-muted md:inline">
            Deterministic sample data · read-only tour
          </span>
          <Link
            href="/login"
            className="ml-auto shrink-0 text-xs font-semibold text-brand hover:text-brand-2"
          >
            Exit demo
          </Link>
        </div>
      </header>

      <div className="min-w-0 lg:grid lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-line bg-elevated lg:border-b-0 lg:border-r">
          <div className="px-4 py-4 sm:px-6 lg:px-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-subtle">
              Demo guide
            </p>
            <h1 className="mt-1 text-lg font-semibold text-ink">
              Find it. Fix it. Prove it.
            </h1>
            <p className="mt-2 text-xs leading-5 text-muted">
              Six stops through one sample repository-to-cloud proof loop.
            </p>
            <div
              aria-label="Demo guide progress"
              aria-valuemax={DEMO_STEPS.length}
              aria-valuemin={1}
              aria-valuenow={visited.size}
              className="mt-3 h-1.5 overflow-hidden rounded-control bg-surface-strong"
              role="progressbar"
            >
              <div
                className="h-full rounded-control bg-brand-fill transition-[width] duration-300 motion-reduce:transition-none"
                style={{
                  width: `${(visited.size / DEMO_STEPS.length) * 100}%`
                }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-subtle">
              {visited.size} of {DEMO_STEPS.length} viewed
            </p>
          </div>

          <nav
            aria-label="Demo guide"
            className="min-w-0 overflow-x-auto overscroll-x-contain lg:overflow-visible"
          >
            <ol className="flex w-max max-w-none list-none gap-1 px-3 pb-4 lg:w-full lg:min-w-0 lg:flex-col">
              {DEMO_STEPS.map((step, index) => (
                <li key={step.id} className="min-w-0 shrink-0 lg:shrink">
                  <button
                    type="button"
                    aria-current={active === step.id ? "step" : undefined}
                    onClick={() => openStep(step.id)}
                    className={cn(
                      "flex w-full min-w-[8.5rem] items-center gap-2.5 rounded-control px-3 py-2 text-left transition-colors lg:min-w-0",
                      active === step.id
                        ? "bg-brand/12 text-ink"
                        : "text-muted hover:bg-surface hover:text-ink"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full font-mono text-[10px]",
                        visited.has(step.id)
                          ? "bg-fixed text-bg"
                          : "bg-surface-strong text-subtle"
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold">{step.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="hidden border-t border-line px-4 py-4 lg:block">
            <button
              type="button"
              onClick={restart}
              className="text-xs font-semibold text-subtle hover:text-ink"
            >
              Restart guide
            </button>
          </div>
        </aside>

        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="min-w-0 overflow-x-hidden px-4 py-6 sm:px-8 lg:px-10">
            <header className="border-b border-line pb-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
                {activeStep.label} · sample {activeIndex + 1} of{" "}
                {DEMO_STEPS.length}
              </p>
              <h2
                ref={activeHeadingRef}
                tabIndex={-1}
                className="mt-1 scroll-mt-16 text-2xl font-semibold tracking-tight text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-3xl"
              >
                {activeStep.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                {activeStep.note}
              </p>
            </header>

            <div className="py-6">
              <DemoStage active={active} snapshot={snapshot} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="max-w-xl text-xs leading-5 text-subtle">
                Demo interactions update this guide only. They never create a
                session, change a tenant, run a validation, or send data.
              </p>
              {nextStep ? (
                <button
                  type="button"
                  onClick={() => openStep(nextStep.id)}
                  className={buttonClassName({ size: "sm" })}
                >
                  Next · {nextStep.label}
                </button>
              ) : (
                <Link
                  href="/signup"
                  className={buttonClassName({ size: "sm" })}
                >
                  Create a real workspace
                </Link>
              )}
            </div>
          </section>

          <aside className="border-t border-line bg-surface/30 px-5 py-6 xl:border-l xl:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-subtle">
              What to notice
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {activeStep.note}
            </p>
            <div className="mt-5 border-l-2 border-approval pl-3">
              <p className="text-xs font-semibold text-ink">Sample boundary</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                All IDs, paths, observations, fixes, and report content on this
                route are deterministic sample data—not customer telemetry.
              </p>
            </div>
            <dl className="mt-6 space-y-4 text-xs">
              <div>
                <dt className="text-subtle">Scenario</dt>
                <dd className="mt-1 text-ink">Repository → cloud production</dd>
              </div>
              <div>
                <dt className="text-subtle">Evidence</dt>
                <dd className="mt-1 text-ink">
                  {snapshot.evidenceIds.length} redacted sample artifacts
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Generated</dt>
                <dd className="mt-1 text-ink">
                  {new Date(snapshot.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </main>
  );
}

function DemoStage({
  active,
  snapshot
}: {
  active: DemoStepId;
  snapshot: ValidationSnapshot;
}) {
  const topPath = snapshot.topAttackPaths[0];
  const control = snapshot.controlObservations[0];
  const fix = snapshot.remediationPriorities[0];

  if (active === "start") {
    return (
      <div>
        <p className="max-w-3xl text-lg leading-8 text-ink">
          A fake repository secret maps to a sample cloud role and production
          impact. A mock SIEM misses the related activity. Periscan identifies
          the smallest path breaker, defines the re-test, and composes a
          redacted evidence pack.
        </p>
        <div className="mt-7 grid gap-5 border-y border-line py-5 sm:grid-cols-3">
          <DemoFact label="Path risk" value={snapshot.summary.topRiskBand} />
          <DemoFact
            label="Control observations"
            value={String(snapshot.metrics.controlObservationCount)}
          />
          <DemoFact
            label="Fixes to review"
            value={String(snapshot.metrics.remediationCount)}
          />
        </div>
        <section className="mt-7 border-l-2 border-brand pl-4">
          <h3 className="text-sm font-semibold text-ink">
            How to use the demo
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Use the numbered guide or Next button. Look for the sample label,
            the evidence basis behind each claim, and the difference between an
            implemented fix and a freshly verified fix.
          </p>
        </section>
      </div>
    );
  }

  if (active === "path") {
    if (!topPath) return <DemoUnavailable label="attack path" />;
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">
              {topPath.attackPath.name}
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
              {buildAttackPathRiskSummary(
                topPath.attackPath,
                topPath.risk.band
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <StateBadge tone="missed" variant="outline" dot={false}>
              {topPath.risk.band} · {topPath.risk.score}
            </StateBadge>
            <AttackPathClaimBadge attackPath={topPath.attackPath} dot={false} />
          </div>
        </div>
        <ol className="mt-7 list-none border-y border-line">
          {topPath.attackPath.pathNodes.map((node, index) => (
            <li
              key={node.pathNodeId}
              className="grid grid-cols-[2rem_1fr] gap-3 border-b border-line py-4 last:border-b-0"
            >
              <span className="grid size-8 place-items-center rounded-full bg-brand/10 font-mono text-xs text-brand-2">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{node.label}</p>
                <p className="mt-1 font-mono text-[10px] uppercase text-subtle">
                  {node.entityType} · {node.evidenceIds.length} evidence
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-5 text-subtle">
          Evidence basis: {topPath.attackPath.evidenceBasis}. The demo preserves
          that label; a high risk score does not silently upgrade heuristic
          evidence into a measured claim.
        </p>
      </div>
    );
  }

  if (active === "control") {
    if (!control) return <DemoUnavailable label="control observation" />;
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge tone="missed" variant="outline" dot={false}>
            Missed observation
          </StateBadge>
          <span className="font-mono text-xs text-subtle">
            confidence{" "}
            {control.confidence == null
              ? "not measured"
              : `${Math.round(control.confidence * 100)}%`}
          </span>
        </div>
        <h3 className="mt-4 text-lg font-semibold text-ink">
          {control.sourceVendor} · {control.signalSubcategory}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {control.freshness}. This is a sample control observation linked to
          evidence, not a claim about a real SIEM deployment.
        </p>
        <dl className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-x-8 gap-y-5 border-y border-line py-5">
          <DemoDefinition label="Source" value={control.sourceType} />
          <DemoDefinition label="Category" value={control.signalCategory} />
          <DemoDefinition
            label="Evidence"
            value={`${control.evidenceIds.length} cited artifact`}
          />
        </dl>
      </div>
    );
  }

  if (active === "fix") {
    if (!fix) return <DemoUnavailable label="remediation" />;
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge tone="approval" dot={false}>
            {fix.status}
          </StateBadge>
          <span className="text-xs text-subtle">owner · {fix.owner}</span>
        </div>
        <h3 className="mt-4 max-w-3xl text-lg font-semibold text-ink">
          {fix.recommendedAction}
        </h3>
        <ol className="mt-6 list-none border-y border-line">
          {fix.technicalSteps.map((step, index) => (
            <li
              key={step}
              className="grid grid-cols-[2rem_1fr] gap-3 border-b border-line py-3.5 text-sm text-muted last:border-b-0"
            >
              <span className="font-mono text-subtle">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-5 text-subtle">
          This sample recommends a path breaker. Demo mode does not create a
          ticket or change the displayed status.
        </p>
      </div>
    );
  }

  if (active === "verify") {
    return (
      <div>
        <h3 className="text-lg font-semibold text-ink">
          Fresh evidence required
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Implementation and verification are separate states. In a live
          workspace these checks are scope-, policy-, and approval-gated.
        </p>
        <ol className="mt-6 list-none border-y border-line">
          {snapshot.verificationPlan.map((item, index) => (
            <li
              key={item}
              className="grid grid-cols-[2rem_1fr] gap-3 border-b border-line py-4 last:border-b-0"
            >
              <span className="grid size-8 place-items-center rounded-full bg-surface-strong font-mono text-xs text-muted">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-muted">{item}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 border-l-2 border-fixed pl-3">
          <p className="text-sm font-semibold text-ink">
            Fixed means re-tested
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Demo mode shows the plan but never pretends to execute it. A real
            risk earns Fixed only after a new verification event succeeds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge tone="fixed" dot={false}>
          {snapshot.evidencePack.status}
        </StateBadge>
        <span className="text-xs text-subtle">
          {snapshot.evidencePack.audience}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-ink">
        {snapshot.evidencePack.title}
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
        The sample pack includes {snapshot.evidencePack.evidenceIds.length}{" "}
        redacted evidence references, {snapshot.metrics.topPathCount} priority
        paths, and the verification plan. Its sample URI cannot be shared as
        customer proof.
      </p>
      <dl className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-x-8 gap-y-5 border-y border-line py-5">
        <DemoDefinition
          label="Redaction"
          value={snapshot.evidencePack.redactionLevel}
        />
        <DemoDefinition
          label="Pack type"
          value={snapshot.evidencePack.packType}
        />
        <DemoDefinition
          label="Evidence"
          value={String(snapshot.evidencePack.evidenceIds.length)}
        />
      </dl>
      <Link
        href="/demo#sample-report"
        className="mt-6 inline-flex text-sm font-semibold text-brand hover:text-brand-2"
      >
        Open the complete sample report →
      </Link>
    </div>
  );
}

function DemoFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">
        {value}
      </p>
    </div>
  );
}

function DemoDefinition({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

function DemoUnavailable({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted">
      This deterministic snapshot does not include a sample {label}.
    </p>
  );
}
