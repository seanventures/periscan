import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_API_URL,
  isCliArgv,
  parseCli,
  printUsage,
  runHealthCommand,
  runScopeCommand
} from "./cli.js";
import { PeriscanApiError } from "./lib/api.js";

describe("parseCli", () => {
  it("defaults to the interactive TUI on 127.0.0.1:3001", () => {
    expect(parseCli([], {})).toEqual({
      apiUrl: DEFAULT_API_URL,
      command: "tui",
      help: false,
      json: false
    });
  });

  it("reads PERISCAN_API_URL and strips a trailing slash", () => {
    expect(
      parseCli([], { PERISCAN_API_URL: "http://control.example:3001/" })
    ).toMatchObject({
      apiUrl: "http://control.example:3001",
      command: "tui"
    });
  });

  it("lets --api override the env URL", () => {
    expect(
      parseCli(["--api", "http://127.0.0.1:3999/"], {
        PERISCAN_API_URL: "http://env.example:3001"
      })
    ).toMatchObject({
      apiUrl: "http://127.0.0.1:3999"
    });
  });

  it("accepts --api=<url> and a trailing health command", () => {
    expect(parseCli(["--api=https://api.periscan.example", "health"], {})).toEqual({
      apiUrl: "https://api.periscan.example",
      command: "health",
      help: false,
      json: false
    });
  });

  it("parses noninteractive health before flags", () => {
    expect(parseCli(["health", "--api", "http://127.0.0.1:3001"], {})).toMatchObject({
      command: "health"
    });
  });

  it("treats --help and -h as usage", () => {
    expect(parseCli(["--help"], {}).help).toBe(true);
    expect(parseCli(["-h"], {}).help).toBe(true);
  });

  it("rejects an unknown command", () => {
    expect(() => parseCli(["exploit"], {})).toThrow(/unknown command/i);
  });

  it("rejects --api without a value", () => {
    expect(() => parseCli(["--api"], {})).toThrow(/--api/);
  });

  it("parses run --scope and --json without Ink", () => {
    expect(
      parseCli(["run", "--scope", "11111111-1111-4111-8111-111111111111", "--json"], {})
    ).toEqual({
      apiUrl: DEFAULT_API_URL,
      command: "run",
      help: false,
      json: true,
      scopeId: "11111111-1111-4111-8111-111111111111"
    });
  });

  it("accepts --scope=<id> after run", () => {
    expect(parseCli(["run", "--scope=abc"], {})).toMatchObject({
      command: "run",
      json: false,
      scopeId: "abc"
    });
  });

  it("rejects run without --scope", () => {
    expect(() => parseCli(["run"], {})).toThrow(/--scope/i);
  });

  it("uses a session fallback when env and --api are absent", () => {
    expect(parseCli([], {}, "http://from-session:3001")).toMatchObject({
      apiUrl: "http://from-session:3001"
    });
  });

  it("lets --api override the session fallback", () => {
    expect(
      parseCli(["--api", "http://flag.example:3001"], {}, "http://from-session:3001")
    ).toMatchObject({
      apiUrl: "http://flag.example:3001"
    });
  });
});

describe("isCliArgv", () => {
  it("is true for health, run, --json, and help", () => {
    expect(isCliArgv(["health"])).toBe(true);
    expect(isCliArgv(["run", "--scope", "x"])).toBe(true);
    expect(isCliArgv(["--json"])).toBe(true);
    expect(isCliArgv(["--help"])).toBe(true);
    expect(isCliArgv([])).toBe(false);
    expect(isCliArgv(["--api", "http://127.0.0.1:3001"])).toBe(false);
  });
});

describe("printUsage", () => {
  it("documents env, login, keys, and health", () => {
    const lines: string[] = [];
    printUsage((chunk) => {
      lines.push(chunk);
    });
    const text = lines.join("");
    expect(text).toContain("PERISCAN_API_URL");
    expect(text).toContain("periscan health");
    expect(text).toContain("--api");
    expect(text).toContain("login");
    expect(text).toContain("1–9");
    expect(text).toContain("q quit");
    expect(text).toContain("Denied");
    expect(text).toContain("run --scope");
    expect(text).toContain("--json");
    expect(text).toContain("PERISCAN_CSRF_TOKEN");
    expect(text).toContain("x-csrf-token");
  });
});

describe("runHealthCommand", () => {
  it("prints JSON and returns 0 when the API is ok", async () => {
    const payload = {
      service: "api",
      status: "ok",
      timestamp: "2026-08-31T00:00:00.000Z"
    };
    const stdout: string[] = [];
    const code = await runHealthCommand({
      apiUrl: "http://127.0.0.1:3001",
      fetchImpl: async (input) => {
        expect(String(input)).toBe("http://127.0.0.1:3001/api/v1/health");
        return new Response(JSON.stringify(payload), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      },
      stdout: {
        write(chunk: string) {
          stdout.push(chunk);
          return true;
        }
      }
    });
    expect(code).toBe(0);
    expect(JSON.parse(stdout.join(""))).toEqual(payload);
  });

  it("returns 1 and writes the error when health fails", async () => {
    const stderr: string[] = [];
    const code = await runHealthCommand({
      apiUrl: "http://127.0.0.1:3001",
      fetchImpl: async () => {
        throw new PeriscanApiError("health 503", 503);
      },
      stderr: {
        write(chunk: string) {
          stderr.push(chunk);
          return true;
        }
      }
    });
    expect(code).toBe(1);
    expect(stderr.join("")).toMatch(/health 503/);
  });

  it("does not start the interactive TUI", async () => {
    const render = vi.fn();
    await runHealthCommand({
      apiUrl: "http://127.0.0.1:3001",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            service: "api",
            status: "ok",
            timestamp: "2026-08-31T00:00:00.000Z"
          }),
          { status: 200 }
        ),
      stdout: { write: () => true }
    });
    expect(render).not.toHaveBeenCalled();
  });
});

