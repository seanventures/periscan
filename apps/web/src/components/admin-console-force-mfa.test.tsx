import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminConsole } from "./admin-console";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function jsonResponse(payload: unknown, status = 200) {
  return { json: async () => payload, ok: status < 400, status };
}

describe("AdminConsole force-MFA and IdP honesty", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("exposes force-MFA toggle and honest SCIM/JIT status", async () => {
    let requireMfa = false;
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
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
            requireMfa,
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
        if (init?.method === "PUT") {
          const body = JSON.parse(String(init.body ?? "{}")) as {
            enabled?: boolean;
          };
          requireMfa = Boolean(body.enabled);
          return jsonResponse({
            effectiveRequireMfa: requireMfa,
            envRequireMfa: false,
            requireMfa
          });
        }
        return jsonResponse({
          effectiveRequireMfa: requireMfa,
          envRequireMfa: false,
          requireMfa
        });
      }
      if (url.includes("/api-keys") || url.includes("/tenants/current/api-keys")) {
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
      if (url.includes("/webhooks")) {
        return jsonResponse({ items: [] });
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
      return jsonResponse({ error: `Unhandled ${url}` }, 404);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<AdminConsole />);

    expect(
      await screen.findByRole("heading", {
        name: "Force multi-factor authentication"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Inbound SCIM 2.0 provisioning of Periscan users/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Just-in-time \(JIT\) auto-create/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Require MFA for password users" })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Force-MFA is on for password sign-in/i)
      ).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/security-settings/require-mfa"),
      expect.objectContaining({ method: "PUT" })
    );
  });
});
