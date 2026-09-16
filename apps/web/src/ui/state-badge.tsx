import type { HTMLAttributes } from "react";

import {
  deriveAttackPathClaim,
  formatRiskBandDisplayLabel,
  type AttackPath
} from "@periscan/shared";

import { buildAttackPathClaimAriaLabel } from "../lib/claim-safe-display";
import { cn } from "./cn";
import { riskBandTone } from "./severity-visual";

export { riskBandTone };

/**
 * Semantic tones for verdict/state badges. These map to the design-system
 * `--color-*` tokens and are deliberately separate from the brand accent, so a
 * verdict never reads as "brand chrome". See app/tailwind.css.
 */
export type StateTone =
  | "validated"
  | "blocked"
  | "missed"
  | "approval"
  | "fixed"
  | "inconclusive"
  | "brand"
  | "neutral";

const TONE_SOLID: Record<StateTone, string> = {
  validated: "text-validated",
  blocked: "text-blocked-text",
  missed: "text-missed",
  approval: "text-approval",
  fixed: "text-fixed",
  inconclusive: "text-inconclusive-text",
  brand: "text-brand",
  neutral: "text-muted"
};

const TONE_OUTLINE: Record<StateTone, string> = {
  validated: "text-validated border border-validated/60",
  blocked: "text-blocked-text border border-blocked/60",
  missed: "text-missed border border-missed/70",
  approval: "text-approval border border-dashed border-approval/70",
  fixed: "text-fixed border border-fixed/60",
  inconclusive:
    "text-inconclusive-text border border-dashed border-inconclusive/60",
  brand: "text-brand border border-brand/60",
  neutral: "text-muted border border-line"
};

export interface StateBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: StateTone;
  /** Solid tint (default) or an outline — outline reads as "inferred / lower confidence". */
  variant?: "solid" | "outline";
  /** Leading status dot. On by default; off for chips that already carry an icon. */
  dot?: boolean;
}

/**
 * The recurring verdict primitive: an uppercase, dot-led chip in one semantic
 * tone. Every validation state, policy gate, control response, safety level and
 * evidence basis renders through this so the product speaks one visual language.
 */
export function StateBadge({
  tone,
  variant = "solid",
  dot = true,
  className,
  children,
  ...rest
}: StateBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap px-0.5 py-0.5",
        "font-mono text-[10.5px] font-bold uppercase tracking-[0.08em]",
        variant === "outline" ? TONE_OUTLINE[tone] : TONE_SOLID[tone],
        className
      )}
      {...rest}
    >
      {dot ? (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-sm bg-current"
        />
      ) : null}
      {children}
    </span>
  );
}

// --- domain → tone maps -------------------------------------------------------

// ValidationState (24 values). Honest mapping: proven-good = validated/fixed,
// control-response = blocked, proven-bad = missed, waiting-on-a-human = approval,
// no-signal / not-set-up = inconclusive.
const VALIDATION_STATE_TONE: Record<string, StateTone> = {
  Discovered: "inconclusive",
  Reachable: "validated",
  Validated: "validated",
  Exploitable: "missed",
  Detected: "blocked",
  Blocked: "blocked",
  Logged: "blocked",
  Alerted: "blocked",
  Routed: "blocked",
  Missed: "missed",
  NoEvidence: "inconclusive",
  Mitigated: "fixed",
  Inconclusive: "inconclusive",
  NeedsApproval: "approval",
  NeedsInternalRunner: "approval",
  Fixed: "fixed",
  PartiallyFixed: "approval",
  StillExposed: "missed",
  Reopened: "missed",
  ClosedWithoutEvidence: "inconclusive",
  NotConfigured: "inconclusive",
  RequiresIntegration: "inconclusive",
  RequiresVerifiedScope: "approval",
  RequiresInternalRunner: "approval"
};

export function validationStateTone(state: string): StateTone {
  return VALIDATION_STATE_TONE[state] ?? "neutral";
}

export function ValidationStateBadge({
  state,
  ...rest
}: { state: string } & Omit<StateBadgeProps, "tone" | "children">) {
  return (
    <StateBadge tone={validationStateTone(state)} {...rest}>
      {state}
    </StateBadge>
  );
}

/**
 * Customer-visible attack-path certainty. A recorded workflow state is not
 * enough to claim reachability or validation: every hop must be measured.
 */
export function AttackPathClaimBadge({
  attackPath,
  ...rest
}: { attackPath: AttackPath } & Omit<
  StateBadgeProps,
  "tone" | "children" | "variant"
>) {
  const claim = deriveAttackPathClaim(attackPath);
  const tone: StateTone = claim.canClaimExploitable
    ? "missed"
    : claim.canClaimReachable
      ? "validated"
      : claim.fullyMeasured
        ? "neutral"
        : "approval";
  // UX-W11: SR labels always say claim-safe; include remapped note when
  // recorded row state exceeds hop measurement (no silent overclaim).
  const claimAriaLabel = buildAttackPathClaimAriaLabel(attackPath);

  return (
    <StateBadge
      tone={tone}
      variant={claim.fullyMeasured ? "solid" : "outline"}
      title={claimAriaLabel}
      aria-label={claimAriaLabel}
      {...rest}
    >
      {claim.displayLabel}
    </StateBadge>
  );
}

