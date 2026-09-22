import {
  queueVigoliumImportStart,
  type VigoliumQualifiedStartInput,
  type VigoliumQualifiedStartResult
} from "@periscan/modules";

export type BasVigoliumStartGate = {
  startable: boolean;
};

export type StartBasVigoliumImportInput = Omit<
  VigoliumQualifiedStartInput,
  "startable"
> & {
  startGate: BasVigoliumStartGate;
};

export type StartBasVigoliumImportResult = VigoliumQualifiedStartResult & {
  recordedPlan: VigoliumQualifiedStartResult["auditPlan"];
};

export function startBasVigoliumImport(
  input: StartBasVigoliumImportInput
): StartBasVigoliumImportResult {
  const planned = queueVigoliumImportStart({
    authorized: input.authorized,
    communityDefaultPack: input.communityDefaultPack,
    fixtureMode: input.fixtureMode,
    json: input.json,
    liveAttackPlanning: input.liveAttackPlanning,
    liveOffensiveEnv: input.liveOffensiveEnv,
    policyOutcome: input.policyOutcome,
    qualified: input.qualified,
    raw: input.raw,
    startable: input.startGate.startable === true,
    verifiedScope: input.verifiedScope
  });

  return {
    ...planned,
    recordedPlan: planned.auditPlan
  };
}
