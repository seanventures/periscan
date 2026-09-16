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
    expect(resolveTrustProxy({ PERISCAN_TRUST_PROXY: "1" })).toBe(1);
    expect(resolveTrustProxy({ PERISCAN_TRUST_PROXY: "2" })).toBe(2);
  });
});
