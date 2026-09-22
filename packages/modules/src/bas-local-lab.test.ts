import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AtomicLabReceiptSchema } from "@periscan/shared";

import {
  ATOMIC_DATE_LAB,
  ATOMIC_ENV_LAB,
  ATOMIC_HOSTNAME_LAB,
  atomicDateLabPlanSha256,
  atomicEnvLabPlanSha256,
  atomicHostnameLabPlanSha256,
  checkAtomicLabPrerequisites,
  qualifyAtomicHostnameLab,
  qualifyAtomicLabScenario,
  type LabDockerCommand
} from "./bas-local-lab.js";

const sourceContent = readFileSync(
  new URL("./fixtures/atomic/T1082.yaml", import.meta.url),
  "utf8"
);
const dateSourceContent = readFileSync(
  new URL("./fixtures/atomic/T1124.yaml", import.meta.url),
  "utf8"
);
const request = () => ({
  sourceContent,
  approvedPlanSha256: atomicHostnameLabPlanSha256()
});

type Mode =
  | "pass"
  | "timeout"
  | "cancel"
  | "output-limit"
  | "cleanup-failure"
  | "foreign-label"
  | "create-timeout"
  | "image-missing"
  | "remote"
  | "wrong-output"
  | "container-failed"
  | "state-cancel";
function dockerDouble(mode: Mode = "pass", controller?: AbortController) {
  let exists = false;
  let runId = "";
  let name = "";
  let entrypoint = "/bin/hostname";
  const docker = vi.fn<LabDockerCommand>(async (raw, options) => {
    const args = raw[0] === "--host" ? raw.slice(2) : raw;
    const ok = (stdout = "") => ({ exitCode: 0, stdout, stderr: "" });
    if (args[0] === "context")
      return ok(
        mode === "remote" ? "ssh://remote" : "unix:///var/run/docker.sock"
      );
    expect(raw.slice(0, 2)).toEqual(["--host", "unix:///var/run/docker.sock"]);
    if (args[0] === "image")
      return mode === "image-missing"
        ? { exitCode: 1, stdout: "", stderr: "not found" }
        : ok(`sha256:${"0".repeat(64)}`);
    if (args[0] === "create") {
      exists = true;
      name = args[args.indexOf("--name") + 1]!;
      runId = args[args.indexOf("--label") + 1]!.split("=")[1]!;
      entrypoint = args[args.indexOf("--entrypoint") + 1] ?? entrypoint;
      return mode === "create-timeout"
        ? { exitCode: null, stdout: "", stderr: "", timedOut: true }
        : ok("container-id");
    }
    if (args[0] === "start") {
      if (mode === "cancel") {
        controller?.abort();
        return { exitCode: null, stdout: "", stderr: "", cancelled: true };
      }
      if (mode === "timeout")
        return { exitCode: null, stdout: "", stderr: "", timedOut: true };
      if (mode === "output-limit")
        return {
          exitCode: null,
          stdout: "partial",
          stderr: "",
          outputLimitExceeded: true
        };
      if (mode === "wrong-output") return ok("unrelated-output");
      if (entrypoint === "/bin/env") {
        return ok(
          `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nHOSTNAME=${ATOMIC_HOSTNAME_LAB.expectedHostname}\nHOME=/\n`
        );
      }
      if (entrypoint === "/bin/date") {
        return ok("Thu Sep 17 20:31:14 UTC 2026\n");
      }
      return ok(`${ATOMIC_HOSTNAME_LAB.expectedHostname}\n`);
    }
    if (
      args[0] === "container" &&
      args[1] === "inspect" &&
      args.includes("{{json .State}}")
    ) {
      if (mode === "state-cancel") {
        controller?.abort();
        return { exitCode: null, stdout: "", stderr: "", cancelled: true };
      }
      return ok(
        JSON.stringify({
          Running: false,
          Status: "exited",
          ExitCode: mode === "container-failed" ? 7 : 0
        })
      );
    }
    expect(options.signal).toBeUndefined(); // Aborting execution never cancels cleanup.
    if (args[0] === "container" && args[1] === "inspect")
      return ok(mode === "foreign-label" ? "other-run" : runId);
    if (args[0] === "rm") {
      if (mode !== "cleanup-failure") exists = false;
      return ok();
    }
    if (args[0] === "container" && args[1] === "ls")
      return ok(exists ? name : "");
    throw new Error(`Unexpected Docker operation: ${args[0]}`);
  });
  return docker;
}

