import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiReferenceConsole } from "./api-reference-console";

const document = {
  endpoints: [
    {
      authentication: "SessionCookie",
      group: "Validation",
      hasQueryParameters: true,
      hasRequestSchema: true,
      hasResponseSchema: true,
      method: "POST",
      operationId: "createSnapshot",
      path: "/api/v1/snapshots",
      queryParameters: ["dryRun"],
      requestContentTypes: ["application/json"],
      requestExample: {
        scopeId: "00000000-0000-4000-8000-000000000000"
      },
      requestFields: [
        {
          allowedValues: [],
          name: "scopeId",
          required: true,
          type: "string:uuid"
        }
      ],
      responseContentTypes: ["application/json"],
      responseExample: { status: "Completed" },
      responseFields: [
        {
          allowedValues: ["Completed", "Failed"],
          name: "status",
          required: true,
          type: "string"
        }
      ],
      summary: "Create a validation snapshot",
      successStatuses: ["200"],
      tags: ["validation"]
    }
  ],
  generatedAt: "2026-07-14T00:00:00.000Z",
  groups: [{ endpointCount: 1, name: "Validation" }],
  openApiPath: "/openapi.json",
  title: "Periscan API",
  totalEndpoints: 1,
  version: "0.1.0"
};

describe("ApiReferenceConsole", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expands generated schemas and exposes product reference walkthroughs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(document), {
          headers: { "content-type": "application/json" },
          status: 200
        })
      )
    );

    render(<ApiReferenceConsole />);

    expect(
      await screen.findByRole("heading", {
        name: "Periscan API & product reference"
      })
    ).toBeInTheDocument();
    // P07: least-privilege callout for automation integrators.
    const lp = screen.getByTestId("api-reference-least-privilege-banner");
    expect(lp).toHaveTextContent(/Least-privilege by default/i);
    expect(lp).toHaveTextContent(/read/i);
    expect(lp).toHaveAttribute("role", "status");
    expect(
      screen.getByRole("link", { name: /Admin → API keys/i })
    ).toHaveAttribute("href", "/admin#api-keys");
    expect(
      screen.getByRole("link", { name: "OpenAPI JSON ↗" })
    ).toHaveAttribute("href", "/openapi.json");
    // UX-W4 / #185: live OpenAPI info.version in product chrome
    expect(screen.getByTestId("api-openapi-version")).toHaveTextContent(
      "API v0.1.0"
    );
    expect(screen.getByText("/api/v1/snapshots")).toBeInTheDocument();
    expect(screen.getByText("scopeId")).toBeInTheDocument();
    expect(screen.getByText("required")).toBeInTheDocument();
    expect(screen.getByText(/PERISCAN_API_KEY/)).toBeInTheDocument();
    // UX-W4 / #177: real curl helper on each endpoint
    expect(
      screen.getByRole("button", { name: "Copy as curl" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Runner safety/ }));
    expect(
      screen.getByRole("heading", { name: "Outbound runner data flow" })
    ).toBeInTheDocument();
    expect(screen.getByText("PassiveReadOnly")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /NIS2 walkthrough/ }));
    expect(screen.getByText("NIS2 Art. 21(2)(a)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Scoring glossary/ }));
    await waitFor(() => {
      expect(screen.getByText("Priority score")).toBeInTheDocument();
    });
    expect(screen.getByText(/Critical ≥85/)).toBeInTheDocument();
  });
});
