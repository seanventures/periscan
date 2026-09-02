import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedContext, RuntimeServiceDeps } from "./runtime-services.js";
import { createModelGatewayServices } from "./services/model-gateway.js";

describe("executeModelToolRequest CAS + kill switch", () => {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const toolRequestId = randomUUID();
  const modelSessionId = randomUUID();
  const scopeId = randomUUID();

  function authContext(): AuthenticatedContext {
    return {
      membership: {
        membershipId: randomUUID(),
        role: "Admin",
        tenantId,
        userId
      },
      session: {
        sessionId: randomUUID(),
        tenantId,
        userId
      },
      tenant: {
        name: "Kill Switch CAS Tenant",
        slug: "kill-switch-cas",
        tenantId
      },
      user: {
        email: "admin@example.com",
        userId
      }
    } as AuthenticatedContext;
  }

  function toolRequest(status: string) {
    return {
      approvedAt: null,
      approvedBy: null,
      completedAt: null,
      createdAt: new Date(),
      denialReason: null,
      inputPayloadHash: "b".repeat(64),
      inputPayloadRedacted: { limit: 5 },
      modelSessionId,
      policyDecisionId: null,
      requestReason: "CAS race drill",
      requestedByModel: false,
      result: null,
      scopeIds: [scopeId],
      session: {
        endedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        modelSessionId,
        status: "Active",
        tenantId
      },
      status,
      tenantId,
      toolName: "list_assets_in_scope",
      toolRequestId,
      updatedAt: new Date()
    };
  }

  function buildServices(input: {
    killSwitchActive: boolean;
    claimCount: number;
    requestStatus?: string;
  }) {
    const updateMany = vi.fn().mockResolvedValue({ count: input.claimCount });
    const findFirst = vi
      .fn()
      // initial tool request load
      .mockResolvedValueOnce(toolRequest(input.requestStatus ?? "Allowed"))
      // post-claim session reload
      .mockResolvedValueOnce({
        endedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        modelSessionId,
        status: "Active",
        tenantId
      });

    const services = createModelGatewayServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      interventionSigningSecret: "test-intervention-secret",
      modelGatewayTurnQueue: { enqueueTurn: vi.fn() },
      prisma: {
        modelSession: {
          findFirst: vi.fn().mockResolvedValue({
            endedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
            modelSessionId,
            status: "Active",
            tenantId
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 })
        },
        modelToolRequest: {
          findFirst,
          updateMany
        },
        tenant: {
          findUnique: vi.fn().mockResolvedValue({
            modelGatewayKillSwitchActivatedAt: input.killSwitchActive
              ? new Date()
              : null,
            modelGatewayKillSwitchActive: input.killSwitchActive,
            modelGatewayKillSwitchReason: input.killSwitchActive
              ? "operator halt"
              : null
          })
        }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    return { findFirst, services, updateMany };
  }

  it("refuses execute while the durable kill switch is already active", async () => {
    const { services, updateMany } = buildServices({
      claimCount: 1,
      killSwitchActive: true
    });

    await expect(
      services.executeModelToolRequest(authContext(), toolRequestId)
    ).rejects.toMatchObject({
      code: "model_gateway_kill_switch_active",
      statusCode: 409
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("does not resurrect a Cancelled tool request after kill-switch CAS miss", async () => {
    const { services, updateMany } = buildServices({
      claimCount: 0,
      killSwitchActive: false,
      requestStatus: "Allowed"
    });

    await expect(
      services.executeModelToolRequest(authContext(), toolRequestId)
    ).rejects.toMatchObject({
      code: "conflict",
      statusCode: 409
    });

    expect(updateMany).toHaveBeenCalledWith({
      data: { status: "Running" },
      where: {
        status: { in: ["Allowed", "Approved"] },
        tenantId,
        toolRequestId
      }
    });
    // No second unconditional status rewrite after a lost claim.
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it("cancels a claimed Running request when kill switch flips after CAS claim", async () => {
    const tenantFindUnique = vi
      .fn()
      // pre-claim check: inactive
      .mockResolvedValueOnce({
        modelGatewayKillSwitchActivatedAt: null,
        modelGatewayKillSwitchActive: false,
        modelGatewayKillSwitchReason: null
      })
      // post-claim check: activate raced in
      .mockResolvedValueOnce({
        modelGatewayKillSwitchActivatedAt: new Date(),
        modelGatewayKillSwitchActive: true,
        modelGatewayKillSwitchReason: "operator halt"
      });

    const updateMany = vi
      .fn()
      // CAS claim wins
      .mockResolvedValueOnce({ count: 1 })
      // abort path Cancelled
      .mockResolvedValueOnce({ count: 1 });

    const services = createModelGatewayServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      interventionSigningSecret: "test-intervention-secret",
      modelGatewayTurnQueue: { enqueueTurn: vi.fn() },
      prisma: {
        modelSession: {
          findFirst: vi.fn().mockResolvedValue({
            endedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
            modelSessionId,
            status: "Active",
            tenantId
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 })
        },
        modelToolRequest: {
          findFirst: vi.fn().mockResolvedValue(toolRequest("Allowed")),
          updateMany
        },
        tenant: { findUnique: tenantFindUnique }
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    await expect(
      services.executeModelToolRequest(authContext(), toolRequestId)
    ).rejects.toMatchObject({
      code: "model_gateway_kill_switch_active",
      statusCode: 409
    });

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      data: { status: "Running" },
      where: {
        status: { in: ["Allowed", "Approved"] },
        tenantId,
        toolRequestId
      }
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      data: {
        denialReason: expect.stringContaining("Kill switch activated before execution"),
        status: "Cancelled"
      },
      where: {
        status: "Running",
        tenantId,
        toolRequestId
      }
    });
  });
});
