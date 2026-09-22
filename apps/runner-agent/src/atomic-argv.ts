import { execFile as execFileCb } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

import { getAtomicLabPlan } from "@periscan/modules";

const execFileDefault = promisify(execFileCb);

export const ATOMIC_ARGV_MODULE_ID = "atomic.control_validation_safe";
export const ATOMIC_ARGV_ALLOWED = new Set([
  "/bin/hostname",
  "/bin/env",
  "/bin/date"
]);

export type AtomicArgvCleanup = "succeeded" | "failed" | "cancelled";

export type AtomicArgvExec = (
  file: string,
  args: readonly string[],
  options: { timeout: number }
) => Promise<{ stdout: string; stderr: string }>;

export class AtomicArgvDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtomicArgvDeniedError";
  }
}

export type AtomicArgvResult = {
  cleanup: AtomicArgvCleanup;
  executed: boolean;
  outputSha256: string;
  stdoutBytes: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readArgv(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  if (!value.every((item) => typeof item === "string")) {
    return null;
  }
  return value as string[];
}

export function isAtomicArgvTask(task: {
  inputs?: unknown;
  moduleId: string;
}): boolean {
  if (task.moduleId !== ATOMIC_ARGV_MODULE_ID) {
    return false;
  }
  if (!isRecord(task.inputs)) {
    return false;
  }
  if (task.inputs.yamlEval === true) {
    return false;
  }
  return readArgv(task.inputs.argv) !== null;
}

export function resolveAtomicArgvFromTask(task: {
  inputs?: unknown;
  moduleId: string;
  target?: unknown;
}): { argv: readonly string[]; guid: string } {
  if (!isAtomicArgvTask(task) || !isRecord(task.inputs)) {
    throw new AtomicArgvDeniedError(
      "Task is not an Atomic argv envelope. Denied tasks are never queued."
    );
  }
  const argv = readArgv(task.inputs.argv);
  const guid =
    typeof task.inputs.guid === "string"
      ? task.inputs.guid
      : isRecord(task.target) && typeof task.target.guid === "string"
        ? task.target.guid
        : "";
  if (!argv || !guid) {
    throw new AtomicArgvDeniedError(
      "Atomic argv task is missing guid or argv. Denied tasks are never queued."
    );
  }
  return { argv, guid };
}

export async function executeAtomicArgv(input: {
  argv: readonly string[];
  exec?: AtomicArgvExec;
  guid: string;
}): Promise<AtomicArgvResult> {
  if (input.argv.length !== 1 || !ATOMIC_ARGV_ALLOWED.has(input.argv[0]!)) {
    throw new AtomicArgvDeniedError(
      "Atomic argv is not allowlisted. Commands are never eval'd from YAML. Denied tasks are never queued."
    );
  }
  const plan = getAtomicLabPlan(input.guid);
  if (!plan || plan.executable !== input.argv[0]) {
    throw new AtomicArgvDeniedError(
      "Atomic guid is not a reviewed Linux argv pin. Denied tasks are never queued."
    );
  }

  const exec = input.exec ?? defaultExec;
  try {
    const { stdout } = await exec(input.argv[0]!, [], {
      timeout: plan.timeoutMs
    });
    const output = stdout ?? "";
    return {
      cleanup: "succeeded",
      executed: true,
      outputSha256: createHash("sha256").update(output, "utf8").digest("hex"),
      stdoutBytes: Buffer.byteLength(output, "utf8")
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "AbortError") {
      return {
        cleanup: "cancelled",
        executed: false,
        outputSha256: "0".repeat(64),
        stdoutBytes: 0
      };
    }
    return {
      cleanup: "failed",
      executed: false,
      outputSha256: "0".repeat(64),
      stdoutBytes: 0
    };
  }
}

async function defaultExec(
  file: string,
  args: readonly string[],
  options: { timeout: number }
): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileDefault(file, [...args], {
    timeout: options.timeout,
    maxBuffer: 8192
  });
  return {
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? "")
  };
}
