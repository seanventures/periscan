import { randomUUID } from "node:crypto";

import {
  AIAppValidationCategorySchema,
  AIAppValidationOutcomeSchema,
  ControlValidationOutcomeSchema,
  SignalEnvelopeSchema,
  type SignalCategory,
  type SignalEnvelope
} from "@periscan/shared";
import { z } from "zod";

import {
  fixtureOrSimulationEvidenceAttributes,
  ModuleExecutionContextSchema,
  ModuleManifestSchema,
  ModuleOutputSchema,
  validationStateForFixtureOrSimulation,
  type ModuleExecutionContext,
  type ModuleOutput,
  type ValidationModule
} from "./index.js";

/**
 * Test-only mock validation modules.
 *
 * These fixtures intentionally fabricate validation outcomes and therefore MUST
 * NEVER be part of the production module registry (Real-First Rule, AGENTS.md).
 * They exist only so tests can exercise registry/execution plumbing without a
 * live tool runtime. The certification harness hard-fails any `mock.*`/`demo.*`
 * module, which keeps them out of the shipping catalog.
 *
 * P05-1 / U-17: mock modules never stamp Validated/Exploitable/Fixed with
 * measured:true — fabricated results stay Inconclusive (or control observation
 * states) with a fixture watermark.
 */

type ModuleManifestInput = z.input<typeof ModuleManifestSchema>;

function createSignal(
  moduleId: string,
  context: ModuleExecutionContext,
  input: {
    confidence: number;
    signalCategory: SignalCategory;
    signalSubcategory: string;
    sourceType: string;
    techniqueIds?: string[];
  }
): SignalEnvelope {
  const timestamp = new Date().toISOString();

  return SignalEnvelopeSchema.parse({
    confidence: input.confidence,
    createdAt: timestamp,
    evidenceIds: [],
    freshness: "Fresh",
    rawPayloadPointer: null,
    redactionStatus: "Redacted",
    relatedAssetIds: [],
    relatedControlIds: [],
    relatedEvidenceIds: [],
    relatedIdentityIds: [],
    relatedPathIds: [],
    sensitivityLevel: "Moderate",
    signalCategory: input.signalCategory,
    signalId: randomUUID(),
    signalSubcategory: input.signalSubcategory,
    sourceIntegrationId: null,
    sourceType: `${moduleId}.${input.sourceType}`,
    sourceVendor: "Periscan",
    tenantId: context.tenantId,
    techniqueIds: input.techniqueIds,
    timestampIngested: timestamp,
    timestampObserved: timestamp,
    updatedAt: timestamp
  });
}

function createModule(
  manifest: ModuleManifestInput,
  targetSchema: z.ZodObject<Record<string, z.ZodTypeAny>>,
  execute: (
    context: ModuleExecutionContext & {
      target: Record<string, unknown>;
    }
  ) => Promise<ModuleOutput>
): ValidationModule {
  const inputSchema = ModuleExecutionContextSchema.extend({
    target: targetSchema
  });

  return {
    inputSchema,
    manifest: ModuleManifestSchema.parse(manifest),
    outputSchema: ModuleOutputSchema,
    async execute(context) {
      const parsedContext = inputSchema.parse(context);
      const result = await execute(parsedContext);

      return ModuleOutputSchema.parse(result);
    }
  };
}

function mapAIAppFixtureOutcomeToValidationState(
  outcome: z.infer<typeof AIAppValidationOutcomeSchema>
) {
  // Fixture-only: never mint Validated/Exploitable as exposure proof.
  switch (outcome) {
    case "GuardrailHeld":
    case "Passed":
      return validationStateForFixtureOrSimulation("Validated");
    case "UnsafeToolCallBlocked":
      return "Blocked" as const;
    case "Inconclusive":
      return "Inconclusive" as const;
    default:
      return validationStateForFixtureOrSimulation("Exploitable");
  }
}

function mapControlOutcomeToValidationState(
  outcome: z.infer<typeof ControlValidationOutcomeSchema>
) {
  switch (outcome) {
    case "Detected":
      return "Detected" as const;
    case "Blocked":
      return "Blocked" as const;
    case "Logged":
      return "Logged" as const;
    case "Alerted":
    case "Routed":
      return "Alerted" as const;
    case "Missed":
      return "Missed" as const;
    default:
      return "Inconclusive" as const;
  }
}

