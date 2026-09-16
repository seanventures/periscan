/**
 * Per-event Zod schemas for outbound webhook `data` payloads (ICP-P1-8).
 *
 * Progressive contract: fields match what emitTenantWebhook / worker emit today.
 * Extra keys may appear in future releases — receivers should tolerate unknowns.
 * HMAC signing and envelope shape (id, type, tenantId, createdAt, data) are unchanged.
 */
import { z } from "zod";

import {
  WEBHOOK_EVENT_TYPES,
  WebhookEventTypeSchema,
  type WebhookEventType
} from "@periscan/shared";

/** Shared loose ID string (UUIDs in prod; tests may use other tokens). */
const IdLike = z.string().min(1);

export const MissionCompletedDataSchema = z
  .object({
    missionId: IdLike,
    status: z.string().min(1)
  })
  .passthrough();

export const MissionFailedDataSchema = z
  .object({
    missionId: IdLike,
    status: z.string().min(1)
  })
  .passthrough();

export const MissionStartedDataSchema = z
  .object({
    jobsQueued: z.number().int().nonnegative(),
    missionId: IdLike,
    moduleIds: z.array(z.string()).optional(),
    runIds: z.array(IdLike).optional(),
    scopeId: IdLike.optional(),
    status: z.string().min(1).optional()
  })
  .passthrough();

export const SnapshotReadyDataSchema = z
  .object({
    missionId: IdLike.optional(),
    snapshotId: IdLike,
    summary: z.unknown().optional()
  })
  .passthrough();

export const RemediationCreatedDataSchema = z
  .object({
    controlGap: z.boolean().optional(),
    relatedFindingFingerprint: z.string().nullable().optional(),
    relatedPathId: IdLike.nullable().optional(),
    remediationId: IdLike,
    techniqueId: z.string().optional()
  })
  .passthrough();

export const RemediationVerifiedDataSchema = z
  .object({
    evidenceIds: z.array(IdLike).optional(),
    measuredRevalidation: z.boolean().optional(),
    newState: z.string().optional(),
    outcome: z.string().min(1),
    previousState: z.string().nullable().optional(),
    relatedPathId: IdLike.nullable().optional(),
    remediationId: IdLike,
    retestMethod: z.string().optional(),
    verificationId: IdLike.optional(),
    verifiedAt: z.string().optional()
  })
  .passthrough();

export const FindingDispositionChangedDataSchema = z
  .object({
    applyToFingerprint: z.boolean().optional(),
    cleared: z.boolean().optional(),
    disposition: z.string().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
    findingId: IdLike,
    fingerprint: z.string().optional(),
    previousStatus: z.string().optional(),
    reasonCode: z.string().nullable().optional(),
    source: z.string().optional(),
    title: z.string().optional()
  })
  .passthrough();

export const PolicyDeniedDataSchema = z
  .object({
    code: z.string().optional(),
    hopKey: z.string().optional(),
    missionId: IdLike.optional(),
    moduleId: z.string().optional(),
    outcome: z.string().min(1),
    pathEdgeId: IdLike.optional(),
    pathId: IdLike.optional(),
    policyDecisionId: IdLike.optional(),
    rationale: z.string().optional(),
    scopeId: IdLike.optional(),
    stage: z.string().optional(),
    stimulusId: IdLike.optional()
  })
  .passthrough();

export const ScheduleFailedDataSchema = z
  .object({
    code: z.string().optional(),
    denyReason: z.string().optional(),
    outcome: z.string().min(1),
    scheduleId: IdLike
  })
  .passthrough();

/**
 * Map of WebhookEventType → data payload schema.
 * Progressive: validate known fields; passthrough allows additive evolution.
 */
export const WEBHOOK_EVENT_DATA_SCHEMAS = {
  "mission.completed": MissionCompletedDataSchema,
  "mission.failed": MissionFailedDataSchema,
  "mission.started": MissionStartedDataSchema,
  "snapshot.ready": SnapshotReadyDataSchema,
  "remediation.created": RemediationCreatedDataSchema,
  "remediation.verified": RemediationVerifiedDataSchema,
  "finding.disposition_changed": FindingDispositionChangedDataSchema,
  "policy.denied": PolicyDeniedDataSchema,
  "schedule.failed": ScheduleFailedDataSchema
} as const satisfies Record<WebhookEventType, z.ZodType>;

export type MissionCompletedData = z.infer<typeof MissionCompletedDataSchema>;
export type MissionFailedData = z.infer<typeof MissionFailedDataSchema>;
export type MissionStartedData = z.infer<typeof MissionStartedDataSchema>;
export type SnapshotReadyData = z.infer<typeof SnapshotReadyDataSchema>;
export type RemediationCreatedData = z.infer<
  typeof RemediationCreatedDataSchema
