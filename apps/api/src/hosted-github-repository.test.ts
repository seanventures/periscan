import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type {
  AuthenticatedContext,
  RuntimeServiceDeps
} from "./runtime-services.js";
import { createScopeServices } from "./services/scopes.js";
import { createValidationServices } from "./services/validation.js";

describe("hosted GitHub URL is not a verifiable repository path", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const scopeId = "33333333-3333-4333-8333-333333333333";

  function context(role: "Owner" | "Admin" = "Owner"): AuthenticatedContext {
    return {
      membership: {
        membershipId: randomUUID(),
        role,
        tenantId,
        userId
      },
      session: {
        sessionId: randomUUID(),
        tenantId,
        userId
      },
      tenant: {
        name: "GitHub URL Tenant",
        slug: "github-url-tenant",
        tenantId
      },
      user: {
        email: "owner@periscan.test",
        userId
      }
    } as AuthenticatedContext;
  }

  it("refuses createScope for a hosted GitHub URL so the row cannot stay PENDING", async () => {
    const scopeCreate = vi.fn();
    const services = createScopeServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: false,
      emailTransport: { send: vi.fn() },
      interventionSigningSecret: "test-intervention-secret",
      missionQueue: {
        enqueueValidationJob: vi.fn()
      },
      prisma: {
        scope: {
          create: scopeCreate
        }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    await expect(
      services.createScope(context(), {
        assetClass: "Code",
        businessCriticality: "Moderate",
        externalValidationProfileId: null,
        maxSafetyLevel: "ActiveNonInvasive",
        purdueLevel: null,
        scopeType: "Repository",
        segmentName: null,
        sensitivity: "Moderate",
        tags: [],
        value: "https://github.com/org/repo"
      })
    ).rejects.toMatchObject({
      code: "hosted_github_url_not_verifiable",
      statusCode: 400
    });
    expect(scopeCreate).not.toHaveBeenCalled();
  });

  it("refuses Verify and Attest when the repository value is a hosted GitHub URL", async () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    const scope = {
      assetClass: "Code",
      businessCriticality: "Moderate",
      createdAt: now,
      createdBy: userId,
      externalValidationProfileId: null,
      maxSafetyLevel: "ActiveNonInvasive",
      purdueLevel: null,
      scopeId,
      scopeType: "Repository",
      segmentName: null,
      sensitivity: "Moderate",
      tags: [],
      tenantId,
      updatedAt: now,
      value: "https://github.com/org/repo",
      verificationMethod: "FILE",
      verificationStatus: "Pending",
      verificationToken: "periscan-token",
      verifiedAt: null,
      verifiedBy: null
    };
    const scopeUpdate = vi.fn();
    const auditCreate = vi.fn();
    const services = createValidationServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: false,
      emailTransport: { send: vi.fn() },
      interventionSigningSecret: "test-intervention-secret",
      missionQueue: {
        enqueueValidationJob: vi.fn()
      },
      prisma: {
        auditEvent: {
          create: auditCreate
        },
        scope: {
          findFirst: vi.fn().mockResolvedValue(scope),
          update: scopeUpdate
        }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    await expect(
      services.verifyScope(context(), scopeId, {
        devModeManual: false,
        operatorAttestation: false
      })
    ).rejects.toMatchObject({
      code: "hosted_github_url_not_verifiable",
      statusCode: 400
    });

    await expect(
      services.verifyScope(context(), scopeId, {
        devModeManual: false,
        operatorAttestation: true
      })
    ).rejects.toMatchObject({
      code: "hosted_github_url_not_verifiable",
      statusCode: 400
    });

    expect(scopeUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
