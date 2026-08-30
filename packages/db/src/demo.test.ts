import { describe, expect, it, vi } from "vitest";

import {
  DEMO_CONNECTOR_BLUEPRINTS,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_RESET_OPERATIONS,
  DEMO_SCOPE_VALUE,
  DEMO_TENANT_ID,
  getDemoBootstrapDefinition,
  resetDemoTenantScenario
} from "./demo.js";

describe("demo bootstrap helpers", () => {
  it("returns the expected demo bootstrap definition", () => {
    const definition = getDemoBootstrapDefinition();

    expect(definition.credentials).toEqual({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD
    });
    expect(definition.scope).toEqual({
      externalValidationProfileId: "safe-baseline",
      scopeType: "Domain",
      value: DEMO_SCOPE_VALUE
    });
    expect(
      definition.connectors.map((connector) => connector.connectorKey)
    ).toEqual(["github", "aws", "jira", "splunk"]);
    expect(definition.connectors).toEqual(
      DEMO_CONNECTOR_BLUEPRINTS.map((connector) => ({
        ...connector,
        config: {
          ...connector.config
        }
      }))
    );
  });

  it("resets demo tenant tables in a stable order", async () => {
    const calls: string[] = [];
    const tenantId = DEMO_TENANT_ID;
    const prisma = Object.fromEntries(
      DEMO_RESET_OPERATIONS.map((operation) => [
        operation.clientKey,
        {
          deleteMany: vi.fn(async (args: { where: { tenantId: string } }) => {
            calls.push(`${operation.label}:${args.where.tenantId}`);
          })
        }
      ])
    );

    await resetDemoTenantScenario(
      prisma as unknown as Parameters<typeof resetDemoTenantScenario>[0],
      tenantId
    );

    expect(calls).toEqual(
      DEMO_RESET_OPERATIONS.map((operation) => `${operation.label}:${tenantId}`)
    );
  });
});