>;
export type RemediationVerifiedData = z.infer<
  typeof RemediationVerifiedDataSchema
>;
export type FindingDispositionChangedData = z.infer<
  typeof FindingDispositionChangedDataSchema
>;
export type PolicyDeniedData = z.infer<typeof PolicyDeniedDataSchema>;
export type ScheduleFailedData = z.infer<typeof ScheduleFailedDataSchema>;

/** Discriminated union of known event data payloads (by event type). */
export type WebhookEventDataByType = {
  [K in WebhookEventType]: z.infer<(typeof WEBHOOK_EVENT_DATA_SCHEMAS)[K]>;
};

export type WebhookEventData = WebhookEventDataByType[WebhookEventType];

export const EVENT_DESCRIPTIONS: Record<WebhookEventType, string> = {
  "mission.completed":
    "Validation mission finished successfully (worker terminal status).",
  "mission.failed": "Validation mission finished in a failed terminal status.",
  "mission.started":
    "startMission queued work (not emitted for RequiresApproval / DeniedByPolicy).",
  "snapshot.ready": "Validation snapshot / evidence pack finalized.",
  "remediation.created": "Remediation task created (path or control-gap).",
  "remediation.verified":
    "verifyRemediation (or runner retest) produced a VerificationEvent — Fixed only via measurement.",
  "finding.disposition_changed":
    "Analyst disposition set or cleared on a finding.",
  "policy.denied": "Policy enforcement denied a run, hop, or stimulus.",
  "schedule.failed": "Scheduled fire denied or failed before work was queued."
};

/** Documented field names for catalog / OpenAPI receivers (not exhaustive). */
const EVENT_DATA_FIELDS: Record<WebhookEventType, readonly string[]> = {
  "mission.completed": ["missionId", "status"],
  "mission.failed": ["missionId", "status"],
  "mission.started": [
    "jobsQueued",
    "missionId",
    "moduleIds",
    "runIds",
    "scopeId",
    "status"
  ],
  "snapshot.ready": ["missionId", "snapshotId", "summary"],
  "remediation.created": [
    "controlGap",
    "relatedFindingFingerprint",
    "relatedPathId",
    "remediationId",
    "techniqueId"
  ],
  "remediation.verified": [
    "evidenceIds",
    "measuredRevalidation",
    "newState",
    "outcome",
    "previousState",
    "relatedPathId",
    "remediationId",
    "retestMethod",
    "verificationId",
    "verifiedAt"
  ],
  "finding.disposition_changed": [
    "applyToFingerprint",
    "cleared",
    "disposition",
    "expiresAt",
    "findingId",
    "fingerprint",
    "previousStatus",
    "reasonCode",
    "source",
    "title"
  ],
  "policy.denied": [
    "code",
    "missionId",
    "outcome",
    "policyDecisionId",
    "rationale",
    "scopeId",
    "stage"
  ],
  "schedule.failed": ["code", "denyReason", "outcome", "scheduleId"]
};

export const WebhookEventDataSummarySchema = z.object({
  dataFields: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
  eventType: WebhookEventTypeSchema
});

export type WebhookEventDataSummary = z.infer<
  typeof WebhookEventDataSummarySchema
>;

/** Catalog entries for all nine WebhookEventType values (schema summaries). */
export function listWebhookEventDataSummaries(): WebhookEventDataSummary[] {
  return WEBHOOK_EVENT_TYPES.map((eventType) => ({
    dataFields: [...EVENT_DATA_FIELDS[eventType]],
    description: EVENT_DESCRIPTIONS[eventType],
    eventType
  }));
}

/**
 * Best-effort parse of a delivery data object for a known event type.
 * Returns success with typed data or a Zod error — does not throw.
 */
export function parseWebhookEventData<T extends WebhookEventType>(
  eventType: T,
  data: unknown
):
  | { success: true; data: WebhookEventDataByType[T] }
  | { success: false; error: z.ZodError } {
  const schema = WEBHOOK_EVENT_DATA_SCHEMAS[eventType];
  const result = schema.safeParse(data);
  if (result.success) {
    return {
      data: result.data as WebhookEventDataByType[T],
      success: true
    };
  }
  return { error: result.error, success: false };
}

/** Human-readable catalog line for OpenAPI info.description (all 9 events). */
export function webhookEventCatalogDescription(): string {
  return WEBHOOK_EVENT_TYPES.map((t) => `\`${t}\``).join(", ");
}
