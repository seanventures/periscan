import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";

import type {
  OpenSourceToolDefinition,
  OpenSourceToolId,
  OpenSourceToolRuntime
} from "@periscan/shared";

import {
  getDefaultDockerImageRef,
  getOpenSourceToolCheckoutPath,
  getOpenSourceToolDefinition,
  getOpenSourceToolEnvPrefix,
  resolveOpenSourceToolRuntime
} from "./toolchain.js";

const INSTALL_OUTPUT_LIMIT = 8_000;

export type OpenSourceToolInstallPlan =
  | {
      args: string[];
      command: string;
      displayCommand: string;
      installable: true;
      noOp: false;
      runtimeKind: OpenSourceToolRuntime;
      tool: OpenSourceToolDefinition;
      toolId: OpenSourceToolId;
      version: string;
    }
  | {
      displayCommand: string;
      installable: true;
      noOp: true;
      reason: string;
      runtimeKind: OpenSourceToolRuntime | null;
      tool: OpenSourceToolDefinition;
      toolId: OpenSourceToolId;
      version: string;
    }
  | {
      displayCommand: string;
      installable: false;
      reason: string;
      runtimeKind: OpenSourceToolRuntime | null;
      tool: OpenSourceToolDefinition;
      toolId: OpenSourceToolId;
      version: string;
    };

export interface OpenSourceToolInstallResult {
  executed: boolean;
  installStatus: "Failed" | "Installed" | "Skipped";
  jobStatus: "Completed" | "Denied" | "Failed";
  outputRedacted: string;
  runtimeAvailable: boolean;
  runtimeKind: OpenSourceToolRuntime | null;
  runtimeReason: string;
  success: boolean;
}

export interface ExecuteOpenSourceToolInstallPlanOptions {
  execute?: boolean;
  spawnCommand?: (
    command: string,
    args: string[]
  ) => Promise<{ output: string; success: boolean }>;
}

