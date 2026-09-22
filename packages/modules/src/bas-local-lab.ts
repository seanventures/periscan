import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { parse } from "yaml";

/** Reviewed Atomic content, MIT: see docs/legal/ATOMIC_CONTENT_NOTICE.md. */
export const ATOMIC_HOSTNAME_LAB = Object.freeze({
  scenarioId: "atomic:486e88ea-4f56-470f-9b57-3f4d73f39133",
  techniqueId: "T1082",
  name: "Hostname Discovery",
  sourceRevision: "11ff111ace63e02825dd44ce8246800203a10ce8",
  sourcePath: "atomics/T1082/T1082.yaml",
  sourceUrl:
    "https://raw.githubusercontent.com/redcanaryco/atomic-red-team/11ff111ace63e02825dd44ce8246800203a10ce8/atomics/T1082/T1082.yaml",
  contentSha256:
    "6cfdcdd8d114195f788bf719baecda1a95363d904316a156c8f44e45e71e9f29",
  image:
    "busybox@sha256:9db7b59979c38555a39def84a31fb98b5296952f9e3afd4f6f11f05b07adfab0",
  platform: "linux",
  executable: "/bin/hostname",
  expectedHostname: "periscan-bas-lab",
  timeoutMs: 15_000,
  maxOutputBytes: 8192,
  memoryMb: 64,
  cpus: 0.25,
  pids: 16,
  network: "none",
  user: "65534:65534",
  readOnly: true,
  hostMounts: false,
  capabilities: "none",
  newPrivileges: false
} as const);

/** Second reviewed Linux-safe discovery test from the same T1082 fixture. */
export const ATOMIC_ENV_LAB = Object.freeze({
  scenarioId: "atomic:fcbdd43f-f4ad-42d5-98f3-0218097e2720",
  techniqueId: "T1082",
  name: "Environment variables discovery on freebsd, macos and linux",
  sourceRevision: ATOMIC_HOSTNAME_LAB.sourceRevision,
  sourcePath: ATOMIC_HOSTNAME_LAB.sourcePath,
  sourceUrl: ATOMIC_HOSTNAME_LAB.sourceUrl,
  contentSha256: ATOMIC_HOSTNAME_LAB.contentSha256,
  image: ATOMIC_HOSTNAME_LAB.image,
  platform: "linux",
  executable: "/bin/env",
  expectedHostname: "periscan-bas-lab",
  timeoutMs: 15_000,
  maxOutputBytes: 8192,
  memoryMb: 64,
  cpus: 0.25,
  pids: 16,
  network: "none",
  user: "65534:65534",
  readOnly: true,
  hostMounts: false,
  capabilities: "none",
  newPrivileges: false
} as const);

/** Third reviewed Linux-safe discovery test: T1124 system time (`date`). */
export const ATOMIC_DATE_LAB = Object.freeze({
  scenarioId: "atomic:f449c933-0891-407f-821e-7916a21a1a6f",
  techniqueId: "T1124",
  name: "System Time Discovery in FreeBSD/macOS",
  sourceRevision: ATOMIC_HOSTNAME_LAB.sourceRevision,
  sourcePath: "atomics/T1124/T1124.yaml",
  sourceUrl:
    "https://raw.githubusercontent.com/redcanaryco/atomic-red-team/11ff111ace63e02825dd44ce8246800203a10ce8/atomics/T1124/T1124.yaml",
  contentSha256:
    "68391c9deff4ac6f43683bf4a5d5fa149764de3ce04f41957ea5afb36f7868aa",
  image: ATOMIC_HOSTNAME_LAB.image,
  platform: "linux",
  executable: "/bin/date",
  expectedHostname: "periscan-bas-lab",
  timeoutMs: 15_000,
  maxOutputBytes: 8192,
  memoryMb: 64,
  cpus: 0.25,
  pids: 16,
  network: "none",
  user: "65534:65534",
  readOnly: true,
  hostMounts: false,
  capabilities: "none",
  newPrivileges: false
} as const);

export type AtomicLabPlan =
  | typeof ATOMIC_HOSTNAME_LAB
  | typeof ATOMIC_ENV_LAB
  | typeof ATOMIC_DATE_LAB;

