"use client";

import Link from "next/link";
import {
  listScaffoldGatedPacks,
  SAFETY_SCAFFOLD_CORE_SCORECARD_IDS,
  type SafetyEquivalentPack
} from "@periscan/shared";

import { Panel, PanelHeader, StateBadge } from "../ui";

/**
 * Slice 9 + Phase C + Slice C/D — specialist / partner-gated scorecard rows and
 * their safety-equivalent canary substitutes.
 *
 * Single source of truth: `packages/shared/src/safety-equivalent-packs.ts`
 * (also served by `GET /api/v1/safety-equivalent-packs`). Scaffold/gated stays
 * gated until blind rescore; canary/plan/exposure classes may be Partial
 * *substitutes* only — never sold as full BAS peers.
 */
export type SpecialistScaffoldRow = {
  id: number;
  requirement: string;
  gate: SafetyEquivalentPack["gate"];
  safety: string;
  scorecardVerdict: SafetyEquivalentPack["scorecardVerdict"];
  claimClass: SafetyEquivalentPack["claimClass"];
  safeModules: string[];
  honestSubstitute: string;
  foreverRefuse: string[];
  canElevateSubstituteToPartial: boolean;
};

function packToScaffoldRow(pack: SafetyEquivalentPack): SpecialistScaffoldRow {
  const honestSubstitute = pack.canElevateSubstituteToPartial
    ? pack.elevateCriteria
    : [
        pack.scorecardId === 21
          ? "Forever refuse ransomware impact."
          : "Forever refuse peer capability.",
        pack.neverElevateReason ?? pack.elevateCriteria
      ].join(" ");

  return {
    id: pack.scorecardId,
    requirement: pack.requirement,
    gate: pack.gate,
    safety: pack.safetyNote,
    scorecardVerdict: pack.scorecardVerdict,
    claimClass: pack.claimClass,
    safeModules: [...pack.safeModules],
    honestSubstitute,
    foreverRefuse: [...pack.foreverRefuse],
    canElevateSubstituteToPartial: pack.canElevateSubstituteToPartial
  };
}

/** Scaffold/gated inventory rows for UI (2/16/21/22/26/28). Derived from shared. */
export const SPECIALIST_SCAFFOLD_ROWS: readonly SpecialistScaffoldRow[] =
  listScaffoldGatedPacks().map(packToScaffoldRow);

export const SAFETY_SCAFFOLD_CORE_IDS = [
  ...SAFETY_SCAFFOLD_CORE_SCORECARD_IDS
] as const;

