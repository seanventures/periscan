import type { ScenarioBundle } from "@periscan/shared";

export type ScenarioBundleSigningFields = Pick<
  ScenarioBundle,
  | "allowedScopeTypes"
  | "bundleVersion"
  | "description"
  | "expectedObservations"
  | "intent"
  | "legalClassification"
  | "maximumIterations"
  | "name"
  | "prerequisites"
  | "safetyCeiling"
  | "sbom"
  | "scopeId"
  | "source"
  | "steps"
  | "techniqueIds"
>;

export function scenarioBundleSigningContent(
  bundle: ScenarioBundleSigningFields
): ScenarioBundleSigningFields {
  return {
    allowedScopeTypes: bundle.allowedScopeTypes,
    bundleVersion: bundle.bundleVersion,
    description: bundle.description,
    expectedObservations: bundle.expectedObservations,
    intent: bundle.intent,
    legalClassification: bundle.legalClassification,
    maximumIterations: bundle.maximumIterations,
    name: bundle.name,
    prerequisites: bundle.prerequisites,
    safetyCeiling: bundle.safetyCeiling,
    sbom: bundle.sbom,
    scopeId: bundle.scopeId,
    source: bundle.source,
    steps: bundle.steps,
    techniqueIds: bundle.techniqueIds
  };
}
