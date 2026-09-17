import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiReferenceView } from "./api-reference-view";

const apiReferencePayload = {
  endpoints: [
    {
      authentication: "Public",
      group: "Auth",
      hasQueryParameters: false,
      hasRequestSchema: true,
      hasResponseSchema: true,
      method: "POST",
      operationId: "signup",
      path: "/api/v1/auth/signup",
      queryParameters: [],
      requestContentTypes: ["application/json"],
      requestExample: {},
      requestFields: [],
      responseContentTypes: ["application/json"],
      responseExample: {},
      responseFields: [],
      summary: "Create a user and tenant",
      successStatuses: ["200"],
      tags: ["auth"]
    },
    {
      authentication: "SessionCookie",
      group: "Validation",
      hasQueryParameters: false,
      hasRequestSchema: true,
      hasResponseSchema: true,
      method: "POST",
      operationId: "createSnapshot",
      path: "/api/v1/snapshots",
      queryParameters: [],
      requestContentTypes: ["application/json"],
      requestExample: {},
      requestFields: [],
      responseContentTypes: ["application/json"],
      responseExample: {},
      responseFields: [],
      summary: "Create a Validation Snapshot",
      successStatuses: ["200"],
      tags: ["validation"]
    },
    {
      authentication: "RunnerToken",
      group: "Runners",
      hasQueryParameters: true,
      hasRequestSchema: true,
      hasResponseSchema: false,
      method: "POST",
      operationId: "pollRunner",
      path: "/api/v1/runners/{id}/poll",
      queryParameters: ["limit"],
      requestContentTypes: ["application/json"],
      requestExample: {},
      requestFields: [],
      responseContentTypes: [],
      responseExample: null,
      responseFields: [],
      summary: "Poll for signed runner tasks",
      successStatuses: ["204"],
      tags: ["runners"]
    }
  ],
  generatedAt: "2026-06-05T00:00:00.000Z",
  groups: [
    {
      endpointCount: 1,
      name: "Auth"
    },
    {
      endpointCount: 1,
      name: "Runners"
    },
    {
      endpointCount: 1,
      name: "Validation"
    }
  ],
  openApiPath: "/openapi.json",
  title: "Periscan API",
  totalEndpoints: 3,
  version: "0.1.0"
};

describe("ApiReferenceView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the generated API reference returned by the public API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => apiReferencePayload,
      ok: true,
      status: 200
    });

    vi.stubGlobal("fetch", fetchImpl);

    render(<ApiReferenceView />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "API reference endpoint count: 3"
        })
      ).toBeInTheDocument();
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/api-reference",
      expect.objectContaining({
        cache: "no-store"
      })
    );

    expect(
      screen.getByRole("link", { name: "Open OpenAPI JSON" })
    ).toHaveAttribute("href", "/openapi.json");

    const validationGroup = screen.getByRole("region", {
      name: "Validation"
    });
    expect(
      within(validationGroup).getByRole("article", {
        name: "POST /api/v1/snapshots"
      })
    ).toBeInTheDocument();
    expect(
      within(validationGroup).getByRole("status", {
        name: "HTTP method: POST"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Authentication mode: Runner token"
      })
    ).toBeInTheDocument();
    expect(
      within(validationGroup).getByRole("status", {
        name: "Query parameters: not published"
      })
    ).toBeInTheDocument();
    expect(
      within(validationGroup).getByRole("status", {
        name: "Request schema: available"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Query parameters: available"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Query parameters limit")).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Response schema: not published"
      })
    ).toBeInTheDocument();
    expect(
      within(validationGroup).getByRole("status", {
        name: "Request content types: application/json"
      })
    ).toBeInTheDocument();
    expect(
      within(validationGroup).getByRole("status", {
        name: "Response content types: application/json"
      })
    ).toBeInTheDocument();
    expect(
      within(validationGroup).getByRole("status", {
        name: "Success statuses: 200"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Response content types: none"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Success statuses: 204"
      })
    ).toBeInTheDocument();
  });

  it("shows a retryable error state when the API reference cannot load", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          error: "Reference generator unavailable"
        }),
        ok: false,
        status: 503
      })
      .mockResolvedValueOnce({
        json: async () => apiReferencePayload,
        ok: true,
        status: 200
      });

    vi.stubGlobal("fetch", fetchImpl);

    render(<ApiReferenceView />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Reference generator unavailable"
      );
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Retry API reference"
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "API reference endpoint count: 3"
        })
      ).toBeInTheDocument();
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
