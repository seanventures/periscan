import {
  queueInfectionMonkeyDiscoverStart,
  type InfectionMonkeyQualifiedStartInput,
  type InfectionMonkeyQualifiedStartResult
} from "@periscan/modules";

export type BasInfectionMonkeyStartGate = {
  startable: boolean;
};

export type StartBasInfectionMonkeyDiscoverInput = Omit<
  InfectionMonkeyQualifiedStartInput,
  "startable"
> & {
  startGate: BasInfectionMonkeyStartGate;
};

export type StartBasInfectionMonkeyDiscoverResult =
  InfectionMonkeyQualifiedStartResult & {
    recordedPlan: InfectionMonkeyQualifiedStartResult["discoverPlan"];
  };

export function startBasInfectionMonkeyDiscover(
  input: StartBasInfectionMonkeyDiscoverInput
): StartBasInfectionMonkeyDiscoverResult {
  const planned = queueInfectionMonkeyDiscoverStart({
    communityDefaultPack: input.communityDefaultPack,
    copyleftOptIn: input.copyleftOptIn,
    dangerAckDigest: input.dangerAckDigest,
    dangerAcknowledged: input.dangerAcknowledged,
    hopReceipts: input.hopReceipts,
    islandReport: input.islandReport,
    liveOffensive: input.liveOffensive,
    plugins: input.plugins,
    policyOutcome: input.policyOutcome,
    qualified: input.qualified,
    scenarioId: input.scenarioId,
    startable: input.startGate.startable === true,
    tenantAuthorized: input.tenantAuthorized,
    timeoutSeconds: input.timeoutSeconds,
    verifiedScopeHosts: input.verifiedScopeHosts
  });

  return {
    ...planned,
    recordedPlan: planned.discoverPlan
  };
}
