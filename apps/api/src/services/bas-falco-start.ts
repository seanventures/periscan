import {
  queueFalcoObserveStart,
  type FalcoObserveQualifiedStartInput,
  type FalcoObserveQualifiedStartResult
} from "@periscan/modules";

export type BasFalcoStartGate = {
  startable: boolean;
};

export type StartBasFalcoObserveInput = Omit<
  FalcoObserveQualifiedStartInput,
  "startable"
> & {
  startGate: BasFalcoStartGate;
};

export type StartBasFalcoObserveResult = FalcoObserveQualifiedStartResult & {
  recordedPlan: FalcoObserveQualifiedStartResult["observePlan"];
};

export function startBasFalcoObserve(
  input: StartBasFalcoObserveInput
): StartBasFalcoObserveResult {
  const planned = queueFalcoObserveStart({
    communityDefaultPack: input.communityDefaultPack,
    fixtureMode: input.fixtureMode,
    json: input.json,
    liveKernel: input.liveKernel,
    policyOutcome: input.policyOutcome,
    qualified: input.qualified,
    raw: input.raw,
    startable: input.startGate.startable === true,
    tenantAuthorized: input.tenantAuthorized
  });

  return {
    ...planned,
    recordedPlan: planned.observePlan
  };
}
