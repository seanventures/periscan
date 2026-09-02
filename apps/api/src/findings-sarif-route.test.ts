import { describe, expect, it, vi } from "vitest";

import {
  SARIF_CONTENT_TYPE,
  SARIF_EXPORT_DISCLAIMER,
  SARIF_VERSION
} from "@periscan/reports";

import { buildApp } from "./app.js";
import { createSessionToken, SESSION_COOKIE_NAME } from "./security.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const MISSION_ID = "55555555-5555-4555-8555-555555555555";
const EVIDENCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BACKED_FINDING_ID = "66666666-6666-4666-8666-666666666666";
const EMPTY_FINDING_ID = "77777777-7777-4777-8777-777777777777";
const SESSION_SECRET = "findings-sarif-session-secret";

const ownerContext = {
  membership: {
    membershipId: "88888888-8888-4888-8888-888888888888",
    role: "Owner",
    tenantId: TENANT_ID,
    userId: USER_ID
  },
  session: {
    authMethod: "password" as const,
    defaultTenantId: TENANT_ID,
    userId: USER_ID
  },
  tenant: {
    name: "SARIF Tenant",
    requireMfa: false,
    tenantId: TENANT_ID,
    type: "Customer"
  },
  user: {
    email: "sarif@periscan.test",
    mfaEnabledAt: null,
    name: "SARIF Owner",
    userId: USER_ID
  }
};

describe("GET /api/v1/findings.sarif", () => {
  it("requires the same session auth as GET /findings", async () => {
    const listValidatedFindings = vi.fn();
    const app = await buildApp({
      services: { listValidatedFindings } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/findings.sarif"
      });

      expect(response.statusCode).toBe(401);
      expect(listValidatedFindings).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("exports evidence-backed findings as Community SARIF 2.1.0", async () => {
    const listValidatedFindings = vi.fn(async () => [
      {
        evidenceIds: [EVIDENCE_ID],
        findingId: BACKED_FINDING_ID,
        severity: "High",
        source: "gitleaks.repository_secrets",
        title: "Repository secret"
      },
      {
        evidenceIds: [],
        findingId: EMPTY_FINDING_ID,
        severity: "Critical",
        source: "gitleaks.repository_secrets",
        title: "Theater finding"
      }
    ]);
    const app = await buildApp({
      services: {
        getSessionContext: async () => ownerContext,
        listValidatedFindings
      } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      const response = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "GET",
        url: `/api/v1/findings.sarif?missionId=${MISSION_ID}`
      });

      expect(response.statusCode).toBe(200);
      expect(String(response.headers["content-type"])).toContain(
        SARIF_CONTENT_TYPE
      );

      const log = response.json();
      expect(log.version).toBe(SARIF_VERSION);
      const findingIds = log.runs[0]?.results.map(
        (result: { properties?: { findingId?: string } }) =>
          result.properties?.findingId
      );
      expect(findingIds).toEqual([BACKED_FINDING_ID]);
      expect(log.runs[0]?.tool?.driver?.properties?.disclaimer).toBe(
        SARIF_EXPORT_DISCLAIMER
      );
      expect(SARIF_EXPORT_DISCLAIMER.toLowerCase()).toContain(
        "not a certification"
      );
      expect(SARIF_EXPORT_DISCLAIMER.toLowerCase()).toContain("not a pentest");

      expect(listValidatedFindings).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant: expect.objectContaining({ tenantId: TENANT_ID })
        }),
        expect.objectContaining({ missionId: MISSION_ID })
      );
    } finally {
      await app.close();
    }
  });
});
