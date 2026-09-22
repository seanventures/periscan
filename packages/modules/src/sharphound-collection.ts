import {
  BLOODHOUND_GRAPH_IMPORT_LICENSE,
  SHARPHOUND_COLLECTOR_LICENSE,
  classifyBloodHoundImportedPath,
  compileSharpHoundCollectionProfile,
  redactBloodHoundGraph,
  type BloodHoundImportedGraph,
  type BloodHoundPathHonesty,
  type ValidationState
} from "@periscan/shared";

export {
  BLOODHOUND_GRAPH_IMPORT_LICENSE,
  SHARPHOUND_COLLECTOR_LICENSE,
  compileSharpHoundCollectionProfile,
  redactBloodHoundGraph
};

export const SHARPHOUND_COLLECTOR_DENY_CODE =
  "sharphound_collector_legal_review_blocked";

const SHARPHOUND_COLLECTOR_DENY_RATIONALE =
  "BloodHound-compatible graph import is supported, but SharpHound collection remains blocked pending legal and security review. A compiled collection profile is not live AD execution.";

export function isSharpHoundLiveAdCollectionRequest(target: {
  collector?: unknown;
  collectorExecution?: unknown;
  liveAdCollection?: unknown;
  useSharpHound?: unknown;
}): boolean {
  return (
    target.collector === "sharphound" ||
    target.useSharpHound === true ||
    target.collectorExecution === true ||
    target.liveAdCollection === true
  );
}

export function evaluateSharpHoundLiveAdCollection(target: {
  collector?: unknown;
  collectorExecution?: unknown;
  liveAdCollection?: unknown;
  useSharpHound?: unknown;
}): { allowed: boolean; code: string | null; rationale: string } {
  if (isSharpHoundLiveAdCollectionRequest(target)) {
    return {
      allowed: false,
      code: SHARPHOUND_COLLECTOR_DENY_CODE,
      rationale: SHARPHOUND_COLLECTOR_DENY_RATIONALE
    };
  }

  return {
    allowed: true,
    code: null,
    rationale: "No SharpHound live AD collection requested."
  };
}

export function applyBloodHoundImportHonesty(input: {
  graph: BloodHoundImportedGraph;
  hopReceipts?: readonly unknown[];
  requestedValidationState?: ValidationState;
}): BloodHoundPathHonesty & { redactedGraph: BloodHoundImportedGraph } {
  const redactedGraph = redactBloodHoundGraph(input.graph);
  const honesty = classifyBloodHoundImportedPath({
    graph: redactedGraph,
    hopReceipts: input.hopReceipts,
    requestedValidationState: input.requestedValidationState ?? "Discovered"
  });
  return { ...honesty, redactedGraph };
}
