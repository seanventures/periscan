import { z } from "zod";

const IdSchema = z.string().uuid();
const TimestampSchema = z.iso.datetime();
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const EngagementWorkspaceStatusSchema = z.enum([
  "Open",
  "InReview",
  "Closed"
]);
export const EngagementWorkspaceRoleSchema = z.enum([
  "Lead",
  "Operator",
  "Observer"
]);
export const EngagementCollaborationEventTypeSchema = z.enum([
  "WorkspaceCreated",
  "CollaboratorUpdated",
  "Note",
  "AssignmentChanged",
  "StatusChanged",
  "EvidencePinned"
]);

export const EngagementWorkspaceSchema = z.object({
  createdAt: TimestampSchema,
  engagementId: IdSchema,
  engagementWorkspaceId: IdSchema,
  lastEventSequence: z.number().int().nonnegative(),
  leadUserId: IdSchema.nullable(),
  objective: z.string().min(3).max(2_000),
  status: EngagementWorkspaceStatusSchema,
  tenantId: IdSchema,
  title: z.string().min(3).max(160),
  updatedAt: TimestampSchema
});

export const EngagementCollaboratorSchema = z.object({
  addedAt: TimestampSchema,
  addedByUserId: IdSchema,
  collaboratorId: IdSchema,
  email: z.email(),
  name: z.string().min(1),
  role: EngagementWorkspaceRoleSchema,
  userId: IdSchema
});

export const EngagementCollaborationEventSchema = z.object({
  actorName: z.string().min(1),
  actorUserId: IdSchema,
  assignedToName: z.string().min(1).nullable(),
  assignedToUserId: IdSchema.nullable(),
  body: z.string().min(1).max(5_000).nullable(),
  createdAt: TimestampSchema,
  engagementCollaborationEventId: IdSchema,
  eventHash: HashSchema,
  eventType: EngagementCollaborationEventTypeSchema,
  evidenceIds: z.array(IdSchema).max(20),
  previousEventHash: HashSchema.nullable(),
  sequence: z.number().int().positive(),
  status: EngagementWorkspaceStatusSchema.nullable()
});

export const EngagementCollaborationIntegritySchema = z.object({
  brokenAtSequence: z.number().int().positive().nullable(),
  eventCount: z.number().int().nonnegative(),
  valid: z.boolean()
});

export const EngagementCollaborationSnapshotSchema = z.object({
  collaborators: z.array(EngagementCollaboratorSchema),
  events: z.array(EngagementCollaborationEventSchema),
  integrity: EngagementCollaborationIntegritySchema,
  workspace: EngagementWorkspaceSchema
});

export const EngagementCollaborationReadResponseSchema = z.object({
  collaboration: EngagementCollaborationSnapshotSchema.nullable()
});

export const InitializeEngagementWorkspaceInputSchema = z.object({
  objective: z.string().trim().min(3).max(2_000),
  title: z.string().trim().min(3).max(160)
});

export const UpsertEngagementCollaboratorInputSchema = z.object({
  role: EngagementWorkspaceRoleSchema,
  userId: IdSchema
});

export const CreateEngagementCollaborationEventInputSchema = z
  .object({
    assignedToUserId: IdSchema.nullish(),
    body: z.string().trim().min(1).max(5_000).nullish(),
    eventType: EngagementCollaborationEventTypeSchema.exclude([
      "WorkspaceCreated",
      "CollaboratorUpdated"
    ]),
    evidenceIds: z.array(IdSchema).max(20).default([]),
    status: EngagementWorkspaceStatusSchema.nullish()
  })
  .superRefine((input, context) => {
    if (input.eventType === "Note" && !input.body) {
      context.addIssue({
        code: "custom",
        message: "A collaboration note requires body text.",
        path: ["body"]
      });
    }
    if (input.eventType === "AssignmentChanged" && !input.assignedToUserId) {
      context.addIssue({
        code: "custom",
        message: "An assignment event requires a tenant member.",
        path: ["assignedToUserId"]
      });
    }
    if (input.eventType === "StatusChanged" && !input.status) {
      context.addIssue({
        code: "custom",
        message: "A status event requires the new workspace status.",
        path: ["status"]
      });
    }
    if (
      input.eventType === "EvidencePinned" &&
      input.evidenceIds.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "An evidence event requires at least one engagement artifact.",
        path: ["evidenceIds"]
      });
    }
  });

export type EngagementWorkspaceStatus = z.infer<
  typeof EngagementWorkspaceStatusSchema
>;
export type EngagementWorkspaceRole = z.infer<
  typeof EngagementWorkspaceRoleSchema
>;
export type EngagementCollaborationEventType = z.infer<
  typeof EngagementCollaborationEventTypeSchema
>;
export type EngagementWorkspace = z.infer<typeof EngagementWorkspaceSchema>;
export type EngagementCollaborator = z.infer<
  typeof EngagementCollaboratorSchema
>;
export type EngagementCollaborationEvent = z.infer<
  typeof EngagementCollaborationEventSchema
>;
export type EngagementCollaborationSnapshot = z.infer<
  typeof EngagementCollaborationSnapshotSchema
>;
export type InitializeEngagementWorkspaceInput = z.infer<
  typeof InitializeEngagementWorkspaceInputSchema
>;
export type UpsertEngagementCollaboratorInput = z.infer<
  typeof UpsertEngagementCollaboratorInputSchema
>;
export type CreateEngagementCollaborationEventInput = z.infer<
  typeof CreateEngagementCollaborationEventInputSchema
>;
