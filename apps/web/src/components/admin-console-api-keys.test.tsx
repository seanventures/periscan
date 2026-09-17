import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminConsole } from "./admin-console";

describe("AdminConsole API keys (P07)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows least-privilege matrix one-liner and automation-readme path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/me") {
          return new Response(
            JSON.stringify({
              membership: {
                membershipId: "55555555-5555-4555-8555-555555555555",
                role: "Owner",
                tenantId: "11111111-1111-4111-8111-111111111111",
                userId: "66666666-6666-4666-8666-666666666666",
                createdAt: "2026-07-01T00:00:00.000Z",
                updatedAt: "2026-07-01T00:00:00.000Z"
              },
              tenant: {
                tenantId: "11111111-1111-4111-8111-111111111111",
                name: "Acme",
                type: "Customer",
                dataRegion: "us-east-1",
                billingAccountId: "acct",
                parentTenantId: null,
                createdAt: "2026-07-01T00:00:00.000Z",
                updatedAt: "2026-07-01T00:00:00.000Z"
              },
              user: {
                userId: "66666666-6666-4666-8666-666666666666",
                email: "ops@acme.example",
                name: "Ops",
                status: "Active",
                createdAt: "2026-07-01T00:00:00.000Z",
                updatedAt: "2026-07-01T00:00:00.000Z"
              }
            }),
            { status: 200 }
          );
        }
        if (route === "/api/v1/tenants/current/api-keys") {
          return new Response(JSON.stringify({ items: [] }), { status: 200 });
        }
        if (route === "/api/v1/tenants/current/branding") {
          return new Response(
            JSON.stringify({
              tenantId: "11111111-1111-4111-8111-111111111111",
              organizationName: null,
              primaryColor: null,
              supportEmail: null,
              reportFooter: null,
              logoUrl: null,
              whiteLabelEnabled: false,
              createdAt: "2026-07-01T00:00:00.000Z",
              updatedAt: "2026-07-01T00:00:00.000Z"
            }),
            { status: 200 }
          );
        }
        // Soft-fail remaining admin panels so create form still mounts.
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      })
    );

    render(<AdminConsole />);

    await waitFor(() => {
      expect(
        screen.getByTestId("api-key-least-privilege-hint")
      ).toBeInTheDocument();
    });
    // P07 a11y: API keys panel is labelled by its heading.
    const keysHeading = screen.getByRole("heading", { name: "API keys" });
    expect(keysHeading).toHaveAttribute("id", "admin-api-keys-heading");
    expect(keysHeading.closest("section")).toHaveAttribute(
      "aria-labelledby",
      "admin-api-keys-heading"
    );
    expect(screen.getByTestId("api-key-least-privilege-hint")).toHaveTextContent(
      /Default read is least-privilege/i
    );
    expect(screen.getByTestId("api-key-least-privilege-hint")).toHaveTextContent(
      /webhook:admin/
    );
    expect(screen.getByTestId("api-key-automation-readme-link")).toHaveAttribute(
      "href",
      "/api-reference"
    );
    expect(screen.getByTestId("api-key-automation-readme-path")).toHaveTextContent(
      "docs/examples/automation-readme.md"
    );
    // Default scope is least-privilege read (button pressed state).
    expect(screen.getByRole("button", { name: "read" })).toHaveClass(
      /border-brand/
    );
  });
});
