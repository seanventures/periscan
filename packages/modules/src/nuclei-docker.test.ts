import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import type * as ToolchainModule from "./toolchain.js";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();

  const runMock = (file: string, args: string[] = []) =>
    Promise.resolve(execFileMock(file, args)).then((value) => {
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
      const cb =
        typeof args === "function"
          ? args
          : typeof options === "function"
            ? options
            : callback;

      const result = runMock(file, argv);
      if (typeof cb === "function") {
        result.then(
          (value) => cb(null, value.stdout, value.stderr),
          (error) => cb(error)
        );
      }
      return result;
    },
    {
      [promisify.custom]: (file: string, args: string[] = []) =>
        runMock(file, args)
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

import {
  executeModuleById,
  ModuleExecutionContextSchema
} from "./index.js";
import {
  getOpenSourceToolDefinition,
  resolveOpenSourceToolRuntime
} from "./toolchain.js";

const resolveOpenSourceToolRuntimeMock = vi.mocked(
  resolveOpenSourceToolRuntime
);

afterEach(() => {
  execFileMock.mockReset();
  resolveOpenSourceToolRuntimeMock.mockReset();
});

describe("nuclei docker runtime", () => {
  it("parses JSONL from docker stdout without a host /out bind-mount", async () => {
    const nuclei = getOpenSourceToolDefinition("nuclei");
    expect(nuclei).not.toBeNull();

    resolveOpenSourceToolRuntimeMock.mockResolvedValue({
      available: true,
      command: "docker",
      displayCommand: "docker run --rm projectdiscovery/nuclei:v3.8.0",
      imageRef: "projectdiscovery/nuclei:v3.8.0",
      reason: null,
      runtime: "docker",
      tool: nuclei!,
      version: "v3.8.0"
    });

    execFileMock.mockImplementation(
      async (_file: string, args: string[] = []) => {
        if (args[0] === "run") {
          return {
            stderr: "",
            stdout: `${JSON.stringify({
              host: "https://nuclei-docker.invalid",
              info: {
                name: "Periscan Safe HTTP Fingerprint",
                severity: "info"
              },
              "matched-at": "https://nuclei-docker.invalid/",
              "template-id": "periscan-safe-http-fingerprint"
            })}\n`
          };
        }

        return { stderr: "", stdout: "" };
      }
    );

    const output = await executeModuleById(
      "nuclei.external_exposure_safe",
      ModuleExecutionContextSchema.parse({
        integrationIds: [],
        inputs: {},
        missionId: randomUUID(),
        policyDecisionId: null,
        runId: randomUUID(),
        runnerId: null,
        safetyLevel: "ActiveNonInvasive",
        scopeId: randomUUID(),
        target: {
          hostname: "nuclei-docker.invalid",
          templateProfile: "safe-baseline"
        },
        tenantId: randomUUID()
      })
    );

    const dockerRun = execFileMock.mock.calls
      .map((call) => call[1])
      .find((args): args is string[] => Array.isArray(args) && args[0] === "run");

    expect(dockerRun).toBeDefined();
    expect(dockerRun).toContain("-jsonl");
    expect(dockerRun).not.toContain("-o");
    expect(dockerRun).not.toContain("/out/report.jsonl");
    expect(dockerRun?.some((arg) => /:\/out(?::|$)/u.test(arg))).toBe(false);
    expect(dockerRun).not.toContain("--volume");
    expect(
      dockerRun?.some(
        (arg) => arg.includes("target=/templates") && arg.includes("readonly")
      )
    ).toBe(true);
    expect(
      dockerRun?.filter((arg, index, all) => all[index - 1] === "-t")
    ).toEqual([
      "/templates/http-fingerprint.yaml",
      "/templates/http-security-headers.yaml",
      "/templates/public-metadata.yaml"
    ]);
    expect(output.outcome).toBe("external_exposure_observed");
    expect(output.evidence[0]?.attributes.templateId).toBe(
      "periscan-safe-http-fingerprint"
    );
    expect(output.evidence[0]?.attributes.templateProfile).toBe("safe-baseline");
  });
});