function isPinnedGitVersion(version: string) {
  return !["latest", "master", "main"].includes(version);
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function getInstallableOpenSourceToolRuntimes(
  tool: OpenSourceToolDefinition
) {
  return tool.runtimePreference.filter((runtime) =>
    ["docker", "git", "pip", "npx"].includes(runtime)
  );
}

export function selectOpenSourceToolInstallRuntime(
  tool: OpenSourceToolDefinition,
  requestedRuntime?: OpenSourceToolRuntime
) {
  if (requestedRuntime) {
    if (!tool.runtimePreference.includes(requestedRuntime)) {
      throw new Error(
        `Runtime ${requestedRuntime} is not allowed for ${tool.displayName}.`
      );
    }

    if (
      !getInstallableOpenSourceToolRuntimes(tool).includes(requestedRuntime)
    ) {
      throw new Error(
        `Runtime ${requestedRuntime} is check-only for ${tool.displayName}.`
      );
    }

    return requestedRuntime;
  }

  return getInstallableOpenSourceToolRuntimes(tool)[0] ?? null;
}

export async function buildOpenSourceToolInstallPlan(
  toolId: OpenSourceToolId,
  requestedRuntime?: OpenSourceToolRuntime,
  env: NodeJS.ProcessEnv = process.env
): Promise<OpenSourceToolInstallPlan> {
  const tool = getOpenSourceToolDefinition(toolId);

  if (!tool) {
    throw new Error(`Unknown OSS tool: ${toolId}`);
  }

  let runtimeKind: OpenSourceToolRuntime | null;

  try {
    runtimeKind = selectOpenSourceToolInstallRuntime(tool, requestedRuntime);
  } catch (error) {
    return {
      displayCommand: `unavailable:${toolId}`,
      installable: false,
      reason:
        error instanceof Error ? error.message : "Runtime is not installable.",
      runtimeKind: requestedRuntime ?? null,
      tool,
      toolId,
      version: tool.defaultVersion
    };
  }

  if (!runtimeKind) {
    return {
      displayCommand: `unavailable:${toolId}`,
      installable: false,
      reason: `${tool.displayName} has no docker, git, or pip runtime that Periscan can install automatically.`,
      runtimeKind: null,
      tool,
      toolId,
      version: tool.defaultVersion
    };
  }

  const runtime = await resolveOpenSourceToolRuntime(toolId, {
    ...env,
    [`${getOpenSourceToolEnvPrefix(toolId)}_RUNTIME`]: runtimeKind
  });

  if (!runtime.available || !runtime.command) {
    return {
      displayCommand: `unavailable:${toolId}`,
      installable: false,
      reason:
        runtime.reason ??
        `${tool.displayName} ${runtimeKind} runtime is unavailable on this worker.`,
      runtimeKind,
      tool,
      toolId,
      version: runtime.version
    };
  }

  if (runtimeKind === "docker") {
    const imageRef = runtime.imageRef ?? getDefaultDockerImageRef(tool, env);

    if (!imageRef) {
      return {
        displayCommand: `unavailable:${toolId}`,
        installable: false,
        reason: `${tool.displayName} does not declare a Docker image.`,
        runtimeKind,
        tool,
        toolId,
        version: runtime.version
      };
    }

    return {
      args: ["pull", imageRef],
      command: runtime.command,
      displayCommand: `${runtime.command} pull ${imageRef}`,
      installable: true,
      noOp: false,
      runtimeKind,
      tool,
      toolId,
      version: runtime.version
    };
  }

  if (runtimeKind === "git") {
    const checkoutPath = getOpenSourceToolCheckoutPath(toolId, env);

    await mkdir(path.dirname(checkoutPath), {
      recursive: true
    });

    if (await pathExists(checkoutPath)) {
      return {
        displayCommand: `reuse ${checkoutPath}`,
        installable: true,
        noOp: true,
        reason: `${tool.displayName} checkout already exists at ${checkoutPath}.`,
        runtimeKind,
        tool,
        toolId,
        version: runtime.version
      };
    }

    const args = ["clone", "--depth", "1"];

    if (isPinnedGitVersion(runtime.version)) {
      args.push("--branch", runtime.version);
    }

    args.push(tool.gitRepo!, checkoutPath);

    return {
      args,
      command: runtime.command,
      displayCommand: `${runtime.command} ${args.join(" ")}`,
      installable: true,
      noOp: false,
      runtimeKind,
      tool,
      toolId,
      version: runtime.version
    };
  }

  if (runtimeKind === "pip") {
    const packageSpec = `${tool.pipPackage}==${runtime.version}`;
    const commandName = path.basename(runtime.command);
    const args =
      commandName === "python" || commandName.startsWith("python")
        ? ["-m", "pip", "install", packageSpec]
        : ["install", packageSpec];

    return {
      args,
      command: runtime.command,
      displayCommand: `${runtime.command} ${args.join(" ")}`,
      installable: true,
      noOp: false,
      runtimeKind,
      tool,
      toolId,
      version: runtime.version
    };
  }

  if (runtimeKind === "npx" && tool.npmPackage) {
    return {
      args: ["--yes", `${tool.npmPackage}@${runtime.version}`, "--version"],
      command: runtime.command || "npx",
      displayCommand: `npx --yes ${tool.npmPackage}@${runtime.version} --version`,
      installable: true,
      noOp: false,
      runtimeKind,
      tool,
      toolId,
      version: runtime.version
    };
  }

  return {
    displayCommand: `unavailable:${toolId}`,
    installable: false,
    reason: `${tool.displayName} runtime ${runtimeKind} is check-only and cannot be installed automatically.`,
    runtimeKind,
    tool,
    toolId,
    version: runtime.version
  };
}

export function redactToolInstallOutput(output: string) {
  return output
    .replace(/(token|secret|password|api[_-]?key)=([^\s]+)/gi, "$1=[REDACTED]")
    .slice(0, INSTALL_OUTPUT_LIMIT);
}

function runSpawnCommand(command: string, args: string[]) {
  return new Promise<{ output: string; success: boolean }>((resolve) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({
        output: error.message,
        success: false
      });
    });
    child.on("close", (code) => {
      resolve({
        output,
        success: code === 0
      });
    });
  });
}

