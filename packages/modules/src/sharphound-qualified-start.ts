import {
  SHARPHOUND_COLLECTOR_LICENSE,
  classifyBloodHoundImportedPath,
  compileSharpHoundCollectionProfile,
  type BloodHoundImportedGraph,
  type BloodHoundPathHonesty,
  type SharpHoundCollectionProfile
} from "@periscan/shared";

export const SHARPHOUND_COLLECTION_NOT_STARTABLE =
  "sharphound_collection_not_startable";
export const SHARPHOUND_LIVE_AD_REQUIRES_TENANT_AUTHORIZATION =
  "sharphound_live_ad_requires_tenant_authorization";

export type SharpHoundTenantAuthorization = {
  liveAdCollection?: boolean;
};

export type SharpHoundQualifiedStartInput = {
  collectionProfile: unknown;
  graph?: BloodHoundImportedGraph;
  hopReceipts?: readonly unknown[];
  liveAdCollection?: boolean;
  startable: boolean;
  tenantAuthorization?: SharpHoundTenantAuthorization;
};

export type SharpHoundQualifiedStartResult = {
  collectionIsNotExploitation: true;
  collectionPlan: SharpHoundCollectionProfile | null;
  communityDefaultPack: false;
  credentialTheft: false;
  dcsync: false;
  denyCode: string | null;
  denyReason: string | null;
  importedGraphIsHypothesis: boolean;
  jobsQueued: number;
  license: typeof SHARPHOUND_COLLECTOR_LICENSE;
  liveAdCollection: false;
  liveAdRequiresTenantAuthorization: true;
  pathHonesty: BloodHoundPathHonesty | null;
  queued: boolean;
  recorded: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestedLiveAdCollection(input: SharpHoundQualifiedStartInput): boolean {
  if (input.liveAdCollection === true) {
    return true;
  }
  if (!isRecord(input.collectionProfile)) {
    return false;
  }
  return (
    input.collectionProfile.liveAdCollection === true ||
    input.collectionProfile.collectorExecution === true ||
    input.collectionProfile.useSharpHound === true
  );
}

function tenantAuthorizedLiveAd(
  authorization: SharpHoundTenantAuthorization | undefined
): boolean {
  return authorization?.liveAdCollection === true;
}

function profileForCompile(profile: unknown): unknown {
  if (!isRecord(profile)) {
    return profile;
  }
  const next = { ...profile };
  delete next.liveAdCollection;
  delete next.collectorExecution;
  delete next.useSharpHound;
  return next;
}

function denied(input: {
  code: string;
  graph?: BloodHoundImportedGraph;
  hopReceipts?: readonly unknown[];
  rationale: string;
}): SharpHoundQualifiedStartResult {
  return {
    collectionIsNotExploitation: true,
    collectionPlan: null,
    communityDefaultPack: false,
    credentialTheft: false,
    dcsync: false,
    denyCode: input.code,
    denyReason: input.rationale,
    importedGraphIsHypothesis: true,
    jobsQueued: 0,
    license: SHARPHOUND_COLLECTOR_LICENSE,
    liveAdCollection: false,
    liveAdRequiresTenantAuthorization: true,
    pathHonesty: graphHonesty(input.graph, input.hopReceipts),
    queued: false,
    recorded: false
  };
}

function graphHonesty(
  graph: BloodHoundImportedGraph | undefined,
  hopReceipts: readonly unknown[] | undefined
): BloodHoundPathHonesty | null {
  if (!graph) {
    return null;
  }
  return classifyBloodHoundImportedPath({
    graph,
    hopReceipts,
    requestedValidationState: "Discovered"
  });
}

export function planSharpHoundQualifiedStart(
  input: SharpHoundQualifiedStartInput
): SharpHoundQualifiedStartResult {
  if (input.startable !== true) {
    return denied({
      code: SHARPHOUND_COLLECTION_NOT_STARTABLE,
      graph: input.graph,
      hopReceipts: input.hopReceipts,
      rationale:
        "SharpHound collection is not startable. Denied tasks are never queued."
    });
  }

  if (
    requestedLiveAdCollection(input) &&
    !tenantAuthorizedLiveAd(input.tenantAuthorization)
  ) {
    return denied({
      code: SHARPHOUND_LIVE_AD_REQUIRES_TENANT_AUTHORIZATION,
      graph: input.graph,
      hopReceipts: input.hopReceipts,
      rationale:
        "Live Active Directory SharpHound collection requires tenant authorization. Denied tasks are never queued."
    });
  }

  const compiled = compileSharpHoundCollectionProfile(
    profileForCompile(input.collectionProfile)
  );
  if (!compiled.ok) {
    return denied({
      code: compiled.code,
      graph: input.graph,
      hopReceipts: input.hopReceipts,
      rationale: compiled.rationale
    });
  }

  const honesty = graphHonesty(input.graph, input.hopReceipts);
  return {
    collectionIsNotExploitation: true,
    collectionPlan: compiled.profile,
    communityDefaultPack: false,
    credentialTheft: false,
    dcsync: false,
    denyCode: null,
    denyReason: null,
    importedGraphIsHypothesis: honesty?.importedGraphIsNotProof ?? true,
    jobsQueued: 1,
    license: SHARPHOUND_COLLECTOR_LICENSE,
    liveAdCollection: false,
    liveAdRequiresTenantAuthorization: true,
    pathHonesty: honesty,
    queued: true,
    recorded: true
  };
}
