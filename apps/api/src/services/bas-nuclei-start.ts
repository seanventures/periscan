import {
  queueNucleiZapQualifiedStart,
  type NucleiZapQualifiedStartInput,
  type NucleiZapQualifiedStartResult
} from "@periscan/modules";

export type BasNucleiZapStartGate = {
  startable: boolean;
};

export type StartBasNucleiZapSafeScanInput = Omit<
  NucleiZapQualifiedStartInput,
  "startable"
> & {
  startGate: BasNucleiZapStartGate;
};

export type StartBasNucleiZapSafeScanResult = NucleiZapQualifiedStartResult & {
  recordedPlan: NucleiZapQualifiedStartResult["safeScanPlan"];
};

export function startBasNucleiZapSafeScan(
  input: StartBasNucleiZapSafeScanInput
): StartBasNucleiZapSafeScanResult {
  const planned = queueNucleiZapQualifiedStart({
    communityDefaultPack: input.communityDefaultPack,
    communityFirstHour: input.communityFirstHour,
    engine: input.engine,
    exploitTemplates: input.exploitTemplates,
    internetWide: input.internetWide,
    liveExploit: input.liveExploit,
    liveOffensive: input.liveOffensive,
    liveOffensiveEnv: input.liveOffensiveEnv,
    policyOutcome: input.policyOutcome,
    profileId: input.profileId,
    qualified: input.qualified,
    scenarioId: input.scenarioId,
    startable: input.startGate.startable === true,
    tenantAuthorized: input.tenantAuthorized
  });

  return {
    ...planned,
    recordedPlan: planned.safeScanPlan
  };
}
