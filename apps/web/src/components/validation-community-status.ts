import {
  communityFirstHourStartModuleIds,
  communityScopeVerificationKind,
  defaultAssetClassForCommunityScope,
  inferCommunityScopeType
} from "@periscan/shared";

export type CommunityStartPack = "first-hour" | "full";

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
 * and hosted git org/repo URLs (github.com, gitlab.com, bitbucket.org,
 * *.github.com, codecommit) switch type via inferCommunityScopeType.
 * Hostname inference does not overwrite Subdomain.
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

/**
 * Operator pin from Validate search (`?moduleIds=gitleaks.repo_secrets`).
 * Empty pin uses the first-hour set when Gitleaks is startable.
 */
export function parsePinnedCommunityModuleIds(
  search: string | URLSearchParams | null | undefined
): string[] {
  if (!search) {
    return [];
  }
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const raw of params.getAll("moduleIds")) {
    for (const token of raw.split(/[,\s]+/u)) {
      const id = token.trim();
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function resolveCommunityStartNowModuleIds(input: {
  pack?: CommunityStartPack | null;
  pinnedModuleIds?: readonly string[] | null;
  startableModuleIds: readonly string[];
}): string[] {
  const startable = [...input.startableModuleIds];
  const pinned = (input.pinnedModuleIds ?? []).filter(Boolean);
  if (pinned.length > 0) {
    const allowed = new Set(startable);
    return pinned.filter((id) => allowed.has(id));
  }
  if (input.pack === "full") {
    return startable;
  }
  const firstHour = communityFirstHourStartModuleIds(startable);
  return firstHour.length > 0 ? firstHour : startable;
}

export function communityStartRequestModuleIds(input: {
  pack?: CommunityStartPack | null;
  pinnedModuleIds?: readonly string[] | null;
  startableModuleIds: readonly string[];
}): string[] | undefined {
  const pinned = (input.pinnedModuleIds ?? []).filter(Boolean);
  if (pinned.length > 0) {
    return resolveCommunityStartNowModuleIds(input);
  }
  if (input.pack === "full") {
    return [...input.startableModuleIds];
  }
  const firstHour = communityFirstHourStartModuleIds(input.startableModuleIds);
  return firstHour.length > 0 ? firstHour : undefined;
}

function deferredMentionsRunner(
  deferred: readonly { moduleId: string; reason: string }[]
): boolean {
  return deferred.some((row) => row.reason.toLowerCase().includes("runner"));
}

function deferredMentionsProwler(
  deferred: readonly { moduleId: string; reason: string }[]
): boolean {
  return deferred.some(
    (row) =>
      row.moduleId.startsWith("prowler.") ||
      row.reason.toLowerCase().includes("prowler") ||
      row.reason.toLowerCase().includes("aws")
  );
}

export function communityStartNowCopy(input: {
  cloudAwsAvailable: boolean;
  deferredModules?: readonly { moduleId: string; reason: string }[];
  pack?: CommunityStartPack | null;
  pinnedModuleIds?: readonly string[] | null;
  runnerAvailable: boolean;
  startableModuleIds: readonly string[];
}): string {
  const ids = resolveCommunityStartNowModuleIds(input);
  const pinned = (input.pinnedModuleIds ?? []).filter(Boolean);
  const deferred = input.deferredModules ?? [];
  const bits = [`${ids.length} engine${ids.length === 1 ? "" : "s"} start now`];
  const firstHour = communityFirstHourStartModuleIds(input.startableModuleIds);
  const usingFirstHourSubset =
    pinned.length === 0 && input.pack !== "full" && firstHour.length > 0;
  if (!usingFirstHourSubset && pinned.length === 0) {
    if (!input.runnerAvailable && deferredMentionsRunner(deferred)) {
      bits.push("runner needed");
    }
    if (!input.cloudAwsAvailable && deferredMentionsProwler(deferred)) {
      bits.push("AWS needed for Prowler");
    }
  } else if (
    pinned.some((id) => id.startsWith("prowler.")) &&
    !input.cloudAwsAvailable &&
    deferredMentionsProwler(deferred) &&
    ids.length === 0
  ) {
    bits.push("AWS needed for Prowler");
  }
  return `${bits.join(" · ")}.`;
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