const YAML_COMMAND_BY_SCENARIO: Record<string, string> = {
  [ATOMIC_HOSTNAME_LAB.scenarioId]: "hostname\n",
  [ATOMIC_ENV_LAB.scenarioId]: "env\n",
  [ATOMIC_DATE_LAB.scenarioId]: "date\n"
};

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const atomicHostnameLabPlanSha256 = () =>
  sha256(JSON.stringify(ATOMIC_HOSTNAME_LAB));
export const atomicEnvLabPlanSha256 = () =>
  sha256(JSON.stringify(ATOMIC_ENV_LAB));
export const atomicDateLabPlanSha256 = () =>
  sha256(JSON.stringify(ATOMIC_DATE_LAB));
export const atomicLabPlanSha256 = (plan: AtomicLabPlan) =>
  sha256(JSON.stringify(plan));

export function normalizeAtomicLabGuid(guid: string): string {
  return guid.startsWith("atomic:") ? guid.slice("atomic:".length) : guid;
}

export function getAtomicLabPlan(guid: string): AtomicLabPlan | undefined {
  const scenarioId = `atomic:${normalizeAtomicLabGuid(guid)}`;
  if (scenarioId === ATOMIC_HOSTNAME_LAB.scenarioId) return ATOMIC_HOSTNAME_LAB;
  if (scenarioId === ATOMIC_ENV_LAB.scenarioId) return ATOMIC_ENV_LAB;
  if (scenarioId === ATOMIC_DATE_LAB.scenarioId) return ATOMIC_DATE_LAB;
  return undefined;
}

export const ATOMIC_LAB_PLANS: readonly AtomicLabPlan[] = [
  ATOMIC_HOSTNAME_LAB,
  ATOMIC_ENV_LAB,
  ATOMIC_DATE_LAB
];

export interface LabCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
  cancelled?: boolean;
  outputLimitExceeded?: boolean;
}
export interface LabCommandOptions {
  timeoutMs: number;
  maxOutputBytes: number;
  signal?: AbortSignal;
}
export type LabDockerCommand = (
  args: string[],
  options: LabCommandOptions
) => Promise<LabCommandResult>;

/** No shell, caller command strings, host mounts, or arbitrary image selection. */
export const executeLabDockerCommand: LabDockerCommand = (args, options) =>
  new Promise((resolve) => {
    if (options.signal?.aborted) {
      resolve({ exitCode: null, stdout: "", stderr: "", cancelled: true });
      return;
    }
    execFile(
      "docker",
      args,
      {
        encoding: "utf8",
        timeout: options.timeoutMs,
        maxBuffer: options.maxOutputBytes,
        killSignal: "SIGKILL",
        signal: options.signal,
        // Every mutating call explicitly binds the inspected local Unix socket.
        env: { ...process.env, DOCKER_CONTEXT: "" }
      },
      (error, stdout, stderr) => {
        const outputLimitExceeded =
          error?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
        resolve({
          exitCode: error
            ? typeof error.code === "number"
              ? error.code
              : null
            : 0,
          stdout,
          stderr,
          outputLimitExceeded,
          cancelled: options.signal?.aborted ?? false,
          timedOut: Boolean(
            error?.killed && !outputLimitExceeded && !options.signal?.aborted
          )
        });
      }
    );
  });

export interface AtomicLabReceipt {
  kind: "AtomicLocalLabQualification";
  runId: string;
  startedAt: string;
  completedAt: string;
  planSha256: string;
  sourceRevision: string;
  sourceSha256: string;
  sourceVerified: boolean;
  scenarioId: string;
  guid: string;
  image: string;
  containerName: string;
  countedAsCustomerExecution: false;
  customerLiveSupported: false;
  policyDecision: {
    outcome: "Allowed" | "Denied";
    reason: string;
    scope: "DisposableLocalContainer";
  };
  execution: {
    status:
      | "NotStarted"
      | "Completed"
      | "Failed"
      | "TimedOut"
      | "Cancelled"
      | "OutputLimitExceeded";
    exitCode: number | null;
    stdoutSha256: string | null;
    stdoutBytes: number;
    expectedOutputMatched: boolean;
  };
  cleanup: "NotRequired" | "Verified" | "Failed";
  detection: "NotMeasured";
  qualification: "Passed" | "Failed";
}

