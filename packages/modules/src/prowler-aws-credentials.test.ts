import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import type * as ChildProcess from "node:child_process";
import type * as ToolchainModule from "./toolchain.js";

type ExecFileMock = (
  file: string,
  args: string[],
  options: Record<string, unknown>
) => Promise<{ stderr: string; stdout: string }>;

const execFileMock = vi.hoisted(() =>
  vi.fn<ExecFileMock>(async () => ({ stderr: "", stdout: "" }))
);

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcess>();

  const runMock = (
    file: string,
    args: string[] = [],
    options: Record<string, unknown> = {}
  ) =>
    Promise.resolve(execFileMock(file, args, options)).then((value) => {
      if (value && typeof value === "object" && "stdout" in value) {
        return value as { stderr: string; stdout: string };
      }

      return { stderr: "", stdout: "" };
    });

  const execFile = Object.assign(
    (
      file: string,
      args?: string[] | ((...cbArgs: unknown[]) => void),
      options?: unknown,
      callback?: (...cbArgs: unknown[]) => void
    ) => {
      const argv = Array.isArray(args) ? args : [];
      const opts =
        typeof options === "object" && options !== null
          ? (options as Record<string, unknown>)
          : {};
      const cb =
        typeof args === "function"
          ? args
          : typeof options === "function"
            ? options
            : callback;

      const result = runMock(file, argv, opts);
      if (typeof cb === "function") {
        result.then(
          (value) => cb(null, value.stdout, value.stderr),
          (error) => cb(error)
        );
      }
      return result;
    },
    {
      [promisify.custom]: (
        file: string,
        args: string[] = [],
        options: Record<string, unknown> = {}
      ) => runMock(file, args, options)
    }
  );

  return {
    ...actual,
    execFile
  };
});

vi.mock("./toolchain.js", async (importOriginal) => {
  const actual = await importOriginal<typeof ToolchainModule>();

  return {
    ...actual,
    resolveOpenSourceToolRuntime: vi.fn(actual.resolveOpenSourceToolRuntime)
  };
});

import { executeModuleById, ModuleExecutionContextSchema } from "./index.js";
import {
  getOpenSourceToolDefinition,
  resolveOpenSourceToolRuntime
} from "./toolchain.js";

const resolveOpenSourceToolRuntimeMock = vi.mocked(
  resolveOpenSourceToolRuntime
);

afterEach(() => {
  execFileMock.mockClear();
  resolveOpenSourceToolRuntimeMock.mockReset();
});

function createContext(overrides: Record<string, unknown> = {}) {
  return ModuleExecutionContextSchema.parse({
    integrationIds: [],
    inputs: {},
    missionId: randomUUID(),
    policyDecisionId: null,
    runId: randomUUID(),
    runnerId: null,
    safetyLevel: "PassiveReadOnly",
    scopeId: randomUUID(),
    target: {},
    tenantId: randomUUID(),
    ...overrides
  });
}

