import { beforeEach, describe, expect, it } from "vitest";
import {
  resolveDatabaseUrlFromEnv,
  DEFAULT_DATABASE_URL
} from "./database-env.js";

describe("database env resolution", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_DB_URL;
    delete process.env.SUPABASE_DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.PERISCAN_TEST_DATABASE_URL;
    delete process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;
    // intentionally do not delete VITEST/NODE_ENV (set by vitest runner); override tests explicitly set them + PERISCAN_TEST when asserting the P3 test-override branch
  });

  it("uses DATABASE_URL when set", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/primary";

    expect(resolveDatabaseUrlFromEnv()).toBe(
      "postgresql://user:pass@127.0.0.1:5432/primary"
    );
  });

  it("falls back to SUPABASE_DB_URL when DATABASE_URL is missing", () => {
    process.env.SUPABASE_DB_URL =
      "postgresql://user:pass@supabase-host:5432/periscan";

    expect(resolveDatabaseUrlFromEnv()).toBe(
      "postgresql://user:pass@supabase-host:5432/periscan"
    );
  });

  it("prefers SUPABASE_DATABASE_URL over SUPABASE_DB_URL", () => {
    process.env.SUPABASE_DATABASE_URL =
      "postgresql://user:pass@supabase-alt:5432/periscan_alt";
    process.env.SUPABASE_DB_URL =
      "postgresql://user:pass@supabase:5432/periscan";
    process.env.POSTGRES_URL = "postgresql://user:pass@postgres:5432/periscan";

    expect(resolveDatabaseUrlFromEnv()).toBe(
      "postgresql://user:pass@supabase-alt:5432/periscan_alt"
    );
  });

  it("falls back to POSTGRES_URL when Supabase aliases are missing", () => {
    process.env.POSTGRES_URL = "postgresql://user:pass@postgres:5432/periscan";

    expect(resolveDatabaseUrlFromEnv()).toBe(
      "postgresql://user:pass@postgres:5432/periscan"
    );
  });

  it("falls back to the default url when no env is set", () => {
    expect(resolveDatabaseUrlFromEnv()).toBe(DEFAULT_DATABASE_URL);
  });

  it("refuses the local default url in production", () => {
    process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT = "production";

    expect(() => resolveDatabaseUrlFromEnv()).toThrow(
      /refusing to use the local development database fallback/u
    );
  });

  it("allows configured production database aliases", () => {
    process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT = "production";
    process.env.SUPABASE_DATABASE_URL =
      "postgresql://user:pass@supabase-prod.local:5432/periscan_prod";

    expect(resolveDatabaseUrlFromEnv()).toBe(
      "postgresql://user:pass@supabase-prod.local:5432/periscan_prod"
    );
  });

  it("respects PERISCAN_TEST_DATABASE_URL when VITEST is set (P3 test-infra override)", () => {
    process.env.VITEST = "true";
    process.env.PERISCAN_TEST_DATABASE_URL =
      "postgresql://periscan:periscan@127.0.0.1:5434/periscan_test";
    // even if DATABASE_URL set, test override wins in test context
    process.env.DATABASE_URL =
      "postgresql://periscan:periscan@127.0.0.1:5432/periscan";

    expect(resolveDatabaseUrlFromEnv()).toBe(
      "postgresql://periscan:periscan@127.0.0.1:5434/periscan_test"
    );
  });

  it("respects PERISCAN_TEST_DATABASE_URL when NODE_ENV=test (P3 test-infra override)", () => {
    process.env.NODE_ENV = "test";
    process.env.PERISCAN_TEST_DATABASE_URL =
      "postgresql://periscan:periscan@127.0.0.1:5434/periscan_test2";

    expect(resolveDatabaseUrlFromEnv()).toBe(
      "postgresql://periscan:periscan@127.0.0.1:5434/periscan_test2"
    );
  });

  it("ignores PERISCAN_TEST_DATABASE_URL outside test contexts (prod/dev safety)", () => {
    delete process.env.VITEST;
    delete process.env.NODE_ENV;
    process.env.PERISCAN_TEST_DATABASE_URL =
      "postgresql://periscan:periscan@127.0.0.1:5434/should_ignore";
    process.env.DATABASE_URL =
      "postgresql://periscan:periscan@127.0.0.1:5432/real";

    expect(resolveDatabaseUrlFromEnv()).toBe(
      "postgresql://periscan:periscan@127.0.0.1:5432/real"
    );
  });
});
