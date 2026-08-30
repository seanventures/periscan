import { describe, expect, it } from "vitest";
import {
  CursorPaginatedListEnvelopeSchema,
  OffsetPaginatedListEnvelopeSchema,
  UnpaginatedListEnvelopeSchema
} from "@periscan/shared";

import { buildApp } from "./app.js";
import {
  augmentOpenApiDocument,
  getOpenApiOperationPayloads,
  OPENAPI_PAYLOAD_DOCUMENTED_EXTENSION
} from "./openapi-payloads.js";
import type { AppServices } from "./runtime-services.js";

/**
 * Enforces that the generated OpenAPI document is complete at the operation
 * level: every route registered on the Fastify app must appear in the OpenAPI
 * `paths` with a non-empty, unique `operationId`. This prevents new routes from
 * regressing to "undocumented" (no operationId/summary/tags), which the UI and
 * generated clients rely on.
 *
 * The app is built with a bare services stub. `app.swagger()` only inspects the
 * route schemas declared at registration time and never invokes any handler, so
 * no real services are required to assert documentation coverage.
 */

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

type OpenApiDocument = {
  components?: {
    securitySchemes?: Record<string, unknown>;
  };
  info?: {
    description?: string;
    title?: string;
    version?: string;
  };
  paths?: Record<
    string,
    Record<string, { operationId?: string; summary?: string; tags?: string[] }>
  >;
  security?: Array<Record<string, unknown>>;
};

/**
 * Count the user-registered routes from the Fastify route tree, excluding the
 * `HEAD`/`OPTIONS`/`TRACE` methods that Fastify adds automatically. This gives
 * an independent inventory of registered routes to cross-check against the
 * number of documented OpenAPI operations.
 *
 * Inbound SCIM honesty stubs (`app.all` + `schema.hide: true`) are excluded:
 * they intentionally do not appear in swagger, but `printRoutes` still lists
 * every method Fastify registers for `app.all`. Product routes never declare
 * TRACE — Fastify only expands TRACE for `app.all`, so TRACE is the reliable
 * filter for those hidden multi-method stubs (and their nested `/:id` children).
 */
function countRegisteredRouteMethods(printedRoutes: string): number {
  let count = 0;

  for (const line of printedRoutes.split("\n")) {
    // `app.all` honesty stubs (SCIM) expand TRACE; product routes never do.
    if (/\bTRACE\b/u.test(line)) {
      continue;
    }

    const match = /\(([A-Z, ]+)\)\s*$/u.exec(line);
    const methods = match?.[1];

    if (!methods) {
      continue;
    }

    for (const token of methods.split(",")) {
      const method = token.trim().toLowerCase();

      if ((HTTP_METHODS as readonly string[]).includes(method)) {
        count += 1;
      }
    }
  }

  return count;
}

async function buildDocumentedApp() {
  const services = {} as unknown as AppServices;
  const app = await buildApp({
    services,
    sessionSecret: "test-session-secret"
  });

  await app.ready();

  return app;
}