export interface AtomicLabPrerequisiteReport {
  dockerUnixSocket: boolean;
  ok: boolean;
  pinnedImagePresent: boolean;
  planApproved: boolean;
  reason: string;
  scenarioAllowlisted: boolean;
  sourceVerified: boolean;
  typedInputsValid: boolean;
}

export interface AtomicLabQualifyInput {
  approvedPlanSha256: string;
  guid: string;
  signal?: AbortSignal;
  sourceContent: string;
  typedInputs?: Record<string, unknown>;
}

function verifySource(source: string, plan: AtomicLabPlan) {
  if (
    Buffer.byteLength(source, "utf8") > 256 * 1024 ||
    sha256(source) !== plan.contentSha256
  )
    return false;
  // The exact source digest is checked before parsing, and only this reviewed
  // definition is eligible. No YAML command is passed to a shell or subprocess.
  const document = parse(source);
  const test = document.atomic_tests?.find(
    (item: { auto_generated_guid: string }) =>
      `atomic:${item.auto_generated_guid}` === plan.scenarioId
  );
  return (
    document.attack_technique === plan.techniqueId &&
    test?.executor?.command === YAML_COMMAND_BY_SCENARIO[plan.scenarioId] &&
    test.executor.name === "sh" &&
    !test.executor.elevation_required &&
    !test.dependencies?.length &&
    !test.input_arguments &&
    !test.executor.cleanup_command &&
    test.supported_platforms?.includes("linux")
  );
}

function typedInputsAreEmpty(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.keys(value).length === 0;
}

function outputMatchesPlan(plan: AtomicLabPlan, stdout: string): boolean {
  if (plan.executable === "/bin/env") {
    return stdout.includes(`HOSTNAME=${plan.expectedHostname}`);
  }
  if (plan.executable === "/bin/date") {
    return /^[A-Za-z]{3} [A-Za-z]{3} [ 0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2} /.test(
      stdout.trim()
    );
  }
  return stdout.trim() === plan.expectedHostname;
}

function emptyReceipt(
  plan: AtomicLabPlan | undefined,
  guid: string
): AtomicLabReceipt {
  return {
    kind: "AtomicLocalLabQualification",
    runId: randomUUID(),
    containerName: "",
    startedAt: new Date().toISOString(),
    completedAt: "",
    planSha256: plan ? atomicLabPlanSha256(plan) : "0".repeat(64),
    sourceRevision: plan?.sourceRevision ?? "",
    sourceSha256: plan?.contentSha256 ?? "0".repeat(64),
    sourceVerified: false,
    scenarioId: plan?.scenarioId ?? `atomic:${guid}`,
    guid,
    image: plan?.image ?? "",
    countedAsCustomerExecution: false,
    customerLiveSupported: false,
    policyDecision: {
      outcome: "Denied",
      reason: "Plan or source integrity check failed.",
      scope: "DisposableLocalContainer"
    },
    execution: {
      status: "NotStarted",
      exitCode: null,
      stdoutSha256: null,
      stdoutBytes: 0,
      expectedOutputMatched: false
    },
    cleanup: "NotRequired",
    detection: "NotMeasured",
    qualification: "Failed"
  };
}

