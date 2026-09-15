import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildA2ATckProcessEnv, normalizeA2ATckReport } from "./a2a-tck.js";

function report(status: "PASS" | "FAIL" | "NOT TESTED") {
  return {
    per_requirement: {
      "CORE-SEND-001": {
        errors:
          status === "FAIL"
            ? ["Authorization: Bearer super-secret-token response mismatch"]
            : [],
        level: "MUST",
        status,
        transports: status === "NOT TESTED" ? {} : { jsonrpc: status }
      },
      "STREAM-SHOULD-001": {
        errors: [],
        level: "SHOULD",
        status: "SKIPPED",
        transports: { jsonrpc: "SKIPPED" }
      }
    },
    per_transport: {
      jsonrpc: {
        failed: status === "FAIL" ? 1 : 0,
        passed: status === "PASS" ? 1 : 0,
        skipped: 1,
        total: 2
      }
    },
    summary: {
      may_compatibility: "100.0%",
      must_compatibility: status === "FAIL" ? "0.0%" : "100.0%",
      overall_compatibility: status === "FAIL" ? "0.0%" : "100.0%",
      should_compatibility: "100.0%",
      spec_version: "1.0.0"
    }
  };
}

describe("official A2A TCK report normalization", () => {
  it("does not expose application or cloud credentials to the TCK process", () => {
    const processEnv = buildA2ATckProcessEnv({
      AWS_SECRET_ACCESS_KEY: "cloud-secret",
      DATABASE_URL: "postgres://secret",
      HOME: "/tmp/home",
      HTTPS_PROXY: "https://proxy.example",
      PATH: "/usr/bin",
      PERISCAN_SIGNING_KEY: "signing-secret"
    });

    expect(processEnv).toEqual({
      HOME: "/tmp/home",
      HTTPS_PROXY: "https://proxy.example",
      PATH: "/usr/bin"
    });
  });

  it("marks a full MUST pass compatible and seals the source report", () => {
    const raw = report("PASS");
    const bytes = JSON.stringify(raw);
    const proof = normalizeA2ATckReport(raw, bytes);

    expect(proof).toMatchObject({
      compatible: true,
      mustCompatibility: 100,
      specVersion: "1.0.0",
      toolVersion: "1.0.0.alpha2"
    });
    expect(proof.reportHash).toBe(
      createHash("sha256").update(bytes).digest("hex")
    );
    expect(proof.requirementResults[0]).toMatchObject({
      requirementId: "CORE-SEND-001",
      status: "PASS"
    });
  });

  it("does not claim compatibility when a MUST requirement was not tested", () => {
    const raw = report("NOT TESTED");
    const proof = normalizeA2ATckReport(raw, JSON.stringify(raw));

    expect(proof.mustCompatibility).toBe(100);
    expect(proof.compatible).toBe(false);
    expect(proof.requirementResults).toContainEqual(
      expect.objectContaining({
        requirementId: "CORE-SEND-001",
        status: "NOT_TESTED"
      })
    );
  });

  it("redacts bearer material from normalized failure evidence", () => {
    const raw = report("FAIL");
    const proof = normalizeA2ATckReport(raw, JSON.stringify(raw));

    expect(proof.compatible).toBe(false);
    expect(proof.requirementResults[0]?.errors[0]).toContain(
      "authorization=[redacted]"
    );
    expect(proof.requirementResults[0]?.errors[0]).not.toContain(
      "super-secret-token"
    );
  });
});
