import {
  queueCalderaQualifiedStart,
  type CalderaQualifiedStartInput,
  type CalderaQualifiedStartResult
} from "@periscan/modules";
import { getPinnedCalderaAbility } from "@periscan/shared";

export const CALDERA_ENDPOINT_NOT_CONFIGURED =
  "caldera_endpoint_not_configured";
export const CALDERA_COMMUNITY_DEFAULT_DENIED =
  "caldera_community_default_denied";
export const CALDERA_ENDPOINT_REQUIRED =
  "Customer-managed isolated Caldera URL and API key are required. Denied tasks are never queued.";
export const CALDERA_COMMUNITY_DEFAULT_REASON =
  "Caldera discovery is not Community default start. Denied tasks are never queued.";

export type BasCalderaStartGate = {
  startable: boolean;
};

export type CalderaQualifiedCampaignStartSelection =
  | "queue"
  | "deny"
  | "fallthrough";

export type CalderaCampaignPin = {
  provider: string;
  upstreamId: string;
};

export type StartBasCalderaDiscoveryInput = Omit<
  CalderaQualifiedStartInput,
  "startable"
> & {
  communityDefaultPack?: boolean;
  startGate: BasCalderaStartGate;
};

function deniedStart(input: {
  code: string;
  rationale: string;
}): CalderaQualifiedStartResult {
  return {
    abilityIds: [],
    denyCode: input.code,
    denyReason: input.rationale,
    jobsQueued: 0,
    liveSupported: false,
    operationId: null,
    queued: false
  };
}

export function resolveCalderaEndpoint(input?: {
  apiKey?: string;
  baseUrl?: string;
}): { apiKey: string; baseUrl: string } | null {
  const baseUrl = (input?.baseUrl ?? process.env.PERISCAN_CALDERA_BASE_URL ?? "")
    .trim();
  const apiKey = (input?.apiKey ?? process.env.PERISCAN_CALDERA_API_KEY ?? "")
    .trim();
  if (!baseUrl || !apiKey) {
    return null;
  }
  return { apiKey, baseUrl };
}

export function isCalderaQualifiedDiscoveryPin(pin: CalderaCampaignPin): boolean {
  return (
    pin.provider === "Caldera" && Boolean(getPinnedCalderaAbility(pin.upstreamId))
  );
}

export function selectCalderaQualifiedCampaignStart(input: {
  endpointConfigured: boolean;
  pins: ReadonlyArray<CalderaCampaignPin>;
  startable: boolean;
}): CalderaQualifiedCampaignStartSelection {
  if (!input.startable) {
    return "fallthrough";
  }
  const calderaPins = input.pins.filter((pin) => pin.provider === "Caldera");
  if (calderaPins.length === 0) {
    return "fallthrough";
  }
  if (!calderaPins.every(isCalderaQualifiedDiscoveryPin)) {
    return "deny";
  }
  if (!input.endpointConfigured) {
    return "deny";
  }
  return "queue";
}

export async function startBasCalderaDiscovery(
  input: StartBasCalderaDiscoveryInput
): Promise<CalderaQualifiedStartResult> {
  if (input.communityDefaultPack === true) {
    return deniedStart({
      code: CALDERA_COMMUNITY_DEFAULT_DENIED,
      rationale: CALDERA_COMMUNITY_DEFAULT_REASON
    });
  }

  const endpoint = resolveCalderaEndpoint({
    apiKey: input.apiKey,
    baseUrl: input.baseUrl
  });
  if (!endpoint) {
    return deniedStart({
      code: CALDERA_ENDPOINT_NOT_CONFIGURED,
      rationale: CALDERA_ENDPOINT_REQUIRED
    });
  }

  return queueCalderaQualifiedStart({
    abilityIds: input.abilityIds,
    apiKey: endpoint.apiKey,
    baseUrl: endpoint.baseUrl,
    fetchImpl: input.fetchImpl,
    liveOffensive: input.liveOffensive,
    name: input.name,
    policyOutcome: input.policyOutcome,
    qualified: input.qualified,
    scenarioId: input.scenarioId,
    startable: input.startGate.startable === true,
    tenantAuthorized: input.tenantAuthorized
  });
}
