import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  A2ATckRequirementResultSchema,
  A2ATckTransportResultSchema,
  type A2ATckRequirementResult,
  type A2ATckTransportResult,
  type RunA2ATckInput
} from "@periscan/shared";
import { z } from "zod";

import { getOpenSourceToolCheckoutPath } from "./toolchain.js";

const execFile = promisify(execFileCallback);

export const A2A_TCK_PINNED_VERSION = "1.0.0.alpha2";
const A2A_TCK_REPORT_MAX_BYTES = 10 * 1024 * 1024;
const A2A_TCK_DEFAULT_TIMEOUT_MS = 5 * 60_000;

const RawRequirementSchema = z.object({
  errors: z.array(z.unknown()).default([]),
  level: z.enum(["MUST", "SHOULD", "MAY"]),
  status: z.enum(["PASS", "FAIL", "SKIPPED", "NOT TESTED"]),
  transports: z
    .record(z.string(), z.enum(["PASS", "FAIL", "SKIPPED"]))
    .default({})
});

const RawA2ATckReportSchema = z.object({
  per_requirement: z.record(z.string(), RawRequirementSchema),
  per_transport: z.record(
    z.string(),
    z.object({
      failed: z.number().int().nonnegative(),
      passed: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative().default(0),
      total: z.number().int().nonnegative()
    })
  ),
  summary: z.object({
    may_compatibility: z.string(),
    must_compatibility: z.string(),
    overall_compatibility: z.string(),
    should_compatibility: z.string(),
    spec_version: z.string().default("")
  })
});

export interface A2ATckExecutionInput {
  level: RunA2ATckInput["level"];
  sutHost: string;
  transports: RunA2ATckInput["transports"];
}

export interface A2ATckExecutionProof {
  compatible: boolean;
  mayCompatibility: number;
  mustCompatibility: number;
  overallCompatibility: number;
  reportHash: string;
  requirementResults: A2ATckRequirementResult[];
  shouldCompatibility: number;
  specVersion: string | null;
  toolVersion: string;
  transportResults: A2ATckTransportResult[];
}

export type A2ATckExecutor = (
  input: A2ATckExecutionInput
) => Promise<A2ATckExecutionProof>;

function parsePercent(value: string) {
  const parsed = Number.parseFloat(value.replace(/%$/u, ""));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`A2A TCK returned an invalid compatibility value.`);
  }
  return parsed;
}

