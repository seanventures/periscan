import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import {
  EngagementCollaborationSnapshotSchema,
  type EngagementCollaborationEventType,
  type EngagementCollaborationSnapshot,
  type EngagementWorkspaceStatus
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  SCOPE_EDITOR_ROLES,
  stringifyCanonicalJson,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

type CollaborationServices = Pick<
  AppServices,
  | "appendEngagementCollaborationEvent"
  | "getEngagementCollaboration"
  | "initializeEngagementCollaboration"
  | "upsertEngagementCollaborator"
>;

type EventHashInput = {
  actorUserId: string;
  assignedToUserId: string | null;
  body: string | null;
  createdAt: Date;
  engagementWorkspaceId: string;
  eventType: EngagementCollaborationEventType;
  evidenceIds: string[];
  previousEventHash: string | null;
  sequence: number;
  status: EngagementWorkspaceStatus | null;
};

function eventHash(input: EventHashInput) {
  return createHash("sha256")
    .update(
      stringifyCanonicalJson({
        actorUserId: input.actorUserId,
        assignedToUserId: input.assignedToUserId,
        body: input.body,
        createdAt: input.createdAt.toISOString(),
        engagementWorkspaceId: input.engagementWorkspaceId,
        eventType: input.eventType,
        evidenceIds: input.evidenceIds,
        previousEventHash: input.previousEventHash,
        sequence: input.sequence,
        status: input.status
      })
    )
    .digest("hex");
}

export function verifyEngagementCollaborationEventChain(
  events: Array<EventHashInput & { eventHash: string }>
) {
  let previousEventHash: string | null = null;
  for (const [index, event] of events.entries()) {
    const sequence = index + 1;
    if (
      event.sequence !== sequence ||
      event.previousEventHash !== previousEventHash ||
      event.eventHash !== eventHash(event)
    ) {
      return {
        brokenAtSequence: sequence,
        eventCount: events.length,
        valid: false
      };
    }
    previousEventHash = event.eventHash;
  }
  return { brokenAtSequence: null, eventCount: events.length, valid: true };
}

export function createEngagementCollaborationServices(
  deps: RuntimeServiceDeps
): CollaborationServices {
  const { prisma } = deps;

  async function engagementForTenant(tenantId: string, engagementId: string) {
    const engagement = await prisma.engagement.findFirst({
      where: { engagementId, tenantId }
    });
    if (!engagement) {
      throw new AppServiceError(
        "Engagement not found.",
        404,
        "engagement_not_found"
      );
    }
    return engagement;
  }

  async function workspaceForTenant(tenantId: string, engagementId: string) {
    const workspace = await prisma.engagementWorkspace.findFirst({
      where: { engagementId, tenantId }
    });
    if (!workspace) {
      throw new AppServiceError(
        "Initialize the collaboration workspace before adding activity.",
        409,
        "engagement_workspace_not_initialized"
      );
    }
    return workspace;
  }

  async function memberForTenant(tenantId: string, userId: string) {
    const membership = await prisma.membership.findUnique({
      include: { user: true },
      where: { tenantId_userId: { tenantId, userId } }
    });
    if (!membership) {
      throw new AppServiceError(
        "Collaborators and assignees must be current tenant members.",
        400,
        "engagement_collaborator_not_member"
      );
    }
    return membership;
  }

  async function snapshot(
    tenantId: string,
    engagementId: string
  ): Promise<EngagementCollaborationSnapshot | null> {
    const workspace = await prisma.engagementWorkspace.findFirst({
      include: {
        collaborators: {
          include: { user: true },
          orderBy: [{ role: "asc" }, { addedAt: "asc" }]
        },
        events: {
          include: { actor: true, assignedTo: true },
          orderBy: { sequence: "asc" }
        }
      },
      where: { engagementId, tenantId }
    });
    if (!workspace) return null;
    const integrityEvents = workspace.events.map((event) => ({
      actorUserId: event.actorUserId,
      assignedToUserId: event.assignedToUserId,
      body: event.body,
      createdAt: event.createdAt,
      engagementWorkspaceId: event.engagementWorkspaceId,
      eventHash: event.eventHash,
      eventType: event.eventType as EngagementCollaborationEventType,
      evidenceIds: event.evidenceIds,
      previousEventHash: event.previousEventHash,
      sequence: event.sequence,
      status: event.status as EngagementWorkspaceStatus | null
    }));
    return EngagementCollaborationSnapshotSchema.parse({
      collaborators: workspace.collaborators.map((collaborator) => ({
        addedAt: collaborator.addedAt.toISOString(),
        addedByUserId: collaborator.addedByUserId,
        collaboratorId: collaborator.collaboratorId,
        email: collaborator.user.email,
        name: collaborator.user.name,
        role: collaborator.role,
        userId: collaborator.userId
      })),
      events: workspace.events.map((event) => ({
        actorName: event.actor.name,
        actorUserId: event.actorUserId,
        assignedToName: event.assignedTo?.name ?? null,
        assignedToUserId: event.assignedToUserId,
        body: event.body,
        createdAt: event.createdAt.toISOString(),
        engagementCollaborationEventId: event.engagementCollaborationEventId,
        eventHash: event.eventHash,
        eventType: event.eventType,
        evidenceIds: event.evidenceIds,
        previousEventHash: event.previousEventHash,
        sequence: event.sequence,
        status: event.status
      })),
      integrity: verifyEngagementCollaborationEventChain(integrityEvents),
      workspace: {
        createdAt: workspace.createdAt.toISOString(),
        engagementId: workspace.engagementId,
        engagementWorkspaceId: workspace.engagementWorkspaceId,
        lastEventSequence: workspace.lastEventSequence,
        leadUserId: workspace.leadUserId,
        objective: workspace.objective,
        status: workspace.status,
        tenantId: workspace.tenantId,
        title: workspace.title,
        updatedAt: workspace.updatedAt.toISOString()
      }
    });
  }

  async function appendEvent(input: {
    actorUserId: string;
    assignedToUserId?: string | null;
    body?: string | null;
    engagementId: string;
    eventType: EngagementCollaborationEventType;
    evidenceIds?: string[];
    status?: EngagementWorkspaceStatus | null;
    tenantId: string;
  }) {
    try {
      await prisma.$transaction(
        async (transaction) => {
          const workspace = await transaction.engagementWorkspace.findFirst({
            where: {
              engagementId: input.engagementId,
              tenantId: input.tenantId
            }
          });
          if (!workspace) {
            throw new AppServiceError(
              "Collaboration workspace not found.",
              404,
              "engagement_workspace_not_found"
            );
          }
          const previous =
            workspace.lastEventSequence === 0
              ? null
              : await transaction.engagementCollaborationEvent.findUnique({
                  where: {
                    engagementWorkspaceId_sequence: {
                      engagementWorkspaceId: workspace.engagementWorkspaceId,
                      sequence: workspace.lastEventSequence
                    }
                  }
                });
          const sequence = workspace.lastEventSequence + 1;
          const createdAt = new Date();
          const hashInput: EventHashInput = {
            actorUserId: input.actorUserId,
            assignedToUserId: input.assignedToUserId ?? null,
            body: input.body ?? null,
            createdAt,
            engagementWorkspaceId: workspace.engagementWorkspaceId,
            eventType: input.eventType,
            evidenceIds: input.evidenceIds ?? [],
            previousEventHash: previous?.eventHash ?? null,
            sequence,
            status: input.status ?? null
          };
          const claimed = await transaction.engagementWorkspace.updateMany({
            data: {
              ...(input.eventType === "AssignmentChanged"
                ? { leadUserId: input.assignedToUserId ?? null }
                : {}),
              ...(input.eventType === "StatusChanged" && input.status
                ? { status: input.status }
                : {}),
              lastEventSequence: sequence
            },
            where: {
              engagementWorkspaceId: workspace.engagementWorkspaceId,
              lastEventSequence: workspace.lastEventSequence,
              tenantId: input.tenantId
            }
          });
          if (claimed.count !== 1) {
            throw new AppServiceError(
              "The activity changed while this update was being saved. Refresh and retry.",
              409,
              "engagement_collaboration_conflict"
            );
          }
          await transaction.engagementCollaborationEvent.create({
            data: {
              ...hashInput,
              eventHash: eventHash(hashInput),
              tenantId: input.tenantId
            }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (error instanceof AppServiceError) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      ) {
        throw new AppServiceError(
          "The activity changed while this update was being saved. Refresh and retry.",
          409,
          "engagement_collaboration_conflict"
        );
      }
      throw error;
    }
  }

  return {
    async getEngagementCollaboration(context, engagementId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "read engagement collaboration"
      );
      await engagementForTenant(context.tenant.tenantId, engagementId);
      return snapshot(context.tenant.tenantId, engagementId);
    },

    async initializeEngagementCollaboration(context, engagementId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "initialize engagement collaboration"
      );
      await engagementForTenant(context.tenant.tenantId, engagementId);
      const existing = await snapshot(context.tenant.tenantId, engagementId);
      if (existing) return existing;
      const createdAt = new Date();
      await prisma.$transaction(async (transaction) => {
        const workspace = await transaction.engagementWorkspace.create({
          data: {
            engagementId,
            lastEventSequence: 1,
            leadUserId: context.user.userId,
            objective: input.objective,
            status: "Open",
            tenantId: context.tenant.tenantId,
            title: input.title
          }
        });
        await transaction.engagementCollaborator.create({
          data: {
            addedByUserId: context.user.userId,
            engagementWorkspaceId: workspace.engagementWorkspaceId,
            role: "Lead",
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          }
        });
        const hashInput: EventHashInput = {
          actorUserId: context.user.userId,
          assignedToUserId: context.user.userId,
          body: input.objective,
          createdAt,
          engagementWorkspaceId: workspace.engagementWorkspaceId,
          eventType: "WorkspaceCreated",
          evidenceIds: [],
          previousEventHash: null,
          sequence: 1,
          status: "Open"
        };
        await transaction.engagementCollaborationEvent.create({
          data: {
            ...hashInput,
            eventHash: eventHash(hashInput),
            tenantId: context.tenant.tenantId
          }
        });
        await writeAuditEvent(transaction, {
          action: "engagement.workspace.created",
          actorType: "User",
          entityId: engagementId,
          entityType: "Engagement",
          metadata: { title: input.title },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return (await snapshot(context.tenant.tenantId, engagementId))!;
    },

    async upsertEngagementCollaborator(context, engagementId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "manage engagement collaborators"
      );
      const workspace = await workspaceForTenant(
        context.tenant.tenantId,
        engagementId
      );
      await memberForTenant(context.tenant.tenantId, input.userId);
      await prisma.engagementCollaborator.upsert({
        create: {
          addedByUserId: context.user.userId,
          engagementWorkspaceId: workspace.engagementWorkspaceId,
          role: input.role,
          tenantId: context.tenant.tenantId,
          userId: input.userId
        },
        update: { role: input.role },
        where: {
          engagementWorkspaceId_userId: {
            engagementWorkspaceId: workspace.engagementWorkspaceId,
            userId: input.userId
          }
        }
      });
      if (input.role === "Lead") {
        await prisma.engagementWorkspace.update({
          data: { leadUserId: input.userId },
          where: { engagementWorkspaceId: workspace.engagementWorkspaceId }
        });
      }
      await appendEvent({
        actorUserId: context.user.userId,
        assignedToUserId: input.userId,
        body: `Workspace role: ${input.role}`,
        engagementId,
        eventType: "CollaboratorUpdated",
        tenantId: context.tenant.tenantId
      });
      await writeAuditEvent(prisma, {
        action: "engagement.collaborator.updated",
        actorType: "User",
        entityId: engagementId,
        entityType: "Engagement",
        metadata: { role: input.role, userId: input.userId },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return (await snapshot(context.tenant.tenantId, engagementId))!;
    },

    async appendEngagementCollaborationEvent(context, engagementId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "add engagement collaboration activity"
      );
      const engagement = await engagementForTenant(
        context.tenant.tenantId,
        engagementId
      );
      await workspaceForTenant(context.tenant.tenantId, engagementId);
      if (input.assignedToUserId) {
        await memberForTenant(context.tenant.tenantId, input.assignedToUserId);
      }
      const invalidEvidenceIds = input.evidenceIds.filter(
        (evidenceId) => !engagement.evidenceIds.includes(evidenceId)
      );
      if (invalidEvidenceIds.length > 0) {
        throw new AppServiceError(
          "Only evidence produced by this engagement can be pinned to its replay.",
          400,
          "engagement_evidence_not_owned"
        );
      }
      await appendEvent({
        actorUserId: context.user.userId,
        assignedToUserId: input.assignedToUserId,
        body: input.body,
        engagementId,
        eventType: input.eventType,
        evidenceIds: input.evidenceIds,
        status: input.status,
        tenantId: context.tenant.tenantId
      });
      await writeAuditEvent(prisma, {
        action: "engagement.collaboration.event_added",
        actorType: "User",
        entityId: engagementId,
        entityType: "Engagement",
        metadata: {
          eventType: input.eventType,
          evidenceCount: input.evidenceIds.length
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return (await snapshot(context.tenant.tenantId, engagementId))!;
    }
  };
}