describe("OpenAPI operation-level coverage", () => {
  it("documents every registered route with a non-empty operationId", async () => {
    const app = await buildDocumentedApp();

    try {
      const document = app.swagger() as OpenApiDocument;
      const paths = document.paths ?? {};

      const operations: {
        method: string;
        path: string;
        operationId?: string;
      }[] = [];

      for (const [path, methods] of Object.entries(paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (!(HTTP_METHODS as readonly string[]).includes(method)) {
            continue;
          }

          operations.push({
            method: method.toUpperCase(),
            operationId: operation.operationId,
            path
          });
        }
      }

      // Every operation must carry a non-empty operationId.
      const undocumented = operations.filter(
        (operation) =>
          typeof operation.operationId !== "string" ||
          operation.operationId.trim().length === 0
      );

      expect(
        undocumented.map((operation) => `${operation.method} ${operation.path}`)
      ).toEqual([]);

      // Sanity check: there is at least one documented operation.
      expect(operations.length).toBeGreaterThan(0);

      // Every registered route must be present in the OpenAPI paths. The route
      // tree (excluding auto-added HEAD/OPTIONS) is an independent inventory, so
      // a route that fails to appear in the document would make these counts
      // diverge.
      const registeredRouteMethods = countRegisteredRouteMethods(
        app.printRoutes({ commonPrefix: false } as never)
      );

      expect(operations.length).toBe(registeredRouteMethods);
    } finally {
      await app.close();
    }
  });

  it("uses unique operationIds across all documented operations", async () => {
    const app = await buildDocumentedApp();

    try {
      const document = app.swagger() as OpenApiDocument;
      const paths = document.paths ?? {};

      const operationIds: string[] = [];

      for (const methods of Object.values(paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (!(HTTP_METHODS as readonly string[]).includes(method)) {
            continue;
          }

          if (operation.operationId) {
            operationIds.push(operation.operationId);
          }
        }
      }

      const duplicates = operationIds.filter(
        (operationId, index) => operationIds.indexOf(operationId) !== index
      );

      expect(duplicates).toEqual([]);
      expect(new Set(operationIds).size).toBe(operationIds.length);
    } finally {
      await app.close();
    }
  });

  it("documents bearerAuth and sessionCookie security schemes", async () => {
    const app = await buildDocumentedApp();

    try {
      const document = app.swagger() as OpenApiDocument;
      const bearerAuth = document.components?.securitySchemes?.bearerAuth as
        | {
            bearerFormat?: string;
            description?: string;
            scheme?: string;
            type?: string;
          }
        | undefined;
      const sessionCookie = document.components?.securitySchemes
        ?.sessionCookie as
        | {
            description?: string;
            in?: string;
            name?: string;
            type?: string;
          }
        | undefined;

      expect(bearerAuth).toMatchObject({
        scheme: "bearer",
        type: "http"
      });
      expect(bearerAuth?.description ?? "").toMatch(/psk_/);
      expect(sessionCookie).toMatchObject({
        in: "cookie",
        name: "periscan_session",
        type: "apiKey"
      });
      expect(document.info?.version).toMatch(/^0\.3\./);
      expect(document.info?.description ?? "").toMatch(/policy\.denied/i);
      expect(document.info?.description ?? "").toMatch(/remediation\.verified/i);
      expect(document.security).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ bearerAuth: [] }),
          expect.objectContaining({ sessionCookie: [] })
        ])
      );
    } finally {
      await app.close();
    }
  });
});

type AugmentedOperation = {
  operationId?: string;
  parameters?: Array<{
    in?: string;
    name?: string;
    required?: boolean;
    schema?: Record<string, unknown>;
  }>;
  requestBody?: {
    content?: Record<string, { schema?: unknown }>;
  };
  responses?: Record<
    string,
    { content?: Record<string, { schema?: unknown }>; description?: string }
  >;
};

type AugmentedDocument = {
  paths?: Record<string, Record<string, AugmentedOperation>>;
};

function collectAugmentedOperations(document: AugmentedDocument) {
  const byOperationId = new Map<string, AugmentedOperation>();

  for (const methods of Object.values(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!(HTTP_METHODS as readonly string[]).includes(method)) {
        continue;
      }

      if (operation.operationId) {
        byOperationId.set(operation.operationId, operation);
      }
    }
  }

  return byOperationId;
}

function jsonSchemaFor(operation: AugmentedOperation | undefined) {
  const requestSchema =
    operation?.requestBody?.content?.["application/json"]?.schema;

  let responseSchema: unknown;

  for (const status of ["200", "201", "202"]) {
    const candidate =
      operation?.responses?.[status]?.content?.["application/json"]?.schema;

    if (candidate) {
      responseSchema = candidate;
      break;
    }
  }

  return { requestSchema, responseSchema };
}

function responseFor(
  operation: AugmentedOperation | undefined,
  status: string
) {
  return operation?.responses?.[status];
}

function contentSchemaFor(
  operation: AugmentedOperation | undefined,
  status: string,
  contentType: string
) {
  return responseFor(operation, status)?.content?.[contentType]?.schema;
}

