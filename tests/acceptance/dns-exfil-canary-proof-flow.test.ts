import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * Swarm S2 — DNS-exfil detection canary product path.
 *
 * POST /control-sources/:id/dns-exfil-canary-proof
 * Honesty: benign_marker_only, realDataExfiltrated:false, measured:false when
 * mock/fixture telemetry (no live emit+telemetry). Never real bulk exfil.
 */
describe("dns-exfil canary proof acceptance", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "dns-canary-a",
        "dns-canary-b"
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

  it("runs canary with measured:false without live telemetry and refuses non-allowlisted / cross-tenant", async () => {
    const app = await buildTestApp();

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "dns-canary-a",
        "DNS Canary Tenant A"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const auth = testHelpers.authHeaders(cookie);

      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId }
      });

      const hostname = `dns-canary-${randomUUID()}.example.com`;
      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: hostname
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

      // Lab path: mock DNS-monitor observation. No live emit → measured:false.
      const proof = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          injectMockObservation: true,
          markerId: "periscan-dns-acc-1",
          scopeId,
          techniqueId: "T1048"
        },
        url: `/api/v1/control-sources/${controlSourceId}/dns-exfil-canary-proof`
      });
      expect(proof.statusCode).toBe(200);
      const body = proof.json();
      expect(body.exfilClaimClass).toBe("benign_marker_only");
      expect(body.realDataExfiltrated).toBe(false);
      expect(body.fullExfilLibrary).toBe(false);
      // Honesty: mock/fixture observe is not liveTelemetry → measured false.
      expect(body.measured).toBe(false);
      expect(body.markerId).toBe("periscan-dns-acc-1");
      expect(body.canaryLabel).toMatch(/periscan-dns-acc-1/);
      expect(body.canaryFqdn).toContain(hostname);
      expect(body.outcome).toMatch(/dns_exfil/i);
      expect(body.summary).toMatch(/benign|no real data|canary/i);
      expect(body.summary).not.toMatch(/bulk exfil|real data exfiltrated: true/i);
      expect(body.mission?.missionType).toBe("ControlValidation");
      expect(Array.isArray(body.runs)).toBe(true);
      expect(body.runs.length).toBeGreaterThanOrEqual(1);
      expect(body.runs[0].moduleId).toBe("periscan.dns_exfil_canary");
      expect(body.validationState).not.toBe("Exploitable");
      expect(body.validationState).not.toBe("Validated");

      // Audit stamps product path + honesty pins.
      const audits = await prisma.auditEvent.findMany({
        where: {
          // DB enum uses underscores; API write path maps module.executed → module_executed
          action: "module_executed",
          tenantId
        },
        orderBy: { createdAt: "desc" },
        take: 5
      });
      const canaryAudit = audits.find((event) => {
        const meta = event.metadata as Record<string, unknown> | null;
        return meta?.productPath === "dns_exfil_canary_proof";
      });
      expect(canaryAudit).toBeTruthy();
      expect(canaryAudit?.metadata).toMatchObject({
        exfilClaimClass: "benign_marker_only",
        fullExfilLibrary: false,
        measured: false,
        moduleId: "periscan.dns_exfil_canary",
        productPath: "dns_exfil_canary_proof",
        realDataExfiltrated: false
      });

      // fixtureMode without inventing live measured claim.
      const fixtureOnly = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          fixtureMode: true,
          injectMockObservation: true,
          markerId: "periscan-dns-fixture-1",
          scopeId,
          techniqueId: "T1048"
        },
        url: `/api/v1/control-sources/${controlSourceId}/dns-exfil-canary-proof`
      });
      expect(fixtureOnly.statusCode).toBe(200);
      const fixtureBody = fixtureOnly.json();
      expect(fixtureBody.exfilClaimClass).toBe("benign_marker_only");
      expect(fixtureBody.realDataExfiltrated).toBe(false);
      expect(fixtureBody.measured).toBe(false);
      expect(fixtureBody.fullExfilLibrary).toBe(false);

      // Non-allowlisted marker refused.
      const refused = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          markerId: "real-exfil-payload.bin",
          scopeId
        },
        url: `/api/v1/control-sources/${controlSourceId}/dns-exfil-canary-proof`
      });
      expect(refused.statusCode).toBe(400);
      const refusedText = JSON.stringify(refused.json());
      expect(refusedText).toMatch(
        /validation_error|allowlist|dns_exfil_marker_not_allowlisted|periscan|regex|Invalid/i
      );
      expect(refusedText).not.toMatch(/realDataExfiltrated":true/);

      // Cross-tenant isolation.
      const tenantB = await testHelpers.performSignup(
        app,
        "dns-canary-b",
        "DNS Canary Tenant B"
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
          markerId: "periscan-dns-cross-tenant"
        },
        url: `/api/v1/control-sources/${controlSourceId}/dns-exfil-canary-proof`
      });
      expect(crossTenant.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  }, 60_000);
});
