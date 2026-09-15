import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type {
  AuthenticatedContext,
  RuntimeServiceDeps
} from "./runtime-services.js";
import { createValidationServices } from "./services/validation.js";

/**
 * SETTLED PERISCAN-506 — CIDR / internal-network operator attestation must be
 * audited with scope identity, the attestation flag, and the actor role.
 */
describe("operator attestation scope.verified audit metadata", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const scopeId = "33333333-3333-4333-8333-333333333333";

  function context(role: "Owner" | "Admin"): AuthenticatedContext {
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
        name: "Attest Tenant",
        slug: "attest-tenant",
        tenantId
      },
      user: {
        email: "owner@periscan.test",
        userId
      }
    } as AuthenticatedContext;
  }

  function scopeRecord(input: {
    scopeType: "IPRange" | "InternalNetwork" | "CloudAccount";
    value: string;
  }) {
    const now = new Date("2026-08-30T12:00:00.000Z");
    return {
      assetClass: "Other",
      businessCriticality: "Moderate",
      createdAt: now,
      createdBy: userId,
      externalValidationProfileId: null,
      maxSafetyLevel: "PassiveReadOnly",
      purdueLevel: null,
      scopeId,
      scopeType: input.scopeType,
      segmentName: null,
      sensitivity: "Moderate",
      tags: [],
      tenantId,
      updatedAt: now,
      value: input.value,
      verificationMethod: null,
      verificationStatus: "Pending",
      verificationToken: "periscan-token",
      verifiedAt: null,
      verifiedBy: null
    };
  }

  function buildServices(input: {
    integrations?: Array<{
      config: unknown;
      integrationId: string;
      product: string;
      status: string;
      vendor: string;
    }>;
    scope: ReturnType<typeof scopeRecord>;
  }) {
    const auditCreate = vi.fn().mockResolvedValue({});
    const scopeUpdate = vi.fn().mockImplementation(async ({ data }) => ({
      ...input.scope,
      ...data
    }));
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
        integration: {
          findMany: vi.fn().mockResolvedValue(input.integrations ?? [])
        },
        scope: {
          findFirst: vi.fn().mockResolvedValue(input.scope),
          update: scopeUpdate
        }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    return { auditCreate, scopeUpdate, services };
  }

  it("audits CIDR Owner attestation with scopeType, scopeValue, operatorAttestation, and role", async () => {
    const scope = scopeRecord({
      scopeType: "IPRange",
      value: "10.0.0.0/8"
    });
    const { auditCreate, services } = buildServices({ scope });

    await services.verifyScope(context("Owner"), scopeId, {
      devModeManual: false,
      operatorAttestation: true
    });

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "scope_verified",
        actorType: "User",
        entityId: scopeId,
        entityType: "Scope",
        metadata: {
          method: "operator_attestation",
          operatorAttestation: true,
          role: "Owner",
          scopeType: "IPRange",
          scopeValue: "10.0.0.0/8"
        },
        tenantId,
        userId
      })
    });
  });

  it("audits InternalNetwork Admin attestation with the same metadata fields", async () => {
    const scope = scopeRecord({
      scopeType: "InternalNetwork",
      value: "172.16.0.0/12"
    });
    const { auditCreate, services } = buildServices({ scope });

    await services.verifyScope(context("Admin"), scopeId, {
      devModeManual: false,
      operatorAttestation: true
    });

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "scope_verified",
        metadata: {
          method: "operator_attestation",
          operatorAttestation: true,
          role: "Admin",
          scopeType: "InternalNetwork",
          scopeValue: "172.16.0.0/12"
        }
      })
    });
  });

  it("does not write an audit event when CIDR verification lacks attestation", async () => {
    const scope = scopeRecord({
      scopeType: "IPRange",
      value: "192.168.0.0/16"
    });
    const { auditCreate, services } = buildServices({ scope });

    await expect(
      services.verifyScope(context("Owner"), scopeId, {
        devModeManual: false,
        operatorAttestation: false
      })
    ).rejects.toMatchObject({
      code: "operator_attestation_required",
      statusCode: 400
    });
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("records operatorAttestation false when CloudAccount verifies via AWS match", async () => {
    const scope = scopeRecord({
      scopeType: "CloudAccount",
      value: "123456789012"
    });
    const { auditCreate, services } = buildServices({
      integrations: [
        {
          config: { awsAccountId: "123456789012" },
          integrationId: randomUUID(),
          product: "AWS",
          status: "Connected",
          vendor: "AWS"
        }
      ],
      scope
    });

    await services.verifyScope(context("Owner"), scopeId, {
      devModeManual: false
    });

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "scope_verified",
        metadata: {
          method: "aws_integration",
          operatorAttestation: false,
          role: "Owner",
          scopeType: "CloudAccount",
          scopeValue: "123456789012"
        }
      })
    });
  });
});
