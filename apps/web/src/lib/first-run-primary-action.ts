import {
  COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL,
  COMMUNITY_FIRST_RUN_REVIEW_LABEL,
  COMMUNITY_FIRST_RUN_START_LABEL,
  COMMUNITY_FIRST_RUN_WATCH_LABEL,
  type ProductActivationState
} from "@periscan/shared";

/**
 * Single source for the first-run / activation primary CTA used by both
 * GetStarted (dashboard empty) and the rail primary button (P01-16).
 *
 * Setup spine (3 steps) until source + scope + measured result exist;
 * then the API nextAction continues Act → Verify → Prove.
 */
export type FirstRunPrimaryAction = {
  href: string;
  label: string;
  reason?: string;
  /** True while the three dashboard setup cards are still incomplete. */
  setupIncomplete: boolean;
};

function milestoneDone(
  activation: ProductActivationState | null | undefined,
  key: ProductActivationState["milestones"][number]["key"]
): boolean {
  return (
    activation?.milestones.some(
      (milestone) => milestone.key === key && milestone.state === "Completed"
    ) ?? false
  );
}

export function resolveFirstRunPrimaryAction(
  activation: ProductActivationState | null | undefined,
  personaFallback?: {
    href: string;
    label: string;
  }
): FirstRunPrimaryAction {
  const scopeVerified = milestoneDone(activation, "ScopeVerified");
  const hasValidation = milestoneDone(activation, "MeasuredResult");

  // Community edition starts on verified scope. A vendor connector is optional
  // extra signal, not the door (SETTLED Community slice).
  if (!scopeVerified) {
    const scopePending =
      activation?.diagnostics.some(
        (diagnostic) => diagnostic.code === "scope_verification_pending"
      ) === true;
    return {
      // P02-4 / P07-2: Authorize home is /scopes (verification), not inventory.
      href: "/scopes",
      label: scopePending ? "Finish authorization" : "Authorize scope",
      reason: "Nothing runs outside verified authorized scope.",
      setupIncomplete: true
    };
  }
  if (!hasValidation) {
    const next = activation?.nextAction;
    const failed = activation?.diagnostics.find(
      (diagnostic) => diagnostic.code === "latest_run_failed"
    );
    const missionCreated = milestoneDone(activation, "MissionCreated");

    if (next?.label === COMMUNITY_FIRST_RUN_WATCH_LABEL) {
      return {
        href: next.href,
        label: COMMUNITY_FIRST_RUN_WATCH_LABEL,
        reason: next.reason,
        setupIncomplete: true
      };
    }

    if (
      next?.label === COMMUNITY_FIRST_RUN_REVIEW_LABEL ||
      next?.label === COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL ||
      (Boolean(failed?.href) &&
        missionCreated &&
        next?.label !== COMMUNITY_FIRST_RUN_START_LABEL)
    ) {
      const reviewLabel =
        next?.label === COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL
          ? COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL
          : COMMUNITY_FIRST_RUN_REVIEW_LABEL;
      return {
        href:
          next?.label === COMMUNITY_FIRST_RUN_REVIEW_LABEL ||
          next?.label === COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL
            ? next.href
            : (failed?.href ?? next?.href ?? "/missions"),
        label: reviewLabel,
        reason:
          next?.label === COMMUNITY_FIRST_RUN_REVIEW_LABEL ||
          next?.label === COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL
            ? next.reason
            : (failed?.detail ?? next?.reason),
        setupIncomplete: true
      };
    }

    return {
      href: "/missions",
      label: COMMUNITY_FIRST_RUN_START_LABEL,
      reason:
        "Community edition starts live OSS/first-party engines on verified scope.",
      setupIncomplete: true
    };
  }

  if (
    activation &&
    activation.completedMilestones < activation.totalMilestones &&
    activation.nextAction
  ) {
    return {
      href: activation.nextAction.href,
      label: activation.nextAction.label,
      reason: activation.nextAction.reason,
      setupIncomplete: false
    };
  }

  return {
    href: personaFallback?.href ?? "/missions",
    label: personaFallback?.label ?? "New validation",
    setupIncomplete: false
  };
}
