import { createHash } from "node:crypto";

import {
  ExpectedControlBehaviorSchema,
  RemediationActionManifestSchema,
  RemediationActionSchema,
  type ConfirmRemediationActionInput,
  type RemediationAction
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

type RemediationActionServices = Pick<
  AppServices,
  | "approveRemediationAction"
  | "executeRemediationAction"
  | "listRemediationActions"
  | "previewRemediationAction"
  | "rollbackRemediationAction"
>;

function hashPreview(value: unknown) {
  return createHash("sha256")
    .update(stringifyCanonicalJson(value))
    .digest("hex");
}

function sortedBehaviors(value: unknown) {
  return [
    ...new Set(ExpectedControlBehaviorSchema.array().parse(value))
  ].sort();
}

function serializeRemediationAction(record: {
  actionType: "ControlExpectationTuning";
  appliedAt: Date | null;
  applicationReceipt: unknown;
  approvedAt: Date | null;
  approvedBy: string | null;
  createdAt: Date;
  failureReason: string | null;
  idempotencyKey: string;
  manifest: unknown;
  previewHash: string;
  remediationActionId: string;
  remediationId: string;
  rollbackReceipt: unknown;
  rolledBackAt: Date | null;
  state: RemediationAction["state"];
  targetEntityId: string;
  tenantId: string;
  updatedAt: Date;
}): RemediationAction {
  return RemediationActionSchema.parse({
    ...record,
    appliedAt: record.appliedAt?.toISOString() ?? null,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    manifest: RemediationActionManifestSchema.parse(record.manifest),
    rolledBackAt: record.rolledBackAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString()
  });
}

export function createRemediationActionServices(
  deps: RuntimeServiceDeps
): RemediationActionServices {
  const { prisma } = deps;

  async function getOwnedAction(tenantId: string, remediationActionId: string) {
    const action = await prisma.remediationAction.findFirst({
      where: { remediationActionId, tenantId }
    });
    if (!action) {
      throw new AppServiceError(
        "Remediation action not found.",
        404,
        "remediation_action_not_found"
      );
    }
    return action;
  }

  function requirePreviewHash(
    action: { previewHash: string },
    input: ConfirmRemediationActionInput
  ) {
    if (action.previewHash !== input.previewHash) {
      throw new AppServiceError(
        "The approved action hash does not match the exact preview.",
        409,
        "remediation_action_preview_hash_mismatch"
      );
    }
  }

  return {
    async listRemediationActions(context, remediationId) {
      const remediation = await prisma.remediationTask.findFirst({
        where: { remediationId, tenantId: context.tenant.tenantId }
      });
      if (!remediation) {
        throw new AppServiceError(
          "Remediation not found.",
          404,
          "remediation_not_found"
        );
      }
      const actions = await prisma.remediationAction.findMany({
        orderBy: { createdAt: "desc" },
        where: { remediationId, tenantId: context.tenant.tenantId }
      });
      return actions.map(serializeRemediationAction);
    },

    async previewRemediationAction(context, remediationId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "preview remediation actions"
      );
      const [remediation, controlSource] = await Promise.all([
        prisma.remediationTask.findFirst({
          where: { remediationId, tenantId: context.tenant.tenantId }
        }),
        prisma.controlSource.findFirst({
          where: {
            controlSourceId: input.controlSourceId,
            tenantId: context.tenant.tenantId
          }
        })
      ]);
      if (!remediation) {
        throw new AppServiceError(
          "Remediation not found.",
          404,
          "remediation_not_found"
        );
      }
      if (["Fixed", "ClosedWithoutEvidence"].includes(remediation.status)) {
        throw new AppServiceError(
          "Create a new remediation before changing a settled risk.",
          409,
          "remediation_action_settled_risk"
        );
      }
      if (!controlSource) {
        throw new AppServiceError(
          "Control source not found.",
          404,
          "control_source_not_found"
        );
      }
      const before = sortedBehaviors(controlSource.expectedBehaviors);
      const after = sortedBehaviors(input.nextExpectedBehaviors);
      if (stringifyCanonicalJson(before) === stringifyCanonicalJson(after)) {
        throw new AppServiceError(
          "The proposed action does not change expected control behavior.",
          400,
          "remediation_action_empty_diff"
        );
      }
      const manifest = RemediationActionManifestSchema.parse({
        actionType: input.actionType,
        approvalRoles: ["Owner", "Admin", "SecurityEngineer"],
        blastRadius:
          "Changes only Periscan's expected-behavior contract for this control source; it does not mutate the external security product.",
        description:
          "Tune the expected control behaviors used by the next measured observation. Applying this action never marks the remediation Fixed.",
        evidenceProduced: [
          "Exact preview hash",
          "Application receipt",
          "Audit event",
          "Required post-change verification reference"
        ],
        exactDiff: { after, before, field: "expectedBehaviors" },
        expectedWriteOperations: [
          `UPDATE control source ${controlSource.controlSourceId} expectedBehaviors`,
          `SET remediation ${remediation.remediationId} status VerificationPending`
        ],
        preconditions: [
          "Remediation and control source belong to the current tenant.",
          "The exact preview hash is approved.",
          "The current expected behaviors still equal the previewed before value."
        ],
        requiredPermissions: [
          "Periscan Owner, Admin, or Security Engineer",
          "No third-party write credential is used"
        ],
        rollback: {
          available: true,
          operation:
            "Restore the previewed before value if the applied value has not changed."
        },
        target: {
          controlSourceId: controlSource.controlSourceId,
          integrationId: controlSource.integrationId,
          provider: controlSource.provider
        },
        title: `Tune ${controlSource.provider} validation expectations`,
        verification: {
          method:
            "Run a fresh control observation and the remediation FixVerification flow.",
          required: true,
          successDoesNotEqualFixed: true
        }
      });
      const previewHash = hashPreview({
        idempotencyKey: input.idempotencyKey,
        manifest,
        remediationId
      });
      const existing = await prisma.remediationAction.findUnique({
        where: {
          tenantId_idempotencyKey: {
            idempotencyKey: input.idempotencyKey,
            tenantId: context.tenant.tenantId
          }
        }
      });
      if (existing) {
        if (existing.previewHash !== previewHash) {
          throw new AppServiceError(
            "This idempotency key is already bound to a different action preview.",
            409,
            "remediation_action_idempotency_conflict"
          );
        }
        return serializeRemediationAction(existing);
      }
      const created = await prisma.$transaction(async (transaction) => {
        const action = await transaction.remediationAction.create({
          data: {
            actionType: input.actionType,
            idempotencyKey: input.idempotencyKey,
            manifest,
            previewHash,
            remediationId,
            state: "AwaitingApproval",
            targetEntityId: controlSource.controlSourceId,
            tenantId: context.tenant.tenantId
          }
        });
        await writeAuditEvent(transaction, {
          action: "remediation_action.previewed",
          actorType: "User",
          entityId: action.remediationActionId,
          entityType: "RemediationAction",
          metadata: { previewHash, remediationId },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return action;
      });
      return serializeRemediationAction(created);
    },

    async approveRemediationAction(context, remediationActionId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "approve remediation actions"
      );
      const action = await getOwnedAction(
        context.tenant.tenantId,
        remediationActionId
      );
      requirePreviewHash(action, input);
      if (["Approved", "Applied", "RolledBack"].includes(action.state)) {
        return serializeRemediationAction(action);
      }
      if (action.state !== "AwaitingApproval") {
        throw new AppServiceError(
          `Action cannot be approved from ${action.state}.`,
          409,
          "remediation_action_invalid_state"
        );
      }
      const updated = await prisma.$transaction(async (transaction) => {
        const next = await transaction.remediationAction.update({
          data: {
            approvedAt: new Date(),
            approvedBy: context.user.userId,
            state: "Approved"
          },
          where: { remediationActionId }
        });
        await writeAuditEvent(transaction, {
          action: "remediation_action.approved",
          actorType: "User",
          entityId: remediationActionId,
          entityType: "RemediationAction",
          metadata: { previewHash: action.previewHash },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return next;
      });
      return serializeRemediationAction(updated);
    },

    async executeRemediationAction(context, remediationActionId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "execute remediation actions"
      );
      const action = await getOwnedAction(
        context.tenant.tenantId,
        remediationActionId
      );
      requirePreviewHash(action, input);
      if (action.state === "Applied") return serializeRemediationAction(action);
      if (action.state !== "Approved") {
        throw new AppServiceError(
          `Action cannot execute from ${action.state}.`,
          409,
          "remediation_action_approval_required"
        );
      }
      const manifest = RemediationActionManifestSchema.parse(action.manifest);
      const controlSource = await prisma.controlSource.findFirst({
        where: {
          controlSourceId: manifest.target.controlSourceId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!controlSource) {
        throw new AppServiceError(
          "Control source not found.",
          404,
          "control_source_not_found"
        );
      }
      if (
        stringifyCanonicalJson(
          sortedBehaviors(controlSource.expectedBehaviors)
        ) !== stringifyCanonicalJson(manifest.exactDiff.before)
      ) {
        throw new AppServiceError(
          "The control source changed after preview. Generate and approve a fresh exact diff.",
          409,
          "remediation_action_stale_preview"
        );
      }
      const appliedAt = new Date();
      const receipt = {
        appliedAt: appliedAt.toISOString(),
        controlSourceId: controlSource.controlSourceId,
        exactDiffHash: action.previewHash,
        externalProductMutated: false,
        nextRequiredAction: "RunFixVerification",
        writeCount: 2
      };
      const updated = await prisma.$transaction(async (transaction) => {
        await transaction.controlSource.update({
          data: { expectedBehaviors: manifest.exactDiff.after },
          where: { controlSourceId: controlSource.controlSourceId }
        });
        await transaction.remediationTask.update({
          data: { status: "VerificationPending" },
          where: { remediationId: action.remediationId }
        });
        const next = await transaction.remediationAction.update({
          data: {
            appliedAt,
            applicationReceipt: receipt,
            state: "Applied"
          },
          where: { remediationActionId }
        });
        await writeAuditEvent(transaction, {
          action: "remediation_action.applied",
          actorType: "User",
          entityId: remediationActionId,
          entityType: "RemediationAction",
          metadata: receipt,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return next;
      });
      return serializeRemediationAction(updated);
    },

    async rollbackRemediationAction(context, remediationActionId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "roll back remediation actions"
      );
      const action = await getOwnedAction(
        context.tenant.tenantId,
        remediationActionId
      );
      requirePreviewHash(action, input);
      if (action.state === "RolledBack") {
        return serializeRemediationAction(action);
      }
      if (action.state !== "Applied") {
        throw new AppServiceError(
          `Action cannot roll back from ${action.state}.`,
          409,
          "remediation_action_invalid_state"
        );
      }
      const manifest = RemediationActionManifestSchema.parse(action.manifest);
      const controlSource = await prisma.controlSource.findFirstOrThrow({
        where: {
          controlSourceId: manifest.target.controlSourceId,
          tenantId: context.tenant.tenantId
        }
      });
      if (
        stringifyCanonicalJson(
          sortedBehaviors(controlSource.expectedBehaviors)
        ) !== stringifyCanonicalJson(manifest.exactDiff.after)
      ) {
        throw new AppServiceError(
          "Rollback stopped because the target changed after application.",
          409,
          "remediation_action_stale_rollback"
        );
      }
      const rolledBackAt = new Date();
      const receipt = {
        controlSourceId: controlSource.controlSourceId,
        restored: manifest.exactDiff.before,
        rolledBackAt: rolledBackAt.toISOString()
      };
      const updated = await prisma.$transaction(async (transaction) => {
        await transaction.controlSource.update({
          data: { expectedBehaviors: manifest.exactDiff.before },
          where: { controlSourceId: controlSource.controlSourceId }
        });
        await transaction.remediationTask.update({
          data: { status: "InProgress" },
          where: { remediationId: action.remediationId }
        });
        const next = await transaction.remediationAction.update({
          data: {
            rollbackReceipt: receipt,
            rolledBackAt,
            state: "RolledBack"
          },
          where: { remediationActionId }
        });
        await writeAuditEvent(transaction, {
          action: "remediation_action.rolled_back",
          actorType: "User",
          entityId: remediationActionId,
          entityType: "RemediationAction",
          metadata: receipt,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return next;
      });
      return serializeRemediationAction(updated);
    }
  };
}
