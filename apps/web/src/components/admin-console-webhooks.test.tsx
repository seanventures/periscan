import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AdminConsole,
  webhookTestCurlSample
} from "./admin-console";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const webhookId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function jsonResponse(payload: unknown, status = 200) {
  return { json: async () => payload, ok: status < 400, status };
}

function baseMocks(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/v1/me") || url.endsWith("/me")) {
      return jsonResponse({
        membership: {
          createdAt: timestamp,
          membershipId: "33333333-3333-4333-8333-333333333333",
          role: "Owner",
          tenantId,
          updatedAt: timestamp,
          userId
        },
        tenant: {
          billingAccountId: null,
          createdAt: timestamp,
          dataRegion: "us-east-1",
          name: "Demo Security",
          parentTenantId: null,
          requireMfa: false,
          tenantId,
          type: "Organization",
          updatedAt: timestamp
        },
        user: {
          createdAt: timestamp,
          email: "owner@example.com",
          mfaEnabledAt: timestamp,
          name: "Owner User",
          status: "Active",
          updatedAt: timestamp,
          userId
        }
      });
    }
    if (url.includes("/security-settings/require-mfa")) {
      return jsonResponse({
        effectiveRequireMfa: false,
        envRequireMfa: false,
        requireMfa: false
      });
    }
    if (url.includes("/api-keys")) {
      return jsonResponse({ items: [] });
    }
    if (url.includes("/branding")) {
      return jsonResponse({
        createdAt: timestamp,
        logoUrl: null,
        organizationName: null,
        primaryColor: null,
        reportFooter: null,
        supportEmail: null,
        tenantId,
        updatedAt: timestamp,
        whiteLabelEnabled: false
      });
    }
    if (url.includes("/members")) {
      return jsonResponse({ items: [] });
    }
    if (url.includes("/webhook-deliveries/dead-letter")) {
      return jsonResponse({ items: [] });
    }
    if (url.includes("/webhooks/event-catalog")) {
      return jsonResponse({
        bodyFields: ["eventType", "deliveryId", "occurredAt", "data"],
        eventDataSummaries: [
          {
            dataFields: ["missionId", "outcome", "status"],
            description: "Mission finished successfully",
            eventType: "mission.completed"
          },
          {
            dataFields: ["code", "outcome", "rationale"],
            description: "Policy denied an action",
            eventType: "policy.denied"
          }
        ],
        eventTypes: ["mission.completed", "policy.denied", "schedule.failed"],
        headers: {
          delivery: "x-periscan-delivery",
          event: "x-periscan-event",
          idempotencyKey: "x-periscan-idempotency-key",
          signature: "x-periscan-signature"
        },
        productPath: "ApiAvailable",
        signatureFormat: "sha256=<hex>"
      });
    }
    if (url.includes(`/webhooks/${webhookId}/test`)) {
      return jsonResponse({}, 202);
    }
    if (url.includes("/webhooks")) {
      return jsonResponse({
        items: [
          {
            createdAt: timestamp,
            createdBy: userId,
            enabled: true,
            events: ["mission.completed", "policy.denied"],
            tenantId,
            updatedAt: timestamp,
            url: "https://hooks.example.com/periscan",
            webhookId
          }
        ]
      });
    }
    if (url.includes("/sso")) {
      return jsonResponse({ config: null });
    }
    if (url.includes("/localization")) {
      return jsonResponse({
        generatedAt: timestamp,
        formats: [],
        localization: {
          createdAt: timestamp,
          locale: "en-US",
          tenantId,
          timezone: "UTC",
          updatedAt: timestamp
        }
      });
    }
    if (url.includes("/trust-safety")) {
      return jsonResponse({
        generatedAt: timestamp,
        marketPresence: { customerReferences: 0 }
      });
    }
    return jsonResponse({ error: `Unhandled ${url}` }, 404);
  });
}

describe("webhookTestCurlSample", () => {
  it("builds a real test-delivery curl without secrets", () => {
    const sample = webhookTestCurlSample(webhookId);
    expect(sample).toContain("curl --request POST");
    expect(sample).toContain(
      `/api/v1/tenants/current/webhooks/${webhookId}/test`
    );
    expect(sample).toContain("$PERISCAN_API_KEY");
    expect(sample).not.toMatch(/whsec_|psk_[a-zA-Z0-9]/);
  });
});

describe("AdminConsole webhooks UX-W4", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("surfaces receiver contract, event catalog, rotate/redrive labels, and copy-as-curl after test", async () => {
    const fetchMock = vi.fn();
    baseMocks(fetchMock);
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<AdminConsole />);

    const webhooksHeading = await screen.findByRole("heading", {
      name: "Outbound webhooks"
    });
    // P07 a11y: webhooks panel is labelled by its heading.
    expect(webhooksHeading).toHaveAttribute("id", "admin-webhooks-heading");
    expect(webhooksHeading.closest("section")).toHaveAttribute(
      "aria-labelledby",
      "admin-webhooks-heading"
    );

    const receiverLinks = screen.getAllByRole("link", {
      name: /Receiver contract/i
    });
    expect(receiverLinks.length).toBeGreaterThanOrEqual(1);
    expect(receiverLinks[0]).toHaveAttribute("href", "/api-reference");

    expect(screen.getAllByText("Receiver contract").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getByText(/x-periscan-signature/i)).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Webhook event catalog" })
    ).toBeInTheDocument();
    expect(screen.getByText("Event catalog")).toBeInTheDocument();
    // P07: progressive data schema field summaries from event-catalog.
    expect(
      screen.getByTestId("webhook-data-schema-examples")
    ).toBeInTheDocument();
    expect(screen.getByText(/data: missionId, outcome, status/i)).toBeInTheDocument();
    expect(screen.getByText("Dead-letter triage · Redrive")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rotate secret" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Test" }));

    expect(
      await screen.findByText("Test delivery enqueued.")
    ).toBeInTheDocument();
    const copyBtn = screen.getByRole("button", { name: "Copy as curl" });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        webhookTestCurlSample(webhookId)
      );
    });
  });
});
