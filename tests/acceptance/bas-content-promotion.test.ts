import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import {
  createPrismaClient,
  runWithTenantRls
} from "../../packages/db/src/client.js";
import {
  BasContentVersionSchema,
  CompileBasCampaignResultSchema,
  OPENAPI_ROUTE,
  PromoteBasContentResultSchema,
  StartBasCampaignResultSchema
} from "../../packages/shared/src/index.js";
import * as helpers from "./helpers.js";

const versionsRoot = "/api/v1/bas/content/versions";
const prefix = `bas-promote-${randomUUID()}`;
const enqueueValidationJob = vi.fn(async () => {});
const enqueueTurn = vi.fn(async () => {});

function atomicContent(path = `atomics/T1082/${randomUUID()}.yaml`) {
  return {
    provider: "AtomicRedTeam",
    format: "json",
    sourceRevision: "promote-pin-1",
    sourcePath: path,
    content: JSON.stringify({
      attack_technique: "T1082",
      atomic_tests: [
        {
          auto_generated_guid: randomUUID(),
          name: "System metadata",
          supported_platforms: ["linux"],
          executor: { name: "sh", command: "PRIVATE_ATOMIC_COMMAND" }
        }
      ]
    })
  };
}

describe("BAS content review promotion with real Postgres", () => {
  let prisma: ReturnType<typeof createPrismaClient>;
  let app: FastifyInstance;
  let a: Awaited<ReturnType<typeof helpers.performSignup>>;
  let b: Awaited<ReturnType<typeof helpers.performSignup>>;
  let tenantA: string;
  let userA: string;
  let scopeId: string;
  const cookies = (user: typeof a) => helpers.authCookies(user.cookie);
  const register = (payload: ReturnType<typeof atomicContent>, user = a) =>
    app.inject({
      method: "POST",
      url: versionsRoot,
      cookies: cookies(user),
      payload
    });
  const promote = (
    id: string,
    payload: Record<string, unknown> = { reviewStatus: "Reviewed" },
    user = a
  ) =>
    app.inject({
      method: "POST",
      url: `${versionsRoot}/${id}/promote`,
      cookies: cookies(user),
      payload
    });

  beforeAll(async () => {
    prisma = createPrismaClient();
    await helpers.probeDatabaseConnection(prisma);
    const services = createRuntimeServices({
      prisma,
      dataRegion: "us-east-1",
      devMode: true,
      missionQueue: { enqueueValidationJob },
      modelGatewayTurnQueue: { enqueueTurn },
      webhookQueue: null
    });
    app = await buildApp({ services, devMode: true });
    a = await helpers.performSignup(app, `${prefix}-a`, `${prefix}-A`);
    b = await helpers.performSignup(app, `${prefix}-b`, `${prefix}-B`);
    tenantA = a.response.json().tenant.tenantId;
    userA = a.response.json().user.userId;
    const scope = await app.inject({
      cookies: cookies(a),
      method: "POST",
      payload: {
        scopeType: "Domain",
        value: `promote-${randomUUID()}.example.com`
      },
      url: "/api/v1/scopes"
    });
    expect(scope.statusCode).toBe(201);
    scopeId = scope.json().scopeId as string;
    const verified = await app.inject({
      cookies: cookies(a),
      method: "POST",
      payload: { devModeManual: true },
      url: `/api/v1/scopes/${scopeId}/verify`
    });
    expect(verified.statusCode).toBe(200);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    if (prisma) {
      await helpers.cleanupTestDataByEmailPrefix(prisma, [prefix]);
      await prisma.$disconnect();
    }
  }, 30_000);

  it("lets Owner/Admin promote Unreviewed content to Reviewed with an audit event", async () => {
    enqueueValidationJob.mockClear();
    const registered = await register(atomicContent());
    expect(registered.statusCode, registered.body).toBe(200);
    const unreviewed = BasContentVersionSchema.parse(registered.json().version);
    expect(unreviewed.reviewStatus ?? "Unreviewed").toBe("Unreviewed");
    expect(unreviewed.executable).toBe(false);

    const first = await promote(unreviewed.basContentVersionId);
    expect(first.statusCode, first.body).toBe(200);
    const promoted = PromoteBasContentResultSchema.parse(first.json());
    expect(promoted.created).toBe(true);
    expect(promoted.version).toMatchObject({
      basContentVersionId: unreviewed.basContentVersionId,
      executable: false,
      evidenceProduced: false,
      reviewStatus: "Reviewed",
      reviewedByUserId: userA
    });
    expect(promoted.version.reviewedAt).toEqual(expect.any(String));
    expect(promoted.version.preview.executable).toBe(false);
    expect(promoted.version.preview.scenarios[0]).toMatchObject({
      executable: false,
      reviewStatus: "Reviewed"
    });
    expect(first.body).not.toMatch(/PRIVATE_ATOMIC_COMMAND/);

    const replay = await promote(unreviewed.basContentVersionId);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ created: false, version: promoted.version });

    const audits = await prisma.auditEvent.findMany({
      where: {
        tenantId: tenantA,
        action: "bas_content_promoted",
        entityId: unreviewed.basContentVersionId
      }
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.metadata).toMatchObject({
      contentSha256: unreviewed.contentSha256,
      executable: false,
      liveSupported: false,
      reviewStatus: "Reviewed",
      startable: false
    });
    expect(enqueueValidationJob).not.toHaveBeenCalled();
    expect(enqueueTurn).not.toHaveBeenCalled();

    const listed = await app.inject({
      url: `${versionsRoot}?provider=AtomicRedTeam`,
      cookies: cookies(a)
    });
    expect(listed.statusCode).toBe(200);
    expect(
      listed
        .json()
        .items.find(
          (item: { basContentVersionId: string }) =>
            item.basContentVersionId === unreviewed.basContentVersionId
        )
    ).toMatchObject({
      executable: false,
      reviewStatus: "Reviewed"
    });
  });

  it("returns 404 across tenants and requires Owner/Admin reviewer role", async () => {
    const registered = await register(atomicContent());
    expect(registered.statusCode, registered.body).toBe(200);
    const id = registered.json().version.basContentVersionId as string;

    const foreign = await promote(id, { reviewStatus: "Reviewed" }, b);
    expect(foreign.statusCode).toBe(404);
    expect(
      await runWithTenantRls(prisma, b.response.json().tenant.tenantId, (tx) =>
        tx.basContentVersionReview.findMany({})
      )
    ).toEqual([]);

    expect(
      (
        await app.inject({
          method: "POST",
          url: `${versionsRoot}/${id}/promote`,
          payload: { reviewStatus: "Reviewed" }
        })
      ).statusCode
    ).toBe(401);

    const where = { tenantId_userId: { tenantId: tenantA, userId: userA } };
    await prisma.membership.update({ where, data: { role: "Viewer" } });
    try {
      const denied = await promote(id);
      expect(denied.statusCode).toBe(403);
      expect(denied.json().code).toBe("forbidden");
    } finally {
      await prisma.membership.update({ where, data: { role: "Owner" } });
    }

    await prisma.membership.update({
      where,
      data: { role: "SecurityEngineer" }
    });
    try {
      expect((await promote(id)).statusCode).toBe(403);
    } finally {
      await prisma.membership.update({ where, data: { role: "Owner" } });
    }

    expect((await promote(id)).statusCode).toBe(200);
    expect(
      (
        await promote(id, {
          reviewStatus: "Reviewed",
          executable: true,
          liveSupported: true,
          startable: true
        })
      ).statusCode
    ).toBe(400);

    const docs = (await app.inject({ url: OPENAPI_ROUTE })).json();
    expect(
      docs.paths[`${versionsRoot}/{id}/promote`].post.responses["200"]
    ).toBeDefined();
  });

  it("does not start unreviewed content and still cannot queue promoted live Atomic", async () => {
    enqueueValidationJob.mockClear();
    const jobsBefore = await prisma.job.count({ where: { tenantId: tenantA } });
    const unreviewedReg = await register(atomicContent());
    expect(unreviewedReg.statusCode, unreviewedReg.body).toBe(200);
    const unreviewed = unreviewedReg.json().version;
    const unreviewedCompile = CompileBasCampaignResultSchema.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/bas/campaigns/compile",
          cookies: cookies(a),
          payload: {
            scopeId,
            contentVersionIds: [unreviewed.basContentVersionId],
            scenarioPins: [
              {
                provider: "AtomicRedTeam",
                contentVersionId: unreviewed.basContentVersionId,
                contentSha256: unreviewed.contentSha256,
                upstreamId: unreviewed.preview.scenarios[0].upstreamId,
                typedInputs: { timeout: 30 }
              }
            ]
          }
        })
      ).json()
    );
    expect(unreviewedCompile.startable).toBe(false);
    expect(unreviewedCompile.queued).toBe(false);
    expect(unreviewedCompile.jobsQueued).toBe(0);
    expect(unreviewedCompile.denyReason).toMatch(/Unreviewed BAS content/i);
    const unreviewedStart = StartBasCampaignResultSchema.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/bas/campaigns/start",
          cookies: cookies(a),
          payload: { compiledDigest: unreviewedCompile.plan.compiledDigest }
        })
      ).json()
    );
    expect(unreviewedStart.queued).toBe(false);
    expect(unreviewedStart.jobsQueued).toBe(0);
    expect(unreviewedStart.mission).toBeNull();

    const liveReg = await register(atomicContent());
    expect(liveReg.statusCode, liveReg.body).toBe(200);
    const liveVersion = liveReg.json().version;
    const promoted = PromoteBasContentResultSchema.parse(
      (await promote(liveVersion.basContentVersionId)).json()
    );
    expect(promoted.version.reviewStatus).toBe("Reviewed");
    expect(promoted.version.executable).toBe(false);

    const liveCompile = CompileBasCampaignResultSchema.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/bas/campaigns/compile",
          cookies: cookies(a),
          payload: {
            scopeId,
            contentVersionIds: [liveVersion.basContentVersionId],
            scenarioPins: [
              {
                provider: "AtomicRedTeam",
                contentVersionId: liveVersion.basContentVersionId,
                contentSha256: liveVersion.contentSha256,
                upstreamId: liveVersion.preview.scenarios[0].upstreamId,
                typedInputs: { timeout: 30 }
              }
            ]
          }
        })
      ).json()
    );
    expect(liveCompile.startable).toBe(false);
    expect(liveCompile.queued).toBe(false);
    expect(liveCompile.jobsQueued).toBe(0);
    expect(liveCompile.denyReason?.toLowerCase()).toMatch(/atomic/);
    expect(liveCompile.denyReason).not.toMatch(/Unreviewed BAS content/i);
    const liveStart = StartBasCampaignResultSchema.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/bas/campaigns/start",
          cookies: cookies(a),
          payload: { compiledDigest: liveCompile.plan.compiledDigest }
        })
      ).json()
    );
    expect(liveStart.outcome).toBe("Denied");
    expect(liveStart.queued).toBe(false);
    expect(liveStart.jobsQueued).toBe(0);
    expect(liveStart.mission).toBeNull();
    expect(liveStart.denyReason?.toLowerCase()).toMatch(/atomic/);
    expect(liveStart.denyReason?.toLowerCase()).toMatch(/never queued/);
    expect(await prisma.job.count({ where: { tenantId: tenantA } })).toBe(
      jobsBefore
    );
    expect(enqueueValidationJob).not.toHaveBeenCalled();

    await expect(
      runWithTenantRls(prisma, tenantA, (tx) =>
        tx.basContentVersion.update({
          where: { basContentVersionId: liveVersion.basContentVersionId },
          data: { contentSha256: "0".repeat(64) }
        })
      )
    ).rejects.toThrow();
  });
});
