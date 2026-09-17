"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  CONTINUOUS_EASM_CHANGE_DETECTION_NOTE,
  CONTINUOUS_EASM_HONESTY_NOTE,
  type MissionSchedule
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { MULTI_HOP_OPERATOR_JOURNEY } from "../lib/multi-hop-journey";
import { getProductHelpGuide } from "../lib/product-help";
import { useApiResource } from "../hooks/use-api-resource";
import {
  ErrorState,
  LoadingSkeleton,
  NotConfigured,
  Panel,
  PanelHeader,
  StateBadge,
  buttonClassName
} from "../ui";
import { SpecialistCoverageHonesty } from "./specialist-coverage-honesty";

/** P19-r2/r3: honest BAS refuse + Wiz co-exist sales walk (product-help id). */
const COMPETITIVE_SALES_WALK = getProductHelpGuide("competitive-walk");

/**
 * Continuous validation operations hub (Slice 8).
 * Plan (threat + signals) → Run (schedules) → Health (ops + runners).
 * Surfaces live schedule depth so operators can observe, recover, and govern.
 */
const HUB_SECTIONS = [
  {
    id: "plan",
    title: "Plan",
    description:
      "Intel and signal triggers that draft the next validation — approve only; never auto-queues denied work.",
    links: [
      {
        href: "/threat-center",
        label: "Threat Center",
        hint: "Advisories & readiness"
      },
      {
        href: "/threat-feed",
        label: "Threat Feed",
        hint: "Consolidated intel"
      },
      {
        href: "/signal-activity",
        label: "Signal Activity",
        hint: "Trigger evaluations"
      }
    ]
  },
  {
    id: "run",
    title: "Run",
    description:
      "ContinuousValidation fires allowlisted safe external/recon modules on verified scope plus snapshot drift. Control / FixVerification keep their own module paths.",
    links: [
      {
        href: "/shift",
        label: "Blue shift",
        hint: "Morning program brief"
      },
      {
        href: "/schedules",
        label: "Schedule",
        hint: "Recurring continuous EASM"
      },
      {
        href: "/external-validation",
        label: "External PoA",
        hint: "Safe Nuclei profiles"
      },
      {
        href: "/missions",
        label: "Validate",
        hint: "Run a snapshot now"
      },
      {
        href: MULTI_HOP_OPERATOR_JOURNEY.pathsHref,
        label: "Measure multi-hop paths",
        hint: "Flagship hop receipts · not SIEM"
      },
      {
        href: "/scopes",
        label: "Authorized scope",
        hint: "Targets schedules may hit"
      }
    ]
  },
  {
    id: "health",
    title: "Health",
    description:
      "Runner fleet, policy, and mission ops metrics for the continuous program.",
    links: [
      {
        href: "/runners",
        label: "Runners",
        hint: "Fleet & kill switch"
      },
      {
        href: "/integrations",
        label: "Connect",
        hint: "Control sources"
      },
      // UX-W6 punch #5: Validation Ops demoted — deep-link join, not rail peer.
      {
        href: "/validation-ops",
        label: "Live validation ops (Labs)",
        hint: "Queue metrics · Labs deep-link"
      }
    ]
  }
] as const;

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.round((Date.now() - then) / 60000);
  if (Math.abs(mins) < 1) return "now";
  if (mins > 0 && mins < 60) return `${mins}m ago`;
  if (mins < 0 && mins > -60) return `in ${Math.abs(mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs > 0 && hrs < 48) return `${hrs}h ago`;
  if (hrs < 0 && hrs > -48) return `in ${Math.abs(hrs)}h`;
  return new Date(iso).toLocaleString();
}

function scheduleTimingNote(schedule: MissionSchedule): string {
  const config = schedule.config as
    | { scheduleTiming?: { blackoutWindows?: unknown[] } }
    | null
    | undefined;
  const blackouts = config?.scheduleTiming?.blackoutWindows;
  const blackoutCount = Array.isArray(blackouts) ? blackouts.length : 0;
  return [
    schedule.frequency,
    schedule.scopeIds.length ? `${schedule.scopeIds.length} scopes` : "no scopes",
    blackoutCount ? `${blackoutCount} blackout` : null
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ContinuousValidationHub() {
  const schedules = useApiResource(
    async () => (await api.listSchedules()).items,
    []
  );

  const summary = useMemo(() => {
    const items = schedules.data ?? [];
    const active = items.filter((s) => s.status === "Active");
    const paused = items.filter((s) => s.status === "Paused");
    const withDiff = items.filter((s) => s.lastDiff != null);
    const next = [...active].sort(
      (a, b) =>
        new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()
    )[0];
    return {
      total: items.length,
      active: active.length,
      paused: paused.length,
      withDiff: withDiff.length,
      next
    };
  }, [schedules.data]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">
            Continuous
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Continuous Validation
          </h1>
          <p className="max-w-2xl text-sm text-muted">
            One blue-team job: intel and signals → decide validate → schedule
            and run → prove. Denied or stale work always requires a fresh policy
            decision — never silent replay.
          </p>
          <p
            className="mt-2 max-w-2xl text-xs leading-5 text-subtle"
            data-testid="continuous-easm-honesty"
          >
            {CONTINUOUS_EASM_HONESTY_NOTE} {CONTINUOUS_EASM_CHANGE_DETECTION_NOTE}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/shift"
            className={buttonClassName({ size: "sm", variant: "primary" })}
          >
            Open blue shift
          </Link>
          <Link
            href="/schedules"
            className={buttonClassName({ size: "sm", variant: "secondary" })}
          >
            Open schedules
          </Link>
        </div>
      </header>

      <Panel aria-label="Schedule operations summary">
        <PanelHeader title="Schedule operations depth" />
        <div className="px-4 pb-4">
          {schedules.loading ? (
            <LoadingSkeleton rows={3} />
          ) : schedules.error ? (
            <ErrorState message={schedules.error} onRetry={schedules.refetch} />
          ) : summary.total === 0 ? (
            <NotConfigured
              title="No continuous schedules yet"
              message="Create a recurring Continuous, Control, or FixVerification schedule on verified scope. Blackouts, pause/resume, and run-now are governed from Schedules."
              action={{ href: "/schedules", label: "Create a schedule" }}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Schedules" value={String(summary.total)} />
                <Metric label="Active" value={String(summary.active)} tone="fixed" />
                <Metric label="Paused" value={String(summary.paused)} tone="approval" />
                <Metric
                  label="With last diff"
                  value={String(summary.withDiff)}
                />
              </div>
              {summary.next ? (
                <div className="mt-4 rounded-control border border-line bg-elevated/40 px-3 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StateBadge tone="fixed" dot={false}>
                      Next run
                    </StateBadge>
                    <span className="font-semibold text-ink">
                      {summary.next.missionType}
                    </span>
                    <span className="font-mono text-xs text-subtle">
                      {relTime(summary.next.nextRunAt)} ·{" "}
                      {scheduleTimingNote(summary.next)}
                    </span>
                    <Link
                      href="/schedules"
                      className="ml-auto text-xs font-semibold text-brand hover:text-brand-2"
                    >
                      Manage →
                    </Link>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Owner {summary.next.createdBy.slice(0, 8)}… · last{" "}
                    {relTime(summary.next.lastRunAt)} · policy is re-evaluated
                    before every queue; denied runs are never silently replayed.
                  </p>
                </div>
              ) : null}
              <ul className="mt-4 divide-y divide-line rounded-control border border-line">
                {(schedules.data ?? []).slice(0, 5).map((schedule) => (
                  <li
                    key={schedule.scheduleId}
                    className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"
                  >
                    <span className="font-semibold text-ink">
                      {schedule.missionType}
                    </span>
                    <StateBadge
                      tone={
                        schedule.status === "Active" ? "fixed" : "inconclusive"
                      }
                      dot={false}
                    >
                      {schedule.status}
                    </StateBadge>
                    <span className="font-mono text-[11px] text-subtle">
                      next {relTime(schedule.nextRunAt)} · last{" "}
                      {relTime(schedule.lastRunAt)}
                    </span>
                    {schedule.lastDiff ? (
                      <StateBadge tone="brand" dot={false}>
                        has drift
                      </StateBadge>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-subtle">
                Recovery: pause to stop future fires, edit blackouts or scopes on
                Schedules, then resume — each resume and run-now takes a fresh
                policy decision. Inspect run history (prior diffs) per schedule
                row.
              </p>
            </>
          )}
        </div>
      </Panel>

      {HUB_SECTIONS.map((section) => (
        <Panel key={section.id}>
          <PanelHeader title={section.title} />
          <div className="px-4 pb-4">
            <p className="mb-3 text-sm text-muted">{section.description}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex flex-col rounded-control border border-line bg-elevated px-3 py-2.5 transition-colors hover:border-line-strong"
                  >
                    <span className="text-sm font-semibold text-ink">
                      {link.label}
                    </span>
                    <span className="text-[12px] text-subtle">{link.hint}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      ))}

      {/* Operator journey: measured multi-hop is the flagship continuous proof path */}
      <Panel data-testid="continuous-multihop-journey">
        <PanelHeader title={MULTI_HOP_OPERATOR_JOURNEY.label} />
        <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-muted">
            {MULTI_HOP_OPERATOR_JOURNEY.summary} Continuous schedules correlate
            paths; hop measurement and receipts live on Attack paths — not a SIEM
            dump.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={MULTI_HOP_OPERATOR_JOURNEY.pathsHref}
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              Open attack paths
            </Link>
            <Link
              href={MULTI_HOP_OPERATOR_JOURNEY.gettingStartedHref}
              className={buttonClassName({ size: "sm", variant: "secondary" })}
            >
              Operator journey help
            </Link>
          </div>
        </div>
      </Panel>

      {/*
        ICP-P1-7: Sales walk is SE/Labs material — demote from default analyst
        view so continuous health stays the primary continuous hub job.
      */}
      {COMPETITIVE_SALES_WALK ? (
        <details
          className="rounded-card border border-line bg-surface"
          data-testid="continuous-sales-walk"
        >
          <summary className="cursor-pointer list-none px-4 py-3 font-display text-sm font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                Labs
              </span>
              <span>Sales walk (honest)</span>
              <span className="text-xs font-normal text-subtle">
                · SE / competitive path — expand
              </span>
            </span>
          </summary>
          <div className="flex flex-col gap-3 border-t border-line px-4 pb-4 pt-3">
            <p className="max-w-2xl text-sm text-muted">
              {COMPETITIVE_SALES_WALK.summary} No fake demo data. No inject
              claims. No CNAPP replacement.
            </p>
            <ol className="grid gap-2 sm:grid-cols-2">
              {COMPETITIVE_SALES_WALK.steps.map((step, index) =>
                step.href ? (
                  <li key={step.title}>
                    <Link
                      href={step.href}
                      className="flex flex-col rounded-control border border-line bg-elevated px-3 py-2.5 transition-colors hover:border-line-strong"
                    >
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
                        Step {index + 1}
                      </span>
                      <span className="mt-0.5 text-sm font-semibold text-ink">
                        {step.actionLabel ?? step.title}
                      </span>
                      <span className="text-[12px] text-subtle">
                        {step.title}
                      </span>
                    </Link>
                  </li>
                ) : null
              )}
            </ol>
          </div>
        </details>
      ) : null}

      <SpecialistCoverageHonesty compact />
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "brand"
}: {
  label: string;
  value: string;
  tone?: "brand" | "fixed" | "approval";
}) {
  const toneClass =
    tone === "fixed"
      ? "text-fixed"
      : tone === "approval"
        ? "text-approval"
        : "text-brand";
  return (
    <div className="rounded-card border border-line bg-elevated/50 px-3 py-3">
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}
