import { HEALTH_ROUTE } from "@periscan/shared";
import { describe, expect, it } from "vitest";

import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  PeriscanApi,
  PeriscanApiError,
  SESSION_COOKIE_NAME,
  isDeniedNeverQueued
} from "./api.js";

function jsonResponse(
  status: number,
  body: unknown,
  setCookies: string[] = []
): Response {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of setCookies) {
    headers.append("set-cookie", cookie);
  }
  return new Response(JSON.stringify(body), { headers, status });
}

function header(
  init: RequestInit | undefined,
  name: string
): string | null {
  return new Headers(init?.headers).get(name);
}

const SESSION_SET_COOKIE = [
  `${SESSION_COOKIE_NAME}=session-jwt; Path=/; HttpOnly; SameSite=Lax`,
  `${CSRF_COOKIE_NAME}=csrf-token; Path=/; SameSite=Lax`
];

function loggedInFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: Array<{ init?: RequestInit; url: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ init, url });
    if (url.endsWith("/api/v1/auth/login") || url.endsWith("/api/v1/auth/signup")) {
      return jsonResponse(200, { user: { email: "op@periscan.test" } }, SESSION_SET_COOKIE);
    }
    return handler(url, init);
  };
  return { calls, fetchImpl };
}

describe("PeriscanApi", () => {
  it("GETs liveness at HEALTH_ROUTE without CSRF", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const api = new PeriscanApi("http://127.0.0.1:3001", {
      fetchImpl: async (input, init) => {
        calls.push({ init, url: String(input) });
        return jsonResponse(200, {
          service: "api",
          status: "ok",
          timestamp: "2026-08-31T00:00:00.000Z"
        });
      }
    });

    await expect(api.health()).resolves.toMatchObject({
      service: "api",
      status: "ok"
    });
    expect(calls[0]?.url).toBe(`http://127.0.0.1:3001${HEALTH_ROUTE}`);
    expect(header(calls[0]?.init, CSRF_HEADER_NAME)).toBeNull();
  });

  it("stores session + CSRF cookies from login and echoes CSRF on mutations", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const api = new PeriscanApi("http://control.example", {
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push({ init, url });
        if (url.endsWith("/api/v1/auth/login")) {
          return jsonResponse(200, { user: { email: "op@periscan.test" } }, SESSION_SET_COOKIE);
        }
        return jsonResponse(201, { items: [] });
      }
    });

    await api.login({ email: "op@periscan.test", password: "secret-password" });
    expect(calls[0]?.init?.method).toBe("POST");
    expect(header(calls[0]?.init, CSRF_HEADER_NAME)).toBeNull();

    await api.request("/api/v1/scopes", {
      body: JSON.stringify({ scopeType: "Domain", value: "example.com" }),
      method: "POST"
    });
    const mutateHeaders = new Headers(calls[1]?.init?.headers);
    expect(mutateHeaders.get("cookie")).toContain(
      `${SESSION_COOKIE_NAME}=session-jwt`
    );
    expect(mutateHeaders.get("cookie")).toContain(
      `${CSRF_COOKIE_NAME}=csrf-token`
    );
    expect(mutateHeaders.get(CSRF_HEADER_NAME)).toBe("csrf-token");
  });

  it("stores Set-Cookie from signup and sends Cookie plus x-csrf-token on POST", async () => {
    const { calls, fetchImpl } = loggedInFetch(() =>
      jsonResponse(201, { scopeId: "11111111-1111-4111-8111-111111111111" })
    );
    const api = new PeriscanApi("http://control.example", { fetchImpl });

    await api.signup({
      email: "op@periscan.test",
      name: "Operator",
      password: "password-long-enough",
      tenantName: "Ops"
    });
    await api.createScope({ scopeType: "Domain", value: "example.com" });

    expect(calls[0]?.url).toBe("http://control.example/api/v1/auth/signup");
    expect(header(calls[0]?.init, CSRF_HEADER_NAME)).toBeNull();
    expect(calls[1]?.url).toBe("http://control.example/api/v1/scopes");
    expect(calls[1]?.init?.method).toBe("POST");
    expect(header(calls[1]?.init, "cookie")).toContain(
      `${SESSION_COOKIE_NAME}=session-jwt`
    );
    expect(header(calls[1]?.init, CSRF_HEADER_NAME)).toBe("csrf-token");
    expect(calls[1]?.init?.body).toBe(
      JSON.stringify({ scopeType: "Domain", value: "example.com" })
    );
  });

  it("does not send CSRF on GET after login", async () => {
    const calls: Array<{ init?: RequestInit }> = [];
    const api = new PeriscanApi("http://control.example", {
      fetchImpl: async (_input, init) => {
        calls.push({ init });
        if (calls.length === 1) {
          return jsonResponse(200, {}, SESSION_SET_COOKIE);
        }
        return jsonResponse(200, { items: [] });
      }
    });
    await api.login({ email: "op@periscan.test", password: "secret-password" });
    await api.request("/api/v1/findings");
    const headers = new Headers(calls[1]?.init?.headers);
    expect(headers.get("cookie")).toContain(SESSION_COOKIE_NAME);
    expect(headers.get(CSRF_HEADER_NAME)).toBeNull();
  });

  it("throws Error with code on 403 csrf_rejected", async () => {
    const api = new PeriscanApi("http://control.example", {
      fetchImpl: async (input, init) => {
        const url = String(input);
        if (url.endsWith("/api/v1/auth/login")) {
          return jsonResponse(200, { user: { email: "op@periscan.test" } }, SESSION_SET_COOKIE);
        }
        if ((init?.method ?? "GET").toUpperCase() === "POST") {
          return jsonResponse(403, {
            code: "csrf_rejected",
            error: "CSRF validation failed. Reload the page and retry."
          });
        }
        return jsonResponse(200, {});
      }
    });
    await api.login({ email: "op@periscan.test", password: "secret-password" });

    const rejected = api.createScope({
      scopeType: "Domain",
      value: "example.com"
    });
    await expect(rejected).rejects.toBeInstanceOf(Error);
    await expect(rejected).rejects.toMatchObject({
      code: "csrf_rejected",
      message: "CSRF validation failed. Reload the page and retry.",
      status: 403
    });
  });

  it("surfaces policy_denied and never retries the mutation", async () => {
    let posts = 0;
    const api = new PeriscanApi("http://control.example", {
      fetchImpl: async (input, init) => {
        const url = String(input);
        if (url.endsWith("/api/v1/auth/login")) {
          return jsonResponse(200, { user: { email: "op@periscan.test" } }, SESSION_SET_COOKIE);
        }
        if ((init?.method ?? "GET").toUpperCase() === "POST") {
          posts += 1;
          return jsonResponse(403, {
            code: "policy_denied",
            error: "Denied by policy. The task was not queued."
          });
        }
        return jsonResponse(200, {});
      }
    });
    await api.login({ email: "op@periscan.test", password: "secret-password" });
    await expect(
      api.requestJson("/api/v1/community/validation-runs", {
        body: JSON.stringify({ scopeId: "scope-1" }),
        method: "POST"
      })
    ).rejects.toMatchObject({
      code: "policy_denied",
      status: 403
    });
    expect(posts).toBe(1);
  });

  it("hits the routes screens need", async () => {
    const scopeId = "22222222-2222-4222-8222-222222222222";
    const missionId = "33333333-3333-4333-8333-333333333333";
    const policyDecisionId = "44444444-4444-4444-8444-444444444444";
    const { calls, fetchImpl } = loggedInFetch(() => jsonResponse(200, { items: [] }));
    const api = new PeriscanApi("http://control.example", { fetchImpl });
    await api.login({ email: "op@periscan.test", password: "secret-password" });

    await api.verifyScope(scopeId, { devModeManual: true });
    expect(calls.at(-1)).toMatchObject({
      url: `http://control.example/api/v1/scopes/${scopeId}/verify`
    });
    expect(calls.at(-1)?.init?.method).toBe("POST");
    expect(header(calls.at(-1)?.init, CSRF_HEADER_NAME)).toBe("csrf-token");
    expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({
      devModeManual: true
    });

    await api.communitySuite(scopeId);
    expect(calls.at(-1)?.url).toBe(
      `http://control.example/api/v1/community/validation-suite?scopeId=${scopeId}`
    );
    expect(calls.at(-1)?.init?.method).toBe("GET");

    await api.previewPolicy({
      executionEnvironment: "ControlPlane",
      safetyLevel: "PassiveReadOnly",
      scopeId,
      target: { hostname: "example.com" }
    });
    expect(calls.at(-1)?.url).toBe(
      `http://control.example/api/v1/scopes/${scopeId}/policy-decisions/preview`
    );
    expect(header(calls.at(-1)?.init, CSRF_HEADER_NAME)).toBe("csrf-token");
    expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({
      executionEnvironment: "ControlPlane",
      missionType: "ValidationSnapshot",
      requestedAction: {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: false,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      },
      safetyLevel: "PassiveReadOnly",
      target: { hostname: "example.com" }
    });

    await api.startCommunity({
      moduleIds: ["gitleaks.secrets"],
      policyDecisionId,
      scopeId
    });
    expect(calls.at(-1)?.url).toBe(
      "http://control.example/api/v1/community/validation-runs"
    );
    expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({
      moduleIds: ["gitleaks.secrets"],
      policyDecisionId,
      scopeId
    });

    await api.listMissions();
    expect(calls.at(-1)?.url).toBe("http://control.example/api/v1/missions");
    expect(calls.at(-1)?.init?.method).toBe("GET");

    await api.getMission(missionId);
    expect(calls.at(-1)?.url).toBe(
      `http://control.example/api/v1/missions/${missionId}`
    );

    await api.listMissionRuns(missionId);
    expect(calls.at(-1)?.url).toBe(
      `http://control.example/api/v1/missions/${missionId}/runs`
    );

    await api.listFindings();
    expect(calls.at(-1)?.url).toBe("http://control.example/api/v1/findings");

    await api.listFindings({ missionId });
    expect(calls.at(-1)?.url).toBe(
      `http://control.example/api/v1/findings?missionId=${missionId}`
    );

    await api.createCommunityRemediations(missionId);
    expect(calls.at(-1)?.url).toBe(
      `http://control.example/api/v1/community/validation-runs/${missionId}/remediations`
    );
    expect(calls.at(-1)?.init?.method).toBe("POST");
    expect(header(calls.at(-1)?.init, CSRF_HEADER_NAME)).toBe("csrf-token");
    expect(calls.at(-1)?.init?.body).toBeUndefined();

    await api.listEvidence();
    expect(calls.at(-1)?.url).toBe("http://control.example/api/v1/evidence");
    expect(calls.at(-1)?.init?.method).toBe("GET");
  });

  it("marks InternalRunner policy previews as requiring a runner", async () => {
    const { calls, fetchImpl } = loggedInFetch(() =>
      jsonResponse(201, { outcome: "Allowed" })
    );
    const api = new PeriscanApi("http://control.example", { fetchImpl });
    await api.login({ email: "op@periscan.test", password: "secret-password" });

    await api.previewPolicy({
      executionEnvironment: "InternalRunner",
      safetyLevel: "ActiveNonInvasive",
      scopeId: "22222222-2222-4222-8222-222222222222",
      target: { repositoryPath: "/repo" }
    });

    expect(JSON.parse(String(calls.at(-1)?.init?.body)).requestedAction).toMatchObject({
      requiresInternalRunner: true
    });
  });

  it("omits moduleIds from startCommunity unless the caller supplies them", async () => {
    const { calls, fetchImpl } = loggedInFetch(() => jsonResponse(200, { missionId: "m1" }));
    const api = new PeriscanApi("http://control.example", { fetchImpl });
    await api.login({ email: "op@periscan.test", password: "secret-password" });

    await api.startCommunity({
      policyDecisionId: "44444444-4444-4444-8444-444444444444",
      scopeId: "22222222-2222-4222-8222-222222222222"
    });

    expect(JSON.parse(String(calls.at(-1)?.init?.body))).toEqual({
      policyDecisionId: "44444444-4444-4444-8444-444444444444",
      scopeId: "22222222-2222-4222-8222-222222222222"
    });
  });

  it("unwraps list envelopes", async () => {
    const { fetchImpl } = loggedInFetch(() =>
      jsonResponse(200, { items: [{ value: "lab.local" }] })
    );
    const api = new PeriscanApi("http://control.example", { fetchImpl });
    await api.login({ email: "op@periscan.test", password: "secret-password" });
    await expect(api.listScopes()).resolves.toEqual([{ value: "lab.local" }]);
  });

  it("sends Bearer psk_ API keys without CSRF on mutating calls", async () => {
    const calls: Array<{ init?: RequestInit; url: string }> = [];
    const api = new PeriscanApi("http://control.example", {
      fetchImpl: async (input, init) => {
        calls.push({ init, url: String(input) });
        return jsonResponse(200, { items: [] });
      }
    });
    api.applyLabAuth("psk_live_operator_key");

    await api.listScopes();
    await api.qualifyBasPack({
      labReceiptHash: "ab".repeat(32),
      pack: "atomic",
      pinIds: ["atomic.t1082"]
    });

    expect(header(calls[0]?.init, "authorization")).toBe(
      "Bearer psk_live_operator_key"
    );
    expect(header(calls[0]?.init, CSRF_HEADER_NAME)).toBeNull();
    expect(header(calls[1]?.init, "authorization")).toBe(
      "Bearer psk_live_operator_key"
    );
    expect(header(calls[1]?.init, CSRF_HEADER_NAME)).toBeNull();
    expect(calls[1]?.url).toBe("http://control.example/api/v1/bas/packs/qualify");
    expect(calls[1]?.init?.method).toBe("POST");
  });

  it("calls qualify, authorize, danger-catalog, and campaign compile/start/cancel", async () => {
    const { calls, fetchImpl } = loggedInFetch((url) => {
      if (url.includes("/bas/danger-catalog")) {
        return jsonResponse(200, {
          available: true,
          items: [],
          qualified: false,
          tenantAuthorized: false
        });
      }
      if (url.includes("/bas/packs/authorize")) {
        return jsonResponse(200, { created: true });
      }
      if (url.includes("/bas/campaigns/compile")) {
        return jsonResponse(200, {
          jobsQueued: 0,
          plan: { compiledDigest: "cd".repeat(32), startable: false },
          queued: false
        });
      }
      if (url.includes("/bas/campaigns/start")) {
        return jsonResponse(200, { jobsQueued: 0, outcome: "Denied" });
      }
      if (url.includes("/bas/campaigns/cancel")) {
        return jsonResponse(200, { cancelled: true });
      }
      return jsonResponse(200, { created: true });
    });
    const api = new PeriscanApi("http://control.example", { fetchImpl });
    await api.login({ email: "op@periscan.test", password: "secret-password" });

    await api.getBasDangerOperatorGate();
    await api.authorizeBasPack({
      expiresAt: "2027-01-01T00:00:00.000Z",
      pack: "atomic",
      scopeId: "22222222-2222-4222-8222-222222222222"
    });
    await api.compileBasCampaign({
      scenarioPins: [
        { provider: "ControlPlane", typedInputs: {}, upstreamId: "control.detection.benign-marker" }
      ],
      scopeId: "22222222-2222-4222-8222-222222222222"
    });
    await api.startBasCampaign({ compiledDigest: "cd".repeat(32) });
    await api.cancelBasCampaign({
      cleanupReceipts: [],
      compiledDigest: "cd".repeat(32)
    });

    expect(calls.map((call) => call.url)).toEqual(
      expect.arrayContaining([
        "http://control.example/api/v1/auth/login",
        "http://control.example/api/v1/bas/danger-catalog",
        "http://control.example/api/v1/bas/packs/authorize",
        "http://control.example/api/v1/bas/campaigns/compile",
        "http://control.example/api/v1/bas/campaigns/start",
        "http://control.example/api/v1/bas/campaigns/cancel"
      ])
    );
  });
});

describe("isDeniedNeverQueued", () => {
  it("treats policy_denied as a hard stop, not a queueable failure", () => {
    expect(
      isDeniedNeverQueued(
        new PeriscanApiError("Denied by policy.", 403, "policy_denied")
      )
    ).toBe(true);
    expect(
      isDeniedNeverQueued(new PeriscanApiError("CSRF failed", 403, "csrf_rejected"))
    ).toBe(false);
    expect(isDeniedNeverQueued(new Error("network"))).toBe(false);
  });
});
