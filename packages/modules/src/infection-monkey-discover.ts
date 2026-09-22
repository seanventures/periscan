import {
  INFECTION_MONKEY_DISCOVER_MODULE_ID,
  INFECTION_MONKEY_LICENSE,
  INFECTION_MONKEY_TOOL_ID,
  classifyInfectionMonkeyIslandReport,
  planInfectionMonkeyDiscoverStart,
  type InfectionMonkeyDiscoverStartInput,
  type InfectionMonkeyDiscoverStartResult
} from "@periscan/shared";

export {
  INFECTION_MONKEY_DISCOVER_MODULE_ID,
  INFECTION_MONKEY_LICENSE,
  INFECTION_MONKEY_TOOL_ID,
  planInfectionMonkeyDiscoverStart
};
export type {
  InfectionMonkeyDiscoverStartInput,
  InfectionMonkeyDiscoverStartResult
};

export const INFECTION_MONKEY_LICENSE_REQUIRED =
  "infection_monkey_license_required";
export const INFECTION_MONKEY_LIVE_DISABLED =
  "infection_monkey_discover_live_permanently_disabled";
export const INFECTION_MONKEY_DISCOVER_NOT_STARTABLE =
  "infection_monkey_not_startable";
export const INFECTION_MONKEY_QUALIFICATION_REQUIRED =
  "infection_monkey_qualification_required";
export const INFECTION_MONKEY_AUTHORIZATION_REQUIRED =
  "infection_monkey_authorization_required";
export const INFECTION_MONKEY_POLICY_NOT_ALLOWED =
  "infection_monkey_policy_not_allowed";
export const INFECTION_MONKEY_COMMUNITY_DEFAULT_DENIED =
  "infection_monkey_community_default_denied";

const LIVE_OFFENSIVE_SCENARIO_IDS = new Set([
  "infection-monkey.live",
  "infection-monkey.mimikatz",
  "infection-monkey.propagate",
  "infection-monkey.ransomware"
]);

export type InfectionMonkeyQualifiedStartInput = {
  communityDefaultPack?: boolean;
  copyleftOptIn: boolean;
  dangerAckDigest?: string;
  dangerAcknowledged?: boolean;
  hopReceipts?: readonly unknown[];
  islandReport?: unknown;
  liveOffensive?: boolean;
  plugins?: readonly string[];
  policyOutcome?: string | null;
  qualified?: boolean;
  scenarioId?: string;
  startable: boolean;
  tenantAuthorized?: boolean;
  timeoutSeconds?: number;
  verifiedScopeHosts: readonly string[];
};

export type InfectionMonkeyQualifiedStartResult =
  InfectionMonkeyDiscoverStartResult;

function denied(input: {
  code: string;
  copyleftOptIn: boolean;
  hopReceipts?: readonly unknown[];
  islandReport?: unknown;
  rationale: string;
}): InfectionMonkeyDiscoverStartResult {
  const islandHonesty = input.islandReport
    ? classifyInfectionMonkeyIslandReport({
        hopReceipts: input.hopReceipts,
        report: input.islandReport
      })
    : null;
  return {
    candidates: [],
    communityDefaultPack: false,
    copyleftOptIn: input.copyleftOptIn,
    credentialTheft: false,
    denyCode: input.code,
    denyReason: input.rationale,
    discoverPlan: null,
    executable: false,
    exploitersEnabled: false,
    importedGraphIsHypothesis: islandHonesty?.importedGraphIsHypothesis ?? true,
    islandHonesty,
    jobsQueued: 0,
    license: INFECTION_MONKEY_LICENSE,
    liveSupported: false,
    propagation: false,
    queued: false,
    ransomwarePayload: false,
    recorded: false
  };
}

function isLiveOffensivePin(
  input: InfectionMonkeyQualifiedStartInput
): boolean {
  if (input.liveOffensive === true) {
    return true;
  }
  return Boolean(
    input.scenarioId && LIVE_OFFENSIVE_SCENARIO_IDS.has(input.scenarioId)
  );
}

export function queueInfectionMonkeyDiscoverStart(
  input: InfectionMonkeyQualifiedStartInput
): InfectionMonkeyDiscoverStartResult {
  if (input.communityDefaultPack === true) {
    return denied({
      code: INFECTION_MONKEY_COMMUNITY_DEFAULT_DENIED,
      copyleftOptIn: input.copyleftOptIn === true,
      hopReceipts: input.hopReceipts,
      islandReport: input.islandReport,
      rationale:
        "Infection Monkey is GPL-3.0 Engine Lab only. It is not in the Community default pack. Denied tasks are never queued."
    });
  }

  if (isLiveOffensivePin(input)) {
    return denied({
      code: INFECTION_MONKEY_LIVE_DISABLED,
      copyleftOptIn: input.copyleftOptIn === true,
      hopReceipts: input.hopReceipts,
      islandReport: input.islandReport,
      rationale:
        "infection-monkey.discover live crawl is unavailable. Record a discover plan of verified-scope hosts as promote-to-scope candidates only. Propagation and exploiters stay default-deny."
    });
  }

  const planned = planInfectionMonkeyDiscoverStart({
    copyleftOptIn: input.copyleftOptIn === true,
    dangerAckDigest: input.dangerAckDigest,
    dangerAcknowledged: input.dangerAcknowledged,
    hopReceipts: input.hopReceipts,
    islandReport: input.islandReport,
    liveOffensive: input.liveOffensive,
    plugins: input.plugins,
    qualified: input.qualified === true,
    startable: input.startable === true,
    tenantAuthorized: input.tenantAuthorized === true,
    timeoutSeconds: input.timeoutSeconds,
    verifiedScopeHosts: input.verifiedScopeHosts
  });

  if (planned.queued && input.policyOutcome !== "Allowed") {
    return denied({
      code: INFECTION_MONKEY_POLICY_NOT_ALLOWED,
      copyleftOptIn: input.copyleftOptIn === true,
      hopReceipts: input.hopReceipts,
      islandReport: input.islandReport,
      rationale:
        "Infection Monkey discover requires an Allowed policy decision. Denied tasks are never queued."
    });
  }

  return planned;
}
