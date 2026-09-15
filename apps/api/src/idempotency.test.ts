import { describe, expect, it } from "vitest";

import {
  AppServiceError,
  // re-exported path for error type used by parse
} from "./runtime-services.js";
import {
  canonicalBodyHash,
  createMemoryIdempotencyStore,
  parseIdempotencyKey,
  withIdempotencyKey
} from "./idempotency.js";

describe("idempotency (P20-7)", () => {
  it("hashes bodies stably", () => {
    expect(canonicalBodyHash({ a: 1, b: 2 })).toBe(
      canonicalBodyHash({ a: 1, b: 2 })
    );
    expect(canonicalBodyHash({ a: 1 })).not.toBe(canonicalBodyHash({ a: 2 }));
    expect(canonicalBodyHash(null)).toBe(canonicalBodyHash(undefined));
  });

  it("parses and rejects invalid keys", () => {
    expect(parseIdempotencyKey(undefined)).toBeNull();
    expect(parseIdempotencyKey("")).toBeNull();
    expect(parseIdempotencyKey("  ")).toBeNull();
    expect(parseIdempotencyKey("mission-create-001")).toBe(
      "mission-create-001"
    );
    expect(() => parseIdempotencyKey("short")).toThrow(AppServiceError);
    expect(() => parseIdempotencyKey("has spaces here")).toThrow(
      AppServiceError
    );
  });

  it("replays first response for same key + body", async () => {
    const store = createMemoryIdempotencyStore();
    let calls = 0;
    const run = () =>
      withIdempotencyKey({
        store,
        tenantId: "t1",
        route: "POST /api/v1/missions",
        key: "proof-loop-key-01",
        body: { scopeId: "s1", missionType: "Validation" },
        execute: async () => {
          calls += 1;
          return {
            statusCode: 201,
            body: { missionId: `m-${calls}`, status: "Draft" }
          };
        }
      });

    const first = await run();
    const second = await run();
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.body).toEqual(first.body);
    expect(calls).toBe(1);
  });

  it("conflicts when the same key is reused with a different body", async () => {
    const store = createMemoryIdempotencyStore();
    await withIdempotencyKey({
      store,
      tenantId: "t1",
      route: "POST /api/v1/missions",
      key: "proof-loop-key-02",
      body: { scopeId: "s1" },
      execute: async () => ({ statusCode: 201, body: { ok: true } })
    });

    await expect(
      withIdempotencyKey({
        store,
        tenantId: "t1",
        route: "POST /api/v1/missions",
        key: "proof-loop-key-02",
        body: { scopeId: "s2" },
        execute: async () => ({ statusCode: 201, body: { ok: false } })
      })
    ).rejects.toMatchObject({
      code: "idempotency_key_conflict",
      statusCode: 409
    });
  });

  it("skips storage when key is omitted", async () => {
    const store = createMemoryIdempotencyStore();
    let calls = 0;
    const run = () =>
      withIdempotencyKey({
        store,
        tenantId: "t1",
        route: "POST /api/v1/missions",
        key: null,
        body: { scopeId: "s1" },
        execute: async () => {
          calls += 1;
          return { statusCode: 201, body: { n: calls } };
        }
      });
    expect((await run()).body).toEqual({ n: 1 });
    expect((await run()).body).toEqual({ n: 2 });
    expect(calls).toBe(2);
  });
});