export function SpecialistCoverageHonesty({
  compact = false
}: {
  compact?: boolean;
}) {
  return (
    <Panel
      aria-label="Specialist and partner-gated coverage"
      data-testid="specialist-coverage-honesty-panel"
    >
      <PanelHeader
        title="Specialist coverage — lab or partner-gated"
        actions={
          <StateBadge tone="approval" dot={false}>
            Scaffold only
          </StateBadge>
        }
      />
      <div className="space-y-3 px-4 pb-4">
        <p className="text-sm text-muted">
          Scorecard rows 2, 16, 21, 22, 26, and 28 stay{" "}
          <strong className="font-semibold text-ink">Scaffold/gated</strong>.
          They are not Available, not Validated, and not sold as full BAS peers.
          Partner-gated rows{" "}
          <strong className="font-semibold text-ink">#2 dark web</strong>,{" "}
          <strong className="font-semibold text-ink">#26 OT/ICS</strong>, and{" "}
          <strong className="font-semibold text-ink">#28 crowd HITL</strong> stay
          NotConfigured ExternallyGated without contracted feeds/labs. Safety-equivalent
          canaries (DNS exfil marker, endpoint marker, plan-only kill-chain, secrets
          exposure) may be{" "}
          <strong className="font-semibold text-ink">Partial substitutes</strong>{" "}
          only — see safety notes. Row 21 ransomware impact is forever refuse.
        </p>
        <p
          className="rounded-control border border-line bg-surface-2 px-3 py-2 text-xs text-muted"
          data-testid="partner-gated-honesty-strip"
        >
          Partner honesty: no live dark-web crawl, no OT protocol speak, no
          crowdsourced pentester marketplace. API inventory:{" "}
          <code className="font-mono text-[11px]">
            GET /api/v1/safety-equivalent-packs
          </code>{" "}
          (partnerGatedScorecardIds: 2, 26, 28),{" "}
          <code className="font-mono text-[11px]">
            GET /api/v1/packs/enterprise-readiness
          </code>
          , and{" "}
          <code className="font-mono text-[11px]">
            GET /api/v1/partner-capabilities/honesty
          </code>{" "}
          (+ A2A #38 / AgentDID #51 residual).
        </p>
        <p
          className="rounded-control border border-line bg-surface-2 px-3 py-2 text-xs text-muted"
          data-testid="safety-scaffold-core-honesty-strip"
        >
          Safety scaffold core (Slice D):{" "}
          <strong className="font-semibold text-ink">#16 plan_only</strong> APT
          planner (never live agentless APT),{" "}
          <strong className="font-semibold text-ink">#21 forever_refuse</strong>{" "}
          ransomware impact (T1486),{" "}
          <strong className="font-semibold text-ink">#22 exposure_only</strong>{" "}
          identity (no live spray/harvest). Inventory fields:{" "}
          <code className="font-mono text-[11px]">
            scaffoldCoreScorecardIds: [16, 21, 22]
          </code>
          .
        </p>
        <ul className="divide-y divide-line rounded-control border border-line">
          {SPECIALIST_SCAFFOLD_ROWS.map((row) => (
            <li
              key={row.id}
              data-testid={`specialist-scaffold-row-${row.id}`}
              data-gate={row.gate}
              data-claim-class={row.claimClass}
              data-can-elevate-substitute={
                row.canElevateSubstituteToPartial ? "true" : "false"
              }
              className="flex flex-col gap-1.5 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-subtle">
                    #{row.id}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {row.requirement}
                  </span>
                  <StateBadge tone="inconclusive" dot={false}>
                    {row.scorecardVerdict}
                  </StateBadge>
                  <StateBadge tone="approval" dot={false}>
                    {row.gate}
                  </StateBadge>
                  <StateBadge tone="neutral" dot={false}>
                    {row.claimClass}
                  </StateBadge>
                </div>
                {compact ? null : (
                  <>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {row.safety}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-subtle">
                      {row.honestSubstitute}
                      {row.safeModules.length > 0 ? (
                        <>
                          {" "}
                          Modules:{" "}
                          <span className="font-mono text-[11px]">
                            {row.safeModules.join(", ")}
                          </span>
                        </>
                      ) : null}
                    </p>
                    {row.foreverRefuse.length > 0 ? (
                      <p className="mt-1 text-xs leading-5 text-subtle">
                        Forever refuse: {row.foreverRefuse.join("; ")}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!compact ? (
          <p className="text-xs text-subtle">
            Governed engines that are shippable live under{" "}
            <Link href="/engines" className="text-brand hover:text-brand-2">
              Engine Lab
            </Link>
            . Safe external exposure stays on{" "}
            <Link
              href="/external-validation"
              className="text-brand hover:text-brand-2"
            >
              External Validation
            </Link>
            . DNS-exfil detection canary is{" "}
            <code className="font-mono text-[11px]">
              POST /api/v1/control-sources/:id/dns-exfil-canary-proof
            </code>{" "}
            (benign marker only;{" "}
            <code className="font-mono text-[11px]">
              realDataExfiltrated:false
            </code>
            ). Inventory:{" "}
            <code className="font-mono text-[11px]">
              GET /api/v1/safety-equivalent-packs
            </code>
            . Do not enable SharpHound, Caldera live, Atomic live inject, or
            other legally sensitive capabilities from this list.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
