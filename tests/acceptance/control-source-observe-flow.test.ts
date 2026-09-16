import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * Swarm S2 — SCV control-source observe (pull path).
 *
 * POST /control-sources/:id/validate with DryRun:
 *   - Calls connector.observeControl, correlates MITRE technique, no inject.
 * LiveRunner / dryRun:false:
 *   - Hard refuse control_live_execution_disabled with clear operator message.
 *
 * Does NOT enable Atomic/Caldera/ransomware/live inject.
 */
describe("control-source SCV observe (pull path) acceptance", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["scv-observe"]);
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

  it("observes technique via SIEM pull without inject and refuses live inject clearly", async () => {
    const app = await buildTestApp();

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "scv-observe",
        "SCV Observe Tenant"
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
          value: `scv-observe-${randomUUID()}.example.com`
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

      // SCV pull: DryRun observeControl correlates technique without inject.
      const observed = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          dryRun: true,
          executionMode: "DryRun",
          fixtureOutcome: "Logged",
          techniqueId: "T1059"
        },
        url: `/api/v1/control-sources/${controlSourceId}/validate`
      });
      expect(observed.statusCode).toBe(200);
      const observedBody = observed.json();
      expect(observedBody.run).toMatchObject({
        moduleId: "atomic.control_validation_safe"
      });
      expect(observedBody.run.target).toMatchObject({
        dryRun: true,
        executionMode: "DryRun",
        injectLoopAvailable: false,
        observationMode: "telemetry_only"
      });
      expect(String(observedBody.run.target.observationNote ?? "")).toMatch(
        /telemetry-only|Inject loop not available/i
      );
      expect(observedBody.run.target).not.toMatchObject({
        injectLoopAvailable: true
      });
      // Observer signal from connector.observeControl (mock SIEM).
      expect(Array.isArray(observedBody.signals)).toBe(true);
      expect(observedBody.signals.length).toBeGreaterThanOrEqual(1);
      const controlSignal = observedBody.signals.find(
        (signal: { signalCategory?: string }) =>
          signal.signalCategory === "ControlObservation"
      );
      expect(controlSignal).toBeTruthy();
      expect(controlSignal.signalSubcategory).toBe("Logged");
      expect(String(controlSignal.sourceType ?? "")).toMatch(
        /splunk|observer/i
      );
      expect(observedBody.attackTechniques?.[0]).toMatchObject({
        techniqueId: "T1059"
      });
      // Never claim closed inject-measure or live BAS.
      const runText = JSON.stringify(observedBody.run);
      expect(runText).not.toMatch(/live inject BAS|closed inject.?measure loop completed/i);
      expect(observedBody.run.validationState).not.toBe("Exploitable");

      // Live inject hard-disabled with clear operator-facing code + message.
      const liveDenied = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          dryRun: false,
          executionMode: "LiveRunner",
          techniqueId: "T1059"
        },
        url: `/api/v1/control-sources/${controlSourceId}/validate`
      });
      expect(liveDenied.statusCode).toBe(400);
      expect(liveDenied.json().code).toBe("control_live_execution_disabled");
      expect(liveDenied.json().error).toContain("Inject loop not available");
      expect(liveDenied.json().error).toContain(
        "control_live_execution_disabled"
      );
      expect(liveDenied.json().error).toMatch(
        /telemetry-only observation|DryRun|Observe telemetry/i
      );
      expect(liveDenied.json().error).toMatch(
        /not live inject BAS|Atomic remains dry-run/i
      );
      // Wave D SOW is not an enablement path in product.
      expect(liveDenied.json().error).toMatch(/signed SOW|dual gates/i);
      expect(liveDenied.json().error).not.toMatch(
        /enabled|use LiveRunner to inject/i
      );

      // dryRun:false alone (without LiveRunner) also refuses.
      const dryRunFalse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          dryRun: false,
          techniqueId: "T1059"
        },
        url: `/api/v1/control-sources/${controlSourceId}/validate`
      });
      expect(dryRunFalse.statusCode).toBe(400);
      expect(dryRunFalse.json().code).toBe("control_live_execution_disabled");

      // No queued live inject mission after refuses.
      const liveMissions = await prisma.validationMission.count({
        where: {
          tenantId,
          status: { in: ["Queued", "Running"] }
        }
      });
      // Completed DryRun mission is fine; nothing should stay queued for inject.
      expect(liveMissions).toBe(0);
    } finally {
      await app.close();
    }
  }, 60_000);
});
