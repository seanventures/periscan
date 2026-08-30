import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildVerificationResult } from "../../apps/api/src/runtime-services.js";
import {
  executeModuleById,
  getModuleById,
  listModuleManifests,
  ModuleExecutionContextSchema
} from "../../packages/modules/src/index.js";
import type { AttackPath } from "../../packages/shared/src/index.js";

/**
 * Validation-provenance honesty gate.
 *
 * A security product must never report a risk as "Fixed" unless a real
 * validation module actually executed during the retest and produced evidence
 * that the exposure is gone. These tests encode that invariant structurally so
 * fabricated "Fixed" outcomes can never ship.
 */

function makePreviousPath(overrides: Partial<AttackPath> = {}): AttackPath {
  return {
    impactScore: 80,
    name: "Repo secret to cloud role",
    validationState: "Exploitable",
    evidenceBasis: "Measured",
    evidenceIds: [randomUUID()],
    ...overrides
  } as unknown as AttackPath;
}

function makeCurrentDraft(
  overrides: Partial<{
    impactScore: number;
    validationState: AttackPath["validationState"];
    name: string;
  }> = {}
) {
  return {
    impactScore: 80,
    name: "Repo secret to cloud role",
    validationState: "Exploitable",
    evidenceIds: [randomUUID()],
    ...overrides
  } as unknown as Parameters<typeof buildVerificationResult>[0]["currentDraft"];
}

describe("validation provenance — buildVerificationResult honesty gate", () => {
  it("returns Inconclusive (never Fixed) when no real retest executed and the path no longer correlates", () => {
    const result = buildVerificationResult({
      currentDraft: null,
      executedRealRetest: false,
      previousPath: makePreviousPath()
    });

    expect(result.outcome).toBe("Inconclusive");
    expect(result.newState).toBe("Inconclusive");
    expect(result.outcome).not.toBe("Fixed");
  });

  it("returns Inconclusive (never Fixed) when no real retest executed even if the path still correlates", () => {
    const result = buildVerificationResult({
      currentDraft: makeCurrentDraft(),
      executedRealRetest: false,
      previousPath: makePreviousPath()
    });

    expect(result.outcome).toBe("Inconclusive");
    expect(result.outcome).not.toBe("Fixed");
  });

  it("returns Fixed only when a real retest ran and the exposure no longer re-correlates", () => {
    const result = buildVerificationResult({
      currentDraft: null,
      executedRealRetest: true,
      previousPath: makePreviousPath()
    });

    expect(result.outcome).toBe("Fixed");
    expect(result.newState).toBe("Fixed");
  });

  it("never reports Fixed for a HEURISTIC exposure (only inferred, never measured)", () => {
    const result = buildVerificationResult({
      currentDraft: null,
      executedRealRetest: true,
      previousPath: makePreviousPath({ evidenceBasis: "Heuristic" })
    });

    expect(result.outcome).toBe("Inconclusive");
    expect(result.outcome).not.toBe("Fixed");
  });

  it("never reports Fixed when there was no prior measured exposure (cannot fix what was never measured)", () => {
    const result = buildVerificationResult({
      currentDraft: null,
      executedRealRetest: true,
      previousPath: null
    });

    expect(result.outcome).toBe("Inconclusive");
    expect(result.newState).toBe("Inconclusive");
  });

  it("returns StillExposed when a real retest ran and the exposure remains at the same impact", () => {
    const result = buildVerificationResult({
      currentDraft: makeCurrentDraft({
        impactScore: 80,
        validationState: "Exploitable"
      }),
      executedRealRetest: true,
      previousPath: makePreviousPath({ impactScore: 80 })
    });

    expect(result.outcome).toBe("StillExposed");
  });

  it("never reports Fixed for any combination unless a real retest executed", () => {
    for (const currentDraft of [null, makeCurrentDraft()]) {
      const result = buildVerificationResult({
        currentDraft,
        executedRealRetest: false,
        previousPath: makePreviousPath()
      });
      expect(result.outcome).not.toBe("Fixed");
      expect(result.newState).not.toBe("Fixed");
    }
  });
});

describe("validation provenance — no fabricated-outcome modules in the production registry", () => {
  it("exposes no mock/demo/fixture/fake/sample module ids in the registry or catalog", () => {
    const fabricationMarker =
      /(^|[._-])(mock|demo|fixture|fake|sample|stub)([._-]|$)/i;

    for (const manifest of listModuleManifests()) {
      expect(fabricationMarker.test(manifest.moduleId)).toBe(false);
      expect(fabricationMarker.test(manifest.toolName)).toBe(false);
    }

    for (const fabricatedId of [
      "mock.external_exposure",
      "mock.github_secret_scan",
      "mock.cloud_posture",
      "mock.ai_app_validation",
      "mock.control_validation",
      "fixture.fix_verification",
      "fake.fix_verification"
    ]) {
      expect(getModuleById(fabricatedId)).toBeNull();
    }
  });
});

describe("validation provenance — compare module is not fix-evidence", () => {
  it("the periscan.fix_verification.compare module yields no signals and reports Inconclusive", async () => {
    const compareModule = getModuleById("periscan.fix_verification.compare");
    expect(compareModule).not.toBeNull();

    const context = ModuleExecutionContextSchema.parse({
      integrationIds: [],
      inputs: {},
      missionId: randomUUID(),
      policyDecisionId: null,
      runId: randomUUID(),
      runnerId: null,
      safetyLevel: "PassiveReadOnly",
      scopeId: randomUUID(),
      target: {
        previousPathName: "Repo secret to cloud role",
        previousValidationState: "Exploitable",
        remediationId: randomUUID(),
        relatedPathId: randomUUID(),
        scopedSignalCount: 0,
        selectedModuleIds: ["periscan.fix_verification.compare"]
      },
      tenantId: randomUUID()
    });

    const output = await executeModuleById(
      "periscan.fix_verification.compare",
      context
    );

    // The compare module runs no test: it only documents inputs. It must never
    // be treated as evidence that an exposure was fixed.
    expect(output.signals).toEqual([]);
    expect(output.validationState).toBe("Inconclusive");
  });
});