export async function checkAtomicLabPrerequisites(
  input: AtomicLabQualifyInput,
  docker: LabDockerCommand = executeLabDockerCommand
): Promise<AtomicLabPrerequisiteReport> {
  const plan = getAtomicLabPlan(input.guid);
  const report: AtomicLabPrerequisiteReport = {
    dockerUnixSocket: false,
    ok: false,
    pinnedImagePresent: false,
    planApproved: false,
    reason:
      "Not in the reviewed Linux-safe lab allowlist. Fail closed; commands are never eval'd from YAML.",
    scenarioAllowlisted: Boolean(plan),
    sourceVerified: false,
    typedInputsValid: typedInputsAreEmpty(input.typedInputs)
  };
  if (!plan) return report;
  if (!report.typedInputsValid) {
    report.reason = "Typed inputs are not accepted for this reviewed scenario.";
    return report;
  }
  report.sourceVerified = verifySource(input.sourceContent, plan);
  report.planApproved = input.approvedPlanSha256 === atomicLabPlanSha256(plan);
  if (!report.sourceVerified || !report.planApproved) {
    report.reason = "Plan or source integrity check failed.";
    return report;
  }
  const configuredHost = process.env.DOCKER_HOST;
  const endpointResult = configuredHost
    ? { exitCode: 0, stdout: configuredHost, stderr: "" }
    : await docker(
        ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
        { timeoutMs: 10_000, maxOutputBytes: 8192, signal: input.signal }
      );
  const endpoint = endpointResult.stdout.trim();
  report.dockerUnixSocket =
    endpointResult.exitCode === 0 &&
    /^unix:\/\/\/[A-Za-z0-9_./-]+\.sock$/.test(endpoint);
  if (!report.dockerUnixSocket) {
    report.reason = "A local Docker Unix socket is required.";
    return report;
  }
  const image = await docker(
    ["--host", endpoint, "image", "inspect", plan.image, "--format", "{{.Id}}"],
    {
      timeoutMs: plan.timeoutMs,
      maxOutputBytes: plan.maxOutputBytes,
      signal: input.signal
    }
  );
  report.pinnedImagePresent =
    image.exitCode === 0 && /^sha256:[a-f0-9]{64}$/.test(image.stdout.trim());
  if (!report.pinnedImagePresent) {
    report.reason = "Pinned lab image is not available locally.";
    return report;
  }
  report.ok = true;
  report.reason =
    "Exact reviewed source and plan; local disposable container with fixed isolation and resource limits.";
  return report;
}

