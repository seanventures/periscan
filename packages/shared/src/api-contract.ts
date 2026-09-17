import { z } from "zod";

export const PUBLIC_API_PREFIX = "/api/v1";
export const OPENAPI_ROUTE = "/openapi.json";
export const HEALTH_ROUTE = `${PUBLIC_API_PREFIX}/health`;
export const VALIDATION_QUEUE_NAME = "validation-missions";
export const WEBHOOK_DELIVERY_QUEUE_NAME = "webhook-deliveries";
export const MODEL_GATEWAY_TURN_QUEUE_NAME = "model-gateway-turns";

export const ApiErrorSchema = z.object({
  code: z.string().optional(),
  error: z.string()
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiReferenceSchemaFieldSchema = z.object({
  allowedValues: z.array(z.string()),
  name: z.string().min(1),
  required: z.boolean(),
  type: z.string().min(1)
});

export const ApiReferenceEndpointSchema = z.object({
  authentication: z.enum(["Public", "SessionCookie", "RunnerToken"]),
  group: z.string().min(1),
  hasQueryParameters: z.boolean(),
  hasRequestSchema: z.boolean(),
  hasResponseSchema: z.boolean(),
  method: z.string().min(1),
  operationId: z.string().nullable(),
  path: z.string().min(1),
  queryParameters: z.array(z.string().min(1)),
  requestContentTypes: z.array(z.string().min(1)),
  requestExample: z.unknown().nullable(),
  requestFields: z.array(ApiReferenceSchemaFieldSchema),
  responseContentTypes: z.array(z.string().min(1)),
  responseExample: z.unknown().nullable(),
  responseFields: z.array(ApiReferenceSchemaFieldSchema),
  summary: z.string().min(1),
  successStatuses: z.array(z.string().regex(/^[23]\d\d$/u)),
  tags: z.array(z.string())
});

export const ApiReferenceGroupSchema = z.object({
  endpointCount: z.number().int().nonnegative(),
  name: z.string().min(1)
});

export const ApiReferenceDocumentSchema = z.object({
  endpoints: z.array(ApiReferenceEndpointSchema),
  generatedAt: z.string(),
  groups: z.array(ApiReferenceGroupSchema),
  openApiPath: z.string().min(1),
  title: z.string().min(1),
  totalEndpoints: z.number().int().nonnegative(),
  version: z.string().min(1)
});

export type ApiReferenceDocument = z.infer<typeof ApiReferenceDocumentSchema>;
export type ApiReferenceEndpoint = z.infer<typeof ApiReferenceEndpointSchema>;
export type ApiReferenceGroup = z.infer<typeof ApiReferenceGroupSchema>;
export type ApiReferenceSchemaField = z.infer<
  typeof ApiReferenceSchemaFieldSchema
>;

/**
 * List pagination envelopes used by public list routes.
 *
 * OpenAPI payload enrichment and runtime handlers must stay aligned with these
 * shapes. Most list routes return the unpaginated `{ items }` form; only a few
 * routes advertise real page/cursor metadata.
 */

/** Offset page metadata returned by findings and audit list routes. */
export const OffsetPageMetaSchema = z.object({
  hasMore: z.boolean(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative()
});

export type OffsetPageMeta = z.infer<typeof OffsetPageMetaSchema>;

/** Bare list envelope — no page or cursor metadata. */
export function unpaginatedListSchema<TItem extends z.ZodType>(itemSchema: TItem) {
  return z
    .object({
      items: z.array(itemSchema)
    })
    .strict();
}

/**
 * Cursor-paginated list envelope (`GET /api/v1/missions`).
 * `nextCursor` is null on the last page.
 */
export function cursorPaginatedListSchema<TItem extends z.ZodType>(
  itemSchema: TItem
) {
  return z
    .object({
      items: z.array(itemSchema),
      nextCursor: z.string().uuid().nullable()
    })
    .strict();
}

/**
 * Offset-paginated list envelope (`GET /api/v1/findings`, `GET /api/v1/audit-events`).
 */
export function offsetPaginatedListSchema<TItem extends z.ZodType>(
  itemSchema: TItem
) {
  return z
    .object({
      items: z.array(itemSchema),
      page: OffsetPageMetaSchema
    })
    .strict();
}

/** Placeholder item for envelope-shape validation (structure only). */
const ListEnvelopeItemSchema = z.unknown();

export const UnpaginatedListEnvelopeSchema = unpaginatedListSchema(
  ListEnvelopeItemSchema
);
export const CursorPaginatedListEnvelopeSchema = cursorPaginatedListSchema(
  ListEnvelopeItemSchema
);
export const OffsetPaginatedListEnvelopeSchema = offsetPaginatedListSchema(
  ListEnvelopeItemSchema
);

export type UnpaginatedListEnvelope = z.infer<
  typeof UnpaginatedListEnvelopeSchema
>;
export type CursorPaginatedListEnvelope = z.infer<
  typeof CursorPaginatedListEnvelopeSchema
>;
export type OffsetPaginatedListEnvelope = z.infer<
  typeof OffsetPaginatedListEnvelopeSchema
>;
