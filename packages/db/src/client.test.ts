import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrismaClient } from "./client.js";

const prismaClientMock = vi.hoisted(() =>
  vi.fn().mockImplementation(function () {
    const client = {
      $connect: vi.fn(),
      $transaction: vi.fn()
    };
    return {
      ...client,
      $extends: vi.fn(() => client)
    };
  })
);

vi.mock("@prisma/client", () => ({
  PrismaClient: prismaClientMock
}));

describe("createPrismaClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_DB_URL;
    delete process.env.SUPABASE_DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.PERISCAN_TEST_DATABASE_URL;
    delete process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;
    // do not delete VITEST/NODE_ENV here; they are set by test runner, but deleting PERISCAN_TEST above ensures unit alias tests exercise the non-override path
  });

  it("uses DATABASE_URL when provided", () => {
    process.env.DATABASE_URL =
      "postgresql://user:pass@127.0.0.1:5432/periscan-db";

    createPrismaClient();

    expect(process.env.DATABASE_URL).toBe(
      "postgresql://user:pass@127.0.0.1:5432/periscan-db"
    );
    expect(prismaClientMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to SUPABASE_DB_URL when DATABASE_URL is missing", () => {
    process.env.SUPABASE_DB_URL =
      "postgresql://user:pass@supabase.local:5432/periscan_db";

    createPrismaClient();

    expect(process.env.DATABASE_URL).toBe(
      "postgresql://user:pass@supabase.local:5432/periscan_db"
    );
    expect(prismaClientMock).toHaveBeenCalledTimes(1);
  });

  it("prefers SUPABASE_DATABASE_URL over SUPABASE_DB_URL", () => {
    process.env.SUPABASE_DATABASE_URL =
      "postgresql://user:pass@supabase-alt.local:5432/periscan_db";
    process.env.SUPABASE_DB_URL =
      "postgresql://user:pass@supabase.local:5432/periscan_db";

    createPrismaClient();

    expect(process.env.DATABASE_URL).toBe(
      "postgresql://user:pass@supabase-alt.local:5432/periscan_db"
    );
    expect(prismaClientMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to SUPABASE_DATABASE_URL before POSTGRES_URL", () => {
    process.env.SUPABASE_DATABASE_URL =
      "postgresql://user:pass@supabase2.local:5432/periscan_db";
    process.env.POSTGRES_URL =
      "postgresql://user:pass@postgres.local:5432/periscan_db";

    createPrismaClient();

    expect(process.env.DATABASE_URL).toBe(
      "postgresql://user:pass@supabase2.local:5432/periscan_db"
    );
  });

  it("refuses local development database fallback in production", () => {
    process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT = "production";

    expect(() => createPrismaClient()).toThrow(
      /refusing to use the local development database fallback/u
    );
    expect(prismaClientMock).not.toHaveBeenCalled();
  });
});
