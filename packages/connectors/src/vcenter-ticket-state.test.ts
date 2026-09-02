import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const integrationContext = {
  integrationId: "22222222-2222-4222-8222-222222222222",
  tenantId: "11111111-1111-4111-8111-111111111111"
};

describe("vCenter inventory and workflow ticket state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("normalizes bounded vCenter fixture inventory and topology signals", async () => {
    const connector = getConnectorByKey("vmware-vcenter");
    expect(connector?.manifest.workflowCapabilities).toEqual([]);
    expect(connector?.manifest.permissionsSummary).toContain("Read-only");
    expect(connector?.manifest.customerVisibleDescription).toMatch(/Partial/i);
    expect(connector?.manifest.customerVisibleDescription).toMatch(
      /read-only inventory/i
    );

    const result = await connector!.sync({
      ...integrationContext,
      authType: "mock",
      config: {},
      mockMode: true
    });

    expect(result.health.authorizationVerified).toBe(true);
    expect(result.assets).toHaveLength(5);
    expect(result.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetType: "Host",
          name: "validation-target-01",
          tags: expect.arrayContaining(["virtual-machine", "vcenter"])
        }),
        expect.objectContaining({
          name: "Authorized Lab Cluster",
          tags: expect.arrayContaining(["cluster"])
        })
      ])
    );
    expect(result.signals).toHaveLength(5);
    expect(result.signals.every((signal) => signal.redactionStatus === "Redacted"))
      .toBe(true);
  });

  it("uses a vSphere session for bounded read-only inventory endpoints", async () => {
    const requested: Array<{ method: string; url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        requested.push({ method: init?.method ?? "GET", url });
        if (url.endsWith("/api/session")) {
          return new Response(JSON.stringify("session-token"), { status: 201 });
        }
        if (url.endsWith("/api/vcenter/datacenter")) {
          return Response.json([{ datacenter: "dc-1", name: "DC One" }]);
        }
        if (url.endsWith("/api/vcenter/cluster")) {
          return Response.json([{ cluster: "cluster-1", name: "Cluster One" }]);
        }
        if (url.endsWith("/api/vcenter/host")) {
          return Response.json([{ host: "host-1", name: "esxi-1" }]);
        }
        if (url.endsWith("/api/vcenter/network")) {
          return Response.json([{ network: "network-1", name: "Network One" }]);
        }
        if (url.endsWith("/api/vcenter/vm")) {
          return Response.json([{ name: "vm-one", vm: "vm-1" }]);
        }
        return new Response(null, { status: 404 });
      })
    );

    const result = await getConnectorByKey("vmware-vcenter")!.sync({
      ...integrationContext,
      authType: "basicAuth",
      config: {
        apiBaseUrl: "https://vcenter.example.test",
        password: "never-return-this-password",
        username: "periscan-readonly"
      },
      mockMode: false
    });

    expect(result.assets).toHaveLength(5);
    expect(requested[0]).toEqual({
      method: "POST",
      url: "https://vcenter.example.test/api/session"
    });
    expect(requested.map((request) => request.url)).toEqual(
      expect.arrayContaining([
        "https://vcenter.example.test/api/vcenter/datacenter",
        "https://vcenter.example.test/api/vcenter/cluster",
        "https://vcenter.example.test/api/vcenter/host",
        "https://vcenter.example.test/api/vcenter/network",
        "https://vcenter.example.test/api/vcenter/vm"
      ])
    );
    expect(JSON.stringify(result)).not.toContain("never-return-this-password");
  });

  it("reads Jira issue status without promoting closure to proof", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          fields: {
            resolutiondate: "2026-07-14T20:00:00.000Z",
            status: { name: "Done", statusCategory: { key: "done" } },
            updated: "2026-07-14T20:00:00.000Z"
          }
        })
      )
    );
    const result = await getConnectorByKey("jira")!.readWorkflowState!({
      ...integrationContext,
      authType: "apiToken",
      config: {
        apiToken: "jira-secret",
        email: "operator@example.test",
        projectKey: "PSCAN",
        siteUrl: "https://example.atlassian.net",
        workflowEvent: { ticketId: "PSCAN-42" }
      },
      mockMode: false
    });

    expect(result).toMatchObject({
      state: "Closed",
      stateLabel: "Done",
      ticketId: "PSCAN-42"
    });
    expect(JSON.stringify(result)).not.toContain("jira-secret");
  });

  it("reads ServiceNow active state from the authorized ticket table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          result: [
            {
              active: "true",
              number: "INC0042",
              state: "2",
              sys_id: "abc123",
              sys_updated_on: "2026-07-14 20:00:00"
            }
          ]
        })
      )
    );
    const result = await getConnectorByKey("servicenow")!.readWorkflowState!({
      ...integrationContext,
      authType: "basicAuth",
      config: {
        instanceUrl: "https://example.service-now.com",
        password: "servicenow-secret",
        ticketTable: "incident",
        username: "periscan-readonly",
        workflowEvent: { ticketId: "INC0042" }
      },
      mockMode: false
    });

    expect(result).toMatchObject({
      state: "InProgress",
      stateLabel: "ServiceNow state 2",
      ticketId: "INC0042"
    });
    expect(JSON.stringify(result)).not.toContain("servicenow-secret");
  });
});