function queryParameterFor(
  operation: AugmentedOperation | undefined,
  name: string
) {
  return operation?.parameters?.find(
    (parameter) => parameter.in === "query" && parameter.name === name
  );
}

function queryParameterNames(operation: AugmentedOperation | undefined) {
  return (operation?.parameters ?? [])
    .filter((parameter) => parameter.in === "query")
    .map((parameter) => parameter.name)
    .sort();
}

describe("OpenAPI payload-level enrichment", () => {
  it("only registers payloads for operationIds present in the document", async () => {
    const app = await buildDocumentedApp();

    try {
      const document = augmentOpenApiDocument(
        app.swagger()
      ) as AugmentedDocument;
      const operations = collectAugmentedOperations(document);

      const registry = getOpenApiOperationPayloads();
      const missing = Object.keys(registry).filter(
        (operationId) => !operations.has(operationId)
      );

      expect(missing).toEqual([]);
      expect(Object.keys(registry).length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it("emits x-periscan-payload-documented and document coverage metric (P20-18)", async () => {
    const app = await buildDocumentedApp();

    try {
      const document = augmentOpenApiDocument(app.swagger()) as AugmentedDocument & {
        "x-periscan-payload-coverage"?: {
          documented: number;
          total: number;
          ratio: number;
        };
      };
      const coverage = document["x-periscan-payload-coverage"];
      expect(coverage).toBeDefined();
      expect(coverage!.total).toBeGreaterThan(0);
      expect(coverage!.documented).toBeGreaterThan(0);
      expect(coverage!.documented).toBeLessThanOrEqual(coverage!.total);
      expect(coverage!.ratio).toBeCloseTo(
        coverage!.documented / coverage!.total,
        4
      );

      // Every operation gets the boolean marker.
      let marked = 0;
      for (const pathItem of Object.values(document.paths ?? {})) {
        for (const method of HTTP_METHODS) {
          const operation = (pathItem as Record<string, unknown>)[method] as
            | Record<string, unknown>
            | undefined;
          if (!operation?.operationId) continue;
          expect(typeof operation[OPENAPI_PAYLOAD_DOCUMENTED_EXTENSION]).toBe(
            "boolean"
          );
          marked += 1;
        }
      }
      expect(marked).toBe(coverage!.total);

      // Proof-loop core ops must be payload-documented.
      const proofLoopOps = [
        "createScope",
        "createIntegration",
        "createRemediation",
        "listFindings"
      ];
      for (const operationId of proofLoopOps) {
        let found = false;
        for (const pathItem of Object.values(document.paths ?? {})) {
          for (const method of HTTP_METHODS) {
            const operation = (pathItem as Record<string, unknown>)[method] as
              | Record<string, unknown>
              | undefined;
            if (operation?.operationId === operationId) {
              found = true;
              expect(operation[OPENAPI_PAYLOAD_DOCUMENTED_EXTENSION]).toBe(true);
            }
          }
        }
        expect(found, `${operationId} present`).toBe(true);
      }
    } finally {
      await app.close();
    }
  });

  it("attaches request and/or response payload schemas in the augmented document", async () => {
    const app = await buildDocumentedApp();

    try {
      const document = augmentOpenApiDocument(
        app.swagger()
      ) as AugmentedDocument;
      const operations = collectAugmentedOperations(document);

      // POST create endpoints expose both a request body and a response schema.
      for (const operationId of ["createScope", "createIntegration"]) {
        const { requestSchema, responseSchema } = jsonSchemaFor(
          operations.get(operationId)
        );

        expect(requestSchema, `${operationId} requestBody`).toBeDefined();
        expect(responseSchema, `${operationId} response`).toBeDefined();
      }

      // LIST endpoints expose an `{ items: [...] }` response schema.
      const listScopes = jsonSchemaFor(operations.get("listScopes"));

      expect(listScopes.responseSchema).toBeDefined();
      expect(
        (
          listScopes.responseSchema as {
            properties?: { items?: { type?: string } };
          }
        ).properties?.items?.type
      ).toBe("array");

      const listModules = jsonSchemaFor(operations.get("listModules"));
      const moduleItemSchema = (
        listModules.responseSchema as {
          properties?: {
            items?: {
              items?: {
                properties?: Record<string, unknown>;
                required?: string[];
              };
            };
          };
        }
      ).properties?.items?.items;

      expect(moduleItemSchema?.properties?.licenseRisk).toBeDefined();
      expect(moduleItemSchema?.properties?.networkAccessRequired).toBeDefined();
      expect(moduleItemSchema?.properties?.destructivePotential).toBeDefined();
      expect(moduleItemSchema?.properties?.redactionRules).toBeDefined();
      expect(moduleItemSchema?.required).toEqual(
        expect.arrayContaining([
          "licenseRisk",
          "networkAccessRequired",
          "destructivePotential",
          "redactionRules"
        ])
      );

      const listOpenSourceTools = jsonSchemaFor(
        operations.get("listOpenSourceTools")
      );
      const openSourceToolItemSchema = (
        listOpenSourceTools.responseSchema as {
          properties?: {
            items?: {
              items?: {
                properties?: Record<string, unknown>;
              };
            };
          };
        }
      ).properties?.items?.items;

      expect(openSourceToolItemSchema?.properties?.tool).toBeDefined();
      expect(openSourceToolItemSchema?.properties?.capabilities).toBeDefined();
      expect(
        queryParameterNames(operations.get("listOpenSourceTools"))
      ).toEqual(["includeDeferred", "includeLegalReview", "phase"]);
      expect(
        queryParameterNames(operations.get("listOpenSourceCapabilities"))
      ).toEqual(["includeDeferred", "includeLegalReview", "phase"]);
      expect(
        queryParameterFor(operations.get("listOpenSourceTools"), "phase")
          ?.schema
      ).toMatchObject({
        default: "Current",
        enum: ["all", "Current", "CurrentMvp", "NearTerm", "LaterPhase"],
        type: "string"
      });
      expect(
        queryParameterFor(
          operations.get("listOpenSourceCapabilities"),
          "includeLegalReview"
        )?.schema
      ).toMatchObject({
        default: false,
        type: "boolean"
      });
      expect(
        jsonSchemaFor(operations.get("getOpenSourceTool")).responseSchema
      ).toBeDefined();

      for (const operationId of [
        "getApiReference",
        "getAttackTechnique",
        "getBillingLimits",
        "getControlRuleCoverage",
        "getControlSourceRuleCoverage",
        "getDeploymentStatus",
        "getEngagement",
        "getHealth",
        "getIntegrationHealth",
        "getMetrics",
        "getOpenApiDocument",
        "getReadiness"
      ]) {
        expect(
          jsonSchemaFor(operations.get(operationId)).responseSchema,
          `${operationId} response`
        ).toBeDefined();
      }

      for (const operationId of [
        "getIntegrationCatalog",
        "listAIAppValidationSuites",
        "listAttackTechniques",
        "listControlValidationScenarios",
        "listEngagements",
        "listExternalValidationProfiles",
        "listOperatorRecommendations",
        "listOperators"
      ]) {
        const { responseSchema } = jsonSchemaFor(operations.get(operationId));

        expect(
          (
            responseSchema as {
              properties?: { items?: { type?: string } };
            }
          ).properties?.items?.type,
          `${operationId} items`
        ).toBe("array");
      }

      const runEngagement = jsonSchemaFor(operations.get("runEngagement"));

      expect(runEngagement.requestSchema).toBeDefined();
      expect(runEngagement.responseSchema).toBeDefined();
      expect(
        jsonSchemaFor(operations.get("approveOperatorRecommendation"))
          .responseSchema
      ).toBeDefined();

      for (const operationId of [
        "acceptInvite",
        "confirmPasswordReset",
        "disableMfa",
        "regenerateMfaRecoveryCodes",
        "requestPasswordReset",
        "setThreatAlertStatus",
        "setThreatFeedSchedule",
        "verifyEmail",
        "verifyMfa"
      ]) {
        const { requestSchema, responseSchema } = jsonSchemaFor(
          operations.get(operationId)
        );

        expect(requestSchema, `${operationId} request`).toBeDefined();
        expect(responseSchema, `${operationId} response`).toBeDefined();
      }

      expect(
        jsonSchemaFor(operations.get("enrollMfa")).responseSchema
      ).toBeDefined();
      expect(
        operations.get("requestPasswordReset")?.responses?.["202"]?.content?.[
          "application/json"
        ]?.schema
      ).toBeDefined();
      expect(
        operations.get("testWebhook")?.responses?.["202"]?.content?.[
          "application/json"
        ]?.schema
      ).toBeDefined();

      expect(
        responseFor(operations.get("redirectHealth"), "307")?.description
      ).toBeDefined();

      for (const operationId of [
        "deleteModelPolicyProfile",
        "deleteModelProvider",
        "deleteScope",
        "deleteWebhook",
        "disableTenantSsoConfig",
        "logout"
      ]) {
        const response = responseFor(operations.get(operationId), "204");

        expect(response?.description, `${operationId} 204`).toBeDefined();
        expect(response?.content, `${operationId} body`).toBeUndefined();
      }

      expect(
        contentSchemaFor(
          operations.get("getPrometheusMetrics"),
          "200",
          "text/plain"
        )
      ).toBeDefined();
      expect(
        contentSchemaFor(operations.get("getAuditExport"), "200", "text/csv")
      ).toBeDefined();
      expect(
        contentSchemaFor(
          operations.get("getAuditExport"),
          "200",
          "application/json"
        )
      ).toBeDefined();
      expect(
        contentSchemaFor(operations.get("getSharedReport"), "200", "text/html")
      ).toBeDefined();
      expect(
        contentSchemaFor(
          operations.get("getSnapshotReport"),
          "200",
          "text/html"
        )
      ).toBeDefined();
      expect(
        jsonSchemaFor(operations.get("downloadEvidence")).responseSchema
      ).toBeDefined();

      for (const operationId of [
        "exportAdvisoryReadinessReport",
        "exportReport",
        "exportSnapshot"
      ]) {
        const operation = operations.get(operationId);

        expect(
          jsonSchemaFor(operation).requestSchema,
          `${operationId} request`
        ).toBeDefined();
        expect(
          contentSchemaFor(operation, "200", "text/html"),
          `${operationId} html response`
        ).toBeDefined();
        expect(
          contentSchemaFor(operation, "200", "application/pdf"),
          `${operationId} pdf response`
        ).toBeDefined();
      }

      for (const operationId of [
        "createRunnerCheckTask",
        "createRunnerDiscoverTask",
        "createRunnerMeasuredTask",
        "createRunnerReachabilityTask",
        "runScopePostureChecks"
      ]) {
        const operation = operations.get(operationId);
        const { requestSchema, responseSchema } = jsonSchemaFor(operation);

        expect(requestSchema, `${operationId} request`).toBeDefined();
        expect(responseSchema, `${operationId} response`).toBeDefined();
        expect(
          operation?.responses?.["201"]?.content?.["application/json"]?.schema,
          `${operationId} 201 response`
        ).toBeDefined();
      }

      for (const operationId of [
        "getThreatFeedSchedule",
        "listDeadLetteredWebhookDeliveries",
        "runDueIntegrationSyncs",
        "runDueReverifications",
        "runDueSchedules",
        "runDueThreatFeedIngestion",
        "syncIntegration",
        "verifyRemediation"
      ]) {
        expect(
          jsonSchemaFor(operations.get(operationId)).responseSchema,
          `${operationId} response`
        ).toBeDefined();
      }

      // Import endpoint exposes a request body schema.
      const importThreatAdvisory = jsonSchemaFor(
        operations.get("importThreatAdvisory")
      );

      expect(importThreatAdvisory.requestSchema).toBeDefined();
      expect(importThreatAdvisory.responseSchema).toBeDefined();

      for (const operationId of [
        "listAuditEvents",
        "listEvidence",
        "listPolicyDecisions",
        "listReports",
        "listSignalTriggerActivity",
        "listThreatAdvisories"
      ]) {
        const limit = queryParameterFor(operations.get(operationId), "limit");

        expect(limit, `${operationId} limit parameter`).toMatchObject({
          in: "query",
          name: "limit",
          required: false
        });
        expect(limit?.schema).toMatchObject({
          default: 50,
          maximum: 100,
          minimum: 1,
          type: "integer"
        });
      }

      // P20-2: path/remediation lists are limit-capped (max 200), not offset-paginated.
      for (const operationId of ["listAttackPaths", "listRemediations"] as const) {
        const limit = queryParameterFor(operations.get(operationId), "limit");

        expect(limit, `${operationId} limit parameter`).toMatchObject({
          in: "query",
          name: "limit",
          required: false
        });
        expect(limit?.schema).toMatchObject({
          default: 50,
          maximum: 200,
          minimum: 1,
          type: "integer"
        });
      }

      expect(queryParameterNames(operations.get("listAuditEvents"))).toEqual([
        "action",
        "actorType",
        "entityId",
        "entityType",
        "from",
        "limit",
        "offset",
        "to",
        "userId"
      ]);
      expect(
        queryParameterNames(operations.get("listPolicyDecisions"))
      ).toEqual(["limit", "missionType", "outcome", "scopeId"]);
      expect(queryParameterNames(operations.get("listJobs"))).toEqual([
        "limit",
        "missionId",
        "status"
      ]);
      expect(queryParameterNames(operations.get("listMissions"))).toEqual([
        "cursor",
        "limit"
      ]);
      expect(queryParameterNames(operations.get("listFindings"))).toEqual([
        "assetId",
        "disposition",
        "excludeDisposition",
        "exploitability",
        "limit",
        "offset",
        "owner",
        "priorityMin",
        "search",
        "severity",
        "sourceMotion",
        "status",
        "validationState"
      ]);

      // Paginated list envelopes must document the real runtime fields and
      // stay aligned with shared Zod contracts + fixture response shapes.
      const sampleUuid = "11111111-1111-4111-8111-111111111111";

      const listMissionsSchema = jsonSchemaFor(operations.get("listMissions"))
        .responseSchema as {
        properties?: {
          items?: { type?: string };
          nextCursor?: {
            anyOf?: Array<{ type?: string }>;
            nullable?: boolean;
            type?: string;
          };
        };
        required?: string[];
      };

      expect(listMissionsSchema.properties?.items?.type).toBe("array");
      // Zod 4 → JSON Schema emits nullable as anyOf[string, null]; legacy
      // OpenAPI 3.0 used { type: string, nullable: true }. Accept either.
      const nextCursor = listMissionsSchema.properties?.nextCursor;
      const nextCursorAllowsNull =
        nextCursor?.nullable === true ||
        nextCursor?.type === "null" ||
        (Array.isArray(nextCursor?.anyOf) &&
          nextCursor.anyOf.some((entry) => entry.type === "null"));
      const nextCursorAllowsString =
        nextCursor?.type === "string" ||
        (Array.isArray(nextCursor?.anyOf) &&
          nextCursor.anyOf.some((entry) => entry.type === "string"));
      expect(nextCursorAllowsNull).toBe(true);
      expect(nextCursorAllowsString).toBe(true);
      expect(listMissionsSchema.required).toEqual(
        expect.arrayContaining(["items", "nextCursor"])
      );
      expect(
        CursorPaginatedListEnvelopeSchema.parse({
          items: [{ missionId: sampleUuid }],
          nextCursor: null
        }).nextCursor
      ).toBeNull();
      expect(
        CursorPaginatedListEnvelopeSchema.parse({
          items: [],
          nextCursor: sampleUuid
        }).nextCursor
      ).toBe(sampleUuid);

      // True offset-paginated runtime envelopes (items + page).
      for (const operationId of ["listAuditEvents", "listFindings"] as const) {
        const schema = jsonSchemaFor(operations.get(operationId))
          .responseSchema as {
          properties?: {
            items?: { type?: string };
            page?: {
              properties?: {
                hasMore?: { type?: string };
                limit?: { type?: string };
                offset?: { type?: string };
              };
              required?: string[];
            };
          };
          required?: string[];
        };

        expect(schema.properties?.items?.type, `${operationId} items`).toBe(
          "array"
        );
        expect(schema.properties?.page?.properties?.hasMore?.type).toBe(
          "boolean"
        );
        expect(schema.properties?.page?.properties?.limit?.type).toBe(
          "integer"
        );
        expect(schema.properties?.page?.properties?.offset?.type).toBe(
          "integer"
        );
        expect(schema.properties?.page?.required).toEqual(
          expect.arrayContaining(["hasMore", "limit", "offset"])
        );
        expect(schema.required).toEqual(
          expect.arrayContaining(["items", "page"])
        );
        expect(
          queryParameterFor(operations.get(operationId), "offset")
        ).toMatchObject({
          in: "query",
          name: "offset",
          required: false
        });
        expect(
          OffsetPaginatedListEnvelopeSchema.parse({
            items: [{ id: sampleUuid }],
            page: { hasMore: true, limit: 25, offset: 0 }
          }).page.hasMore
        ).toBe(true);
      }

      // Representative unpaginated / limit-capped lists stay bare `{ items }` (P20-2).
      for (const operationId of [
        "listScopes",
        "listJobs",
        "listRemediations",
        "listEvidence",
        "listAttackPaths"
      ] as const) {
        const schema = jsonSchemaFor(operations.get(operationId))
          .responseSchema as {
          properties?: Record<string, unknown>;
          required?: string[];
        };

        expect(schema.required, `${operationId} required`).toEqual(["items"]);
        expect(schema.properties?.nextCursor, `${operationId} no cursor`).toBe(
          undefined
        );
        expect(schema.properties?.page, `${operationId} no page`).toBe(
          undefined
        );
        expect(
          UnpaginatedListEnvelopeSchema.parse({ items: [] }).items
        ).toEqual([]);
      }
      expect(
        queryParameterNames(operations.get("listWebhookDeliveries"))
      ).toEqual(["webhookId"]);
      expect(
        queryParameterNames(operations.get("listModelGatewayAuditEvents"))
      ).toEqual(["modelSessionId"]);
      expect(queryParameterNames(operations.get("listThreatCatalog"))).toEqual([
        "kev",
        "kind",
        "limit",
        "q",
        "severity"
      ]);
      expect(queryParameterNames(operations.get("listThreatAlerts"))).toEqual([
        "limit",
        "status"
      ]);

      expect(
        queryParameterFor(operations.get("listJobs"), "limit")?.schema
      ).toMatchObject({
        default: 50,
        maximum: 200
      });
      expect(
        queryParameterFor(operations.get("listThreatAlerts"), "limit")?.schema
      ).toMatchObject({
        default: 100,
        maximum: 200
      });
      expect(
        queryParameterFor(operations.get("listThreatCatalog"), "kind")?.schema
      ).toMatchObject({
        enum: ["Vulnerability", "Indicator", "Advisory"],
        type: "string"
      });

      const tenantSsoAuthorizationUrl = operations.get(
        "buildTenantSsoAuthorizationUrl"
      );

      expect(queryParameterNames(tenantSsoAuthorizationUrl)).toEqual([
        "loginHint",
        "nonce",
        "prompt",
        "redirectUri",
        "state"
      ]);
      expect(
        queryParameterFor(tenantSsoAuthorizationUrl, "nonce")
      ).toMatchObject({
        required: true
      });
      expect(
        queryParameterFor(tenantSsoAuthorizationUrl, "state")
      ).toMatchObject({
        required: true
      });
      expect(
        jsonSchemaFor(tenantSsoAuthorizationUrl).requestSchema
      ).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it("never mutates Fastify route schemas (doc-only augmentation)", async () => {
    const app = await buildDocumentedApp();

    try {
      // The raw swagger document (pre-augmentation) must not carry payload
      // schemas, proving the routes themselves declare no body/response schema.
      const raw = app.swagger() as AugmentedDocument;
      const rawOps = collectAugmentedOperations(raw);
      const rawCreateScope = jsonSchemaFor(rawOps.get("createScope"));

      expect(rawCreateScope.requestSchema).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});
