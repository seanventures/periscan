import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CreateAIApplicationInputSchema,
  ValidateAIApplicationInputSchema
} from "../../apps/api/src/app.js";
import { classifyAiValidationDrift } from "../../apps/api/src/services/control-ai.js";
import {
  executeModuleById,
  getModuleById,
  ModuleExecutionContextSchema
} from "../../packages/modules/src/index.js";
import { renderValidationSnapshotReportHtml } from "../../packages/reports/src/index.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";
import {
  AIApplicationSchema,
  type SignalEnvelope
} from "../../packages/shared/src/domain.js";
import {
  AIAppValidationOutcomeSchema,
  listAIAppValidationSuites
} from "../../packages/shared/src/validation-catalog.js";

async function readRepoFile(repoPath: string) {
  return readFile(new URL(`../../${repoPath}`, import.meta.url), "utf8");
}

function sectionBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

function parseBulletsBetween(source: string, start: string, end: string) {
  return sectionBetween(source, start, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function context(overrides: Record<string, unknown> = {}) {
  return ModuleExecutionContextSchema.parse({
    integrationIds: [],
    inputs: {},
    missionId: randomUUID(),
    policyDecisionId: randomUUID(),
    runId: randomUUID(),
    runnerId: null,
    safetyLevel: "ControlledValidation",
    scopeId: randomUUID(),
    target: {},
    tenantId: randomUUID(),
    ...overrides
  });
}

function createAiRiskSignal(
  input: Pick<SignalEnvelope, "signalSubcategory" | "techniqueIds"> & {
    evidenceIds: string[];
  }
): SignalEnvelope {
  const timestamp = "2026-06-28T00:00:00.000Z";

  return {
    confidence: 0.84,
    createdAt: timestamp,
    evidenceIds: input.evidenceIds,
    freshness: "Fresh",
    rawPayloadPointer: null,
    redactionStatus: "Redacted",
    relatedAssetIds: [],
    relatedControlIds: [],
    relatedEvidenceIds: input.evidenceIds,
    relatedIdentityIds: [],
    relatedPathIds: [],
    sensitivityLevel: "Moderate",
    signalCategory: "AIApplication",
    signalId: randomUUID(),
    signalSubcategory: input.signalSubcategory,
    sourceIntegrationId: null,
    sourceRunnerId: null,
    sourceType: "promptfoo.suite",
    sourceVendor: "Periscan",
    techniqueIds: input.techniqueIds,
    tenantId: randomUUID(),
    timestampIngested: timestamp,
    timestampObserved: timestamp,
    updatedAt: timestamp
  };
}

describe("PRD section 3.5 AI App Security Validation coverage", () => {
  it("maps every PRD coverage bullet to a first-class safe validation suite", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "3.5 AI App Security Validation",
      "3.6 Fix Verification"
    );
    const coverage = parseBulletsBetween(section, "Coverage", "Outcomes");
    const sourceToCategory = new Map([
      ["prompt injection", "PromptInjection"],
      ["RAG authorization failure", "RAGAuthorization"],
      ["sensitive data leakage", "SensitiveDataLeakage"],
      ["unsafe tool invocation", "UnsafeToolInvocation"],
      ["agent over-permissioning", "AgentOverPermissioning"],
      ["system prompt exposure", "SystemPromptExposure"],
      ["cross-tenant retrieval", "CrossTenantRetrieval"],
      ["guardrail drift", "GuardrailDrift"],
      ["AI security review evidence", "AISecurityReviewEvidence"]
    ]);
    const suites = listAIAppValidationSuites();
    const categories = new Set(suites.map((suite) => suite.category));

    expect(coverage).toEqual([...sourceToCategory.keys()]);
    for (const [sourceBullet, category] of sourceToCategory) {
      expect(categories.has(category)).toBe(true);
      const suite = suites.find((item) => item.category === category);

      expect(suite).toMatchObject({
        moduleId: "ai_app.safe_validation",
        requiredScopeTypes: ["AIApplicationEndpoint"],
        safetyLevel: "ControlledValidation"
      });
      expect(suite?.safeTestIntent.length).toBeGreaterThan(20);
      expect(suite?.prohibitedBehaviors.join(" ")).toMatch(
        /No (real|raw|secret|unauthorized|destructive|unsupported)/u
      );
      expect(sourceBullet.length).toBeGreaterThan(0);
    }
  });

  it("keeps every PRD AI validation outcome in the public outcome contract", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "3.5 AI App Security Validation",
      "3.6 Fix Verification"
    );
    const outcomes = parseBulletsBetween(section, "Outcomes", "Requirements");
    const sourceToOutcome = new Map([
      ["Passed", "Passed"],
      ["Failed", "Failed"],
      ["Inconclusive", "Inconclusive"],
      ["Leakage Observed", "LeakageObserved"],
      ["Unauthorized Retrieval Observed", "UnauthorizedRetrievalObserved"],
      ["Unsafe Tool Call Attempted", "UnsafeToolCallAttempted"],
      ["Unsafe Tool Call Blocked", "UnsafeToolCallBlocked"],
      ["Guardrail Bypassed", "GuardrailBypassed"],
      ["Guardrail Held", "GuardrailHeld"],
      ["Regressed", "Regressed"]
    ]);

    expect(outcomes).toEqual([...sourceToOutcome.keys()]);
    for (const outcome of sourceToOutcome.values()) {
      expect(AIAppValidationOutcomeSchema.safeParse(outcome).success).toBe(
        true
      );
    }
  });

  it("maps registration, test-account notes, customer scope, and validation routes to API contracts", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "3.5 AI App Security Validation",
      "3.6 Fix Verification"
    );
    const requirements = parseBulletsBetween(
      section,
      "Requirements",
      "Promptfoo, PyRIT"
    );
    const appSource = await readRepoFile("apps/api/src/app.ts");
    const serviceSource = await readRepoFile(
      "apps/api/src/services/control-ai.ts"
    );

    expect(requirements).toEqual([
      "Register AI apps and endpoints.",
      "Support test accounts and customer-defined scope.",
      "Run safe validation tests only.",
      "Redact sensitive outputs.",
      "Generate AI security evidence packs.",
      "Support baseline and drift comparison."
    ]);
    expect(appSource).toContain('"/api/v1/ai-apps"');
    expect(appSource).toContain('"/api/v1/ai-apps/:id/validate"');
    expect(appSource).toContain('"/api/v1/ai-apps/:id/history"');
    expect(appSource).toContain('"/api/v1/ai-apps/validation-suites"');
    expect(serviceSource).toContain('verificationStatus !== "Verified"');
    expect(serviceSource).toContain('"AIApplicationEndpoint"');

    const parsedCreate = CreateAIApplicationInputSchema.parse({
      appType: "Agent",
      authMethod: "Bearer",
      dataSourcesDescription: "Approved synthetic RAG corpus",
      endpointUrl: "https://ai.example.test/validate",
      guardrailsDescription: "Prompt, retrieval, and tool-use guardrails",
      name: "Customer Copilot",
      owner: "AI Security",
      ragEnabled: true,
      scopeId: randomUUID(),
      testAccountNotes: "Use approved synthetic tenant test account only.",
      toolsEnabled: true
    });

    expect(
      AIApplicationSchema.parse({
        ...parsedCreate,
        aiAppId: randomUUID(),
        createdAt: "2026-06-28T00:00:00.000Z",
        lastValidatedAt: null,
        latestValidation: null,
        tenantId: randomUUID(),
        updatedAt: "2026-06-28T00:00:00.000Z"
      }).testAccountNotes
    ).toBe("Use approved synthetic tenant test account only.");

    expect(
      ValidateAIApplicationInputSchema.parse({
        executionMode: "LiveSafe",
        harness: "garak",
        safeTestCases: [
          {
            category: "CrossTenantRetrieval",
            input:
              "Periscan safe validation: confirm retrieval is restricted to my authorized test tenant.",
            testCaseId: "safe-cross-tenant-boundary"
          }
        ],
        validationCategory: "CrossTenantRetrieval"
      }).harness
    ).toBe("garak");
  });

  it("executes all PRD-added safe suite categories with redacted, evidence-backed outputs", async () => {
    const cases = [
      ["AgentOverPermissioning", "UnsafeToolCallAttempted", "T1098"],
      ["SystemPromptExposure", "GuardrailHeld", "T1552"],
      ["CrossTenantRetrieval", "UnauthorizedRetrievalObserved", "T1078"],
      ["AISecurityReviewEvidence", "Passed", "T1592"],
      ["GuardrailDrift", "Regressed", "T1562"]
    ] as const;

    for (const [category, outcome, techniqueId] of cases) {
      const output = await executeModuleById(
        "ai_app.safe_validation",
        context({
          target: {
            appName: "Customer Copilot",
            endpointUrl: "https://ai.example.test/validate",
            fixtureOutcome: outcome,
            validationCategory: category
          }
        })
      );

      expect(output.evidence.map((item) => item.artifactType)).toEqual(
        expect.arrayContaining(["RawModuleOutput", "NormalizedEvidence"])
      );
      expect(output.signals[0]).toMatchObject({
        signalCategory: "AIApplication",
        signalSubcategory: outcome
      });
      expect(output.signals[0]?.techniqueIds).toContain(techniqueId);
      expect(JSON.stringify(output.evidence)).not.toMatch(
        /(AKIA|secret-token|api[_-]?key\s*[:=])/iu
      );
    }
  });

  it("classifies AI validation baseline and drift comparison outcomes", () => {
    expect(
      classifyAiValidationDrift({
        currentOutcome: "ai_validation_passed",
        currentSignalOutcomes: ["GuardrailHeld"],
        currentValidationState: "Validated",
        previousOutcome: null,
        previousValidationState: null
      })
    ).toBe("NoBaseline");
    expect(
      classifyAiValidationDrift({
        currentOutcome: "ai_risk_observed",
        currentSignalOutcomes: ["Regressed"],
        currentValidationState: "Exploitable",
        previousOutcome: "ai_validation_passed",
        previousValidationState: "Validated"
      })
    ).toBe("Regressed");
    expect(
      classifyAiValidationDrift({
        currentOutcome: "ai_validation_passed",
        currentSignalOutcomes: ["GuardrailHeld"],
        currentValidationState: "Validated",
        previousOutcome: "ai_risk_observed",
        previousValidationState: "Exploitable"
      })
    ).toBe("Improved");
    expect(
      classifyAiValidationDrift({
        currentOutcome: "ai_validation_passed",
        currentSignalOutcomes: ["GuardrailHeld"],
        currentValidationState: "Validated",
        previousOutcome: "ai_validation_passed",
        previousValidationState: "Validated"
      })
    ).toBe("Stable");
  });

  it("keeps Promptfoo, PyRIT, and similar harnesses policy-gated and redacted", async () => {
    const module = getModuleById("ai_app.safe_validation");
    const fixtureDirectory = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../packages/modules/fixtures/ai"
    );

    expect(module?.manifest).toMatchObject({
      approvalRequired: true,
      fixtureSupported: true,
      liveSupported: true,
      requiredScopes: ["AIApplicationEndpoint"],
      safetyLevel: "ControlledValidation",
      toolIds: ["promptfoo", "pyrit", "garak"]
    });

    for (const [harness, filename, forbidden] of [
      ["promptfoo", "promptfoo-safe-validation-fixture.json", "AKIA"],
      ["pyrit", "pyrit-safe-validation-fixture.json", "tenant fixture"],
      [
        "garak",
        "garak-safe-validation-fixture.json",
        "garak-secret-token-1234567890"
      ]
    ] as const) {
      const output = await executeModuleById(
        "ai_app.safe_validation",
        context({
          target: {
            endpointUrl: "https://ai.example.test/validate",
            fixtureMode: true,
            fixtureReportPath: path.join(fixtureDirectory, filename),
            harness
          }
        })
      );

      expect(output.evidence.length).toBeGreaterThan(0);
      expect(output.evidence[0]?.attributes.harness).toBe(harness);
      expect(JSON.stringify(output.evidence)).not.toContain(forbidden);
    }
  });

  it("renders AI security evidence packs from normalized AI risk signals", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const evidenceId = randomUUID();

    snapshot.aiAppRisks = [
      createAiRiskSignal({
        evidenceIds: [evidenceId],
        signalSubcategory: "SystemPromptExposure",
        techniqueIds: ["T1552"]
      })
    ];
    snapshot.metrics.aiRiskCount = 1;
    snapshot.evidenceIds = [...snapshot.evidenceIds, evidenceId];

    const html = renderValidationSnapshotReportHtml(snapshot, {
      packType: "AIAppValidationReport"
    });

    expect(html).toContain("Periscan AI Security Validation Report");
    expect(html).toContain("AI App Validation");
    expect(html).toContain("SystemPromptExposure");
    expect(html).toContain(evidenceId);
    expect(html).toContain("T1552");
    expect(html).not.toMatch(/raw secret|AKIA|garak-secret-token/iu);
  });
});
