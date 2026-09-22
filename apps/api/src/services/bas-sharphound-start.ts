import {
  planSharpHoundQualifiedStart,
  type SharpHoundQualifiedStartResult,
  type SharpHoundTenantAuthorization
} from "@periscan/modules";
import type { BloodHoundImportedGraph } from "@periscan/shared";

export type BasSharpHoundStartGate = {
  startable: boolean;
};

export type StartBasSharpHoundCollectionInput = {
  collectionProfile: unknown;
  graph?: BloodHoundImportedGraph;
  hopReceipts?: readonly unknown[];
  liveAdCollection?: boolean;
  startGate: BasSharpHoundStartGate;
  tenantAuthorization?: SharpHoundTenantAuthorization;
};

export type StartBasSharpHoundCollectionResult =
  SharpHoundQualifiedStartResult & {
    recordedPlan: SharpHoundQualifiedStartResult["collectionPlan"];
  };

export function startBasSharpHoundCollection(
  input: StartBasSharpHoundCollectionInput
): StartBasSharpHoundCollectionResult {
  const planned = planSharpHoundQualifiedStart({
    collectionProfile: input.collectionProfile,
    graph: input.graph,
    hopReceipts: input.hopReceipts,
    liveAdCollection: input.liveAdCollection,
    startable: input.startGate.startable === true,
    tenantAuthorization: input.tenantAuthorization
  });

  return {
    ...planned,
    recordedPlan: planned.collectionPlan
  };
}
