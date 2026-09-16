/**
 * Continuous loop Slice D — Dynamic paths (23), SCV (6), White-Label (97),
 * Free trials (94), Assessment licensing (92).
 *
 * Proves:
 *  1. List recommendations API + apply → Draft (never auto-queue)
 *  2. SCV pull observe + rule-coverage report; inject remains disabled
 *  3. White-label branding (org name / color / footer) on report HTML
 *  4. Honest NotConfigured payment + short-term assessment pack catalog
 *
 * Forbidden: SCV Strong while inject off; invent payments.
 * Scorecard JSON is not edited by this suite.
 */
import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const PREFIX = "slice-d";

describe("Slice D — dynamic recommendations, SCV coverage, WL, commercial", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        PREFIX,
        `${PREFIX}-wl`,
        `${PREFIX}-scv`,
        `${PREFIX}-comm`,
        `${PREFIX}-rec`
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

  it("lists recommendations API and applies path next-mission as Draft only (id 23 ops)", async () => {
    const app = await buildTestApp();

    try {
      const { cookie, response: signup } = await testHelpers.performSignup(
        app,
        `${PREFIX}-rec`,
        "Slice D Recommendations Tenant"
      );
      const auth = testHelpers.authHeaders(cookie);
      const tenantId = signup.json().tenant.tenantId as string;

      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `slice-d-rec-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      expect(
        (
          await app.inject({
            cookies: auth,
            method: "POST",
            payload: { devModeManual: true },
            url: `/api/v1/scopes/${scopeId}/verify`
          })
        ).statusCode
      ).toBe(200);

      for (const connector of ["github", "aws"] as const) {
        const connected = await app.inject({
          cookies: auth,
          method: "POST",
          payload: { mockMode: true },
          url: `/api/v1/integrations/${connector}/connect`
        });
        expect(connected.statusCode).toBe(201);
        const sync = await app.inject({
          cookies: auth,
          method: "POST",
          url: `/api/v1/integrations/${connected.json().integrationId}/sync`
        });
        expect(sync.statusCode).toBe(200);
      }

      const pathsResponse = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      expect(pathsResponse.statusCode).toBe(200);
      const paths = pathsResponse.json().items as Array<{
        attackPath: { pathId: string };
      }>;
      expect(paths.length).toBeGreaterThan(0);
      const pathId = paths[0]!.attackPath.pathId;

      const nextResponse = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/next-mission`
      });
      expect(nextResponse.statusCode).toBe(200);
      const recommendation = nextResponse.json().recommendation as {
        recommendationId: string;
        kind: string;
        status: string;
      } | null;
      expect(recommendation).not.toBeNull();
      expect(recommendation!.kind).toBe("DynamicPathNextMission");

      // List recommendations APIs — generated operator recs + durable records.
      const listGenerated = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/operator-recommendations"
      });
      expect(listGenerated.statusCode).toBe(200);
      expect(Array.isArray(listGenerated.json().items)).toBe(true);

      const listRecords = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/operators/recommendations"
      });
      expect(listRecords.statusCode).toBe(200);
      const records = listRecords.json().items as Array<{
        status: string;
        payload: { recommendationId?: string; kind?: string };
      }>;
      expect(records.length).toBeGreaterThan(0);
      const pathRecord = records.find(
        (row) =>
          row.payload?.recommendationId === recommendation!.recommendationId ||
          row.payload?.kind === "DynamicPathNextMission"
      );
      expect(pathRecord).toBeTruthy();
      expect(pathRecord!.status).toBe("Proposed");

      const approve = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/attack-paths/${pathId}/next-mission/approve`
      });
      expect(approve.statusCode).toBe(201);
      const approved = approve.json() as {
        queued: boolean;
        mission: { missionId: string; status: string };
        recommendation: { status: string };
      };
      expect(approved.queued).toBe(false);
      expect(approved.mission.status).toBe("Draft");
      expect(approved.recommendation.status).toBe("Approved");

      const missionRow = await prisma.validationMission.findUniqueOrThrow({
        where: { missionId: approved.mission.missionId }
      });
      expect(missionRow.status).toBe("Draft");
      expect(missionRow.tenantId).toBe(tenantId);

      const queuedCount = await prisma.validationMission.count({
        where: {
          tenantId,
          status: { in: ["Queued", "Running"] }
        }
      });
      expect(queuedCount).toBe(0);
    } finally {
      await app.close();
    }
  }, 120_000);

  it("SCV pull observe feeds rule coverage and keeps inject disabled (id 6 Partial)", async () => {
    const app = await buildTestApp();

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        `${PREFIX}-scv`,
        "Slice D SCV Tenant"
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
          value: `slice-d-scv-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      expect(
        (
          await app.inject({
            cookies: auth,
            method: "POST",
            payload: { devModeManual: true },
            url: `/api/v1/scopes/${scopeId}/verify`
          })
        ).statusCode
      ).toBe(200);

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
      const controlSourceId = controlSource.json().controlSourceId as string;

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
      expect(observedBody.run.target).toMatchObject({
        dryRun: true,
        executionMode: "DryRun",
        injectLoopAvailable: false,
        observationMode: "telemetry_only"
      });
      expect(observedBody.run.target.injectLoopAvailable).not.toBe(true);

      // Aggregate + per-source coverage report APIs after pull observe.
      const aggregate = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/control-sources/rule-coverage"
      });
      expect(aggregate.statusCode).toBe(200);
      const coverage = aggregate.json() as {
        items: Array<{ techniqueId: string; status: string }>;
        totalTechniques: number;
        recommendations: string[];
      };
      expect(coverage.totalTechniques).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(coverage.items)).toBe(true);
      expect(Array.isArray(coverage.recommendations)).toBe(true);
      // Coverage text must not invent closed inject→measure Strong claims.
      const coverageText = JSON.stringify(coverage);
      expect(coverageText).not.toMatch(
        /closed inject.?measure|live inject BAS|Strong SCV/i
      );

      const perSource = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/control-sources/${controlSourceId}/rule-coverage`
      });
      expect(perSource.statusCode).toBe(200);
      const sourceCoverage = perSource.json() as {
        controlSourceId?: string;
        items: unknown[];
      };
      expect(Array.isArray(sourceCoverage.items)).toBe(true);

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
      expect(liveDenied.json().error).toMatch(/Inject loop not available/i);

      // Honesty ceiling: inject remains off → cannot claim Strong SCV.
      expect(observedBody.run.target.injectLoopAvailable).toBe(false);
      expect(JSON.stringify(observedBody)).not.toMatch(
        /SCV Strong|closed inject.?measure loop completed/i
      );
    } finally {
      await app.close();
    }
  }, 90_000);

  it("white-label branding renders org name, primary color, and footer on report HTML (id 97)", async () => {
    const app = await buildTestApp();

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        `${PREFIX}-wl`,
        "Slice D White Label Tenant"
      );
      const auth = testHelpers.authHeaders(cookie);

      await prisma.tenant.update({
        where: {
          tenantId: (
            await app.inject({
              cookies: auth,
              method: "GET",
              url: "/api/v1/tenants/current"
            })
          ).json().tenant.tenantId as string
        },
        data: { billingPackageKey: "ValidationSnapshot" }
      });

      const brandingResponse = await app.inject({
        cookies: auth,
        method: "PUT",
        payload: {
          logoUrl: "https://assets.periscan.test/slice-d-partner.svg",
          organizationName: "Slice D Partner Advisory",
          primaryColor: "#0F766E",
          reportFooter: "Prepared by Slice D Partner Advisory for the client.",
          supportEmail: "security@slice-d-partner.test",
          whiteLabelEnabled: true
        },
        url: "/api/v1/tenants/current/branding"
      });
      expect(brandingResponse.statusCode).toBe(200);
      expect(brandingResponse.json()).toMatchObject({
        organizationName: "Slice D Partner Advisory",
        primaryColor: "#0F766E",
        reportFooter: "Prepared by Slice D Partner Advisory for the client.",
        whiteLabelEnabled: true
      });

      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `slice-d-wl-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      expect(
        (
          await app.inject({
            cookies: auth,
            method: "POST",
            payload: { devModeManual: true },
            url: `/api/v1/scopes/${scope.json().scopeId}/verify`
          })
        ).statusCode
      ).toBe(200);

      const snapshot = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { audience: "MSSP Client" },
        url: "/api/v1/snapshots"
      });
      expect(snapshot.statusCode).toBe(201);

      const exported = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/snapshots/${snapshot.json().snapshotId}/export`
      });
      expect(exported.statusCode).toBe(200);
      const html = exported.body;
      expect(html).toContain("Slice D Partner Advisory");
      expect(html).toContain(
        "Prepared by Slice D Partner Advisory for the client."
      );
      expect(html).toContain("--accent: #0F766E");
      expect(html).toContain("security@slice-d-partner.test");
      // Evidence content is not rewritten by white-label branding.
      expect(html).not.toMatch(/fabricated payment|card checkout complete/i);
    } finally {
      await app.close();
    }
  }, 90_000);

  it("free trial + assessment pack catalog stay payment-processor NotConfigured (ids 94/92)", async () => {
    const app = await buildTestApp();

    try {
      const { cookie, response: signup } = await testHelpers.performSignup(
        app,
        `${PREFIX}-comm`,
        "Slice D Commercial Tenant"
      );
      const auth = testHelpers.authHeaders(cookie);
      const tenantId = signup.json().tenant.tenantId as string;

      const packages = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/billing/packages"
      });
      expect(packages.statusCode).toBe(200);
      const items = packages.json().items as Array<{
        packageKey: string;
        paymentProcessorStatus: string;
        includedCapabilities: string[];
        includedMeterNames: string[];
        label: string;
      }>;
      expect(items.length).toBeGreaterThan(0);
      for (const pkg of items) {
        expect(pkg.paymentProcessorStatus).toBe("NotConfigured");
      }

      const assessmentPacks = items.filter(
        (pkg) =>
          pkg.includedMeterNames.includes("ShortTermAssessments") ||
          pkg.includedCapabilities.some((cap) =>
            /short-term assessment/i.test(cap)
          )
      );
      expect(assessmentPacks.length).toBeGreaterThan(0);
      expect(
        assessmentPacks.some((pkg) =>
          ["MSSPPartner", "Enterprise"].includes(pkg.packageKey)
        )
      ).toBe(true);
      // Catalog is real entitlement metadata — not a public rate card / card checkout.
      expect(JSON.stringify(assessmentPacks)).toMatch(
        /ShortTermAssessments|short-term assessment/i
      );
      expect(JSON.stringify(items)).not.toMatch(
        /stripe|card checkout ready|self-serve purchase complete/i
      );

      const active = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/billing/active-package"
      });
      expect(active.statusCode).toBe(200);
      expect(active.json().paymentProcessorStatus).toBe("NotConfigured");

      const trialStart = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          agreementAccepted: true,
          durationDays: 7,
          retentionDays: 21
        },
        url: "/api/v1/billing/trial/start"
      });
      expect(trialStart.statusCode).toBe(201);
      expect(trialStart.json()).toMatchObject({
        status: "Active",
        entitlementPackageKey: "Enterprise"
      });
      expect(JSON.stringify(trialStart.json())).not.toMatch(
        /payment processor used|card charged|stripe/i
      );

      const trialGet = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/billing/trial"
      });
      expect(trialGet.statusCode).toBe(200);
      expect(trialGet.json().status).toBe("Active");

      const convert = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          approvalReference: "slice-d-order-form-2026-08-02",
          packageKey: "MSSPPartner"
        },
        url: "/api/v1/billing/trial/convert"
      });
      expect(convert.statusCode).toBe(200);
      expect(convert.json()).toMatchObject({
        status: "Converted",
        conversionApprovalReference: "slice-d-order-form-2026-08-02"
      });

      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: { action: "trial_converted", tenantId }
      });
      expect(audit.metadata).toMatchObject({ paymentProcessorUsed: false });

      const postConvertActive = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/billing/active-package"
      });
      expect(postConvertActive.statusCode).toBe(200);
      expect(postConvertActive.json()).toMatchObject({
        packageKey: "MSSPPartner",
        paymentProcessorStatus: "NotConfigured"
      });
      expect(
        (postConvertActive.json().includedMeterNames as string[]).includes(
          "ShortTermAssessments"
        )
      ).toBe(true);
    } finally {
      await app.close();
    }
  }, 90_000);
});
