import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createAllowlistedDetectionMarkerId,
  executeModuleById,
  isAllowlistedDetectionMarkerId,
  runDetectionMarkerEmitObserveLoop
} from "@periscan/modules";

// Mirror apps/api DetectionMarkerProofInputSchema without importing the full app
// graph (avoids Prisma bootstrap in this focused unit suite).
const DetectionMarkerProofInputSchema = z.object({
  expectedRule: z.string().min(1).optional(),
  fixtureMode: z.boolean().optional(),
  injectMockObservation: z.boolean().optional(),
  markerId: z
    .string()
    .min(8)
    .max(128)
    .regex(/^periscan-[A-Za-z0-9._:-]{4,120}$/u)
    .optional(),
  observedEvents: z
    .array(z.union([z.string(), z.record(z.string(), z.unknown())]))
    .optional(),
  performEmit: z.boolean().optional(),
  platform: z.enum(["macOS", "Linux"]).optional(),
  platformAnalytics: z.enum(["macOS", "Linux"]).optional(),
  scopeId: z.string().uuid().optional(),
  techniqueId: z.string().min(1).optional()
});

describe("Wave B detection marker proof (API contracts)", () => {
  it("accepts only allowlisted marker ids on the request schema", () => {
    expect(
      DetectionMarkerProofInputSchema.parse({
        markerId: "periscan-api-contract-1",
        techniqueId: "T1059"
      }).markerId
    ).toBe("periscan-api-contract-1");

    expect(() =>
      DetectionMarkerProofInputSchema.parse({
        markerId: "malware-sample.exe"
      })
    ).toThrow();
  });

  it("closes emit→observe with mock SIEM events the API would inject", async () => {
    const platform = process.platform === "darwin" ? "macOS" : "Linux";
    const markerId = createAllowlistedDetectionMarkerId("api-mock-siem");
    expect(isAllowlistedDetectionMarkerId(markerId)).toBe(true);

    // Mirrors apps/api runDetectionMarkerProof mock observation injection.
    const observedEvents = [
      {
        event: "process_create",
        markerId,
        message: `Periscan mock SIEM correlated allowlisted detection marker ${markerId}`,
        techniqueId: "T1059"
      }
    ];

    const loop = await runDetectionMarkerEmitObserveLoop({
      liveTelemetry: true,
      markerId,
      observedEvents,
      performEmit: true,
      platform,
      techniqueId: "T1059",
      telemetryWindowComplete: true
    });

    expect(loop.closedLoop).toBe(true);
    expect(loop.validationState).toBe("Detected");
    expect(loop.outcome).toBe("detection_marker_emit_observe_detected");
    expect(loop.evidenceAttributes.drvClaimClass).toBe("benign_marker_only");
    expect(loop.evidenceAttributes.fullAttackLibrary).toBe(false);
  });

  it("module path used by control-ai produces a single evidence chain", async () => {
    const platform = process.platform === "darwin" ? "macOS" : "Linux";
    const markerId = "periscan-control-ai-path-1";
    const output = await executeModuleById(
      "periscan.detection_marker_emit_observe",
      {
        integrationIds: [],
        inputs: {},
        missionId: "00000000-0000-4000-8000-000000000001",
        policyDecisionId: null,
        runId: "00000000-0000-4000-8000-000000000002",
        runnerId: null,
        safetyLevel: "ActiveNonInvasive",
        scopeId: "00000000-0000-4000-8000-000000000003",
        target: {
          injectMockObservation: true,
          liveTelemetry: true,
          markerId,
          observedEvents: [
            `mock SIEM: detection rule fired for ${markerId}`
          ],
          performEmit: true,
          platform,
          techniqueId: "T1059"
        },
        tenantId: "00000000-0000-4000-8000-000000000004"
      }
    );

    expect(output.validationState).toBe("Detected");
    expect(output.evidence).toHaveLength(1);
    expect(output.evidence[0]?.attributes).toMatchObject({
      closedLoop: true,
      productPath: "detection_marker_emit_observe",
      realMalware: false
    });
  });
});