beforeEach(() => vi.stubEnv("DOCKER_HOST", ""));
afterEach(() => vi.unstubAllEnvs());

describe("pinned Atomic local lab qualification", () => {
  it("executes only the reviewed action with bounded container isolation and verifies cleanup", async () => {
    const docker = dockerDouble();
    const result = await qualifyAtomicHostnameLab(request(), docker);
    expect(result).toMatchObject({
      sourceVerified: true,
      qualification: "Passed",
      cleanup: "Verified",
      detection: "NotMeasured",
      execution: { status: "Completed", expectedOutputMatched: true },
      policyDecision: { outcome: "Allowed" }
    });
    const create = docker.mock.calls.find(([args]) => args.includes("create"))!;
    for (const pair of [
      ["--network", "none"],
      ["--user", "65534:65534"],
      ["--cap-drop", "ALL"],
      ["--security-opt", "no-new-privileges"],
      ["--memory", "64m"],
      ["--pids-limit", "16"],
      ["--entrypoint", "/bin/hostname"]
    ]) {
      const index = create[0].indexOf(pair[0]!);
      expect(create[0].slice(index, index + 2)).toEqual(pair);
    }
    expect(create[0]).toContain("--read-only");
    expect(create[0]).toContain("--pull=never");
    expect(create[0]).not.toContain("--mount");
    expect(create[0]).not.toContain("-v");
    expect(create[0]).not.toContain("--privileged");
    expect(create[0].at(-1)).toBe(ATOMIC_HOSTNAME_LAB.image);
    expect(create[1]).toMatchObject({ timeoutMs: 15000, maxOutputBytes: 8192 });
    expect(result.execution.stdoutSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.execution).not.toHaveProperty("stdout");
  });

  it("denies changed source or approval digest before any Docker call", async () => {
    const docker = dockerDouble();
    for (const input of [
      { ...request(), sourceContent: sourceContent + "\n" },
      { ...request(), approvedPlanSha256: "0".repeat(64) }
    ]) {
      expect(await qualifyAtomicHostnameLab(input, docker)).toMatchObject({
        qualification: "Failed",
        cleanup: "NotRequired",
        policyDecision: { outcome: "Denied" },
        execution: { status: "NotStarted" }
      });
    }
    expect(docker).not.toHaveBeenCalled();
  });

  it.each(["remote", "image-missing"] as const)(
    "refuses %s prerequisites without creating a container",
    async (mode) => {
      const docker = dockerDouble(mode);
      expect(await qualifyAtomicHostnameLab(request(), docker)).toMatchObject({
        policyDecision: { outcome: "Denied" },
        execution: { status: "NotStarted" }
      });
      expect(docker.mock.calls.some(([args]) => args.includes("create"))).toBe(
        false
      );
    }
  );

  it("rejects remote DOCKER_HOST overrides", async () => {
    vi.stubEnv("DOCKER_HOST", "tcp://example.com:2375");
    const docker = dockerDouble();
    expect(
      (await qualifyAtomicHostnameLab(request(), docker)).policyDecision.outcome
    ).toBe("Denied");
    expect(docker).not.toHaveBeenCalled();
  });

  it.each([
    ["timeout", "TimedOut"],
    ["create-timeout", "TimedOut"],
    ["cancel", "Cancelled"],
    ["state-cancel", "Cancelled"],
    ["output-limit", "OutputLimitExceeded"]
  ] as const)(
    "cleans up after %s, including ambiguous create outcomes",
    async (mode, status) => {
      const controller = new AbortController();
      const docker = dockerDouble(mode, controller);
      const result = await qualifyAtomicHostnameLab(
        { ...request(), signal: controller.signal },
        docker
      );
      expect(result).toMatchObject({
        qualification: "Failed",
        cleanup: "Verified",
        execution: { status }
      });
      expect(docker.mock.calls.some(([args]) => args.includes("rm"))).toBe(
        true
      );
    }
  );

  it("honors cancellation before allocation", async () => {
    const controller = new AbortController();
    controller.abort();
    const docker = dockerDouble();
    expect(
      await qualifyAtomicHostnameLab(
        { ...request(), signal: controller.signal },
        docker
      )
    ).toMatchObject({
      qualification: "Failed",
      cleanup: "NotRequired",
      execution: { status: "Cancelled" }
    });
    expect(docker).not.toHaveBeenCalled();
  });

  it.each([
    "cleanup-failure",
    "foreign-label",
    "wrong-output",
    "container-failed"
  ] as const)("does not pass qualification for %s", async (mode) => {
    const docker = dockerDouble(mode);
    const result = await qualifyAtomicHostnameLab(request(), docker);
    expect(result.qualification).toBe("Failed");
    if (mode === "foreign-label") {
      expect(docker.mock.calls.some(([args]) => args.includes("rm"))).toBe(
        false
      );
      expect(result.cleanup).toBe("Failed");
    }
    if (mode === "cleanup-failure") expect(result.cleanup).toBe("Failed");
  });
});

