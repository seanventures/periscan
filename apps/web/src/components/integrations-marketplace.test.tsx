import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IntegrationsMarketplace } from "./integrations-marketplace";

const timestamp = "2026-07-14T12:00:00.000Z";
const integration = {
  authType: "apiToken",
  category: "SecurityControl",
  config: {
    baseUrl: "https://splunk.example.test",
    connectorKey: "splunk",
    mockMode: false,
    token: "[redacted]"
  },
  createdAt: timestamp,
  healthStatus: "Healthy",
  integrationId: "33333333-3333-4333-8333-333333333333",
  lastSyncAt: null,
  nextSyncAt: null,
  permissionsSummary: {
    connectorKey: "splunk",
    requiredPermissions: ["search:read"]
  },
  product: "Splunk Cloud",
  status: "Connected",
  syncFrequency: null,
  tenantId: "11111111-1111-4111-8111-111111111111",
  updatedAt: timestamp,
  vendor: "Splunk"
};

const splunk = {
  authMethods: [
    {
      description: "Fixture data.",
      fields: [],
      kind: "mock",
      label: "Mock",
      mockSupported: true
    },
    {
      description: "Read-only Splunk REST access.",
      fields: [
        {
          key: "baseUrl",
          label: "Splunk REST Base URL",
          required: true,
          secret: false
        },
        {
          key: "token",
          label: "Splunk API Token",
          required: true,
          secret: true
        }
      ],
      kind: "apiToken",
      label: "Splunk API Token",
      mockSupported: false
    }
  ],
  availability: "Beta",
  category: "SecurityControl",
  certificationLevel: "Beta",
  connectable: true,
  connectorKey: "splunk",
  controlObservationCapabilities: ["Logged"],
  customerVisibleDescription: "Read-only detection evidence.",
  dataSensitivity: "High",
  dedicatedClient: true,
  executionReadiness: "ReadyForCredentials",
  executionReadinessReason: "Credentials required.",
  fabricIngestCapabilities: [],
  healthCheckMethod: "REST health",
  implementationTier: "DedicatedClient",
  live: true,
  marketplaceCategory: "SIEM",
  mockSupported: true,
  permissionsSummary: "Runs read-only searches.",
  product: "Splunk Cloud",
  requiredPermissions: ["search:read"],
  setupComplexity: "Medium",
  signalCategories: ["ControlObservation"],
  supportedMissionTypes: ["ControlValidation"],
  validationCapabilities: [],
  vendor: "Splunk",
  workflowCapabilities: []
};

const plannedDarktrace = {
  ...splunk,
  authMethods: [],
  availability: "Planned",
  connectable: false,
  connectorKey: "darktrace",
  dedicatedClient: false,
  executionReadiness: "NotConnectable",
  executionReadinessReason:
    "Catalog coverage only. Setup is blocked until a vendor-specific live client and credentialed contract tests are implemented and reviewed.",
  implementationTier: "StandardizedCatalog",
  live: false,
  product: "ActiveAI Security Platform",
  vendor: "Darktrace"
};

describe("IntegrationsMarketplace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps standardized catalog coverage visible but not configurable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/integrations/catalog") {
        return {
          json: async () => ({ items: [plannedDarktrace] }),
          ok: true,
          status: 200
        };
      }
      if (route === "/api/v1/integrations") {
        return { json: async () => ({ items: [] }), ok: true, status: 200 };
      }
      throw new Error(`Unhandled route ${route}`);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<IntegrationsMarketplace />);

    const interestLink = await screen.findByRole("link", {
      name: "Discuss ActiveAI Security Platform connector design partnership"
    });
    expect(interestLink).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:sales@periscan.com")
    );
    expect(screen.queryByRole("button", { name: "Configure" })).toBeNull();
    expect(
      screen.getByText(/Setup is blocked until a vendor-specific live client/u)
    ).toBeInTheDocument();
  });

  it("never implies Production-certified connectors when catalog is 0 Production", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/integrations/catalog") {
        return {
          json: async () => ({ items: [splunk, plannedDarktrace] }),
          ok: true,
          status: 200
        };
      }
      if (route === "/api/v1/integrations") {
        return { json: async () => ({ items: [] }), ok: true, status: 200 };
      }
      throw new Error(`Unhandled route ${route}`);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<IntegrationsMarketplace />);

    const honesty = await screen.findByTestId("integration-production-honesty");
    expect(honesty).toHaveTextContent(/0 Production-certified/i);
    expect(honesty).toHaveTextContent(/remain\s+Beta/i);
    expect(honesty).toHaveTextContent(/live-smoke/i);
    expect(honesty).not.toHaveTextContent(/Production-ready connectors available/i);

    // Beta badge is fine; Production availability must not appear on cards.
    expect(screen.getAllByText("Beta").length).toBeGreaterThan(0);
    expect(screen.queryByText("Production")).toBeNull();
  });

  it("collects manifest credentials and verifies authorization before showing connected", async () => {
    let configured = false;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/integrations/catalog") {
          return {
            json: async () => ({ items: [splunk] }),
            ok: true,
            status: 200
          };
        }
        if (route === "/api/v1/integrations" && init?.method === "POST") {
          configured = true;
          return {
            json: async () => ({
              ...integration,
              healthStatus: "Unknown",
              status: "Created"
            }),
            ok: true,
            status: 201
          };
        }
        if (route === "/api/v1/integrations") {
          return {
            json: async () => ({ items: configured ? [integration] : [] }),
            ok: true,
            status: 200
          };
        }
        if (
          route.endsWith(`/integrations/${integration.integrationId}/health`)
        ) {
          return {
            json: async () => ({
              health: {
                authorizationVerified: true,
                checkedAt: timestamp,
                detail: "Splunk authorization verified.",
                latencyMs: 12,
                status: "Healthy"
              },
              integration
            }),
            ok: true,
            status: 200
          };
        }
        throw new Error(`Unhandled route ${route}`);
      }
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<IntegrationsMarketplace />);
    fireEvent.click(await screen.findByRole("button", { name: "Configure" }));

    expect(screen.getByLabelText("Authentication method")).toHaveValue(
      "apiToken"
    );
    expect(screen.getByLabelText("Splunk API Token")).toHaveAttribute(
      "type",
      "password"
    );
    expect(
      screen.getByRole("button", { name: "Save and test connection" })
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Splunk REST Base URL"), {
      target: { value: "https://splunk.example.test" }
    });
    fireEvent.change(screen.getByLabelText("Splunk API Token"), {
      target: { value: "secret-token" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save and test connection" })
    );

    await screen.findByText(
      /credentials verified: Splunk authorization verified/
    );
    const createCall = fetchMock.mock.calls.find(
      ([route, init]) =>
        String(route) === "/api/v1/integrations" && init?.method === "POST"
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      authType: "apiToken",
      config: {
        baseUrl: "https://splunk.example.test",
        token: "secret-token"
      },
      connectorKey: "splunk",
      mockMode: false
    });
    await waitFor(() =>
      expect(screen.getByText("Connected and verified")).toBeInTheDocument()
    );
  });
});
