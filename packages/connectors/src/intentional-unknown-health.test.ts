import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const TENANT_ID = "55555555-5555-4555-8555-555555555555";
const INTEGRATION_ID = "66666666-6666-4666-8666-666666666666";

describe("intentional Unknown connector health states", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps Slack webhook health readiness-only until delivery occurs", async () => {
    const connector = getConnectorByKey("slack");
    const fetchMock = vi.fn(async () => {
      throw new Error("Slack health must not post to the incoming webhook.");
    });
    vi.stubGlobal("fetch", fetchMock);

    const context = {
      authType: "webhook",
      config: {
        channel: "#security",
        username: "Periscan",
        webhookUrl: "https://hooks.slack.com/services/T000/B000/slack-secret"
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    };

    const health = await connector!.healthCheck(context);
    const result = await connector!.sync(context);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(health.status).toBe("Unknown");
    expect(health.authorizationVerified).toBe(false);
    expect(health.detail).toContain("delivery is verified");
    expect(result.health.status).toBe("Unknown");
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("slack-secret");
    expect(JSON.stringify(result)).not.toContain("hooks.slack.com");
  });

  it("keeps Microsoft Teams webhook health readiness-only until delivery occurs", async () => {
    const connector = getConnectorByKey("microsoft-teams");
    const fetchMock = vi.fn(async () => {
      throw new Error("Teams health must not post to the incoming webhook.");
    });
    vi.stubGlobal("fetch", fetchMock);

    const context = {
      authType: "webhook",
      config: {
        channelName: "Security",
        themeColor: "2563EB",
        webhookUrl: "https://contoso.webhook.office.com/webhookb2/teams-secret"
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    };

    const health = await connector!.healthCheck(context);
    const result = await connector!.sync(context);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(health.status).toBe("Unknown");
    expect(health.authorizationVerified).toBe(false);
    expect(health.detail).toContain("delivery is verified");
    expect(result.health.status).toBe("Unknown");
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("teams-secret");
    expect(JSON.stringify(result)).not.toContain("webhook.office.com");
  });

  it("keeps PagerDuty Events API health unknown without creating an incident", async () => {
    const connector = getConnectorByKey("pagerduty");
    const fetchMock = vi.fn(async () => {
      throw new Error(
        "PagerDuty health must not trigger an Events API incident."
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const context = {
      authType: "eventsApi",
      config: {
        dedupKeyPrefix: "periscan",
        routingKey: "pagerduty-secret-routing-key",
        severity: "error",
        source: "Periscan"
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    };

    const health = await connector!.healthCheck(context);
    const result = await connector!.sync(context);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(health.status).toBe("Unknown");
    expect(health.authorizationVerified).toBe(false);
    expect(health.detail).toContain("no non-mutating health endpoint");
    expect(result.health.status).toBe("Unknown");
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(
      "pagerduty-secret-routing-key"
    );
  });

  it("keeps Lakera health unknown when no read-only inventory IDs are configured", async () => {
    const connector = getConnectorByKey("lakera");
    const fetchMock = vi.fn(async () => {
      throw new Error(
        "Lakera health without IDs must not call guard or metadata APIs."
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const context = {
      authType: "apiKey",
      config: {
        apiKey: "lakera-secret-api-key",
        platformBaseUrl: "https://api.lakera.ai/v2",
        policyIds: [],
        projectIds: []
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    };

    const health = await connector!.healthCheck(context);
    const result = await connector!.sync(context);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(health.status).toBe("Unknown");
    expect(health.authorizationVerified).toBe(false);
    expect(health.detail).toContain("No Lakera projectIds or policyIds");
    expect(result.health.status).toBe("Unknown");
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("lakera-secret-api-key");
  });
});
