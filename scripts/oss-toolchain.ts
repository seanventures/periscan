import { access, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import {
  getDefaultDockerImageRef,
  getOpenSourceToolCheckoutPath,
  getOpenSourceToolEnvPrefix,
  getOpenSourceToolHome,
  listOpenSourceToolDefinitions,
  resolveOpenSourceToolRuntime,
  type OpenSourceToolDefinition
} from "../packages/modules/src/toolchain.ts";

type CommandName = "list" | "check" | "pull";
type PhaseFilter = "Current" | "CurrentMvp" | "NearTerm" | "LaterPhase" | "all";

interface CliOptions {
  includeDeferred: boolean;
  includeLegalReview: boolean;
  phase: PhaseFilter;
  toolId: string | null;
}

function parseArgs(argv: string[]) {
  const [rawCommand, ...rest] = argv;
  const command = (rawCommand ?? "list") as CommandName;

  if (!["list", "check", "pull"].includes(command)) {
    throw new Error(`Unsupported command: ${rawCommand ?? ""}`);
  }

  const options: CliOptions = {
    includeDeferred: false,
    includeLegalReview: false,
    phase: "Current",
    toolId: null
  };

  for (const arg of rest) {
    if (arg === "--") {
      continue;
    }

    if (arg === "--include-deferred") {
      options.includeDeferred = true;
      continue;
    }

    if (arg === "--include-legal-review") {
      options.includeLegalReview = true;
      continue;
    }

    if (arg.startsWith("--phase=")) {
      const value = arg.slice("--phase=".length) as PhaseFilter;

      if (
        !["Current", "CurrentMvp", "NearTerm", "LaterPhase", "all"].includes(
          value
        )
      ) {
        throw new Error(`Unsupported phase filter: ${value}`);
      }

      options.phase = value;
      continue;
    }

    if (arg.startsWith("--tool=")) {
      const value = arg.slice("--tool=".length).trim();
      if (!value) throw new Error("--tool requires a tool ID.");
      options.toolId = value;
      continue;
    }

    throw new Error(`Unsupported flag: ${arg}`);
  }

  return {
    command,
    options
  };
}

function filterTools(options: CliOptions) {
  const phase = options.phase === "CurrentMvp" ? "Current" : options.phase;

  const tools = listOpenSourceToolDefinitions({
    includeDeferred: options.includeDeferred,
    includeLegalReview: options.includeLegalReview,
    phase
  });
  if (!options.toolId) return tools;
  const selected = tools.filter((tool) => tool.toolId === options.toolId);
  if (selected.length === 0) {
    throw new Error(
      `Tool ${options.toolId} is not available in the selected phase/policy filter.`
    );
  }
  return selected;
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function printToolLine(tool: OpenSourceToolDefinition) {
  const phase = tool.phase === "CurrentMvp" ? "Current" : tool.phase;

  console.log(
    [
      tool.toolId,
      phase,
      tool.policyStatus,
      tool.license,
      tool.runtimePreference.join("/"),
      tool.moduleIds.join(",")
    ].join(" | ")
  );
}

function runCommand(command: string, args: string[], cwd?: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with exit code ${code ?? -1}.`
        )
      );
    });
  });
}

async function handleList(options: CliOptions) {
  console.log("toolId | phase | policy | license | runtimes | modules");

  for (const tool of filterTools(options)) {
    printToolLine(tool);
  }
}

async function handleCheck(options: CliOptions) {
  for (const tool of filterTools(options)) {
    const resolution = await resolveOpenSourceToolRuntime(tool.toolId);
    const detail =
      resolution.runtime === "docker" && resolution.imageRef
        ? `image=${resolution.imageRef}`
        : resolution.runtime === "git"
          ? `checkout=${getOpenSourceToolCheckoutPath(tool.toolId)}`
          : resolution.displayCommand;

    console.log(
      [
        tool.toolId,
        resolution.available ? "available" : "missing",
        resolution.runtime ?? "unavailable",
        detail
      ].join(" | ")
    );
  }
}

async function pullDockerTool(tool: OpenSourceToolDefinition) {
  const resolution = await resolveOpenSourceToolRuntime(tool.toolId, {
    ...process.env,
    [`${getOpenSourceToolEnvPrefix(tool.toolId)}_RUNTIME`]: "docker"
  });

  if (
    !resolution.available ||
    resolution.runtime !== "docker" ||
    !resolution.imageRef
  ) {
    throw new Error(
      `${tool.displayName} requires docker for pull, but docker is not currently available.`
    );
  }

  await runCommand(resolution.command!, ["pull", resolution.imageRef]);
}

function isPinnedGitVersion(version: string) {
  return !["latest", "master"].includes(version);
}

async function pullGitTool(tool: OpenSourceToolDefinition) {
  const resolution = await resolveOpenSourceToolRuntime(tool.toolId, {
    ...process.env,
    [`${getOpenSourceToolEnvPrefix(tool.toolId)}_RUNTIME`]: "git"
  });

  if (!resolution.available || resolution.runtime !== "git" || !tool.gitRepo) {
    throw new Error(
      `${tool.displayName} requires git for pull, but git is not currently available.`
    );
  }

  const checkoutPath = getOpenSourceToolCheckoutPath(tool.toolId);
  const checkoutExists = await pathExists(checkoutPath);

  await mkdir(path.dirname(checkoutPath), {
    recursive: true
  });

  if (!checkoutExists) {
    const cloneArgs = ["clone", "--depth", "1"];

    if (isPinnedGitVersion(tool.defaultVersion)) {
      cloneArgs.push("--branch", tool.defaultVersion);
    }

    cloneArgs.push(tool.gitRepo, checkoutPath);
    await runCommand(resolution.command!, cloneArgs);
    return;
  }

  console.log(`reuse | ${tool.toolId} | ${checkoutPath}`);
}

async function handlePull(options: CliOptions) {
  const toolHome = getOpenSourceToolHome();

  await mkdir(toolHome, {
    recursive: true
  });

  for (const tool of filterTools(options)) {
    const pullRuntime = tool.runtimePreference.find(
      (runtime) => runtime === "docker" || runtime === "git"
    );

    if (!pullRuntime) {
      console.log(
        `skip | ${tool.toolId} | no pullable docker/git artifact; use ${tool.runtimePreference.join("/")} manually`
      );
      continue;
    }

    if (pullRuntime === "docker") {
      const imageRef = getDefaultDockerImageRef(tool);

      console.log(
        `pull | ${tool.toolId} | docker | ${imageRef ?? "missing-image"}`
      );
      await pullDockerTool(tool);
      continue;
    }

    console.log(
      `pull | ${tool.toolId} | git | ${tool.gitRepo ?? getOpenSourceToolCheckoutPath(tool.toolId)}`
    );
    await pullGitTool(tool);
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === "list") {
    await handleList(options);
    return;
  }

  if (command === "check") {
    await handleCheck(options);
    return;
  }

  await handlePull(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
