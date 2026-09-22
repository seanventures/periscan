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
  OPENAPI_ROUTE,
  BasContentVersionSchema,
  BasContentVersionListSchema
} from "../../packages/shared/src/index.js";
import * as helpers from "./helpers.js";

const root = "/api/v1/bas/content/versions";
const prefix = `bas-registry-${randomUUID()}`;
const enqueueValidationJob = vi.fn(async () => {});
const enqueueTurn = vi.fn(async () => {});

function content(path = `abilities/${randomUUID()}.json`) {
  return {
    provider: "Caldera",
    format: "json",
    sourceRevision: "test-pin-1",
    sourcePath: path,
    content: JSON.stringify([
      {
        id: randomUUID(),
        name: "OS metadata",
        technique: { attack_id: "T1082" },
        platforms: {
          linux: {
            sh: {
              command: "PRIVATE_COMMAND_BODY",
              cleanup: "PRIVATE_CLEANUP_BODY"
            }
          }
        }
      }
    ])
  };
}

describe("BAS content registry with real Postgres", () => {
  let prisma: ReturnType<typeof createPrismaClient>;
  let app: FastifyInstance;
  let a: Awaited<ReturnType<typeof helpers.performSignup>>;
  let b: Awaited<ReturnType<typeof helpers.performSignup>>;
  let tenantA: string;
  let tenantB: string;
  let userA: string;
  let savedId: string;
  let savedInput: ReturnType<typeof content>;
  const cookies = (user: typeof a) => helpers.authCookies(user.cookie);
  const register = (payload: ReturnType<typeof content>, user = a) =>
    app.inject({ method: "POST", url: root, cookies: cookies(user), payload });

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
    tenantB = b.response.json().tenant.tenantId;
    userA = a.response.json().user.userId;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    if (prisma) {
      await helpers.cleanupTestDataByEmailPrefix(prisma, [prefix]);
      await prisma.$disconnect();
    }
  }, 30_000);

  it("persists normalized immutable metadata, replays idempotently and rejects changed content at the same pin", async () => {
    const input = content();
    savedInput = input;
    const first = await register(input);
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().created).toBe(true);
    const version = BasContentVersionSchema.parse(first.json().version);
    savedId = version.basContentVersionId;
    expect(version).toMatchObject({
      tenantId: tenantA,
      scenarioCount: 1,
      executable: false,
      evidenceProduced: false,
      provenance: "UserSuppliedUnverified"
    });
    const replay = await register(input);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ created: false, version });
    const conflict = await register({
      ...input,
      content: input.content.replace("OS metadata", "Different scenario")
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().code).toBe("bas_content_version_conflict");
    const persisted = await runWithTenantRls(prisma, tenantA, (tx) =>
      tx.basContentVersion.findUniqueOrThrow({
        where: { basContentVersionId: savedId }
      })
    );
    expect(persisted.contentSha256).toBe(version.contentSha256);
    expect(JSON.stringify(persisted)).not.toMatch(
      /PRIVATE_COMMAND_BODY|PRIVATE_CLEANUP_BODY/
    );
    expect(first.body).not.toMatch(/PRIVATE_COMMAND_BODY|PRIVATE_CLEANUP_BODY/);
    const audits = await prisma.auditEvent.findMany({
      where: {
        tenantId: tenantA,
        action: "bas_content_registered",
        entityId: savedId
      }
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.metadata).toMatchObject({
      contentSha256: version.contentSha256,
      scenarioCount: 1
    });
    const read = await app.inject({
      url: `${root}/${savedId}`,
      cookies: cookies(a)
    });
    expect(read.json()).toEqual(version);
  });

  it("handles concurrent same-content replays and different-content collisions without overwrites or duplicate audits", async () => {
    const input = content();
    const results = await Promise.all(
      Array.from({ length: 4 }, () => register(input))
    );
    expect(results.map((r) => r.statusCode)).toEqual([200, 200, 200, 200]);
    expect(results.filter((r) => r.json().created)).toHaveLength(1);
    expect(
      new Set(results.map((r) => r.json().version.basContentVersionId)).size
    ).toBe(1);
    const collision = content();
    const conflicting = await Promise.all([
      register(collision),
      register({
        ...collision,
        content: collision.content.replace("OS metadata", "Changed")
      })
    ]);
    expect(conflicting.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const winner = conflicting
      .find((r) => r.statusCode === 200)!
      .json().version;
    expect(
      await prisma.auditEvent.count({
        where: {
          tenantId: tenantA,
          action: "bas_content_registered",
          entityId: winner.basContentVersionId
        }
      })
    ).toBe(1);
  });

  it("enforces tenant isolation for reads, cursor anchors and DB writes, and denies metadata mutation", async () => {
    const foreignRead = await app.inject({
      url: `${root}/${savedId}`,
      cookies: cookies(b)
    });
    expect(foreignRead.statusCode).toBe(404);
    expect(
      (
        await app.inject({
          url: `${root}?cursor=${savedId}`,
          cookies: cookies(b)
        })
      ).statusCode
    ).toBe(404);
    const empty = await app.inject({ url: root, cookies: cookies(b) });
    expect(empty.json()).toEqual({ items: [], nextCursor: null });
    const hidden = await runWithTenantRls(prisma, tenantB, (tx) =>
      tx.basContentVersion.findMany({})
    );
    expect(hidden).toEqual([]);
    const stored = await runWithTenantRls(prisma, tenantA, (tx) =>
      tx.basContentVersion.findUniqueOrThrow({
        where: { basContentVersionId: savedId }
      })
    );
    await expect(
      runWithTenantRls(prisma, tenantB, (tx) =>
        tx.basContentVersion.create({
          data: {
            ...stored,
            basContentVersionId: randomUUID(),
            sourcePath: "foreign.json"
          }
        })
      )
    ).rejects.toThrow();
    await expect(
      runWithTenantRls(prisma, tenantA, (tx) =>
        tx.basContentVersion.update({
          where: { basContentVersionId: savedId },
          data: { contentSha256: "0".repeat(64) }
        })
      )
    ).rejects.toThrow();
    // Same upstream identity may independently exist in a different tenant.
    expect((await register(savedInput, b)).statusCode).toBe(200);
  });

  it("requires authentication/admin registration and rejects client overrides", async () => {
    expect((await app.inject({ url: root })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "POST", url: root, payload: content() }))
        .statusCode
    ).toBe(401);
    const where = { tenantId_userId: { tenantId: tenantA, userId: userA } };
    await prisma.membership.update({ where, data: { role: "Viewer" } });
    try {
      expect((await register(content())).statusCode).toBe(403);
      expect(
        (await app.inject({ url: root, cookies: cookies(a) })).statusCode
      ).toBe(200);
    } finally {
      await prisma.membership.update({ where, data: { role: "Owner" } });
    }
    for (const extra of [
      { executable: true },
      { tenantId: tenantB },
      { sourcePath: "../escape" }
    ]) {
      expect(
        (
          await app.inject({
            method: "POST",
            url: root,
            cookies: cookies(a),
            payload: { ...content(), ...extra }
          })
        ).statusCode
      ).toBe(400);
    }
    for (const query of [
      "limit=51",
      "limit=0",
      "cursor=broken",
      "tenantId=elsewhere"
    ]) {
      expect(
        (await app.inject({ url: `${root}?${query}`, cookies: cookies(a) }))
          .statusCode
      ).toBe(400);
    }
  });

  it("registers Atomic technique definitions and keeps provider-filtered pages separate", async () => {
    const input = {
      provider: "AtomicRedTeam",
      format: "json",
      sourceRevision: "atomic-test-pin",
      sourcePath: "atomics/T1082/T1082.yaml",
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
    const response = await register(input);
    expect(response.statusCode, response.body).toBe(200);
    const version = BasContentVersionSchema.parse(response.json().version);
    expect(version.preview.scenarios[0]).toMatchObject({
      techniqueIds: ["T1082"],
      reviewStatus: "Unreviewed",
      executable: false
    });
    const page = await app.inject({
      url: `${root}?provider=AtomicRedTeam`,
      cookies: cookies(a)
    });
    expect(
      page
        .json()
        .items.map(
          (item: { basContentVersionId: string }) => item.basContentVersionId
        )
    ).toEqual([version.basContentVersionId]);
    expect(
      (
        await app.inject({
          url: `${root}?provider=Caldera&cursor=${version.basContentVersionId}`,
          cookies: cookies(a)
        })
      ).statusCode
    ).toBe(404);
    expect(response.body).not.toContain("PRIVATE_ATOMIC_COMMAND");
  });

  it("paginates complete summaries without embedding source previews, and exposes OpenAPI contracts", async () => {
    await register(content());
    const all: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await app.inject({
        url: `${root}?provider=Caldera&limit=2${cursor ? `&cursor=${cursor}` : ""}`,
        cookies: cookies(a)
      });
      expect(response.statusCode).toBe(200);
      const page = BasContentVersionListSchema.parse(response.json());
      expect(page.items.length).toBeLessThanOrEqual(2);
      expect(response.body).not.toContain('"preview"');
      all.push(...page.items.map((item) => item.basContentVersionId));
      cursor = page.nextCursor;
      expect(all.length).toBeLessThan(30);
    } while (cursor);
    expect(new Set(all).size).toBe(all.length);
    const stored = await runWithTenantRls(prisma, tenantA, (tx) =>
      tx.basContentVersion.count({
        where: { tenantId: tenantA, provider: "Caldera" }
      })
    );
    expect(all).toHaveLength(stored);
    const docs = (await app.inject({ url: OPENAPI_ROUTE })).json();
    expect(docs.paths[root].post.requestBody).toBeDefined();
    expect(
      docs.paths[root].get.parameters.map((p: { name: string }) => p.name)
    ).toEqual(expect.arrayContaining(["provider", "limit", "cursor"]));
    expect(docs.paths[`${root}/{id}`].get.responses["200"]).toBeDefined();
    expect(enqueueValidationJob).not.toHaveBeenCalled();
    expect(enqueueTurn).not.toHaveBeenCalled();
    expect(
      await prisma.validationMission.count({ where: { tenantId: tenantA } })
    ).toBe(0);
    expect(
      await prisma.validationRun.count({ where: { tenantId: tenantA } })
    ).toBe(0);
  });

  it("rolls back registration when the audit write fails", async () => {
    // Isolated to this test tenant; failure happens after the content insert.
    const input = content();
    expect(tenantA).toMatch(/^[a-f0-9-]{36}$/);
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION bas_registry_test_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit unavailable'; END $$`
    );
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER bas_registry_test_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW WHEN (NEW.action = 'bas_content_registered' AND NEW.tenant_id = '${tenantA}'::uuid) EXECUTE FUNCTION bas_registry_test_reject_audit()`
      );
      const response = await register(input);
      expect(response.statusCode).toBe(500);
      const count = await runWithTenantRls(prisma, tenantA, (tx) =>
        tx.basContentVersion.count({
          where: { tenantId: tenantA, sourcePath: input.sourcePath }
        })
      );
      expect(count).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        "DROP TRIGGER IF EXISTS bas_registry_test_audit_failure ON audit_events"
      );
      await prisma.$executeRawUnsafe(
        "DROP FUNCTION bas_registry_test_reject_audit()"
      );
    }
  });
});