function sanitizeTckError(value: unknown) {
  return String(value)
    .replace(
      /authorization\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/giu,
      "authorization=[redacted]"
    )
    .replace(/bearer\s+[A-Za-z0-9._~+/=-]+/giu, "Bearer [redacted]")
    .replace(/[A-Za-z0-9+/=_-]{160,}/gu, "[long-value-redacted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 1_000);
}

export function normalizeA2ATckReport(
  rawReport: unknown,
  reportBytes: string,
  toolVersion = A2A_TCK_PINNED_VERSION
): A2ATckExecutionProof {
  const report = RawA2ATckReportSchema.parse(rawReport);
  const requirementResults = Object.entries(report.per_requirement)
    .map(([requirementId, requirement]) =>
      A2ATckRequirementResultSchema.parse({
        errors: requirement.errors
          .map(sanitizeTckError)
          .filter(Boolean)
          .slice(0, 20),
        level: requirement.level,
        requirementId: requirementId.slice(0, 160),
        status:
          requirement.status === "NOT TESTED"
            ? "NOT_TESTED"
            : requirement.status,
        transports: requirement.transports
      })
    )
    .sort((left, right) =>
      left.requirementId.localeCompare(right.requirementId)
    );
  const transportResults = Object.entries(report.per_transport)
    .filter(([transport]) =>
      ["grpc", "jsonrpc", "http_json"].includes(transport)
    )
    .map(([transport, result]) =>
      A2ATckTransportResultSchema.parse({
        ...result,
        transport
      })
    );
  const mustCompatibility = parsePercent(report.summary.must_compatibility);
  const unprovenMustRequirement = requirementResults.some(
    (requirement) =>
      requirement.level === "MUST" && requirement.status !== "PASS"
  );

  return {
    compatible: mustCompatibility === 100 && !unprovenMustRequirement,
    mayCompatibility: parsePercent(report.summary.may_compatibility),
    mustCompatibility,
    overallCompatibility: parsePercent(report.summary.overall_compatibility),
    reportHash: createHash("sha256").update(reportBytes).digest("hex"),
    requirementResults,
    shouldCompatibility: parsePercent(report.summary.should_compatibility),
    specVersion: report.summary.spec_version.trim() || null,
    toolVersion,
    transportResults
  };
}

function timeoutFromEnv(env: NodeJS.ProcessEnv) {
  const configured = Number.parseInt(env.PERISCAN_A2A_TCK_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(configured) && configured >= 10_000
    ? Math.min(configured, 15 * 60_000)
    : A2A_TCK_DEFAULT_TIMEOUT_MS;
}

const A2A_TCK_PROCESS_ENV_ALLOWLIST = [
  "CI",
  "CURL_CA_BUNDLE",
  "HOME",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "LANG",
  "LC_ALL",
  "NO_PROXY",
  "NODE_ENV",
  "PATH",
  "PIP_CERT",
  "REQUESTS_CA_BUNDLE",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "UV_CACHE_DIR",
  "UV_NATIVE_TLS",
  "UV_PYTHON",
  "UV_PYTHON_INSTALL_DIR",
  "WINDIR",
  "XDG_CACHE_HOME"
] as const;

/**
 * Keep application, cloud, database, and signing credentials out of the
 * third-party TCK process. The pinned TCK receives only runtime and network
 * trust settings needed to execute against the authorized target.
 */
export function buildA2ATckProcessEnv(
  env: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    A2A_TCK_PROCESS_ENV_ALLOWLIST.flatMap((key) => {
      const value = env[key];
      return value === undefined ? [] : [[key, value]];
    })
  ) as NodeJS.ProcessEnv;
}

export async function executeA2ATck(
  input: A2ATckExecutionInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<A2ATckExecutionProof> {
  const checkoutPath = path.resolve(
    env.PERISCAN_A2A_TCK_CHECKOUT ??
      getOpenSourceToolCheckoutPath("a2a-tck", env)
  );
  const uvBinary = env.PERISCAN_A2A_TCK_UV_BINARY?.trim() || "uv";
  const expectedVersion =
    env.PERISCAN_A2A_TCK_VERSION ?? A2A_TCK_PINNED_VERSION;
  const processEnv = buildA2ATckProcessEnv(env);
  const workspace = await mkdtemp(path.join(tmpdir(), "periscan-a2a-tck-"));
  const executionPath = path.join(workspace, "tck");

  try {
    await readFile(path.join(checkoutPath, "run_tck.py"));
    let checkedOutVersion = "";
    try {
      const result = await execFile(
        env.PERISCAN_A2A_TCK_GIT_BINARY?.trim() || "git",
        ["-C", checkoutPath, "describe", "--tags", "--exact-match"],
        { env: processEnv, maxBuffer: 1024 * 1024, timeout: 10_000 }
      );
      checkedOutVersion = result.stdout.trim();
    } catch {
      throw new Error(
        `The A2A TCK checkout is not pinned to the required ${expectedVersion} tag.`
      );
    }
    if (checkedOutVersion !== expectedVersion) {
      throw new Error(
        `The A2A TCK checkout is ${checkedOutVersion}; ${expectedVersion} is required.`
      );
    }
    await cp(checkoutPath, executionPath, {
      filter: (source) =>
        ![".git", ".venv", "reports"].includes(path.basename(source)),
      recursive: true
    });
    const args = [
      "run",
      "./run_tck.py",
      "--sut-host",
      input.sutHost,
      "--transport",
      input.transports.join(",")
    ];
    if (input.level !== "all") args.push("--level", input.level);

    let executionFailure: unknown = null;
    try {
      await execFile(uvBinary, args, {
        cwd: executionPath,
        env: processEnv,
        maxBuffer: A2A_TCK_REPORT_MAX_BYTES,
        timeout: timeoutFromEnv(env)
      });
    } catch (error) {
      executionFailure = error;
    }

    let reportBytes: string;
    try {
      reportBytes = await readFile(
        path.join(executionPath, "reports", "compatibility.json"),
        "utf8"
      );
    } catch {
      const detail = sanitizeTckError(
        executionFailure instanceof Error
          ? executionFailure.message
          : executionFailure
      );
      throw new Error(
        `The official A2A TCK did not produce compatibility.json.${detail ? ` ${detail}` : ""}`
      );
    }
    if (Buffer.byteLength(reportBytes) > A2A_TCK_REPORT_MAX_BYTES) {
      throw new Error("The official A2A TCK report exceeded 10 MB.");
    }
    return normalizeA2ATckReport(
      JSON.parse(reportBytes) as unknown,
      reportBytes,
      expectedVersion
    );
  } finally {
    await rm(workspace, { force: true, recursive: true });
  }
}
