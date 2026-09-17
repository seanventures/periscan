import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

import {
  authCookies,
  getSessionCookie,
  safeRequestedAction
} from "./helpers.js";

/**
 * approvedAt/approvedBy on a PolicyDecision are proof-of-approval: who approved it
 * and when. They must be populated ONLY for an Approved decision; a denied decision
 * was explicitly NOT approved, so it must never bear an approver. This proves the
 * deny path no longer over-claims approval (it previously stamped approvedAt:now +
 * approvedBy:<denier> while setting approvalState to Rejected), while the approve
 * path still records the real approver.
 */
describe("Policy decision deny/approve approval stamp", () => {
  async function setupVerifiedScope(app: Awaited<ReturnType<typeof buildApp>>) {
    const owner = await app.inject({
      method: "POST",
      payload: {
        email: `deny-owner-${randomUUID()}@periscan.test`,
        name: "Deny Owner",
        password: "periscan-deny-password",
        tenantName: "Deny Tenant"
      },
      url: "/api/v1/auth/signup"
    });
    expect(owner.statusCode).toBe(201);
    const cookie = getSessionCookie(owner);

    const scope = await app.inject({
      cookies: authCookies(cookie),
      method: "POST",
      payload: {
        scopeType: "Domain",
        value: `deny-${randomUUID()}.example.com`
      },
      url: "/api/v1/scopes"
    });
    expect(scope.statusCode).toBe(201);
    const scopeId = scope.json().scopeId as string;

    const verify = await app.inject({
      cookies: authCookies(cookie),
      method: "POST",
      payload: { devModeManual: true },
      url: `/api/v1/scopes/${scopeId}/verify`
    });
    expect(verify.statusCode).toBe(200);

    return { cookie, scopeId };
  }

  async function previewRequiresApproval(
    app: Awaited<ReturnType<typeof buildApp>>,
    cookie: string,
    scopeId: string
  ) {
    // ControlledValidation without explicit mission approval resolves to a
    // RequiresApproval/Pending decision, created with no approval stamp.
    const preview = await app.inject({
      cookies: authCookies(cookie),
      method: "POST",
      payload: {
        executionEnvironment: "ExternalPoA",
        missionType: "ExposureValidation",
        requestedAction: safeRequestedAction(),
        safetyLevel: "ControlledValidation",
        target: { hostname: `decision-${randomUUID()}.example.com` }
      },
      url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
    });
    expect(preview.statusCode).toBe(201);
    const decision = preview.json();
    expect(decision.outcome).toBe("RequiresApproval");
    expect(decision.approvalState).toBe("Pending");
    expect(decision.approvedAt).toBeNull();
    expect(decision.approvedBy).toBeNull();
    return decision.policyDecisionId as string;
  }

  it("denies without stamping an approver, and approves with one", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });

    try {
      const { cookie, scopeId } = await setupVerifiedScope(app);

      // Deny path: approvalState flips to Rejected but the approval stamp stays
      // null — a denied decision must never record who/when it was "approved".
      const denyId = await previewRequiresApproval(app, cookie, scopeId);
      const deny = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/approvals/${denyId}/deny`
      });
      expect(deny.statusCode).toBe(200);
      const denied = deny.json();
      expect(denied.approvalState).toBe("Rejected");
      expect(denied.approvedAt).toBeNull();
      expect(denied.approvedBy).toBeNull();

      // Approve path (unchanged): the real approver and timestamp are recorded.
      const approveId = await previewRequiresApproval(app, cookie, scopeId);
      const approve = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/approvals/${approveId}/approve`
      });
      expect(approve.statusCode).toBe(200);
      const approved = approve.json();
      expect(approved.approvalState).toBe("Approved");
      expect(typeof approved.approvedAt).toBe("string");
      expect(typeof approved.approvedBy).toBe("string");
      expect((approved.approvedBy as string).length).toBeGreaterThan(0);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);

  it("denying an auto-allowed decision blocks the mission from starting", async () => {
    // denyPolicyDecision carries no outcome guard, so an auto-"Allowed" decision
    // (verified scope + ActiveNonInvasive) can be rejected to revoke it. The
    // mission-start gate must honor that rejection: before the fix it returned
    // "Proceed" for an Allowed outcome regardless of approvalState, so the deny
    // was decorative and the mission queued anyway.
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });

    try {
      const { cookie, scopeId } = await setupVerifiedScope(app);

      const scope = await prisma.scope.findUniqueOrThrow({
        where: { scopeId }
      });

      const preview = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          requestedAction: safeRequestedAction(),
          safetyLevel: "ActiveNonInvasive",
          target: { hostname: scope.value }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(preview.statusCode).toBe(201);
      expect(preview.json().outcome).toBe("Allowed");
      expect(preview.json().approvalState).toBe("NotRequired");
      const policyDecisionId = preview.json().policyDecisionId as string;

      const missionResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(missionResponse.statusCode).toBe(201);
      const missionId = missionResponse.json().missionId as string;

      // Revoke the auto-allowed decision.
      const deny = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/approvals/${policyDecisionId}/deny`
      });
      expect(deny.statusCode).toBe(200);
      expect(deny.json().approvalState).toBe("Rejected");

      const start = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { moduleIds: ["nuclei.external_exposure_safe"] },
        url: `/api/v1/missions/${missionId}/start`
      });
      expect(start.statusCode).toBe(200);
      expect(start.json().jobsQueued).toBe(0);
      expect(start.json().mission.status).toBe("DeniedByPolicy");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
