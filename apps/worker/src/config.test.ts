import { describe, expect, it } from "vitest";

import { resolveWorkerFixtureTargetAllowance } from "./config.js";

describe("resolveWorkerFixtureTargetAllowance", () => {
  it("allows fixture targets only when dev mode is enabled outside production", () => {
    expect(
      resolveWorkerFixtureTargetAllowance({
        PERISCAN_DEV_MODE: "true"
      })
    ).toBe(true);
    expect(resolveWorkerFixtureTargetAllowance({})).toBe(false);
  });

  it("rejects dev mode in production", () => {
    expect(() =>
      resolveWorkerFixtureTargetAllowance({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_DEV_MODE: "true"
      })
    ).toThrow(/PERISCAN_DEV_MODE/u);
  });
});
