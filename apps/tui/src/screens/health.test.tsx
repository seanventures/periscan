import { execFile } from "node:child_process";

import React from "react";
import { render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PeriscanApi } from "../lib/api.js";
import { HealthScreen } from "./health.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn()
}));

const execFileMock = vi.mocked(execFile);

function makeApi(
  health: PeriscanApi["health"] = async () => ({ status: "ok" })
): PeriscanApi {
  return {
    apiUrl: "http://127.0.0.1:3001",
    health
  } as PeriscanApi;
}

function mockWhich(onPath: boolean) {
  execFileMock.mockImplementation(((
    _file: string,
    _args: readonly string[] | undefined,
    optionsOrCallback?: unknown,
    maybeCallback?: unknown
  ) => {
    const callback =
      typeof optionsOrCallback === "function"
        ? optionsOrCallback
        : maybeCallback;
    if (typeof callback !== "function") {
      return undefined;
    }
    if (onPath) {
      callback(null, "/opt/homebrew/bin/gitleaks\n", "");
      return undefined;
    }
    const error = Object.assign(new Error("which: gitleaks not found"), {
      code: 1
    });
    callback(error, "", "");
    return undefined;
  }) as unknown as typeof execFile);
}

describe("HealthScreen", () => {
  let unmount: (() => void) | undefined;

  beforeEach(() => {
    mockWhich(true);
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    vi.clearAllMocks();
  });

  it("shows the API URL and GET /api/v1/health status", async () => {
    const api = makeApi(async () => ({ status: "ok" }));
    const instance = render(
      <HealthScreen api={api} onStatus={vi.fn()} />
    );
    unmount = instance.unmount;

    await vi.waitFor(() => {
      const frame = instance.lastFrame() ?? "";
      expect(frame).toContain("http://127.0.0.1:3001");
      expect(frame).toContain("/api/v1/health");
      expect(frame).toContain("ok");
    });
  });

  it("shows when the API health probe fails", async () => {
    const api = makeApi(async () => {
      throw new Error("health 503");
    });
    const instance = render(
      <HealthScreen api={api} onStatus={vi.fn()} />
    );
    unmount = instance.unmount;

    await vi.waitFor(() => {
      expect(instance.lastFrame() ?? "").toContain("health 503");
    });
  });

  it("reports gitleaks on PATH when which succeeds", async () => {
    mockWhich(true);
    const instance = render(
      <HealthScreen api={makeApi()} onStatus={vi.fn()} />
    );
    unmount = instance.unmount;

    await vi.waitFor(() => {
      expect(instance.lastFrame() ?? "").toMatch(/gitleaks.*on PATH/i);
    });
    expect(execFileMock).toHaveBeenCalledWith(
      "which",
      ["gitleaks"],
      expect.any(Function)
    );
  });

  it("reports gitleaks missing from PATH when which fails", async () => {
    mockWhich(false);
    const instance = render(
      <HealthScreen api={makeApi()} onStatus={vi.fn()} />
    );
    unmount = instance.unmount;

    await vi.waitFor(() => {
      expect(instance.lastFrame() ?? "").toMatch(/gitleaks.*not on PATH/i);
    });
  });

  it("hints drain-validation-queue.sh if the worker is missing mission context", async () => {
    const instance = render(
      <HealthScreen api={makeApi()} onStatus={vi.fn()} />
    );
    unmount = instance.unmount;

    await vi.waitFor(() => {
      const frame = instance.lastFrame() ?? "";
      expect(frame).toMatch(/missing mission context/i);
      expect(frame).toContain("drain-validation-queue.sh");
    });
  });
});
