/**
 * Noninteractive operator commands. No Ink.
 *
 * Captain hook (`index.tsx`): skip `render()` when `isCliArgv(argv)` —
 * argv includes `--json`, `--help`/`-h`, or the first positional is
 * `health` or `run`. Then `process.exit(await runCli(parseCli(argv)))`.
 *
 *   pnpm tui -- health
 *   pnpm tui -- run --scope <id> --json
 */
import { communityPolicyPreviewRequest } from "@periscan/shared";

import { SCREEN_ORDER, screenLabel } from "./nav.js";
import { PeriscanApi, PeriscanApiError } from "./lib/api.js";
import { pinGitleaksRepoSecretsModuleIds } from "./lib/gitleaks-pin.js";

export const DEFAULT_API_URL = "http://127.0.0.1:3001";

export type CliCommand = "tui" | "health" | "run";

export interface ParsedCli {
  apiUrl: string;
  command: CliCommand;
  help: boolean;
  json: boolean;
  scopeId?: string;
}

export interface IoWriter {
  write(chunk: string): unknown;
}

export interface CliRuntime {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  stderr?: IoWriter;
  stdout?: IoWriter;
}

export function normalizeApiUrl(url: string): string {
  return url.replace(/\/+$/u, "");
}

export function isCliArgv(argv: string[]): boolean {
  const args = argv.filter((arg) => arg !== "--");
  if (
    args.includes("--json") ||
    args.includes("--help") ||
    args.includes("-h")
  ) {
    return true;
  }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === undefined) {
      break;
    }
    if (arg === "--api" || arg === "--scope") {
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    return arg === "health" || arg === "run";
  }
  return false;
}

export function parseCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  fallbackApiUrl: string = DEFAULT_API_URL
): ParsedCli {
  let apiUrl = env.PERISCAN_API_URL?.trim() || fallbackApiUrl || DEFAULT_API_URL;
  let command: CliCommand = "tui";
  let help = false;
  let json = false;
  let scopeId: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined || arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--api") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for --api (control plane URL).");
      }
      apiUrl = value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--api=")) {
      const value = arg.slice("--api=".length);
      if (!value) {
        throw new Error("Missing value for --api (control plane URL).");
      }
      apiUrl = value;
      continue;
    }

    if (arg === "--scope") {
      const value = argv[i + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for --scope <id>.");
      }
      scopeId = value;
      i += 1;
      continue;
    }

    if (arg.startsWith("--scope=")) {
      const value = arg.slice("--scope=".length);
      if (!value) {
        throw new Error("Missing value for --scope <id>.");
      }
      scopeId = value;
      continue;
    }

    if (arg === "health") {
      command = "health";
      continue;
    }

    if (arg === "run") {
      command = "run";
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    throw new Error(`Unknown command: ${arg}`);
  }

  if (command === "run" && !scopeId) {
    throw new Error("run requires --scope <id>.");
  }

  return {
    apiUrl: normalizeApiUrl(apiUrl) || DEFAULT_API_URL,
    command,
    help,
    json,
    ...(scopeId ? { scopeId } : {})
  };
}

export function printUsage(write: (chunk: string) => void): void {
  const keys = SCREEN_ORDER.map(
    (id, index) => `${index + 1} ${screenLabel(id)}`
  ).join(" · ");

  write(`Periscan operator TUI (Apache-2.0)

Usage:
  periscan [--api <url>]                    Interactive operator TUI
  periscan health [--api <url>] [--json]    Noninteractive GET /api/v1/health
  periscan run --scope <id> [--json]        Pin gitleaks.repo_secrets (same as interactive g)

  pnpm tui
  pnpm tui -- --api http://127.0.0.1:3001
  pnpm tui -- health
  pnpm tui -- run --scope <id> --json

Environment:
  PERISCAN_API_URL      Control plane origin (default ${DEFAULT_API_URL})
  PERISCAN_API_TOKEN    Session cookie (periscan_session=…), raw session JWT, or Bearer API key (psk_…)
  PERISCAN_CSRF_TOKEN   periscan_csrf cookie value (sent as x-csrf-token; not used with psk_ keys)
  --api                 Overrides PERISCAN_API_URL for this process

Login:
  Interactive: press 2 (auth) and login with email/password.
  Scripts: lab-session exports — Cookie + x-csrf-token on mutating calls.
  Session cookie: periscan_session
  CSRF cookie periscan_csrf is echoed as x-csrf-token on mutating calls.

Keys:
  1–9 jump screens (${keys})
  g pin gitleaks.repo_secrets on run (4)
  e evidence
  b BAS
  ? help
  q quit

Safety:
  Denied policy decisions never queue.
  BAS adapters require qualified scenarios, policy approval and verified cleanup.
`);
}

