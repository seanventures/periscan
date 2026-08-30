import type { Prisma, PrismaClient } from "@prisma/client";
import type { ModelGatewayAuditEvent } from "@periscan/shared";

export type GatewayPrisma = Prisma.TransactionClient | PrismaClient;

export interface WriteModelGatewayAuditEventInput {
  tenantId: string;
  eventType: ModelGatewayAuditEvent["eventType"];
  modelSessionId?: string | null;
  userId?: string | null;
  modelProviderId?: string | null;
  toolName?: string | null;
  toolRequestId?: string | null;
  policyDecisionId?: string | null;
  evidenceIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Append a single entry to the per-session model gateway audit timeline. Used by
 * both the synchronous control-plane API and the asynchronous turn orchestrator
 * so the timeline is consistent regardless of who triggered the event.
 */
export async function writeModelGatewayAuditEvent(
  prisma: GatewayPrisma,
  input: WriteModelGatewayAuditEventInput
): Promise<void> {
  await prisma.modelGatewayAuditEvent.create({
    data: {
      eventType: input.eventType,
      evidenceIds: input.evidenceIds ?? [],
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      modelProviderId: input.modelProviderId ?? null,
      modelSessionId: input.modelSessionId ?? null,
      policyDecisionId: input.policyDecisionId ?? null,
      tenantId: input.tenantId,
      toolName: input.toolName ?? null,
      toolRequestId: input.toolRequestId ?? null,
      userId: input.userId ?? null
    }
  });
}
