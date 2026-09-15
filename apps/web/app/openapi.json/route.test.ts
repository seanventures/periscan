import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const originalApiUrl = process.env.PERISCAN_API_URL;

describe("OpenAPI proxy route", () => {
  afterEach(() => {
    if (originalApiUrl === undefined) delete process.env.PERISCAN_API_URL;
    else process.env.PERISCAN_API_URL = originalApiUrl;
    vi.unstubAllGlobals();
  });

  it("serves the API document from the web origin", async () => {
    process.env.PERISCAN_API_URL = "https://api.example.com/";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ openapi: "3.0.3" }), {
        headers: {
          connection: "keep-alive",
          "content-length": "19",
          "content-type": "application/json"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/openapi.json",
      { cache: "no-store" }
    );
    await expect(response.json()).resolves.toEqual({ openapi: "3.0.3" });
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("connection")).toBeNull();
  });
});
