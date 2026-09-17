import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  executeModuleById,
  ModuleExecutionContextSchema
} from "../../packages/modules/src/index.js";
import { resolveOpenSourceToolRuntime } from "../../packages/modules/src/toolchain.js";

/**
 * GA-3 / PERISCAN-494 — live OSS engine path (not fixture theater).
 *
 * fixtureMode=false must either exec Gitleaks or fail closed. It must never
 * silently load the fixture JSON. Fixed-only-via-verify stays a separate acc.
 */

let scanRoot: string | undefined;

afterEach(async () => {
  if (scanRoot) {
    await rm(scanRoot, { force: true, recursive: true });
    scanRoot = undefined;
  }
});

function liveContext(target: Record<string, unknown>) {
  return ModuleExecutionContextSchema.parse({
    integrationIds: [],
    inputs: {},
    missionId: randomUUID(),
    policyDecisionId: null,
    runId: randomUUID(),
    runnerId: null,
    safetyLevel: "PassiveReadOnly",
    scopeId: randomUUID(),
    target,
    tenantId: randomUUID()
  });
}

describe("live OSS engine execution (GA-3 / PERISCAN-498)", () => {
  it("grype.repo_vulnerability_scan fixtureMode=true is executable and not the catalog sim", async () => {
    const fixturePath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "../../packages/modules/fixtures/grype/repo-vuln-fixture.json"
    );
    const output = await executeModuleById(
      "grype.repo_vulnerability_scan",
      liveContext({
        fixtureMode: true,
        fixtureReportPath: fixturePath,
        repositoryName: "fixture-repo",
        repositoryPath: "/tmp/does-not-need-to-exist"
      })
    );
    expect(output.outcome).toBe("vulnerability_inventory_observed");
    expect(output.validationState).toBe("Validated");
    expect(output.signals.length).toBe(1);
  });

  it("grype.repo_vulnerability_scan fixtureMode=false execs or fails closed", async () => {
    const runtime = await resolveOpenSourceToolRuntime("grype");
    scanRoot = await mkdtemp(path.join(tmpdir(), "periscan-live-grype-"));
    await writeFile(path.join(scanRoot, "README.md"), "# empty\n", "utf8");
    const context = liveContext({
      fixtureMode: false,
      repositoryName: "periscan-live-grype",
      repositoryPath: scanRoot
    });
    if (!runtime.available) {
      const output = await executeModuleById(
        "grype.repo_vulnerability_scan",
        context
      );
      expect(output.outcome).toBe("tool_unavailable");
      expect(output.validationState).toBe("Inconclusive");
      return;
    }
    const output = await executeModuleById(
      "grype.repo_vulnerability_scan",
      context
    );
    expect(["Validated", "Fixed", "Inconclusive"]).toContain(
      output.validationState
    );
    expect(output.outcome).not.toBe("cve_scan_fixture_complete");
  });

  it("gitleaks.repo_secrets with fixtureMode=false execs the engine or fails closed", async () => {
    const runtime = await resolveOpenSourceToolRuntime("gitleaks");
    scanRoot = await mkdtemp(path.join(tmpdir(), "periscan-live-gitleaks-"));
    // Synthetic leak corpus (not a real credential). Amazon's documented
    // example access key + a PEM header — never a GitHub PAT (push protection).
    await writeFile(
      path.join(scanRoot, "leaked.js"),
      [
        'const aws = "AKIAIOSFODNN7EXAMPLE";',
        "const pem = `-----BEGIN RSA PRIVATE KEY-----",
        "MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF7P1z+7QexamplekeymaterialXX",
        "-----END RSA PRIVATE KEY-----`;",
        ""
      ].join("\n"),
      "utf8"
    );
    const context = liveContext({
      fixtureMode: false,
      repositoryName: "periscan-live-gitleaks",
      repositoryPath: scanRoot
    });

    if (!runtime.available) {
      await expect(
        executeModuleById("gitleaks.repo_secrets", context)
      ).rejects.toThrow(/gitleaks runtime is not available/i);
      return;
    }

    const output = await executeModuleById("gitleaks.repo_secrets", context);

    expect(
      output.validationState,
      `outcome=${output.outcome} summary=${output.summary} errors=${output.errors.join(",")}`
    ).toBe("Validated");
    expect(output.outcome).toBe("secret_exposure_observed");
    expect(output.signals.length).toBeGreaterThan(0);
    expect(
      output.evidence.every((item) => item.redactionStatus === "Redacted")
    ).toBe(true);
    const preview = String(output.evidence[0]?.attributes.secretPreview ?? "");
    expect(preview).not.toMatch(/AKIAIOSFODNN7EXAMPLE/u);
  });
});
