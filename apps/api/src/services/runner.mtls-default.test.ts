import { afterEach, describe, expect, it } from "vitest";

import { shouldRequireRunnerMtls } from "./runner.js";

const originalRequireMtls = process.env.PERISCAN_RUNNER_REQUIRE_MTLS;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalRequireMtls === undefined) {
    delete process.env.PERISCAN_RUNNER_REQUIRE_MTLS;
  } else {
    process.env.PERISCAN_RUNNER_REQUIRE_MTLS = originalRequireMtls;
  }
  process.env.NODE_ENV = originalNodeEnv;
});

describe("shouldRequireRunnerMtls", () => {
  it("defaults to true when NODE_ENV=production and flag is unset", () => {
    delete process.env.PERISCAN_RUNNER_REQUIRE_MTLS;
    process.env.NODE_ENV = "production";
    expect(shouldRequireRunnerMtls()).toBe(true);
  });

  it("defaults to false when NODE_ENV is not production and flag is unset", () => {
    delete process.env.PERISCAN_RUNNER_REQUIRE_MTLS;
    process.env.NODE_ENV = "test";
    expect(shouldRequireRunnerMtls()).toBe(false);

    process.env.NODE_ENV = "development";
    expect(shouldRequireRunnerMtls()).toBe(false);
  });

  it("honors explicit PERISCAN_RUNNER_REQUIRE_MTLS=true outside production", () => {
    process.env.PERISCAN_RUNNER_REQUIRE_MTLS = "true";
    process.env.NODE_ENV = "development";
    expect(shouldRequireRunnerMtls()).toBe(true);
  });

  it("honors explicit PERISCAN_RUNNER_REQUIRE_MTLS=false in production", () => {
    process.env.PERISCAN_RUNNER_REQUIRE_MTLS = "false";
    process.env.NODE_ENV = "production";
    expect(shouldRequireRunnerMtls()).toBe(false);
  });
});
