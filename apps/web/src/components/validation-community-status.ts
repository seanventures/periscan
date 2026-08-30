import {
  communityScopeVerificationKind,
  defaultAssetClassForCommunityScope,
  inferCommunityScopeType
} from "@periscan/shared";

export const VALIDATION_PROOF_STAGES = [
  "Scope",
  "Verify",
  "Readiness",
  "Run",
  "Results"
] as const;

export const COMMUNITY_VALIDATE_SCOPE_TYPES = [
  "Domain",
  "Subdomain",
  "Repository",
  "CloudAccount",
  "IPRange"
] as const;

export type CommunityValidateScopeType =
  (typeof COMMUNITY_VALIDATE_SCOPE_TYPES)[number];

export const VALIDATE_EMPTY_SCOPE_COPY =
  "Add a domain, repository path, AWS account, or CIDR you are authorized to validate. Community engines only run after you prove control of that scope.";

/**
 * Strong paste inference for Validate add-scope. Path / CIDR / 12-digit AWS
 * switch type. Hostname inference does not overwrite Subdomain.
 */
export function resolveCommunityAddScopeType(
  value: string,
  selectedType: CommunityValidateScopeType
): CommunityValidateScopeType {
  const inferred = inferCommunityScopeType(value);
  if (
    inferred === "IPRange" ||
    inferred === "Repository" ||
    inferred === "CloudAccount"
  ) {
    return inferred;
  }
  return selectedType;
}

export function communityAddScopePlaceholder(
  scopeType: CommunityValidateScopeType
): string {
  if (scopeType === "IPRange") {
    return "10.0.0.0/24";
  }
  if (scopeType === "Repository") {
    return "/opt/customer/repo";
  }
  if (scopeType === "CloudAccount") {
    return "123456789012";
  }
  if (scopeType === "Subdomain") {
    return "app.example.com";
  }
  return "example.com";
}

export function buildCommunityAddScopeInput(
  value: string,
  selectedType: CommunityValidateScopeType
): {
  assetClass: ReturnType<typeof defaultAssetClassForCommunityScope>;
  scopeType: CommunityValidateScopeType;
  value: string;
} {
  const scopeType = resolveCommunityAddScopeType(value, selectedType);
  return {
    assetClass: defaultAssetClassForCommunityScope(scopeType),
    scopeType,
    value: value.trim()
  };
}

export function communityScopeAllowsOperatorAttestation(
  scopeType: string
): boolean {
  return communityScopeVerificationKind(scopeType) !== "dns_txt";
}

export function communityVerifyScopeRequest(operatorAttestation: boolean): {
  operatorAttestation?: boolean;
} {
  return operatorAttestation ? { operatorAttestation: true } : {};
}

export function communityVerifyTokenHint(scopeType: string): string {
  const kind = communityScopeVerificationKind(scopeType);
  if (kind === "repository_token_file") {
    return ".periscan-authorization";
  }
  if (kind === "dns_txt") {
    return "DNS TXT _periscan.";
  }
  return "";
}

export function communityVerifyFailureCopy(scopeType: string): string {
  return communityScopeVerificationKind(scopeType) === "dns_txt"
    ? "Verification didn't pass yet — add the DNS record and retry."
    : "Verification didn't pass yet — complete the challenge and retry.";
}

export type ValidationProofStage = (typeof VALIDATION_PROOF_STAGES)[number];

export function computeValidationStageStatus(input: {
  hasScope: boolean;
  verified: boolean;
  communityStarted: boolean;
  snapshotReady: boolean;
}): {
  done: Record<ValidationProofStage, boolean>;
  active: ValidationProofStage | undefined;
} {
  const done: Record<ValidationProofStage, boolean> = {
    Scope: input.hasScope,
    Verify: input.verified,
    Readiness: input.verified,
    Run: input.communityStarted || input.snapshotReady,
    Results: input.snapshotReady
  };
  return {
    done,
    active: VALIDATION_PROOF_STAGES.find((stage) => !done[stage])
  };
}

export function deferredModuleAction(
  reason: string
): { href: "/runners" | "/integrations"; label: string } | null {
  const text = reason.toLowerCase();
  if (text.includes("runner")) {
    return { href: "/runners", label: "Enroll a runner" };
  }
  if (text.includes("aws") || text.includes("prowler")) {
    return { href: "/integrations", label: "Connect AWS" };
  }
  return null;
}

export function nothingStartableCopy(input: {
  cloudAwsAvailable: boolean;
  runnerAvailable: boolean;
}): string {
  const needs: string[] = [];
  if (!input.runnerAvailable) needs.push("enroll a runner");
  if (!input.cloudAwsAvailable) needs.push("connect AWS");
  if (needs.length === 0) {
    return "No engines can start yet.";
  }
  return `No engines can start yet — ${needs.join(" or ")}.`;
}

export function nucleiStartCopy(input: {
  nucleiMissionId: string | null;
  nucleiSkipReason: string | null;
}): {
  kind: "started" | "skipped" | "not-started";
  text: string | null;
} {
  if (input.nucleiMissionId) {
    return {
      kind: "started",
      text: `Nuclei started as a second mission (${input.nucleiMissionId}).`
    };
  }
  if (input.nucleiSkipReason) {
    return { kind: "skipped", text: input.nucleiSkipReason };
  }
  return { kind: "not-started", text: null };
}
