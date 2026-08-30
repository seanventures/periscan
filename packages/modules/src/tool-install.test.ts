import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildOpenSourceToolInstallPlan,
  executeOpenSourceToolInstallPlan,
  redactToolInstallOutput,
  selectOpenSourceToolInstallRuntime
} from "./tool-install.js";
import { getOpenSourceToolDefinition } from "./toolchain.js";

async function createExecutable(name: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "periscan-tool-install-"));
  const executablePath = path.join(dir, name);

  await writeFile(executablePath, "#!/bin/sh\nexit 0\n");
  await chmod(executablePath, 0o755);

  return {
    dir,
    executablePath
  };
}

describe("third-party tool install planning", () => {
  it("constructs an allowlisted docker pull plan from tool metadata", async () => {
    const { dir } = await createExecutable("docker");
    const plan = await buildOpenSourceToolInstallPlan("gitleaks", "docker", {
      PATH: dir
    });

    if (!plan.installable || plan.noOp) {
      throw new Error("Expected an executable docker install plan.");
    }

    expect(plan.command).toBe(path.join(dir, "docker"));
    expect(plan.args).toEqual(["pull", "ghcr.io/gitleaks/gitleaks:v8.30.0"]);
    expect(plan.displayCommand).toContain("ghcr.io/gitleaks/gitleaks:v8.30.0");
  });

  it("rejects check-only runtime install requests", () => {
    const promptfoo = getOpenSourceToolDefinition("promptfoo");

    expect(promptfoo).not.toBeNull();
    expect(() => selectOpenSourceToolInstallRuntime(promptfoo!, "npx")).toThrow(
      /check-only/
    );
  });

  it("does not execute install plans unless platform execution is enabled", async () => {
    const { dir } = await createExecutable("docker");
    const plan = await buildOpenSourceToolInstallPlan("gitleaks", "docker", {
      PATH: dir
    });
    const result = await executeOpenSourceToolInstallPlan(plan, {
      execute: false
    });

    expect(result).toMatchObject({
      executed: false,
      installStatus: "Skipped",
      jobStatus: "Denied",
      success: false
    });
  });

  it("redacts command output and reports successful controlled execution", async () => {
    const { dir } = await createExecutable("docker");
    const plan = await buildOpenSourceToolInstallPlan("gitleaks", "docker", {
      PATH: dir
    });
    const result = await executeOpenSourceToolInstallPlan(plan, {
      execute: true,
      spawnCommand: async () => ({
        output: "downloaded token=super-secret-value",
        success: true
      })
    });

    expect(result).toMatchObject({
      executed: true,
      installStatus: "Installed",
      jobStatus: "Completed",
      success: true
    });
    expect(result.outputRedacted).toContain("token=[REDACTED]");
    expect(redactToolInstallOutput("api_key=abc123")).toBe(
      "api_key=[REDACTED]"
    );
  });
});
