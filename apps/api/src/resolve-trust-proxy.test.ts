import { describe, expect, it } from "vitest";

import { resolveTrustProxy } from "./app.js";

describe("resolveTrustProxy", () => {
  it("defaults true in production deployment env", () => {
    expect(
      resolveTrustProxy({ PERISCAN_DEPLOYMENT_ENVIRONMENT: "production" })
    ).toBe(true);
  });

  it("defaults false outside production", () => {
    expect(resolveTrustProxy({})).toBe(false);
    expect(
      resolveTrustProxy({ PERISCAN_DEPLOYMENT_ENVIRONMENT: "development" })
    ).toBe(false);
  });

  it("honors explicit booleans and hop counts", () => {
    expect(resolveTrustProxy({ PERISCAN_TRUST_PROXY: "true" })).toBe(true);
    expect(resolveTrustProxy({ PERISCAN_TRUST_PROXY: "0" })).toBe(false);
    const oneHop = resolveTrustProxy({ PERISCAN_TRUST_PROXY: "1" });
    const twoHops = resolveTrustProxy({ PERISCAN_TRUST_PROXY: "2" });
    expect(typeof oneHop).toBe("function");
    expect(typeof twoHops).toBe("function");
    if (typeof oneHop === "function") {
      expect(oneHop("127.0.0.1", 0)).toBe(true);
      expect(oneHop("127.0.0.1", 1)).toBe(false);
    }
    if (typeof twoHops === "function") {
      expect(twoHops("127.0.0.1", 0)).toBe(true);
      expect(twoHops("127.0.0.1", 1)).toBe(true);
      expect(twoHops("127.0.0.1", 2)).toBe(false);
    }
  });

  it("never returns a hop-count number (Fastify 5.12 types reject it)", () => {
    for (const env of [
      { PERISCAN_TRUST_PROXY: "1" },
      { PERISCAN_TRUST_PROXY: "2" },
      { PERISCAN_DEPLOYMENT_ENVIRONMENT: "production" }
    ]) {
      expect(typeof resolveTrustProxy(env)).not.toBe("number");
    }
  });
});
