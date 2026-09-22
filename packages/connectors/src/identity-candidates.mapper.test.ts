import { afterEach, describe, expect, it, vi } from "vitest";

import {
  countIdentityCandidates,
  IDENTITY_ABUSE_PROMOTE_TO_SCOPE_REQUIRED_CODE,
  evaluateIdentityAbuseStart
} from "@periscan/shared";

import { getConnectorByKey } from "./index.js";

const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const INTEGRATION_ID = "11111111-1111-4111-8111-111111111111";

function mockContext(connectorKey: string) {
  return {
    authType: "mock",
    config: { connectorKey, mockMode: true },
    integrationId: INTEGRATION_ID,
    mockMode: true,
    tenantId: TENANT_ID
  };
}

function expectCandidateShape(
  candidates: Array<{
    autoAddedToScope: boolean;
    externalId: string;
    kind: string;
    liveSpray: boolean;
    promotion: string;
    source: string;
  }>,
  source: string
) {
  expect(candidates.length).toBeGreaterThan(0);
  expect(candidates.every((row) => row.source === source)).toBe(true);
  expect(candidates.every((row) => row.autoAddedToScope === false)).toBe(true);
  expect(candidates.every((row) => row.liveSpray === false)).toBe(true);
  expect(candidates.every((row) => row.promotion === "promote-to-scope")).toBe(
    true
  );
  expect(candidates.every((row) => row.externalId.length > 0)).toBe(true);
  expect(new Set(candidates.map((row) => row.kind))).toEqual(
    new Set(["user", "group", "app"])
  );
}

describe("IdP connector sync → IdentityCandidate mapper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("produces Okta user/group/app candidates from mock sync without auto-scope or live spray", async () => {
    const connector = getConnectorByKey("okta");
    expect(connector).toBeDefined();
    const result = await connector!.sync(mockContext("okta"));

    expectCandidateShape(result.identityCandidates ?? [], "okta");
    expect(countIdentityCandidates(result.identityCandidates ?? [])).toEqual({
      apps: 1,
      groups: 2,
      users: 2
    });
    expect(
      evaluateIdentityAbuseStart({
        candidates: result.identityCandidates,
        moduleId: "identity.cred_spray"
      }).code
    ).toBe(IDENTITY_ABUSE_PROMOTE_TO_SCOPE_REQUIRED_CODE);
  });

  it("produces Entra user/group/app candidates from mock sync", async () => {
    const connector = getConnectorByKey("microsoft-entra-id");
    expect(connector).toBeDefined();
    const result = await connector!.sync(mockContext("microsoft-entra-id"));

    expectCandidateShape(
      result.identityCandidates ?? [],
      "microsoft-entra-id"
    );
    expect(countIdentityCandidates(result.identityCandidates ?? [])).toEqual({
      apps: 1,
      groups: 2,
      users: 2
    });
    expect(
      result.identityCandidates?.some(
        (row) => row.kind === "user" && row.externalId === "entra-user-admin"
      )
    ).toBe(true);
  });

  it("produces JumpCloud user/group/app candidates from mock sync", async () => {
    const connector = getConnectorByKey("jumpcloud");
    expect(connector).toBeDefined();
    const result = await connector!.sync(mockContext("jumpcloud"));

    expectCandidateShape(result.identityCandidates ?? [], "jumpcloud");
    expect(countIdentityCandidates(result.identityCandidates ?? [])).toEqual({
      apps: 2,
      groups: 2,
      users: 2
    });
  });

  it("maps live Okta inventory responses to candidates without leaking the API token", async () => {
    const connector = getConnectorByKey("okta");
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/v1/users/me")) {
        return new Response(JSON.stringify({ id: "00u-me", profile: { login: "svc" } }));
      }
      if (url.includes("/factors")) {
        return new Response(JSON.stringify([]));
      }
      if (url.includes("/api/v1/users")) {
        return new Response(
          JSON.stringify([
            { id: "00u-live", profile: { displayName: "Live User", login: "live@example.com" }, status: "ACTIVE" }
          ])
        );
      }
      if (url.includes("/api/v1/groups")) {
        return new Response(
          JSON.stringify([{ id: "00g-live", profile: { name: "Live Group" } }])
        );
      }
      if (url.includes("/api/v1/apps")) {
        return new Response(
          JSON.stringify([{ id: "0oa-live", label: "Live App", name: "live-app", status: "ACTIVE" }])
        );
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiToken",
      config: {
        apiToken: "okta-secret-ssws-api-token",
        orgUrl: "https://periscan.okta.test"
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(countIdentityCandidates(result.identityCandidates ?? [])).toEqual({
      apps: 1,
      groups: 1,
      users: 1
    });
    expect(result.identityCandidates?.[0]?.source).toBe("okta");
    expect(JSON.stringify(result)).not.toContain("okta-secret-ssws-api-token");
  });
});