export const mockValidationModules: ValidationModule[] = [
  createModule(
    {
      moduleId: "mock.external_exposure",
      name: "Mock External Exposure",
      capabilityName: "External Exposure Validation",
      version: "0.1.0",
      toolName: "periscan.mock.external",
      license: "MIT",
      safetyLevel: "ActiveNonInvasive",
      requiredInputs: ["hostname"],
      requiredPermissions: [],
      supportedMissionTypes: [
        "ValidationSnapshot",
        "ExposureValidation",
        "ContinuousValidation"
      ],
      executionMode: "ExternalPoA",
      timeoutSeconds: 30,
      resourceLimits: {
        maxNetworkRequests: 20,
        memoryMb: 128
      },
      parser: "periscan.mock.external.v1",
      outputSchema: "periscan.module-output.v1",
      evidenceTypes: ["NormalizedEvidence"],
      approvalRequired: false,
      customerVisibleDescription:
        "Validates a mock internet-facing exposure path without touching live systems."
    },
    z.object({
      hostname: z.string().min(1)
    }),
    async (context) => ({
      outcome: "reachable",
      summary: `Fixture external validation reached ${String(context.target.hostname)}.`,
      validationState: "Reachable",
      signals: [
        createSignal("mock.external_exposure", context, {
          confidence: 0.84,
          signalCategory: "Exposure",
          signalSubcategory: "ExternalExposure",
          sourceType: "validation"
        })
      ],
      evidence: [
        {
          artifactType: "NormalizedEvidence",
          attributes: fixtureOrSimulationEvidenceAttributes({
            hostname: context.target.hostname
          }),
          description: "Fixture external reachability observation.",
          redactionStatus: "Redacted",
          sensitivityLevel: "Moderate"
        }
      ],
      errors: []
    })
  ),
  createModule(
    {
      moduleId: "mock.github_secret_scan",
      name: "Mock GitHub Secret Scan",
      capabilityName: "Repository Secret Validation",
      version: "0.1.0",
      toolName: "periscan.mock.github",
      license: "MIT",
      safetyLevel: "PassiveReadOnly",
      requiredInputs: ["repository"],
      requiredPermissions: ["repositories:read"],
      supportedMissionTypes: [
        "ValidationSnapshot",
        "ExposureValidation",
        "ContinuousValidation"
      ],
      executionMode: "ControlPlane",
      timeoutSeconds: 30,
      resourceLimits: {
        memoryMb: 128
      },
      parser: "periscan.mock.github.v1",
      outputSchema: "periscan.module-output.v1",
      evidenceTypes: ["NormalizedEvidence"],
      approvalRequired: false,
      customerVisibleDescription:
        "Finds a fixture repository secret and returns normalized, redacted output."
    },
    z.object({
      repository: z.string().min(1)
    }),
    async (context) => ({
      outcome: "validated_secret_path_seed",
      summary: `Fixture repository secret path seed found in ${String(context.target.repository)} (fixture only — not live proof).`,
      validationState: validationStateForFixtureOrSimulation("Validated"),
      signals: [
        createSignal("mock.github_secret_scan", context, {
          confidence: 0.91,
          signalCategory: "Repository",
          signalSubcategory: "SecretScanCandidate",
          sourceType: "validation"
        })
      ],
      evidence: [
        {
          artifactType: "NormalizedEvidence",
          attributes: fixtureOrSimulationEvidenceAttributes({
            repository: context.target.repository,
            secretPreview: "ghp_****fixture"
          }),
          description:
            "Fixture secret scan candidate with redacted token preview.",
          redactionStatus: "Redacted",
          sensitivityLevel: "High"
        }
      ],
      errors: []
    })
  ),
  createModule(
    {
      moduleId: "mock.cloud_posture",
      name: "Mock Cloud Posture",
      capabilityName: "Cloud Posture Validation",
      version: "0.1.0",
      toolName: "periscan.mock.cloud",
      license: "MIT",
      safetyLevel: "PassiveReadOnly",
      requiredInputs: ["cloudAccountId"],
      requiredPermissions: ["cloud:read"],
      supportedMissionTypes: [
        "ValidationSnapshot",
        "ExposureValidation",
        "ContinuousValidation"
      ],
      executionMode: "ControlPlane",
      timeoutSeconds: 45,
      resourceLimits: {
        memoryMb: 192
      },
      parser: "periscan.mock.cloud.v1",
      outputSchema: "periscan.module-output.v1",
      evidenceTypes: ["NormalizedEvidence"],
      approvalRequired: false,
      customerVisibleDescription:
        "Returns fixture cloud posture signals for an authorized account."
    },
    z.object({
      cloudAccountId: z.string().min(1)
    }),
    async (context) => ({
      outcome: "public_exposure_observed",
      summary: `Fixture posture checks found public exposure indicators in ${String(context.target.cloudAccountId)} (fixture only — not live proof).`,
      validationState: validationStateForFixtureOrSimulation("Validated"),
      signals: [
        createSignal("mock.cloud_posture", context, {
          confidence: 0.88,
          signalCategory: "Cloud",
          signalSubcategory: "PublicExposure",
          sourceType: "validation"
        })
      ],
      evidence: [
        {
          artifactType: "NormalizedEvidence",
          attributes: fixtureOrSimulationEvidenceAttributes({
            cloudAccountId: context.target.cloudAccountId
          }),
          description: "Fixture cloud posture observation.",
          redactionStatus: "Redacted",
          sensitivityLevel: "Moderate"
        }
      ],
      errors: []
    })
  ),
  createModule(
    {
      moduleId: "mock.ai_app_validation",
      name: "Mock AI App Validation",
      capabilityName: "AI App Safety Validation",
      version: "0.1.0",
      toolName: "periscan.mock.ai-app",
      license: "MIT",
      safetyLevel: "ControlledValidation",
      requiredInputs: ["endpointUrl"],
      requiredPermissions: [],
      supportedMissionTypes: ["AIAppValidation", "ValidationSnapshot"],
      executionMode: "ControlPlane",
      timeoutSeconds: 60,
      resourceLimits: {
        memoryMb: 192
      },
      parser: "periscan.mock.ai-app.v1",
      outputSchema: "periscan.module-output.v1",
      evidenceTypes: ["NormalizedEvidence"],
      approvalRequired: true,
      customerVisibleDescription:
        "Runs safe fixture AI app checks and returns evidence-backed outcomes."
    },
    z.object({
      appName: z.string().min(1).optional(),
      endpointUrl: z.url(),
      fixtureOutcome: AIAppValidationOutcomeSchema.optional(),
      validationCategory: AIAppValidationCategorySchema.optional()
    }),
    async (context) => {
      const outcome = AIAppValidationOutcomeSchema.parse(
        context.target.fixtureOutcome ?? "GuardrailHeld"
      );
      const category = AIAppValidationCategorySchema.parse(
        context.target.validationCategory ?? "PromptInjection"
      );
      const appLabel =
        typeof context.target.appName === "string" &&
        context.target.appName.length > 0
          ? context.target.appName
          : String(context.target.endpointUrl);

      return {
        outcome: outcome.toLowerCase(),
        summary: `Fixture AI app validation for ${appLabel} returned ${outcome} in the ${category} suite (fixture only — not live proof).`,
        validationState: mapAIAppFixtureOutcomeToValidationState(outcome),
        signals: [
          createSignal("mock.ai_app_validation", context, {
            confidence: outcome === "Inconclusive" ? 0.51 : 0.82,
            signalCategory: "AIApplication",
            signalSubcategory: outcome,
            sourceType: "validation"
          })
        ],
        evidence: [
          {
            artifactType: "NormalizedEvidence",
            attributes: fixtureOrSimulationEvidenceAttributes({
              endpointUrl: context.target.endpointUrl,
              outcome,
              validationCategory: category
            }),
            description: "Fixture AI validation transcript summary.",
            redactionStatus: "Redacted",
            sensitivityLevel: "Moderate"
          }
        ],
        errors: []
      };
    }
  ),
  createModule(
    {
      moduleId: "mock.control_validation",
      name: "Mock Control Validation",
      capabilityName: "Control Response Validation",
      version: "0.1.0",
      toolName: "periscan.mock.control",
      license: "MIT",
      safetyLevel: "BASLite",
      requiredInputs: ["controlSourceId"],
      requiredPermissions: ["control:observe"],
      supportedMissionTypes: ["ControlValidation", "ValidationSnapshot"],
      executionMode: "ControlPlane",
      timeoutSeconds: 60,
      resourceLimits: {
        memoryMb: 192
      },
      parser: "periscan.mock.control.v1",
      outputSchema: "periscan.module-output.v1",
      evidenceTypes: ["NormalizedEvidence"],
      approvalRequired: true,
      customerVisibleDescription:
        "Runs a dry-run control validation fixture and returns normalized verdicts."
    },
    z.object({
      controlSourceId: z.string().uuid(),
      dryRun: z.boolean().optional(),
      fixtureOutcome: ControlValidationOutcomeSchema.optional(),
      techniqueId: z.string().min(1).optional()
    }),
    async (context) => {
      const outcome = ControlValidationOutcomeSchema.parse(
        context.target.fixtureOutcome ?? "Detected"
      );

      return {
        outcome: outcome.toLowerCase(),
        summary: `Fixture control validation for ${String(context.target.controlSourceId)} returned ${outcome}.`,
        validationState: mapControlOutcomeToValidationState(outcome),
        signals: [
          createSignal("mock.control_validation", context, {
            confidence: outcome === "NoEvidence" ? 0.58 : 0.78,
            signalCategory: "ControlObservation",
            signalSubcategory: outcome,
            sourceType: "validation",
            techniqueIds: context.target.techniqueId
              ? [String(context.target.techniqueId)]
              : []
          })
        ],
        evidence: [
          {
            artifactType: "NormalizedEvidence",
            attributes: fixtureOrSimulationEvidenceAttributes({
              controlSourceId: context.target.controlSourceId,
              dryRun: context.target.dryRun ?? true,
              outcome,
              techniqueId: context.target.techniqueId ?? null
            }),
            description: "Fixture control validation observation.",
            redactionStatus: "Redacted",
            sensitivityLevel: "Moderate"
          }
        ],
        errors: []
      };
    }
  )
];

const mockModulesById = new Map(
  mockValidationModules.map(
    (module) => [module.manifest.moduleId, module] as const
  )
);

export function getMockModuleById(moduleId: string): ValidationModule | null {
  return mockModulesById.get(moduleId) ?? null;
}

export async function executeMockModuleById(
  moduleId: string,
  context: ModuleExecutionContext
): Promise<ModuleOutput> {
  const module = getMockModuleById(moduleId);

  if (!module) {
    throw new Error(`Unknown mock module: ${moduleId}`);
  }

  return module.execute(context);
}
