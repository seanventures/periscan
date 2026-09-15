import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH, PUT } from "./route";

const originalApiUrl = process.env.PERISCAN_API_URL;
const originalDeploymentEnvironment =
  process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;

describe("API route proxy", () => {
  afterEach(() => {
    if (originalApiUrl === undefined) {
      delete process.env.PERISCAN_API_URL;
    } else {
      process.env.PERISCAN_API_URL = originalApiUrl;
    }

    if (originalDeploymentEnvironment === undefined) {
      delete process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;
    } else {
      process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT =
        originalDeploymentEnvironment;
    }

    vi.unstubAllGlobals();
  });

  it.each([
    ["PUT", PUT],
    ["PATCH", PATCH]
  ])("forwards %s requests to the upstream API", async (method, handler) => {
    process.env.PERISCAN_API_URL = "http://api.local:3001";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: {
          connection: "keep-alive",
          "content-length": "11",
          "content-type": "application/json"
        },
        status: 202
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const body = JSON.stringify({ enabled: true });
    const response = await handler(
      new Request(
        "http://web.local/api/v1/tenants/current/design-partner?source=ui",
        {
          body,
          headers: {
            authorization: "Bearer should-not-forward",
            "content-type": "application/json",
            cookie: "periscan_session=session-token",
            "x-periscan-tenant-id": "tenant-1"
          },
          method
        }
      ),
      {
        params: Promise.resolve({
          path: ["tenants", "current", "design-partner"]
        })
      }
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.local:3001/api/v1/tenants/current/design-partner?source=ui",
      expect.objectContaining({
        body,
        cache: "no-store",
        method,
        redirect: "manual"
      })
    );
    const upstreamHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(upstreamHeaders.get("authorization")).toBeNull();
    expect(upstreamHeaders.get("content-type")).toBe("application/json");
    expect(upstreamHeaders.get("cookie")).toBe(
      "periscan_session=session-token"
    );
    expect(upstreamHeaders.get("x-periscan-tenant-id")).toBe("tenant-1");
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("connection")).toBeNull();
  });

  it("refuses the local API fallback for production web deployments", async () => {
    delete process.env.PERISCAN_API_URL;
    process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT = "production";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://app.example.com/api/v1/me"),
      {
        params: Promise.resolve({
          path: ["me"]
        })
      }
    );

    await expect(response.json()).resolves.toEqual({
      code: "api_proxy_unavailable",
      error:
        "Set PERISCAN_API_URL for production web deployments; refusing to proxy API calls to the local development API fallback."
    });
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
