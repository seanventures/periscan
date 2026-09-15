import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * Continuous loop Slice B — Dynamic Attack Paths (scorecard id 23)
 * + choke honesty residual (scorecard id 4).
 *
 * Proves signal/hop-driven "next recommended mission" over real API + Postgres:
 * 1. Correlated multi-hop path yields a DynamicPathNextMission recommendation.
 * 2. Recommendation always requires human approval and is persisted.
 * 3. Approve creates a Draft mission only (queued=false) — never auto-queue.
 * 4. Honesty notes deny autonomous replan / full-BAS claims.
 * 5. Choke-points methodology remains GreedyHittingSetApproximation with
 *    explicit non-min-cut language (score stays &lt; 4 without real solver).
 */

const EMAIL_PREFIX = "slice-b-dynpath";

describe("dynamic path next mission (Slice B / id 23)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        EMAIL_PREFIX,
        `${EMAIL_PREFIX}-choke`
      ]);
      await prisma.$disconnect();
    }
  });

  it("generates, persists, and human-approves a path next mission without auto-queue", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma
      })
    });

    try {
      const { cookie, response: signup } = await testHelpers.performSignup(
        app,
        EMAIL_PREFIX,
        `${EMAIL_PREFIX} Tenant`
      );
      const auth = testHelpers.authHeaders(cookie);
      const tenantId = signup.json().tenant.tenantId as string;

      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `slice-b-dynpath-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verifyResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verifyResponse.statusCode).toBe(200);

      const github = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { mockMode: true },
        url: "/api/v1/integrations/github/connect"
      });
      expect(github.statusCode).toBe(201);
      const aws = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { mockMode: true },
        url: "/api/v1/integrations/aws/connect"
      });
      expect(aws.statusCode).toBe(201);

      for (const integrationId of [
        github.json().integrationId as string,
        aws.json().integrationId as string
      ]) {
        const sync = await app.inject({
          cookies: auth,
          method: "POST",
          url: `/api/v1/integrations/${integrationId}/sync`
        });
        expect(sync.statusCode).toBe(200);
        expect(sync.json().signalCount).toBeGreaterThan(0);
      }

      const pathsResponse = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      expect(pathsResponse.statusCode).toBe(200);
      const paths = pathsResponse.json().items as Array<{
        attackPath: { pathId: string; evidenceIds: string[]; name: string };
      }>;
      expect(paths.length).toBeGreaterThan(0);

      const multiHop =
        paths.find((item) => item.attackPath.evidenceIds.length > 0) ??
        paths[0]!;
      const pathId = multiHop.attackPath.pathId;

      const nextResponse = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/next-mission`
      });
      expect(nextResponse.statusCode).toBe(200);
      const nextBody = nextResponse.json() as {
        recommendation: {
          approvalRequired: true;
          drivers: string[];
          honestyNotes: string[];
          kind: string;
          missionPlan: { approvalRequired: true; scopeId: string | null };
          recommendationId: string;
          status: string;
          title: string;
        } | null;
      };

      expect(nextBody.recommendation).not.toBeNull();
      const recommendation = nextBody.recommendation!;
      expect(recommendation.kind).toBe("DynamicPathNextMission");
      expect(recommendation.approvalRequired).toBe(true);
      expect(recommendation.missionPlan.approvalRequired).toBe(true);
      expect(recommendation.status).toBe("Proposed");
      expect(recommendation.missionPlan.scopeId).toBe(scopeId);
      expect(
        recommendation.honestyNotes.some((note) =>
          /not autonomous|never auto-queue|human approval/i.test(note)
        )
      ).toBe(true);
      expect(recommendation.drivers.length).toBeGreaterThan(0);

      const persisted = await prisma.operatorRecommendation.findFirst({
        where: {
          payload: {
            equals: recommendation.recommendationId,
            path: ["recommendationId"]
          },
          tenantId
        }
      });
      expect(persisted).not.toBeNull();
      expect(persisted!.status).toBe("Proposed");

      const approveResponse = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/attack-paths/${pathId}/next-mission/approve`
      });
      expect(
        approveResponse.statusCode,
        `approve body: ${approveResponse.body}`
      ).toBe(201);
      const approved = approveResponse.json() as {
        mission: { missionId: string; status: string };
        queued: boolean;
        recommendation: { status: string };
      };
      expect(approved.queued).toBe(false);
      expect(approved.recommendation.status).toBe("Approved");
      expect(approved.mission.status).toBe("Draft");
      expect(approved.mission.missionId).toBeTruthy();

      const after = await prisma.operatorRecommendation.findFirst({
        where: {
          payload: {
            equals: recommendation.recommendationId,
            path: ["recommendationId"]
          },
          tenantId
        }
      });
      expect(after?.status).toBe("Approved");

      const refetch = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/next-mission`
      });
      expect(refetch.statusCode).toBe(200);
      expect(refetch.json().recommendation?.status).toBe("Approved");
    } finally {
      await app.close();
    }
  }, 120_000);

  it("choke-points API stays greedy/evidence-weighted and never claims min-cut", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        `${EMAIL_PREFIX}-choke`,
        `${EMAIL_PREFIX}-choke Tenant`
      );
      const auth = testHelpers.authHeaders(cookie);

      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `slice-b-choke-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      const github = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { mockMode: true },
        url: "/api/v1/integrations/github/connect"
      });
      const aws = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { mockMode: true },
        url: "/api/v1/integrations/aws/connect"
      });
      for (const integrationId of [
        github.json().integrationId as string,
        aws.json().integrationId as string
      ]) {
        await app.inject({
          cookies: auth,
          method: "POST",
          url: `/api/v1/integrations/${integrationId}/sync`
        });
      }

      const choke = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths/choke-points"
      });
      expect(choke.statusCode).toBe(200);
      const body = choke.json() as {
        assumptions: string[];
        methodology: string;
        totalPaths: number;
      };
      expect(body.methodology).toBe("GreedyHittingSetApproximation");
      expect(
        body.assumptions.some((a) =>
          /not .*min-cut|not XM-class min-cut/i.test(a)
        )
      ).toBe(true);
      expect(body.assumptions.some((a) => /greedy/i.test(a))).toBe(true);
      expect(
        body.assumptions.some((a) =>
          /Partial until|do not market as Leading/i.test(a)
        )
      ).toBe(true);
      expect(body.methodology.toLowerCase()).not.toContain("mincut");
      expect(body.methodology.toLowerCase()).not.toContain("min-cut");
    } finally {
      await app.close();
    }
  }, 120_000);
});
