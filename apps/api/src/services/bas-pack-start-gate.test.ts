import { describe, expect, it } from "vitest";

import { DANGER_CATALOG } from "@periscan/shared";

import type { AuthenticatedContext } from "../runtime-services.js";
import { createBasPackStartGateServices } from "./bas-pack-start-gate.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const ownerContext = {
  membership: { role: "Owner", tenantId: TENANT_ID, userId: USER_ID },
  tenant: { tenantId: TENANT_ID },
  user: { userId: USER_ID }
} as unknown as AuthenticatedContext;

function prismaWithRows(input: {
  authorizations?: Array<{ expiresAt: Date }>;
  qualifications?: Array<{ pack: string }>;
}) {
  return {
    $transaction: async (
      fn: (tx: {
        $executeRaw: () => Promise<number>;
        basPackQualification: { findMany: () => Promise<Array<{ pack: string }>> };
        tenantBasPackAuthorization: {
          findMany: () => Promise<Array<{ expiresAt: Date }>>;
        };
      }) => Promise<unknown>
    ) =>
      fn({
        $executeRaw: async () => 0,
        basPackQualification: {
          findMany: async () => input.qualifications ?? []
        },
        tenantBasPackAuthorization: {
          findMany: async () => input.authorizations ?? []
        }
      })
  };
}

describe("getBasDangerOperatorGate", () => {
  it("returns the catalog as available and unqualified when no receipts exist", async () => {
    const services = createBasPackStartGateServices({
      prisma: prismaWithRows({}) as never
    });
    const gate = await services.getBasDangerOperatorGate(ownerContext);
    expect(gate.available).toBe(true);
    expect(gate.qualified).toBe(false);
    expect(gate.tenantAuthorized).toBe(false);
    expect(gate.items.map((item) => item.moduleId)).toEqual(
      DANGER_CATALOG.map((entry) => entry.moduleId)
    );
  });

  it("sets qualified and tenantAuthorized from stored receipts", async () => {
    const services = createBasPackStartGateServices({
      prisma: prismaWithRows({
        authorizations: [{ expiresAt: new Date("2027-01-01T00:00:00.000Z") }],
        qualifications: [{ pack: "atomic" }]
      }) as never
    });
    const gate = await services.getBasDangerOperatorGate(ownerContext);
    expect(gate.available).toBe(true);
    expect(gate.qualified).toBe(true);
    expect(gate.tenantAuthorized).toBe(true);
  });
});
