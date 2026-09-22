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
  AuthorizeBasPackResultSchema,
  CompileBasCampaignResultSchema,
  QualifyBasPackResultSchema,
  StartBasCampaignResultSchema,
  tenantBasPackAuthorizationDigest
} from "../../packages/shared/src/index.js";
import * as helpers from "./helpers.js";

const prefix = `bas-start-gate-${randomUUID()}`;
const enqueueValidationJob = vi.fn(async () => {});
const enqueueTurn = vi.fn(async () => {});
const RECEIPT = "c".repeat(64);

describe("BAS qualified live-pack start gate with real Postgres", () => {
  let prisma: ReturnType<typeof createPrismaClient>;
  let app: FastifyInstance;
  let a: Awaited<ReturnType<typeof helpers.performSignup>>;
  let b: Awaited<ReturnType<typeof helpers.performSignup>>;
  let tenantA: string;
  let userA: string;
  let scopeId: string;
  const cookies = (user: typeof a) => helpers.authCookies(user.cookie);
  const qualify = (
    payload: Record<string, unknown>,
    user: typeof a = a
  ) =>
    app.inject({
      cookies: cookies(user),
      method: "POST",
      payload,
      url: "/api/v1/bas/packs/qualify"
    });
  const authorize = (
    payload: Record<string, unknown>,
    user: typeof a = a
  ) =>
    app.inject({
      cookies: cookies(user),
      method: "POST",
      payload,
      url: "/api/v1/bas/packs/authorize"
    });
  const compileAtomic = (user: typeof a = a) =>
    app.inject({
      cookies: cookies(user),
      method: "POST",
      payload: {
        scopeId,
        scenarioPins: [
          { provider: "ControlPlane", upstreamId: "atomic.live" }
        ]
      },
      url: "/api/v1/bas/campaigns/compile"
    });
  const start = (compiledDigest: string, user: typeof a = a) =>
    app.inject({
      cookies: cookies(user),
      method: "POST",
      payload: { compiledDigest },
      url: "/api/v1/bas/campaigns/start"
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
        value: `start-gate-${randomUUID()}.example.com`
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

  it("denies live Atomic without qualification or authorization and never queues", async () => {
    enqueueValidationJob.mockClear();
    const jobsBefore = await prisma.job.count({ where: { tenantId: tenantA } });
    process.env.PERISCAN_LIVE_OFFENSIVE = "1";
    try {
      const compiled = CompileBasCampaignResultSchema.parse(
        (await compileAtomic()).json()
      );
      expect(compiled.startable).toBe(false);
      expect(compiled.jobsQueued).toBe(0);
      const started = StartBasCampaignResultSchema.parse(
        (await start(compiled.plan.compiledDigest)).json()
      );
      expect(started.queued).toBe(false);
      expect(started.jobsQueued).toBe(0);
      expect(started.mission).toBeNull();
      expect(started.denyReason?.toLowerCase()).toMatch(/atomic/);
      expect(await prisma.job.count({ where: { tenantId: tenantA } })).toBe(
        jobsBefore
      );
      expect(enqueueValidationJob).not.toHaveBeenCalled();
    } finally {
      delete process.env.PERISCAN_LIVE_OFFENSIVE;
    }
  });

  it("returns 404 across tenants and requires Owner to qualify or authorize", async () => {
    const qualified = QualifyBasPackResultSchema.parse(
      (
        await qualify({
          labReceiptHash: RECEIPT,
          pack: "atomic",
          pinIds: ["atomic.live"]
        })
      ).json()
    );
    expect(qualified.created).toBe(true);

    const foreignScope = await authorize(
      {
        expiresAt: "2026-12-01T00:00:00.000Z",
        pack: "atomic",
        scopeId
      },
      b
    );
    expect(foreignScope.statusCode).toBe(404);
    expect(
      await runWithTenantRls(prisma, b.response.json().tenant.tenantId, (tx) =>
        tx.tenantBasPackAuthorization.findMany({})
      )
    ).toEqual([]);

    const compiled = CompileBasCampaignResultSchema.parse(
      (await compileAtomic()).json()
    );
    expect((await start(compiled.plan.compiledDigest, b)).statusCode).toBe(404);

    const where = { tenantId_userId: { tenantId: tenantA, userId: userA } };
    await prisma.membership.update({ where, data: { role: "Admin" } });
    try {
      expect(
        (
          await qualify({
            labReceiptHash: "d".repeat(64),
            pack: "atomic",
            pinIds: ["atomic.live"]
          })
        ).statusCode
      ).toBe(403);
    } finally {
      await prisma.membership.update({ where, data: { role: "Owner" } });
    }
  });

  it("starts a qualified tenant-authorized Atomic pin and denies expired or forbidden pins", async () => {
    enqueueValidationJob.mockClear();
    const jobsBefore = await prisma.job.count({ where: { tenantId: tenantA } });
    const qualified = await qualify({
      labReceiptHash: RECEIPT,
      pack: "atomic",
      pinIds: ["atomic.live"]
    });
    expect(qualified.statusCode, qualified.body).toBe(200);
    const authorized = AuthorizeBasPackResultSchema.parse(
      (
        await authorize({
          expiresAt: "2026-12-01T00:00:00.000Z",
          pack: "atomic",
          scopeId
        })
      ).json()
    );
    expect(authorized.created).toBe(true);

    const compiled = CompileBasCampaignResultSchema.parse(
      (
        await app.inject({
          cookies: cookies(a),
          method: "POST",
          payload: {
            scopeId,
            scenarioPins: [
              {
                provider: "ControlPlane",
                typedInputs: { lane: "qualified" },
                upstreamId: "atomic.live"
              }
            ]
          },
          url: "/api/v1/bas/campaigns/compile"
        })
      ).json()
    );
    expect(compiled.startable).toBe(true);
    expect(compiled.jobsQueued).toBe(0);
    const started = StartBasCampaignResultSchema.parse(
      (await start(compiled.plan.compiledDigest)).json()
    );
    expect(started.startable).toBe(true);
    expect(started.queued).toBe(true);
    expect(started.jobsQueued).toBeGreaterThan(0);
    expect(started.mission?.missionId).toBeTruthy();
    expect(await prisma.job.count({ where: { tenantId: tenantA } })).toBeGreaterThan(
      jobsBefore
    );

    const forbiddenCompile = CompileBasCampaignResultSchema.parse(
      (
        await app.inject({
          cookies: cookies(a),
          method: "POST",
          payload: {
            scopeId,
            scenarioPins: [
              {
                provider: "ControlPlane",
                typedInputs: { persistence: true },
                upstreamId: "atomic.live"
              }
            ]
          },
          url: "/api/v1/bas/campaigns/compile"
        })
      ).json()
    );
    expect(forbiddenCompile.startable).toBe(false);
    const forbiddenStart = StartBasCampaignResultSchema.parse(
      (await start(forbiddenCompile.plan.compiledDigest)).json()
    );
    expect(forbiddenStart.queued).toBe(false);
    expect(forbiddenStart.jobsQueued).toBe(0);
    expect(forbiddenStart.denyReason?.toLowerCase()).toMatch(
      /t1486|ransomware|forbidden|persistence/
    );

    await prisma.tenantBasPackAuthorization.deleteMany({
      where: {
        tenantBasPackAuthorizationId:
          authorized.authorization.tenantBasPackAuthorizationId
      }
    });
    const expiredExpiresAt = "2020-01-01T00:00:00.000Z";
    await prisma.tenantBasPackAuthorization.create({
      data: {
        approverUserId: userA,
        digest: tenantBasPackAuthorizationDigest({
          approver: userA,
          expiresAt: expiredExpiresAt,
          pack: "atomic",
          scopeId,
          tenantId: tenantA
        }),
        expiresAt: new Date(expiredExpiresAt),
        pack: "atomic",
        scopeId,
        tenantId: tenantA
      }
    });
    const expiredCompile = CompileBasCampaignResultSchema.parse(
      (
        await app.inject({
          cookies: cookies(a),
          method: "POST",
          payload: {
            scopeId,
            scenarioPins: [
              {
                provider: "ControlPlane",
                typedInputs: { lane: "expired" },
                upstreamId: "atomic.live"
              }
            ]
          },
          url: "/api/v1/bas/campaigns/compile"
        })
      ).json()
    );
    expect(expiredCompile.startable).toBe(false);
    const expiredStart = StartBasCampaignResultSchema.parse(
      (await start(expiredCompile.plan.compiledDigest)).json()
    );
    expect(expiredStart.queued).toBe(false);
    expect(expiredStart.jobsQueued).toBe(0);
  });
});
