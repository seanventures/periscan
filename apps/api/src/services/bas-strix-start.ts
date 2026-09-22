import {
  queueStrixImportStart,
  type StrixQualifiedStartInput,
  type StrixQualifiedStartResult
} from "@periscan/modules";

export type BasStrixStartGate = {
  startable: boolean;
};

export type StartBasStrixImportInput = Omit<
  StrixQualifiedStartInput,
  "startable"
> & {
  startGate: BasStrixStartGate;
};

export type StartBasStrixImportResult = StrixQualifiedStartResult & {
  recordedPlan: StrixQualifiedStartResult["importPlan"];
};

export function startBasStrixImport(
  input: StartBasStrixImportInput
): StartBasStrixImportResult {
  const planned = queueStrixImportStart({
    communityDefaultPack: input.communityDefaultPack,
    executionEnvironment: input.executionEnvironment,
    liveExploit: input.liveExploit,
    liveOffensive: input.liveOffensive,
    liveOffensiveEnv: input.liveOffensiveEnv,
    policyOutcome: input.policyOutcome,
    qualified: input.qualified,
    scenarioId: input.scenarioId,
    startable: input.startGate.startable === true,
    tenantAuthorized: input.tenantAuthorized,
    unrestrictedShell: input.unrestrictedShell
  });

  return {
    ...planned,
    recordedPlan: planned.importPlan
  };
}