/** Developer qualification only; no control-plane run, finding or detection verdict. */
export async function qualifyAtomicLabScenario(
  input: AtomicLabQualifyInput,
  docker: LabDockerCommand = executeLabDockerCommand
): Promise<AtomicLabReceipt> {
  const guid = normalizeAtomicLabGuid(input.guid);
  const plan = getAtomicLabPlan(guid);
  const receipt = emptyReceipt(plan, guid);
  receipt.containerName = `periscan-bas-${receipt.runId}`;
  const finish = () => {
    receipt.completedAt = new Date().toISOString();
    return receipt;
  };
  if (!plan) {
    receipt.policyDecision.reason =
      "Not in the reviewed Linux-safe lab allowlist. Fail closed; commands are never eval'd from YAML.";
    return finish();
  }
  if (!typedInputsAreEmpty(input.typedInputs)) {
    receipt.policyDecision.reason =
      "Typed inputs are not accepted for this reviewed scenario.";
    return finish();
  }
  if (
    input.approvedPlanSha256 !== receipt.planSha256 ||
    !verifySource(input.sourceContent, plan)
  )
    return finish();
  receipt.sourceVerified = true;
  if (input.signal?.aborted) {
    receipt.execution.status = "Cancelled";
    receipt.policyDecision.reason = "Cancelled before execution.";
    return finish();
  }
  // Reject remote Docker contexts before any create/start call. Bind all later
  // commands to this exact local endpoint, independent of context changes.
  const configuredHost = process.env.DOCKER_HOST;
  const endpointResult = configuredHost
    ? { exitCode: 0, stdout: configuredHost, stderr: "" }
    : await docker(
        ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
        { timeoutMs: 10_000, maxOutputBytes: 8192, signal: input.signal }
      );
  const endpoint = endpointResult.stdout.trim();
  if (
    endpointResult.exitCode !== 0 ||
    !/^unix:\/\/\/[A-Za-z0-9_./-]+\.sock$/.test(endpoint)
  ) {
    receipt.policyDecision.reason = "A local Docker Unix socket is required.";
    return finish();
  }
  const call = (args: string[], cancellable = true) =>
    docker(["--host", endpoint, ...args], {
      timeoutMs: plan.timeoutMs,
      maxOutputBytes: plan.maxOutputBytes,
      ...(cancellable ? { signal: input.signal } : {})
    });
  const image = await call([
    "image",
    "inspect",
    plan.image,
    "--format",
    "{{.Id}}"
  ]);
  if (
    image.exitCode !== 0 ||
    !/^sha256:[a-f0-9]{64}$/.test(image.stdout.trim())
  ) {
    receipt.policyDecision.reason =
      "Pinned lab image is not available locally.";
    return finish();
  }
  if (input.signal?.aborted) {
    receipt.execution.status = "Cancelled";
    receipt.policyDecision.reason = "Cancelled before container creation.";
    return finish();
  }
  receipt.policyDecision = {
    outcome: "Allowed",
    reason:
      "Exact reviewed source and plan; local disposable container with fixed isolation and resource limits.",
    scope: "DisposableLocalContainer"
  };
  let creationAttempted = false;
  try {
    creationAttempted = true;
    const created = await call([
      "create",
      "--pull=never",
      "--name",
      receipt.containerName,
      "--label",
      `io.periscan.bas.run-id=${receipt.runId}`,
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--user",
      plan.user,
      "--memory",
      `${plan.memoryMb}m`,
      "--cpus",
      String(plan.cpus),
      "--pids-limit",
      String(plan.pids),
      "--hostname",
      plan.expectedHostname,
      "--entrypoint",
      plan.executable,
      plan.image
    ]);
    const execution =
      created.exitCode === 0
        ? await call(["start", "--attach", receipt.containerName])
        : created;
    if (created.exitCode === 0 && execution.exitCode === 0) {
      const stateResult = await call([
        "container",
        "inspect",
        receipt.containerName,
        "--format",
        "{{json .State}}"
      ]);
      if (stateResult.exitCode !== 0) {
        execution.exitCode = null;
        execution.cancelled = stateResult.cancelled;
        execution.timedOut = stateResult.timedOut;
        execution.outputLimitExceeded = stateResult.outputLimitExceeded;
      } else {
        const state = JSON.parse(stateResult.stdout) as {
          ExitCode?: number;
          Running?: boolean;
          Status?: string;
        };
        execution.exitCode =
          state.Running === false &&
          state.Status === "exited" &&
          Number.isInteger(state.ExitCode)
            ? state.ExitCode!
            : null;
      }
    }
    receipt.execution = {
      status: execution.cancelled
        ? "Cancelled"
        : execution.timedOut
          ? "TimedOut"
          : execution.outputLimitExceeded
            ? "OutputLimitExceeded"
            : execution.exitCode === 0
              ? "Completed"
              : "Failed",
      exitCode: execution.exitCode,
      stdoutSha256: sha256(execution.stdout),
      stdoutBytes: Buffer.byteLength(execution.stdout, "utf8"),
      expectedOutputMatched:
        created.exitCode === 0 && outputMatchesPlan(plan, execution.stdout)
    };
  } catch {
    receipt.execution.status = input.signal?.aborted ? "Cancelled" : "Failed";
  } finally {
    if (creationAttempted) {
      try {
        // Cancellation must not cancel cleanup. Check the run label before
        // removal, including ambiguous create timeouts; never delete a foreign container.
        const label = await call(
          [
            "container",
            "inspect",
            receipt.containerName,
            "--format",
            '{{ index .Config.Labels "io.periscan.bas.run-id" }}'
          ],
          false
        );
        if (label.exitCode === 0 && label.stdout.trim() === receipt.runId) {
          await call(["rm", "--force", receipt.containerName], false);
        }
        const remaining = await call(
          [
            "container",
            "ls",
            "--all",
            "--filter",
            `name=^/${receipt.containerName}$`,
            "--format",
            "{{.Names}}"
          ],
          false
        );
        receipt.cleanup =
          remaining.exitCode === 0 && remaining.stdout.trim() === ""
            ? "Verified"
            : "Failed";
      } catch {
        receipt.cleanup = "Failed";
      }
    }
  }
  if (
    receipt.execution.status === "Completed" &&
    receipt.execution.expectedOutputMatched &&
    receipt.cleanup === "Verified"
  ) {
    receipt.qualification = "Passed";
  }
  return finish();
}

export async function qualifyAtomicHostnameLab(
  input: {
    sourceContent: string;
    approvedPlanSha256: string;
    signal?: AbortSignal;
  },
  docker: LabDockerCommand = executeLabDockerCommand
): Promise<AtomicLabReceipt> {
  return qualifyAtomicLabScenario(
    {
      ...input,
      guid: normalizeAtomicLabGuid(ATOMIC_HOSTNAME_LAB.scenarioId)
    },
    docker
  );
}