describe("reviewed Atomic lab adapter harness", () => {
  const envGuid = "fcbdd43f-f4ad-42d5-98f3-0218097e2720";
  const envRequest = () => ({
    approvedPlanSha256: atomicEnvLabPlanSha256(),
    guid: envGuid,
    sourceContent
  });

  it("qualifies env discovery with allowlisted argv, hashed output, and cleanup", async () => {
    const docker = dockerDouble();
    const result = await qualifyAtomicLabScenario(envRequest(), docker);
    expect(AtomicLabReceiptSchema.parse(result)).toMatchObject({
      countedAsCustomerExecution: false,
      customerLiveSupported: false,
      detection: "NotMeasured",
      guid: envGuid,
      qualification: "Passed",
      cleanup: "Verified",
      execution: { status: "Completed", expectedOutputMatched: true }
    });
    expect(result.execution).not.toHaveProperty("stdout");
    const create = docker.mock.calls.find(([args]) => args.includes("create"))!;
    expect(
      create[0].slice(
        create[0].indexOf("--entrypoint"),
        create[0].indexOf("--entrypoint") + 2
      )
    ).toEqual(["--entrypoint", "/bin/env"]);
    expect(create[0]).not.toContain("sh");
    expect(create[0]).not.toContain("-c");
    expect(create[0].join(" ")).not.toMatch(/\benv\n/);
  });

  it("checks prerequisites and typed inputs before any container create", async () => {
    const docker = dockerDouble("image-missing");
    const prereq = await checkAtomicLabPrerequisites(envRequest(), docker);
    expect(prereq).toMatchObject({
      ok: false,
      pinnedImagePresent: false,
      scenarioAllowlisted: true,
      typedInputsValid: true
    });
    const extra = dockerDouble();
    expect(
      await qualifyAtomicLabScenario(
        { ...envRequest(), typedInputs: { output_file: "/tmp/T1082.txt" } },
        extra
      )
    ).toMatchObject({
      execution: { status: "NotStarted" },
      policyDecision: { outcome: "Denied" },
      qualification: "Failed"
    });
    expect(extra).not.toHaveBeenCalled();
  });

  it("fails closed for an unreviewed Linux fixture without Docker", async () => {
    const docker = dockerDouble();
    const result = await qualifyAtomicLabScenario(
      {
        approvedPlanSha256: atomicEnvLabPlanSha256(),
        guid: "034fe21c-3186-49dd-8d5d-128b35f181c7",
        sourceContent
      },
      docker
    );
    expect(result).toMatchObject({
      cleanup: "NotRequired",
      execution: { status: "NotStarted" },
      policyDecision: { outcome: "Denied" },
      qualification: "Failed"
    });
    expect(result.policyDecision.reason).toMatch(/allowlist|argv|fail closed/i);
    expect(docker).not.toHaveBeenCalled();
  });

  it("cancels env qualification and verifies cleanup after create", async () => {
    const controller = new AbortController();
    const docker = dockerDouble("cancel", controller);
    const result = await qualifyAtomicLabScenario(
      { ...envRequest(), signal: controller.signal },
      docker
    );
    expect(result).toMatchObject({
      cleanup: "Verified",
      execution: { status: "Cancelled" },
      qualification: "Failed"
    });
    expect(ATOMIC_ENV_LAB.executable).toBe("/bin/env");
  });
});