export async function executeOpenSourceToolInstallPlan(
  plan: OpenSourceToolInstallPlan,
  options: ExecuteOpenSourceToolInstallPlanOptions = {}
): Promise<OpenSourceToolInstallResult> {
  if (!plan.installable) {
    return {
      executed: false,
      installStatus: "Skipped",
      jobStatus: "Denied",
      outputRedacted: redactToolInstallOutput(plan.reason),
      runtimeAvailable: false,
      runtimeKind: plan.runtimeKind,
      runtimeReason: plan.reason,
      success: false
    };
  }

  if (plan.noOp) {
    return {
      executed: false,
      installStatus: "Installed",
      jobStatus: "Completed",
      outputRedacted: redactToolInstallOutput(plan.reason),
      runtimeAvailable: true,
      runtimeKind: plan.runtimeKind,
      runtimeReason: plan.reason,
      success: true
    };
  }

  if (options.execute !== true) {
    const reason =
      "Install command was not executed because platform-controlled install execution is disabled.";
    return {
      executed: false,
      installStatus: "Skipped",
      jobStatus: "Denied",
      outputRedacted: reason,
      runtimeAvailable: false,
      runtimeKind: plan.runtimeKind,
      runtimeReason: reason,
      success: false
    };
  }

  const result = await (options.spawnCommand ?? runSpawnCommand)(
    plan.command,
    plan.args
  );

  return {
    executed: true,
    installStatus: result.success ? "Installed" : "Failed",
    jobStatus: result.success ? "Completed" : "Failed",
    outputRedacted: redactToolInstallOutput(result.output),
    runtimeAvailable: result.success,
    runtimeKind: plan.runtimeKind,
    runtimeReason: result.success
      ? `Install job completed for ${plan.displayCommand}.`
      : `Install job failed for ${plan.displayCommand}.`,
    success: result.success
  };
}

export async function buildOpenSourceToolUninstallPlan(
  toolId: OpenSourceToolId,
  env: NodeJS.ProcessEnv = process.env
): Promise<OpenSourceToolInstallPlan> {
  const tool = getOpenSourceToolDefinition(toolId);
  if (!tool) {
    throw new Error(`Unknown OSS tool: ${toolId}`);
  }
  const runtime = await resolveOpenSourceToolRuntime(toolId, env);
  if (tool.dockerImage) {
    const imageRef = runtime.imageRef ?? getDefaultDockerImageRef(tool, env);
    if (imageRef) {
      return {
        args: ["rmi", "--force", imageRef],
        command: runtime.command ?? "docker",
        displayCommand: `docker rmi --force ${imageRef}`,
        installable: true,
        noOp: false,
        runtimeKind: "docker",
        tool,
        toolId,
        version: tool.defaultVersion
      };
    }
  }
  if (tool.pipPackage) {
    return {
      args: ["uninstall", "-y", tool.pipPackage],
      command: runtime.command ?? "pip",
      displayCommand: `pip uninstall -y ${tool.pipPackage}`,
      installable: true,
      noOp: false,
      runtimeKind: "pip",
      tool,
      toolId,
      version: tool.defaultVersion
    };
  }
  if (tool.gitRepo) {
    const checkoutPath = getOpenSourceToolCheckoutPath(toolId, env);
    if (await pathExists(checkoutPath)) {
      return {
        args: ["-rf", checkoutPath],
        command: "rm",
        displayCommand: `rm -rf ${checkoutPath}`,
        installable: true,
        noOp: false,
        runtimeKind: "git",
        tool,
        toolId,
        version: tool.defaultVersion
      };
    }
    return {
      displayCommand: `rm -rf ${checkoutPath}`,
      installable: true,
      noOp: true,
      reason: "No local checkout to remove.",
      runtimeKind: "git",
      tool,
      toolId,
      version: tool.defaultVersion
    };
  }
  return {
    displayCommand: `forget:${toolId}`,
    installable: true,
    noOp: true,
    reason: `${tool.displayName} has no local package to delete; marking uninstalled.`,
    runtimeKind: runtime.runtime ?? null,
    tool,
    toolId,
    version: tool.defaultVersion
  };
}