// ControlState — the observed control response.
const CONTROL_STATE_TONE: Record<string, StateTone> = {
  Detected: "blocked",
  Blocked: "blocked",
  Logged: "blocked",
  Alerted: "fixed",
  Routed: "blocked",
  Missed: "missed",
  NoEvidence: "inconclusive",
  NeedsTuning: "approval"
};

export function ControlStateBadge({
  state,
  ...rest
}: { state: string } & Omit<StateBadgeProps, "tone" | "children">) {
  return (
    <StateBadge tone={CONTROL_STATE_TONE[state] ?? "neutral"} {...rest}>
      {state}
    </StateBadge>
  );
}

// PolicyDecision gate.
const POLICY_GATE_TONE: Record<string, StateTone> = {
  Allowed: "fixed",
  Approved: "fixed",
  Queued: "validated",
  RequiresApproval: "approval",
  Denied: "missed",
  Expired: "inconclusive"
};

export function PolicyGateBadge({
  outcome,
  ...rest
}: { outcome: string } & Omit<StateBadgeProps, "tone" | "children">) {
  return (
    <StateBadge tone={POLICY_GATE_TONE[outcome] ?? "neutral"} {...rest}>
      {outcome}
    </StateBadge>
  );
}

// RiskBand — tones live in severity-visual so charts and badges stay 1:1 (P01-3).
// Wire "Fixed" displays as "Closed (risk)" so it is not confused with
// remediation status Fixed (P09-3 residual presentation).
export function RiskBandBadge({
  band,
  title,
  ...rest
}: { band: string } & Omit<StateBadgeProps, "tone" | "children">) {
  const label = formatRiskBandDisplayLabel(band);
  return (
    <StateBadge
      tone={riskBandTone(band)}
      title={
        title ??
        (band === "Fixed"
          ? "Closed (risk) — path risk band after verified closure; not remediation status Fixed"
          : undefined)
      }
      {...rest}
    >
      {label}
    </StateBadge>
  );
}

// EvidenceBasis first-class chips (Measured | Heuristic | Imported).
// Measured = proven end-to-end (solid validated); Heuristic = inferred (outline
// approval); Imported = BYO scan prioritization only (outline inconclusive).
// Never dress Imported/Heuristic as Measured.
export function EvidenceBasisBadge({
  basis,
  title,
  ...rest
}: { basis: string } & Omit<StateBadgeProps, "tone" | "children" | "variant">) {
  if (basis === "Measured") {
    return (
      <StateBadge tone="validated" variant="solid" title={title} {...rest}>
        Measured
      </StateBadge>
    );
  }
  if (basis === "Imported") {
    return (
      <StateBadge
        tone="inconclusive"
        variant="outline"
        title={
          title ??
          "Imported scan signal — prioritization input only; not Measured re-probe"
        }
        {...rest}
      >
        Imported
      </StateBadge>
    );
  }
  // Heuristic and any unknown basis stay outline approval (never solid success).
  return (
    <StateBadge
      tone="approval"
      variant="outline"
      title={
        title ??
        (basis === "Heuristic"
          ? "Heuristic — modeled reachability, not hop-measured proof"
          : undefined)
      }
      {...rest}
    >
      {basis}
    </StateBadge>
  );
}

// SafetyLevel — escalates PassiveReadOnly → Disallowed.
// Customer-facing labels: BASLite is never marketed as "BAS" peer parity —
// ICP-P2-7 / P08 renames residual to "limited safe stimulus".
const SAFETY_TONE: Record<string, StateTone> = {
  PassiveReadOnly: "validated",
  ActiveNonInvasive: "blocked",
  ControlledValidation: "approval",
  BASLite: "approval",
  AdvancedAdversarial: "missed",
  Disallowed: "missed"
};

/** Product-facing safety labels (wire enum values stay unchanged). */
export function formatSafetyLevelLabel(level: string): string {
  if (level === "BASLite") {
    return "limited safe stimulus";
  }
  return level;
}

export function SafetyLevelBadge({
  level,
  title,
  ...rest
}: { level: string } & Omit<StateBadgeProps, "tone" | "children">) {
  const label = formatSafetyLevelLabel(level);
  return (
    <StateBadge
      tone={SAFETY_TONE[level] ?? "neutral"}
      title={
        title ??
        (level === "BASLite"
          ? "limited safe stimulus (wire safetyLevel BASLite) — not full BAS inject parity"
          : undefined)
      }
      aria-label={
        level === "BASLite"
          ? "limited safe stimulus safety level"
          : `Safety level ${label}`
      }
      {...rest}
    >
      {label}
    </StateBadge>
  );
}