describe("Prowler stored AWS credentials", () => {
  it("returns tool_unavailable when awsIntegrationId is set without credentials", async () => {
    const output = await executeModuleById(
      "prowler.aws_posture",
      createContext({
        target: {
          awsAccountId: "123456789012",
          awsIntegrationId: "33333333-3333-4333-8333-333333333333"
        }
      })
    );

    expect(output.outcome).toBe("tool_unavailable");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.evidence).toHaveLength(0);
    expect(output.errors.join(" ")).toMatch(
      /credentials were not provided for Prowler/i
    );
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("surfaces an honest integration error instead of fixture findings", async () => {
    const output = await executeModuleById(
      "prowler.aws_posture",
      createContext({
        inputs: {
          awsCredentialError: "AWS integration was not found for this tenant."
        },
        target: {
          awsAccountId: "123456789012",
          awsIntegrationId: "33333333-3333-4333-8333-333333333333"
        }
      })
    );

    expect(output.outcome).toBe("tool_unavailable");
    expect(output.errors).toEqual([
      "AWS integration was not found for this tenant."
    ]);
    expect(output.summary).toMatch(/not found for this tenant/i);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("still uses an explicit fixture when fixtureMode is set", async () => {
    const fixtureReportPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/prowler/aws-posture-fixture.json"
    );
    const output = await executeModuleById(
      "prowler.aws_posture",
      createContext({
        target: {
          awsAccountId: "123456789012",
          awsIntegrationId: "33333333-3333-4333-8333-333333333333",
          fixtureMode: true,
          fixtureReportPath
        }
      })
    );

    expect(output.outcome).toBe("cloud_misconfiguration_observed");
    expect(output.validationState).toBe("Validated");
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("runs Prowler with ephemeral AWS env instead of process env", async () => {
    const prowler = getOpenSourceToolDefinition("prowler");
    expect(prowler).not.toBeNull();
    resolveOpenSourceToolRuntimeMock.mockResolvedValue({
      available: true,
      command: "prowler",
      displayCommand: "prowler",
      imageRef: null,
      reason: null,
      runtime: "binary",
      tool: prowler!,
      version: prowler!.defaultVersion
    });

    const accessKey = "test-aws-access-key";
    const secretKey = "test-aws-secret-key";
    const output = await executeModuleById(
      "prowler.aws_posture",
      createContext({
        inputs: {
          awsRuntimeEnv: {
            AWS_ACCESS_KEY_ID: accessKey,
            AWS_DEFAULT_REGION: "us-east-1",
            AWS_REGION: "us-east-1",
            AWS_SECRET_ACCESS_KEY: secretKey
          }
        },
        target: {
          awsAccountId: "123456789012",
          awsIntegrationId: "33333333-3333-4333-8333-333333333333"
        }
      })
    );

    expect(output.outcome).toBe("no_cloud_misconfiguration_observed");
    expect(execFileMock).toHaveBeenCalledOnce();
    const options = execFileMock.mock.calls[0]?.[2];
    const env = options?.env as NodeJS.ProcessEnv | undefined;
    expect(env?.AWS_ACCESS_KEY_ID).toBe(accessKey);
    expect(env?.AWS_SECRET_ACCESS_KEY).toBe(secretKey);
    expect(env?.AWS_REGION).toBe("us-east-1");
  });

  it("passes inlined AWS env to the Prowler docker runtime", async () => {
    const prowler = getOpenSourceToolDefinition("prowler");
    expect(prowler).not.toBeNull();
    resolveOpenSourceToolRuntimeMock.mockResolvedValue({
      available: true,
      command: "docker",
      displayCommand: "docker run --rm toniblyx/prowler:latest",
      imageRef: "toniblyx/prowler:latest",
      reason: null,
      runtime: "docker",
      tool: prowler!,
      version: prowler!.defaultVersion
    });

    const accessKey = "test-aws-access-key";
    const secretKey = "test-aws-secret-key";
    await executeModuleById(
      "prowler.aws_posture",
      createContext({
        inputs: {
          awsRuntimeEnv: {
            AWS_ACCESS_KEY_ID: accessKey,
            AWS_DEFAULT_REGION: "us-west-2",
            AWS_REGION: "us-west-2",
            AWS_SECRET_ACCESS_KEY: secretKey
          }
        },
        target: {
          awsAccountId: "123456789012",
          awsIntegrationId: "33333333-3333-4333-8333-333333333333"
        }
      })
    );

    expect(execFileMock).toHaveBeenCalledOnce();
    const args = execFileMock.mock.calls[0]?.[1] ?? [];
    expect(args).toContain(`AWS_ACCESS_KEY_ID=${accessKey}`);
    expect(args).toContain(`AWS_SECRET_ACCESS_KEY=${secretKey}`);
    expect(args).toContain("AWS_REGION=us-west-2");
  });
});