function createApi(
  apiUrl: string,
  runtime: CliRuntime
): PeriscanApi {
  const env = runtime.env ?? process.env;
  const api = new PeriscanApi(apiUrl, { fetchImpl: runtime.fetchImpl });
  api.applyLabAuth(env.PERISCAN_API_TOKEN, env.PERISCAN_CSRF_TOKEN);
  return api;
}

function writeJson(writer: IoWriter, payload: unknown): void {
  writer.write(`${JSON.stringify(payload)}\n`);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runHealthCommand(options: {
  apiUrl: string;
  fetchImpl?: typeof fetch;
  stdout?: IoWriter;
  stderr?: IoWriter;
  env?: NodeJS.ProcessEnv;
}): Promise<number> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  try {
    const api = createApi(options.apiUrl, options);
    const payload = await api.health();
    writeJson(stdout, payload);
    return payload.status === "ok" ? 0 : 1;
  } catch (error) {
    stderr.write(`${errorText(error)}\n`);
    return 1;
  }
}

type ScopeRow = {
  scopeId?: string;
  scopeType?: string;
  value?: string;
  verificationStatus?: string;
};

type PolicyRow = {
  approvalState?: string;
  outcome?: string;
  policyDecisionId?: string;
  rationale?: string;
  scopeId?: string;
};

function policyAllowsRun(policy: PolicyRow): boolean {
  return (
    policy.outcome === "Allowed" ||
    (policy.outcome === "RequiresApproval" &&
      policy.approvalState === "Approved")
  );
}

export async function runScopeCommand(options: {
  apiUrl: string;
  scopeId: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  stdout?: IoWriter;
  stderr?: IoWriter;
}): Promise<number> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const scopeId = options.scopeId.trim();
  if (!scopeId) {
    stderr.write("run requires --scope <id>.\n");
    return 2;
  }

  const api = createApi(options.apiUrl, options);
  try {
    const scope = await api.requestJson<ScopeRow>(`/api/v1/scopes/${scopeId}`);
    if (
      scope.verificationStatus &&
      scope.verificationStatus !== "Verified"
    ) {
      stderr.write(
        `Scope ${scopeId} is ${scope.verificationStatus}; Community run requires a verified scope.\n`
      );
      return 1;
    }

    const suite = await api.communitySuite(scopeId);
    const preview = communityPolicyPreviewRequest({
      cloudAwsAvailable: suite.cloudAwsAvailable,
      runnerAvailable: suite.runnerAvailable,
      scopeType: scope.scopeType ?? suite.scopeType ?? "Domain"
    });
    const policy = await api.previewPolicy({
      executionEnvironment: preview.executionEnvironment,
      safetyLevel: preview.safetyLevel,
      scopeId,
      target: { value: scope.value ?? scopeId }
    });

    if (policy.outcome === "Denied") {
      writeJson(stdout, policy);
      stderr.write("Denied never queues\n");
      return 1;
    }
    if (!policyAllowsRun(policy)) {
      writeJson(stdout, policy);
      stderr.write(`${policy.outcome} does not queue Community work\n`);
      return 1;
    }

    const moduleIds = pinGitleaksRepoSecretsModuleIds(
      suite.startableModuleIds ?? []
    );
    const started = await api.startCommunity({
      policyDecisionId: policy.policyDecisionId,
      scopeId,
      ...(moduleIds ? { moduleIds } : {})
    });
    writeJson(stdout, started);
    return 0;
  } catch (error) {
    if (error instanceof PeriscanApiError && error.code === "policy_denied") {
      writeJson(stdout, {
        code: error.code,
        error: error.message
      });
      stderr.write("Denied never queues\n");
      return 1;
    }
    stderr.write(`${errorText(error)}\n`);
    return 1;
  }
}

export async function runCli(
  parsed: ParsedCli,
  runtime: CliRuntime = {}
): Promise<number> {
  const stderr = runtime.stderr ?? process.stderr;
  if (parsed.help) {
    printUsage((chunk) => {
      (runtime.stdout ?? process.stdout).write(chunk);
    });
    return 0;
  }
  if (parsed.command === "health") {
    return runHealthCommand({
      apiUrl: parsed.apiUrl,
      env: runtime.env,
      fetchImpl: runtime.fetchImpl,
      stderr,
      stdout: runtime.stdout
    });
  }
  if (parsed.command === "run") {
    return runScopeCommand({
      apiUrl: parsed.apiUrl,
      env: runtime.env,
      fetchImpl: runtime.fetchImpl,
      scopeId: parsed.scopeId ?? "",
      stderr,
      stdout: runtime.stdout
    });
  }
  stderr.write(
    "Noninteractive mode (--json) requires health or run --scope <id>.\n"
  );
  printUsage((chunk) => {
    stderr.write(chunk);
  });
  return 2;
}
