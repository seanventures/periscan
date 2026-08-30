"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { resolveFirstRunPrimaryAction } from "../lib/first-run-primary-action";
import {
  type FirstProofResume,
  clearFirstProofResume,
  readFirstProofResume,
  writeFirstProofResume
} from "../lib/first-proof-resume";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { useApiResource } from "../hooks/use-api-resource";
import { buttonClassName } from "../ui/button";
import { cn } from "../ui/cn";
import { ProofLoopMap } from "./proof-loop-map";

interface Step {
  n: number;
  title: string;
  desc: string;
  href: string;
  cta: string;
  done: boolean;
  partial?: boolean;
}

function StepCard({ step, active }: { step: Step; active: boolean }) {
  const state = step.done ? "done" : active ? "active" : "todo";
  return (
    <Link
      href={step.href}
      data-testid="get-started-step-card"
      className={cn(
        "group relative flex flex-col gap-3 rounded-card border p-5 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:ring-brand",
        state === "done" &&
          "border-fixed/30 bg-fixed/[0.04] hover:border-fixed/50",
        state === "active" &&
          "border-brand/45 bg-brand/[0.06] hover:border-brand/70",
        state === "todo" && "border-line bg-surface/40 hover:border-line-strong"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full font-mono text-[13px] font-semibold transition-colors",
            step.done
              ? "bg-fixed text-bg"
              : active
                ? "bg-brand-fill text-white"
                : "bg-surface-strong text-muted"
          )}
        >
          {step.done ? (
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="m3.5 8.5 3 3 6-7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            step.n
          )}
        </span>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold text-ink">
            {step.title}
          </p>
          {step.partial ? (
            <p className="text-[11px] font-medium uppercase tracking-wide text-approval">
              In progress — finish verification
            </p>
          ) : null}
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">{step.desc}</p>
      <span
        className={cn(
          "mt-auto inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors",
          step.done ? "text-subtle" : "text-brand-2 group-hover:text-brand"
        )}
      >
        {step.done ? "Done" : step.cta}
        {step.done ? null : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5"
          >
            <path
              d="M3 8h9M8.5 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </Link>
  );
}

/**
 * VP Eng TTV estimates from code-backed activation spine (ICP P04).
 * Not a live timer — honest planning ranges for first MeasuredResult and full loop.
 */
export const FIRST_RUN_TTV_ESTIMATES = [
  {
    id: "connect",
    label: "Connect source",
    eta: "10–20 min",
    milestoneKey: "SourceConnected" as const
  },
  {
    id: "authorize",
    label: "Authorize scope",
    eta: "10–25 min",
    milestoneKey: "ScopeVerified" as const
  },
  {
    id: "validate",
    label: "First measured validation",
    eta: "25–45 min",
    milestoneKey: "MeasuredResult" as const
  },
  {
    id: "prove",
    label: "Full proof loop (9 milestones)",
    eta: "½–2 days",
    milestoneKey: null
  }
] as const;

/**
 * Activation milestones that gate first MeasuredResult (ICP P04 countdown).
 * Progress % is derived only from persisted activation state — never invented.
 */
export const FIRST_MEASURED_PROOF_MILESTONE_KEYS = [
  "AccountCreated",
  "SourceConnected",
  "ScopeVerified",
  "PolicyPreviewed",
  "MissionCreated",
  "MeasuredResult"
] as const;

export function firstMeasuredProofProgress(
  activation: import("@periscan/shared").ProductActivationState | null | undefined
): {
  completed: number;
  total: number;
  percent: number;
  remaining: number;
  measured: boolean;
} {
  const total = FIRST_MEASURED_PROOF_MILESTONE_KEYS.length;
  if (!activation) {
    return { completed: 0, total, percent: 0, remaining: total, measured: false };
  }
  const completed = FIRST_MEASURED_PROOF_MILESTONE_KEYS.filter((key) =>
    activation.milestones.some((m) => m.key === key && m.state === "Completed")
  ).length;
  const measured = activation.milestones.some(
    (m) => m.key === "MeasuredResult" && m.state === "Completed"
  );
  const remaining = Math.max(0, total - completed);
  const percent = Math.round((completed / Math.max(total, 1)) * 100);
  return { completed, total, percent, remaining, measured };
}

/**
 * First-run onboarding — shown on the dashboard while a tenant's program is
 * empty. It replaces the wall-of-zeros command center with a single, obvious
 * path to first value: connect a source, verify a scope, run the first
 * validation. Progress is REAL (derived from the tenant's integrations, scopes,
 * and snapshots), so a step checks itself off as the user completes it and the
 * onboarding retires itself once the first validation has run.
 */
export function GetStarted({ userName }: { userName?: string }) {
  const activation = useApiResource(() => api.getProductActivationState(), []);
  const milestoneDone = (key: string) =>
    activation.data?.milestones.some(
      (milestone) => milestone.key === key && milestone.state === "Completed"
    ) ?? false;
  const sourceConnected = milestoneDone("SourceConnected");
  const scopeVerified = milestoneDone("ScopeVerified");
  const scopeAdded =
    scopeVerified ||
    activation.data?.diagnostics.some(
      (diagnostic) => diagnostic.code === "scope_verification_pending"
    ) === true;
  const hasValidation = milestoneDone("MeasuredResult");
  const primary = resolveFirstRunPrimaryAction(activation.data, {
    href: "/scopes",
    label: "Continue the proof loop"
  });

  const steps: Step[] = [
    {
      n: 1,
      title: "Connect a signal source",
      desc: "Point Periscan at a tool you already run — cloud, code, identity, a scanner export. Read-only by default; you see exactly what it reads.",
      href: "/integrations",
      cta: "Connect a source",
      done: sourceConnected
    },
    {
      n: 2,
      title: "Authorize scope",
      desc: "Open Scope to add and verify a domain, repository path, AWS account, or CIDR. Nothing runs outside verified scope. Inventory & ownership live under Setup → Assets & ownership.",
      href: "/scopes",
      cta: scopeAdded ? "Finish authorization" : "Authorize scope",
      done: scopeVerified,
      partial: scopeAdded && !scopeVerified
    },
    {
      n: 3,
      title: "Run your first validation",
      desc: "Run Community validation on authorized scope: secrets, SCA, SAST, IaC, SBOM, TLS, ZAP, Nuclei, Prowler, kube CIS, YARA, and recon — then keep the evidence.",
      href:
        sourceConnected && scopeVerified && !hasValidation
          ? primary.href
          : "/missions",
      cta:
        sourceConnected && scopeVerified && !hasValidation
          ? primary.label
          : "Run Community validation",
      done: hasValidation
    }
  ];

  const completed = steps.filter((s) => s.done).length;
  const setupComplete = completed === steps.length;
  const activeIdx = steps.findIndex((s) => !s.done);
  const remaining = Math.max(0, steps.length - completed);
  const totalMilestones = activation.data?.totalMilestones ?? 9;
  const completedMilestones = activation.data?.completedMilestones ?? 0;
  const proveMilestonesRemaining = Math.max(
    0,
    totalMilestones - completedMilestones
  );
  // P04: first measured proof countdown from real activation milestones.
  const firstProof = firstMeasuredProofProgress(activation.data);
  // P02-5: single primary CTA brain shared with the rail (setup spine → nextAction).
  const primaryHref = primary.href;
  const primaryLabel =
    primary.setupIncomplete && completed === 0
      ? "Start — connect a source"
      : primary.label;
  const primaryReason = primary.reason;
  const maturity = activation.data?.maturity ?? null;
  const navIsGuided = maturity === "New" || maturity === "Activating";
  const actionableDiagnostics = (activation.data?.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.code !== "experience_profile_incomplete"
  );

  // UX-W16: resume pointer for mid-setup returns to Home.
  const [resume, setResume] = useState<FirstProofResume | null>(null);
  useEffect(() => {
    setResume(readFirstProofResume());
  }, []);
  useEffect(() => {
    if (!setupComplete) {
      return;
    }
    clearFirstProofResume();
    setResume(null);
  }, [setupComplete]);
  const rememberPrimaryCta = () => {
    if (!primary.setupIncomplete) {
      return;
    }
    writeFirstProofResume(primary.label, primaryHref);
    setResume(readFirstProofResume());
  };

  return (
    <div className="relative mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-14">
      <section className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div className="max-w-xl">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-2">
            {completed === 0
              ? "Welcome to Periscan"
              : setupComplete
                ? "Setup complete"
                : "Getting started"}
          </p>
          <h1 className="mt-3 text-balance font-display text-4xl font-bold leading-[1.08] text-ink md:text-5xl">
            {completed === 0
              ? "Let's prove your first path."
              : setupComplete
                ? "Continue toward Prove."
                : `${remaining} more step${remaining === 1 ? "" : "s"} to your first proof.`}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            {setupComplete
              ? "The three setup steps are done. Finish the remaining proof-loop milestones — remediate, re-validate, and deliver evidence-backed proof."
              : `${userName ? `${userName.split(" ")[0]}, three` : "Three"} steps take you from an empty console to a measured, evidence-backed snapshot of what an attacker can actually reach — and proof of what you've fixed.`}
          </p>
          {/* Mid-market / VP pilot confidence: success criteria one-liner. */}
          <p
            data-testid="get-started-success-criteria"
            className="mt-3 max-w-xl rounded-control border border-brand/25 bg-brand/[0.05] px-3 py-2 text-[13px] leading-relaxed text-ink"
          >
            <span className="font-semibold text-brand-2">Success</span>
            {" = "}
            <strong className="font-semibold">Measured</strong>
            {" + one re-validate"}
            <span className="text-muted">
              {" "}
              — pilot complete when a fix lands Fixed only via verification.
            </span>
          </p>
          {/* P04 trust: runner is optional for cloud/source-side Validation Snapshot. */}
          <p
            role="status"
            data-testid="get-started-runner-optional"
            className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-muted"
          >
            <span className="font-semibold text-ink">Runner optional</span>
            {" — "}
            cloud and source-side Validation Snapshots do not require an
            internal runner. Pair a runner later only for internal network
            reachability or host-local tasks.
          </p>
          {/* UX-W13: one calm progress line when activation advances — no celebration cheese. */}
          {completed > 0 ? (
            <p
              role="status"
              data-testid="get-started-progress-success"
              className="mt-3 text-[13px] leading-relaxed text-muted"
            >
              {setupComplete
                ? "Setup is in place. Continue milestones when you're ready."
                : `${completed} of ${steps.length} setup steps complete.`}
            </p>
          ) : null}

          {/* UX-W1 / #36–38: singular primary CTA only in the hero row.
              Demo / full guide stay secondary (muted text links below). */}
          <div className="mt-7 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={primaryHref}
                data-testid="get-started-primary-cta"
                onClick={rememberPrimaryCta}
                className={buttonClassName({ className: "gap-2" })}
              >
                {primaryLabel}
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M3 8h9M8.5 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              {/* UX-W16: resume only when mid-setup; keeps primary singular otherwise. */}
              {!setupComplete && resume ? (
                <Link
                  href={resume.href}
                  data-testid="get-started-resume-cta"
                  className="inline-flex items-center gap-1.5 rounded-control border border-brand/40 bg-brand/[0.08] px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand/[0.12] hover:text-brand-2"
                >
                  Resume: {resume.step}
                </Link>
              ) : null}
            </div>
            {primaryReason ? (
              <p
                className="max-w-xl text-[12px] leading-relaxed text-subtle"
                data-testid="get-started-primary-reason"
              >
                {primaryReason}
              </p>
            ) : null}
          </div>

          <div
            className="mt-6 flex flex-wrap items-center gap-3"
            data-testid="get-started-setup-meter"
          >
            <div
              className="h-1.5 w-40 overflow-hidden rounded-pill bg-surface-strong"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={setupComplete ? totalMilestones : steps.length}
              aria-valuenow={
                setupComplete ? completedMilestones : completed
              }
              aria-label={
                setupComplete
                  ? "Proof-loop milestone progress"
                  : "First-run setup progress"
              }
            >
              <div
                className="h-full rounded-pill bg-brand transition-[width] duration-700 ease-out"
                style={{
                  width: `${
                    setupComplete
                      ? (completedMilestones / Math.max(totalMilestones, 1)) *
                        100
                      : (completed / steps.length) * 100
                  }%`
                }}
              />
            </div>
            {/* One progress language at a time: setup first, then milestones. */}
            <span className="font-mono text-xs text-subtle">
              {setupComplete
                ? `${completedMilestones} of ${totalMilestones} proof-loop milestones`
                : `${completed} of ${steps.length} setup steps`}
            </span>
            <Link
              href={primaryHref}
              className="text-xs font-semibold text-brand hover:text-brand-2"
            >
              {setupComplete
                ? proveMilestonesRemaining > 0
                  ? `Continue ${proveMilestonesRemaining} remaining milestone${proveMilestonesRemaining === 1 ? "" : "s"} →`
                  : "Open next proof-loop step →"
                : "Open next proof-loop step →"}
            </Link>
            {!setupComplete ? (
              <Link
                href="/demo"
                className="text-xs font-medium text-subtle hover:text-muted"
                data-testid="get-started-demo-secondary"
              >
                Explore a live sample
              </Link>
            ) : null}
          </div>

        </div>
      </section>

      <details
        data-testid="get-started-full-loop-details"
        className="group mt-6 max-w-3xl rounded-card border border-line bg-elevated/50"
      >
        <summary
          data-testid="get-started-full-loop-summary"
          className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden"
        >
          How the full loop works
        </summary>
        <div className="space-y-4 border-t border-line px-4 py-4">
          <FirstMeasuredProofCountdown
            progress={firstProof}
            loading={activation.loading}
            sourceConnected={sourceConnected}
          />
          <FirstRunTtvStrip
            activation={activation.data}
            loading={activation.loading}
          />
          <div className="relative mx-auto hidden w-full max-w-[320px] md:block">
            <ProofLoopMap
              activation={activation.data}
              loading={activation.loading}
              variant="hero"
            />
          </div>
          <div className="md:hidden">
            <ProofLoopMap
              activation={activation.data}
              loading={activation.loading}
              variant="panel"
            />
          </div>
        </div>
      </details>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((step, idx) => (
          <StepCard key={step.n} step={step} active={idx === activeIdx} />
        ))}
      </div>

      {setupComplete ? (
        <section
          aria-labelledby="continue-prove"
          className="mt-5 rounded-card border border-brand/35 bg-brand/[0.06] p-4"
        >
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-2">
            Next on the proof loop
          </p>
          <h2
            id="continue-prove"
            className="mt-1 text-sm font-semibold text-ink"
          >
            {primary.label}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
            {primary.reason ??
              "Remediate findings, re-validate fixes, and deliver a governed evidence pack. The full checklist tracks every persisted milestone."}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={primary.href}
              className="inline-flex text-xs font-semibold text-brand hover:text-brand-2"
            >
              Take next action →
            </Link>
            <Link
              href="/scopes"
              className="inline-flex text-xs font-semibold text-muted hover:text-ink"
            >
              Review authorized scope →
            </Link>
          </div>
        </section>
      ) : null}

      {hasValidation ? (
        <section
          aria-labelledby="flagship-multihop"
          className="mt-5 rounded-card border border-line bg-elevated p-4"
          data-testid="flagship-multihop-journey"
        >
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
            Flagship differentiator
          </p>
          <h2
            id="flagship-multihop"
            className="mt-1 text-sm font-semibold text-ink"
          >
            Measure multi-hop paths hop by hop
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
            After a snapshot correlates paths, open Attack paths and Measure
            hop (safe) on each edge. Allowed policy auto-queues the probe;
            confirm progress only via edge receipts with evidence IDs — never
            invent Measured certainty from launch status.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/attack-paths"
              className="inline-flex text-xs font-semibold text-brand hover:text-brand-2"
            >
              Measure path hops →
            </Link>
            <Link
              href="/scopes"
              className="inline-flex text-xs font-semibold text-muted hover:text-ink"
            >
              Confirm authorized scope
            </Link>
          </div>
        </section>
      ) : null}

      {activation.error ? (
        <div
          role="alert"
          className="mt-5 rounded-control border border-missed/30 bg-missed/[0.05] px-4 py-3 text-sm text-muted"
        >
          Activation diagnostics are temporarily unavailable. Your saved source,
          scope, and mission state has not changed.{" "}
          <button
            type="button"
            onClick={activation.refetch}
            className="font-semibold text-brand"
          >
            Retry
          </button>
        </div>
      ) : actionableDiagnostics.length > 0 ? (
        <section
          aria-labelledby="setup-diagnostics"
          className="mt-5 rounded-card border border-line bg-elevated p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
                Prerequisite diagnostics
              </p>
              <h2
                id="setup-diagnostics"
                className="mt-1 text-sm font-semibold text-ink"
              >
                Exact blockers before measured evidence
              </h2>
            </div>
            <Link
              href="/trust-safety"
              className="text-xs font-semibold text-brand hover:text-brand-2"
            >
              How safe validation works
            </Link>
          </div>
          <ul className="mt-3 grid list-none gap-2 sm:grid-cols-2">
            {actionableDiagnostics.slice(0, 4).map((diagnostic) => (
              <li
                key={diagnostic.code}
                className="rounded-control border border-line px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-ink">
                    {diagnostic.title}
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-subtle">
                    {diagnostic.severity}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {diagnostic.detail}
                </p>
                {diagnostic.href ? (
                  <Link
                    href={diagnostic.href}
                    className="mt-2 inline-flex text-xs font-semibold text-brand"
                  >
                    Resolve prerequisite →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer
        className="mt-8 flex flex-col items-center gap-2 text-center text-[13px] text-subtle"
        data-testid="get-started-footer"
      >
        <p>
          {navIsGuided ? (
            <>
              While you activate, the left rail shows the Operate path (Home,
              Connect, Scope, Validate) — not every product surface. Labs stay
              hidden until Show Labs &amp; more. This Home setup retires once
              your first measured validation is available.
            </>
          ) : (
            <>
              Use Connect → Scope → Validate on the rail. This Home setup
              retires once your first measured validation is available.
            </>
          )}
        </p>
        <p>
          Automating the loop?{" "}
          <Link
            href="/api-reference"
            className="font-semibold text-brand underline underline-offset-2 hover:text-brand-2"
            data-testid="get-started-api-reference"
          >
            {sourceConnected ? "API for automation →" : "API reference →"}
          </Link>{" "}
          · OpenAPI + copy-as-curl + proof-loop examples (not Labs demo).
        </p>
      </footer>
    </div>
  );
}

/**
 * ICP P04 — first measured proof countdown from real activation milestones.
 * Shows remaining count + percent complete; never invents progress.
 * When a source is connected, surfaces "API for automation" for eng buyers.
 */
function FirstMeasuredProofCountdown({
  progress,
  loading,
  sourceConnected
}: {
  progress: ReturnType<typeof firstMeasuredProofProgress>;
  loading: boolean;
  sourceConnected: boolean;
}) {
  return (
    <section
      aria-label="First measured proof countdown"
      data-testid="first-measured-proof-countdown"
      className="mt-5 rounded-control border border-brand/30 bg-brand/[0.05] px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-2">
          First measured proof
        </p>
        <p
          className="font-mono text-[12px] font-semibold text-ink"
          data-testid="first-measured-proof-percent"
        >
          {loading ? "…" : `${progress.percent}%`}
        </p>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-strong"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label="Progress to first measured proof"
        data-testid="first-measured-proof-progressbar"
      >
        <div
          className="h-full rounded-pill bg-brand transition-[width] duration-700 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p
        className="mt-1.5 text-[12px] leading-relaxed text-muted"
        data-testid="first-measured-proof-status"
      >
        {progress.measured
          ? "MeasuredResult is complete — continue Act → Verify → Prove on the full loop."
          : loading
            ? "Loading activation milestones…"
            : `${progress.completed} of ${progress.total} activation milestones toward first MeasuredResult · ${progress.remaining} remaining`}
      </p>
      {sourceConnected ? (
        <p className="mt-2 text-[12px] text-muted">
          Source connected — automate the loop with the{" "}
          <Link
            href="/api-reference"
            className="font-semibold text-brand underline underline-offset-2 hover:text-brand-2"
            data-testid="get-started-api-for-automation"
          >
            API for automation
          </Link>{" "}
          (OpenAPI + copy-as-curl samples).
        </p>
      ) : null}
    </section>
  );
}

function FirstRunTtvStrip({
  activation,
  loading
}: {
  activation: import("@periscan/shared").ProductActivationState | null;
  loading: boolean;
}) {
  return (
    <section
      aria-label="Time to first value estimates"
      data-testid="first-run-ttv-strip"
      className="mt-5 rounded-control border border-line bg-elevated/60 px-3 py-2.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle">
          Time-to-value · from activation milestones
        </p>
        <p className="text-[11px] text-subtle">
          Planning ranges with credentials ready — not a live clock
          {loading ? " · loading…" : ""}
        </p>
      </div>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {FIRST_RUN_TTV_ESTIMATES.map((row) => {
          const done =
            row.milestoneKey != null &&
            (activation?.milestones.some(
              (m) => m.key === row.milestoneKey && m.state === "Completed"
            ) ??
              false);
          return (
            <li
              key={row.id}
              data-testid={`ttv-milestone-${row.id}`}
              className="rounded-control border border-line bg-bg/50 px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-ink">
                  {row.label}
                </span>
                <span className="font-mono text-[11px] text-brand-2">
                  {row.eta}
                </span>
              </div>
              <p className="mt-0.5 text-[10.5px] text-subtle">
                {done
                  ? "Complete"
                  : row.milestoneKey
                    ? "Open on setup spine"
                    : `${activation?.completedMilestones ?? 0}/${activation?.totalMilestones ?? 9} milestones`}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-subtle">
        Default demo path: Connect → Authorize → Validate. Labs never open by
        default.
      </p>
    </section>
  );
}
