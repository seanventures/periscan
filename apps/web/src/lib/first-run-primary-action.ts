import {
  COMMUNITY_FIRST_RUN_CONNECT_AWS_LABEL,
  COMMUNITY_FIRST_RUN_CONNECT_AWS_REASON,
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
 * Setup spine is authorize → Community validation. A vendor connector is
 * optional extra signal. After MeasuredResult, Connect/Validate twins are
 * refused. After a finding, Home/Monday is Review findings — or Verify if
 * open remediations exist.
 */
export type FirstRunPrimaryAction = {
  href: string;
  label: string;
  reason?: string;
  /** True while the dashboard setup spine is still incomplete. */
  setupIncomplete: boolean;
};

/** Validate suite facts so Home does not advertise a dead Run (PERISCAN-556). */
export type CommunityStartability = {
  cloudAwsAvailable?: boolean;
  startableModuleIds?: readonly string[] | null;
};

/**
 * When nextAction is Run but no Community engine can queue, do not advertise
 * Run. Connect AWS is optional extra signal — not the Community door after
 * MeasuredResult (PERISCAN-547).
 */
export function resolveCommunityStartPrimaryAction(
  input: CommunityStartability & {
    nextAction?: { href: string; label: string; reason?: string } | null;
  }
): { href: string; label: string; reason: string } | null {
  const startable = input.startableModuleIds;
  const knownEmpty = startable != null && startable.length === 0;
  const next = input.nextAction;
  const nextIsConnectAws =
    next?.label === COMMUNITY_FIRST_RUN_CONNECT_AWS_LABEL;

  if (!knownEmpty && !nextIsConnectAws) {
    return null;
  }

  if (input.cloudAwsAvailable === false || nextIsConnectAws) {
    return {
      href: "/integrations",
      label: COMMUNITY_FIRST_RUN_CONNECT_AWS_LABEL,
      reason:
        nextIsConnectAws && next?.reason
          ? next.reason
          : COMMUNITY_FIRST_RUN_CONNECT_AWS_REASON
    };
  }

  if (knownEmpty) {
    return {
      href: "/missions",
      label: "No Community engines start yet",
      reason: "No Community engines can start on this verified scope yet."
    };
  }

  return null;
}

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

function isConnectSourceAction(
  action: { href: string; label: string } | null | undefined
): boolean {
  if (!action) {
    return false;
  }
  return (
    action.href === "/integrations" || /connect a source/i.test(action.label)
  );
}

function isPostMeasureValidateTwin(
  action: { href: string; label: string } | null | undefined
): boolean {
  if (!action) {
    return false;
  }
  return (
    action.label === COMMUNITY_FIRST_RUN_START_LABEL ||
    /^validate$/i.test(action.label) ||
    /new validation/i.test(action.label)
  );
}

/**
 * After the first Community finding, Home/Monday has one verb: Review findings,
 * or Verify when open remediations exist. Never Connect or Validate.
 */
export function resolvePostFindingPrimaryAction(input: {
  findingsCount: number;
  openRemediationCount: number;
}): FirstRunPrimaryAction | null {
  if (input.findingsCount <= 0) {
    return null;
  }
  if (input.openRemediationCount > 0) {
    return {
      href: "/remediation",
      label: "Verify",
      reason:
        "Open remediations wait on measured re-validation. Fixed only via verification.",
      setupIncomplete: false
    };
  }
  return {
    href: "/findings",
    label: "Review findings",
    reason:
      "A measured Community result is persisted. Review findings. Fixed only via verification.",
    setupIncomplete: false
  };
}

export function resolveFirstRunPrimaryAction(
  activation: ProductActivationState | null | undefined,
  personaFallback?: {
    href: string;
    label: string;
  },
  startability?: CommunityStartability
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

    const emptyStart = resolveCommunityStartPrimaryAction({
      cloudAwsAvailable: startability?.cloudAwsAvailable,
      nextAction: next,
      startableModuleIds: startability?.startableModuleIds
    });
    if (emptyStart) {
      return {
        ...emptyStart,
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

  const next = activation?.nextAction;
  if (
    activation &&
    activation.completedMilestones < activation.totalMilestones &&
    next &&
    !isConnectSourceAction(next) &&
    !isPostMeasureValidateTwin(next)
  ) {
    return {
      href: next.href,
      label: next.label,
      reason: next.reason,
      setupIncomplete: false
    };
  }

  if (
    hasValidation &&
    activation &&
    activation.completedMilestones < activation.totalMilestones
  ) {
    return {
      href: "/findings",
      label: "Review findings",
      reason:
        "A measured Community result is persisted. Review findings and remediations. Fixed only via verification.",
      setupIncomplete: false
    };
  }

  return {
    href: personaFallback?.href ?? "/missions",
    label: personaFallback?.label ?? "New validation",
    setupIncomplete: false
  };
}