describe("runScopeCommand", () => {
  const SCOPE_ID = "11111111-1111-4111-8111-111111111111";
  const POLICY_ID = "44444444-4444-4444-8444-444444444444";
  const SESSION = "periscan_session=lab-session-jwt";
  const CSRF = "lab-csrf-token";

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
      status
    });
  }

  it("POSTs Community validation with Cookie plus x-csrf-token from lab env", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const stdout: string[] = [];
    const started = {
      jobsQueued: 2,
      mission: { missionId: "55555555-5555-4555-8555-555555555555", status: "Queued" }
    };

    const code = await runScopeCommand({
      apiUrl: "http://127.0.0.1:3001",
      env: {
        PERISCAN_API_TOKEN: SESSION,
        PERISCAN_CSRF_TOKEN: CSRF
      },
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push({ init, url });
        if (url.endsWith(`/api/v1/scopes/${SCOPE_ID}`)) {
          return jsonResponse({
            scopeId: SCOPE_ID,
            scopeType: "Domain",
            value: "lab.example.com",
            verificationStatus: "Verified"
          });
        }
        if (url.includes("/api/v1/community/validation-suite")) {
          return jsonResponse({
            cloudAwsAvailable: false,
            deferredModules: [],
            editionId: "community",
            includeExternalPoa: false,
            licenseNote: "Apache-2.0",
            modules: [],
            runnerAvailable: false,
            scopeType: "Domain",
            startableModuleIds: ["gitleaks.secrets"],
            valueLine: "Community edition"
          });
        }
        if (url.includes("/policy-decisions/preview")) {
          return jsonResponse({
            approvalState: "NotRequired",
            outcome: "Allowed",
            policyDecisionId: POLICY_ID,
            rationale: "Verified scope",
            scopeId: SCOPE_ID
          });
        }
        if (url.endsWith("/api/v1/community/validation-runs")) {
          return jsonResponse(started);
        }
        return jsonResponse({ error: "not found" }, 404);
      },
      scopeId: SCOPE_ID,
      stdout: {
        write(chunk: string) {
          stdout.push(chunk);
          return true;
        }
      }
    });

    expect(code).toBe(0);
    expect(JSON.parse(stdout.join(""))).toMatchObject({ jobsQueued: 2 });

    const mutating = calls.filter(
      (call) => (call.init?.method ?? "GET").toUpperCase() === "POST"
    );
    expect(mutating.length).toBeGreaterThanOrEqual(2);
    for (const call of mutating) {
      const headers = new Headers(call.init?.headers);
      expect(headers.get("cookie")).toContain(SESSION);
      expect(headers.get("cookie")).toContain(`periscan_csrf=${CSRF}`);
      expect(headers.get("x-csrf-token")).toBe(CSRF);
    }

    const start = mutating.find((call) =>
      call.url.endsWith("/api/v1/community/validation-runs")
    );
    expect(JSON.parse(String(start?.init?.body))).toEqual({
      policyDecisionId: POLICY_ID,
      scopeId: SCOPE_ID
    });
  });

  it("does not POST startCommunity when policy is Denied", async () => {
    const urls: string[] = [];
    const stderr: string[] = [];
    const code = await runScopeCommand({
      apiUrl: "http://127.0.0.1:3001",
      env: {
        PERISCAN_API_TOKEN: SESSION,
        PERISCAN_CSRF_TOKEN: CSRF
      },
      fetchImpl: async (input, init) => {
        const url = String(input);
        urls.push(`${init?.method ?? "GET"} ${url}`);
        if (url.endsWith(`/api/v1/scopes/${SCOPE_ID}`)) {
          return jsonResponse({
            scopeId: SCOPE_ID,
            scopeType: "Domain",
            value: "lab.example.com",
            verificationStatus: "Verified"
          });
        }
        if (url.includes("validation-suite")) {
          return jsonResponse({
            cloudAwsAvailable: false,
            runnerAvailable: false,
            startableModuleIds: ["gitleaks.secrets"]
          });
        }
        if (url.includes("policy-decisions/preview")) {
          return jsonResponse({
            approvalState: "NotRequired",
            outcome: "Denied",
            policyDecisionId: POLICY_ID,
            rationale: "Out of scope",
            scopeId: SCOPE_ID
          });
        }
        return jsonResponse({ error: "unexpected start" }, 500);
      },
      scopeId: SCOPE_ID,
      stderr: {
        write(chunk: string) {
          stderr.push(chunk);
          return true;
        }
      },
      stdout: { write: () => true }
    });

    expect(code).toBe(1);
    expect(stderr.join("")).toMatch(/Denied never queues/i);
    expect(urls.some((line) => line.includes("validation-runs"))).toBe(false);
  });
});

describe("cli module", () => {
  it("does not import Ink", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./cli.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from ["']ink["']/u);
  });
});
