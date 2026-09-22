import {
  assertCalderaAbilitiesAllowlisted,
  CalderaAdapterError
} from "@periscan/shared";

import {
  createCalderaOperationsClient,
  type CalderaFetch
} from "./caldera-operations-adapter.js";

export const CALDERA_DISCOVERY_NOT_STARTABLE =
  "caldera_discovery_not_startable";
export const CALDERA_TENANT_AUTHORIZATION_REQUIRED =
  "caldera_tenant_authorization_required";
export const CALDERA_POLICY_NOT_ALLOWED = "caldera_policy_not_allowed";
export const CALDERA_LIVE_DISABLED = "caldera_live_disabled";
export const CALDERA_QUALIFICATION_REQUIRED = "qualification_required";

const LIVE_OFFENSIVE_SCENARIO_IDS = new Set([
  "caldera.advanced_adversarial",
  "caldera.live"
]);

export type CalderaQualifiedStartInput = {
  abilityIds: string[];
  apiKey: string;
  baseUrl: string;
  fetchImpl?: CalderaFetch;
  liveOffensive?: boolean;
  name?: string;
  policyOutcome?: string | null;
  qualified?: boolean;
  scenarioId?: string;
  startable: boolean;
  tenantAuthorized?: boolean;
};

export type CalderaQualifiedStartResult = {
  abilityIds: string[];
  denyCode: string | null;
  denyReason: string | null;
  jobsQueued: number;
  liveSupported: false;
  operationId: string | null;
  queued: boolean;
};

function denied(input: {
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

function isLiveOffensivePin(input: CalderaQualifiedStartInput): boolean {
  if (input.liveOffensive === true) {
    return true;
  }
  return Boolean(
    input.scenarioId && LIVE_OFFENSIVE_SCENARIO_IDS.has(input.scenarioId)
  );
}

function adapterDenied(error: unknown): CalderaQualifiedStartResult | null {
  if (error instanceof CalderaAdapterError) {
    return denied({
      code: error.code,
      rationale: error.message
    });
  }
  return null;
}

export async function queueCalderaQualifiedStart(
  input: CalderaQualifiedStartInput
): Promise<CalderaQualifiedStartResult> {
  if (isLiveOffensivePin(input)) {
    return denied({
      code: CALDERA_LIVE_DISABLED,
      rationale:
        "caldera.advanced_adversarial live execution is disabled in the current Periscan release (plan/fixture import only). The live-offensive triple-gate does not queue live Caldera."
    });
  }

  if (input.startable !== true) {
    return denied({
      code: CALDERA_DISCOVERY_NOT_STARTABLE,
      rationale:
        "Caldera discovery is not startable. Denied tasks are never queued."
    });
  }

  if (input.qualified !== true) {
    return denied({
      code: CALDERA_QUALIFICATION_REQUIRED,
      rationale:
        "Caldera adapter qualification is required before live execution. Denied tasks are never queued."
    });
  }

  if (input.tenantAuthorized !== true) {
    return denied({
      code: CALDERA_TENANT_AUTHORIZATION_REQUIRED,
      rationale:
        "Caldera discovery requires tenant authorization. Denied tasks are never queued."
    });
  }

  if (input.policyOutcome !== "Allowed") {
    return denied({
      code: CALDERA_POLICY_NOT_ALLOWED,
      rationale:
        "Caldera discovery requires an Allowed policy decision. Denied tasks are never queued."
    });
  }

  try {
    assertCalderaAbilitiesAllowlisted(input.abilityIds);
  } catch (error) {
    const closed = adapterDenied(error);
    if (closed) {
      return closed;
    }
    throw error;
  }

  try {
    const client = createCalderaOperationsClient({
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      fetchImpl: input.fetchImpl
    });
    const created = await client.createOperation({
      abilityIds: input.abilityIds,
      name: input.name ?? "periscan-caldera-discovery"
    });
    return {
      abilityIds: [...input.abilityIds],
      denyCode: null,
      denyReason: null,
      jobsQueued: 1,
      liveSupported: false,
      operationId: created.operationId,
      queued: true
    };
  } catch (error) {
    const closed = adapterDenied(error);
    if (closed) {
      return closed;
    }
    throw error;
  }
}
