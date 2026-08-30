import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * Slice 10 release-qual — Detection Rule Validation (matrix row 8 residual).
 *
 * Product path: POST /control-sources/:id/detection-marker-proof
 * Closes a single allowlisted benign-marker emit→observe loop with mock SIEM
 * events. Asserts honesty: benign_marker_only, never full ATT&CK BAS library,
 * cross-tenant control sources invisible, non-allowlisted markers refused.
 *
 * Does NOT claim Fully-E2E DRV / full Sigma library / Atomic live inject.
 */
describe("detection marker proof (DRV emit→observe) acceptance", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "drv-marker-a",
        "drv-marker-b"
      ]);
      await prisma.$disconnect();
    }
  });

  async function buildTestApp() {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    return buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma,
        webhookQueue: null
      })
    });
  }

  it("closes benign-marker emit→observe and refuses non-allowlisted / cross-tenant use", async () => {
    const app = await buildTestApp();

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "drv-marker-a",
        "DRV Marker Tenant A"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const auth = testHelpers.authHeaders(cookie);

      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId }
      });

      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `drv-marker-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      const verified = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verified.statusCode).toBe(200);

      const integration = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          connectorKey: "splunk",
          fixtureOutcome: "Logged",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });
      expect(integration.statusCode).toBe(201);

      const controlSource = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          controlType: "SIEM",
          expectedBehaviors: ["Detected", "Logged"],
          integrationId: integration.json().integrationId,
          provider: "Splunk"
        },
        url: "/api/v1/control-sources"
      });
      expect(controlSource.statusCode).toBe(201);
      const controlSourceId = controlSource.json()
        .controlSourceId as string;

      // Closed-loop path: real local process emit (not fixtureMode planned-only)
      // + mock SIEM observation. fixtureMode=true intentionally never mints emit
      // receipts (honesty: planned command only).
      const platform = process.platform === "darwin" ? "macOS" : "Linux";
      const proof = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          injectMockObservation: true,
          markerId: "periscan-drv-acc-1",
          performEmit: true,
          platform,
          scopeId,
          techniqueId: "T1059"
        },
        url: `/api/v1/control-sources/${controlSourceId}/detection-marker-proof`
      });
      expect(proof.statusCode).toBe(200);
      const body = proof.json();
      expect(body.closedLoop).toBe(true);
      expect(body.drvClaimClass).toBe("benign_marker_only");
      expect(body.fullAttackLibrary).toBe(false);
      expect(body.markerId).toBe("periscan-drv-acc-1");
      expect(body.outcome).toBe("detection_marker_emit_observe_detected");
      expect(body.summary).toMatch(/benign-marker|Closed|not full ATT&CK BAS/i);
      expect(body.summary).not.toMatch(/full BAS|Atomic live|ransomware/i);
      expect(body.mission?.missionType).toBe("ControlValidation");
      expect(Array.isArray(body.runs)).toBe(true);
      expect(body.runs.length).toBeGreaterThanOrEqual(1);
      expect(body.runs[0].moduleId).toBe(
        "periscan.detection_marker_emit_observe"
      );
      // Marker-class Detected is the honest closed-loop state; never Exploitable.
      expect(body.validationState).toBe("Detected");
      expect(body.validationState).not.toBe("Exploitable");
      expect(body.validationState).not.toBe("Validated");

      // Evidence + audit pin claim class for Controls UI → API → ledger path.
      expect(Array.isArray(body.mission?.evidenceIds)).toBe(true);
      expect((body.mission?.evidenceIds ?? []).length).toBeGreaterThanOrEqual(1);
      const markerAudits = await prisma.auditEvent.findMany({
        where: {
          // DB enum uses underscores; API write path maps module.executed → module_executed
          action: "module_executed",
          tenantId
        },
        orderBy: { createdAt: "desc" },
        take: 8
      });
      const markerAudit = markerAudits.find((event) => {
        const meta = event.metadata as Record<string, unknown> | null;
        return meta?.productPath === "detection_marker_proof";
      });
      expect(markerAudit).toBeTruthy();
      expect(markerAudit?.metadata).toMatchObject({
        drvClaimClass: "benign_marker_only",
        fullAttackLibrary: false,
        markerId: "periscan-drv-acc-1",
        moduleId: "periscan.detection_marker_emit_observe",
        productPath: "detection_marker_proof"
      });
      const artifacts = await prisma.evidenceArtifact.findMany({
        where: {
          tenantId,
          relatedEntityType: "ValidationRun",
          relatedEntityId: body.runs[0].runId as string
        }
      });
      expect(artifacts.length).toBeGreaterThanOrEqual(1);

      // fixtureMode plans only — partial/correlation path, never pretends closed emit.
      const fixtureOnly = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          fixtureMode: true,
          injectMockObservation: true,
          markerId: "periscan-drv-fixture-1",
          performEmit: true,
          scopeId,
          techniqueId: "T1059"
        },
        url: `/api/v1/control-sources/${controlSourceId}/detection-marker-proof`
      });
      expect(fixtureOnly.statusCode).toBe(200);
      const fixtureBody = fixtureOnly.json();
      expect(fixtureBody.drvClaimClass).toBe("benign_marker_only");
      expect(fixtureBody.fullAttackLibrary).toBe(false);
      // fixtureMode does not mint emit receipts → not a closed emit→observe.
      expect(fixtureBody.closedLoop).toBe(false);
      expect(fixtureBody.outcome).toMatch(
        /without_emit|incomplete|inconclusive|correlated/i
      );

      // Non-allowlisted marker ids are refused at request schema (Zod) or service.
      const refused = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          markerId: "malware-sample.exe",
          scopeId
        },
        url: `/api/v1/control-sources/${controlSourceId}/detection-marker-proof`
      });
      expect(refused.statusCode).toBe(400);
      // Schema rejects bad marker shape before service; body may be validation_error
      // or detection_marker_not_allowlisted depending on path.
      const refusedText = JSON.stringify(refused.json());
      expect(refusedText).toMatch(
        /validation_error|allowlist|detection_marker_not_allowlisted|periscan|regex|Invalid/i
      );
      expect(refusedText).not.toMatch(/closedLoop":true/);

      // Tenant B cannot run marker proof against tenant A's control source.
      const tenantB = await testHelpers.performSignup(
        app,
        "drv-marker-b",
        "DRV Marker Tenant B"
      );
      const authB = testHelpers.authHeaders(tenantB.cookie);
      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId: tenantB.response.json().tenant.tenantId }
      });
      const crossTenant = await app.inject({
        cookies: authB,
        method: "POST",
        payload: {
          fixtureMode: true,
          injectMockObservation: true,
          markerId: "periscan-drv-cross-tenant"
        },
        url: `/api/v1/control-sources/${controlSourceId}/detection-marker-proof`
      });
      expect(crossTenant.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  }, 60_000);
});
