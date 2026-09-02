import { afterEach, describe, expect, it, vi } from "vitest";

import { HEALTH_ROUTE } from "@periscan/shared";

import { GET } from "./route";

const originalApiUrl = process.env.PERISCAN_API_URL;
const originalDeploymentEnvironment =
  process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;

describe("API health proxy route", () => {
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

  it("forwards health checks to the configured API URL", async () => {
    process.env.PERISCAN_API_URL = "https://api.example.com/";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          service: "api",
          status: "ok"
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: "api",
      status: "ok"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com${HEALTH_ROUTE}`,
      {
        cache: "no-store"
      }
    );
  });

  it("keeps the local API fallback outside production", async () => {
    delete process.env.PERISCAN_API_URL;
    delete process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          service: "api",
          status: "ok"
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:3001${HEALTH_ROUTE}`,
      {
        cache: "no-store"
      }
    );
  });

  it("refuses the local API fallback for production web health checks", async () => {
    delete process.env.PERISCAN_API_URL;
    process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT = "production";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: "api_proxy_unavailable",
      error:
        "Set PERISCAN_API_URL for production web deployments; refusing to proxy API calls to the local development API fallback."
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