describe("T1124 date lab argv from the same Atomic pin", () => {
  const dateGuid = "f449c933-0891-407f-821e-7916a21a1a6f";
  const dateRequest = () => ({
    approvedPlanSha256: atomicDateLabPlanSha256(),
    guid: dateGuid,
    sourceContent: dateSourceContent
  });

  it("keeps hostname and env plan digests unchanged", () => {
    expect(atomicHostnameLabPlanSha256()).toBe(
      "dfb5a23f88acc2c3fff36ae5023b923f968afd4abf2ccc3d6b09d771c4436da6"
    );
    expect(atomicEnvLabPlanSha256()).toBe(
      "ff021dfc7fb08a602d4970a0eba2e0151190e3376a1edb85ace67eeb3fea106e"
    );
    expect(ATOMIC_DATE_LAB.executable).toBe("/bin/date");
    expect(ATOMIC_DATE_LAB.techniqueId).toBe("T1124");
  });

  it("qualifies date discovery with allowlisted argv, hashed output, and cleanup", async () => {
    const docker = dockerDouble();
    const result = await qualifyAtomicLabScenario(dateRequest(), docker);
    expect(AtomicLabReceiptSchema.parse(result)).toMatchObject({
      countedAsCustomerExecution: false,
      customerLiveSupported: false,
      detection: "NotMeasured",
      guid: dateGuid,
      qualification: "Passed",
      cleanup: "Verified",
      execution: { status: "Completed", expectedOutputMatched: true }
    });
    expect(result.execution).not.toHaveProperty("stdout");
    const create = docker.mock.calls.find(([args]) => args.includes("create"))!;
    expect(
      create[0].slice(
        create[0].indexOf("--entrypoint"),
        create[0].indexOf("--entrypoint") + 2
      )
    ).toEqual(["--entrypoint", "/bin/date"]);
    expect(create[0]).not.toContain("sh");
    expect(create[0]).not.toContain("-c");
    expect(create[0].join(" ")).not.toMatch(/\bdate\n/);
  });

  it("fails closed when the date GUID is paired with the T1082 fixture", async () => {
    const docker = dockerDouble();
    const result = await qualifyAtomicLabScenario(
      {
        approvedPlanSha256: atomicDateLabPlanSha256(),
        guid: dateGuid,
        sourceContent
      },
      docker
    );
    expect(result).toMatchObject({
      cleanup: "NotRequired",
      execution: { status: "NotStarted" },
      policyDecision: { outcome: "Denied" },
      qualification: "Failed"
    });
    expect(docker).not.toHaveBeenCalled();
  });

  it("does not treat date YAML as a shell line and denies extra typed inputs", async () => {
    const docker = dockerDouble();
    expect(
      await qualifyAtomicLabScenario(
        { ...dateRequest(), typedInputs: { format: "+%s" } },
        docker
      )
    ).toMatchObject({
      execution: { status: "NotStarted" },
      policyDecision: { outcome: "Denied" },
      qualification: "Failed"
    });
    expect(docker).not.toHaveBeenCalled();
  });
});
