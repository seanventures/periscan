import {
  queueRustinelObserveImportStart,
  type RustinelQualifiedStartInput,
  type RustinelQualifiedStartResult
} from "@periscan/modules";

export type BasRustinelStartGate = {
  startable: boolean;
};

export type StartBasRustinelObserveImportInput = Omit<
  RustinelQualifiedStartInput,
  "startable"
> & {
  startGate: BasRustinelStartGate;
};

export type StartBasRustinelObserveImportResult =
  RustinelQualifiedStartResult & {
    recordedPlan: RustinelQualifiedStartResult["observeImportPlan"];
  };

export function startBasRustinelObserveImport(
  input: StartBasRustinelObserveImportInput
): StartBasRustinelObserveImportResult {
  const planned = queueRustinelObserveImportStart({
    communityDefaultPack: input.communityDefaultPack,
    liveAgent: input.liveAgent,
    policyOutcome: input.policyOutcome,
    qualified: input.qualified,
    startable: input.startGate.startable === true,
    tenantAuthorized: input.tenantAuthorized,
    yamlEval: input.yamlEval
  });

  return {
    ...planned,
    recordedPlan: planned.observeImportPlan
  };
}
