import { describe, expect, it } from "vitest";

import {
  ApiReferenceEndpointSchema,
  HEALTH_ROUTE,
  OPENAPI_ROUTE,
  PUBLIC_API_PREFIX
} from "./api-contract.js";
import { HealthResponseSchema, MetricsResponseSchema } from "./health.js";

describe("HealthResponseSchema", () => {
  it("accepts a valid API health payload", () => {
    expect(
      HealthResponseSchema.parse({
        service: "api",
        status: "ok",
        timestamp: "2026-06-01T00:00:00.000Z"
      })
    ).toMatchObject({
      service: "api",
      status: "ok"
    });
  });

  it("exports stable public API routes", () => {
    expect(PUBLIC_API_PREFIX).toBe("/api/v1");
    expect(HEALTH_ROUTE).toBe("/api/v1/health");
    expect(OPENAPI_ROUTE).toBe("/openapi.json");
  });

  it("requires schema availability metadata in API reference endpoints", () => {
    expect(
      ApiReferenceEndpointSchema.parse({
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
        requestExample: { scopeId: "00000000-0000-4000-8000-000000000000" },
        requestFields: [
          {
            allowedValues: [],
            name: "scopeId",
            required: true,
            type: "string:uuid"
          }
        ],
        responseContentTypes: ["application/json"],
        responseExample: { snapshotId: "00000000-0000-4000-8000-000000000000" },
        responseFields: [],
        summary: "Create a Validation Snapshot",
        successStatuses: ["200"],
        tags: ["validation"]
      })
    ).toMatchObject({
      hasQueryParameters: false,
      hasRequestSchema: true,
      hasResponseSchema: true,
      queryParameters: [],
      requestContentTypes: ["application/json"],
      requestFields: [expect.objectContaining({ name: "scopeId" })],
      responseContentTypes: ["application/json"],
      successStatuses: ["200"]
    });
  });
});

describe("MetricsResponseSchema", () => {
  it("accepts a valid API metrics payload", () => {
    expect(
      MetricsResponseSchema.parse({
        memory: { heapTotal: 100000, heapUsed: 50000, rss: 120000 },
        node: "v20.0.0",
        pid: 123,
        service: "api",
        timestamp: "2026-06-05T12:00:00.000Z",
        uptimeSeconds: 3600
      })
    ).toMatchObject({
      service: "api",
      uptimeSeconds: 3600
    });
  });
});
