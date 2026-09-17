import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

async function buildTestApp(prisma: ReturnType<typeof createPrismaClient>) {
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
      prisma
    })
  });
}

describe("global search flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["search-owner"]);
      await prisma.$disconnect();
    }
  });

  it("finds a scope by substring and ignores short queries", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildTestApp(prisma);
    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "search-owner",
        "Search Tenant"
      );
      const auth = testHelpers.authHeaders(cookie);

      const distinctive = `zephyrquux-${Date.now()}.example.com`;
      const created = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { scopeType: "Domain", value: distinctive },
        url: "/api/v1/scopes"
      });
      expect(created.statusCode).toBe(201);
      const scopeId = created.json().scopeId;

      const found = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/search?q=zephyrquux"
      });
      expect(found.statusCode).toBe(200);
      const body = found.json();
      expect(body.query).toBe("zephyrquux");
      const scopeHit = body.results.find(
        (r: { type: string; id: string }) =>
          r.type === "Scope" && r.id === scopeId
      );
      expect(scopeHit).toBeTruthy();
      expect(scopeHit.label).toBe(distinctive);

      // Short queries return nothing (avoid scanning on 1 char).
      const short = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/search?q=z"
      });
      expect(short.statusCode).toBe(200);
      expect(short.json().results).toEqual([]);

      // A miss returns an empty result set, not an error.
      const miss = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/search?q=nothingmatchesthisxyzzy"
      });
      expect(miss.statusCode).toBe(200);
      expect(miss.json().results).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
