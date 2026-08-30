// @ts-nocheck
import {
  generateOperatorRecommendations,
  type OperatorRecommendation,
  type OperatorRecommendationRecord,
  type OperatorRecommendationStatus
} from "@periscan/operators";
import { evaluatePolicy } from "@periscan/policy";
import type { Prisma } from "@prisma/client";

import {
  serializePolicyDecision,
  serializeValidationMission
} from "../serializers/entities.js";
import { serializeSignalTriggerRoutingSettings } from "../serializers/tenant.js";
import {
  AppServiceError,
  assertSignalTriggerRoutingIntegrations,
  buildOperatorContextForTenant,
  buildSafeRequestedAction,
  buildSignalTriggerEvaluationResponse,
  buildSignalTriggerRoutingDecision,
  deliverSignalTriggerRouting,
  loadSignalTriggerRoutingSettings,
  requireRole,
  resolveSignalTriggerRoutingIntegrationIds,
  serializeAuditEvent,
  serializeSignalEnvelope,
  SCOPE_EDITOR_ROLES,
  SIGNAL_TRIGGER_RULES,
  TENANT_ADMIN_ROLES,
  uniqueSignalTriggerValues,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

type OperatorRecommendationRow = {
  createdAt: Date;
  operatorRecommendationId: string;
  payload: Prisma.JsonValue;
  scopeId: string | null;
  status: OperatorRecommendationStatus;
  tenantId: string;
};

function serializeOperatorRecommendationRecord(
  row: OperatorRecommendationRow
): OperatorRecommendationRecord {
  const payload =
    row.payload &&
    typeof row.payload === "object" &&
    !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};

  return {
    createdAt: row.createdAt.toISOString(),
    operatorRecommendationId: row.operatorRecommendationId,
    payload,
    scopeId: row.scopeId,
    status: row.status,
    tenantId: row.tenantId
  };
}

async function persistGeneratedOperatorRecommendations(
  prisma: RuntimeServiceDeps["prisma"],
  tenantId: string,
  recommendations: OperatorRecommendation[]
) {
  for (const recommendation of recommendations) {
    const existing = await prisma.operatorRecommendation.findFirst({
      where: {
        payload: {
          equals: recommendation.recommendationId,
          path: ["recommendationId"]
        },
        tenantId
      }
    });

    if (existing) {
      continue;
    }

    let scopeId = recommendation.missionPlan.scopeId ?? null;
    if (scopeId) {
      const scopeExists = await prisma.scope.count({
        where: {
          scopeId,
          tenantId
        }
      });
      if (!scopeExists) {
        // Drop invalid FK rather than failing generation for the whole list.
        scopeId = null;
      }
    }

    await prisma.operatorRecommendation.create({
      data: {
        payload: recommendation as unknown as Prisma.InputJsonValue,
        scopeId,
        status: recommendation.status,
        tenantId
      }
    });
  }
}

// Signal-driven triggers and operator-recommendation service group (D1 Phase 2
// closure decomposition). Cross-group this.previewPolicyDecision/createMission
// resolve via the composed AppServices object.
export function createSignalOperatorServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "approveOperatorRecommendation"
  | "approveSignalTrigger"
  | "createOperatorRecommendationRecord"
  | "evaluateSignalTriggers"
  | "getOperatorRecommendations"
  | "getSignalTriggerRoutingSettings"
  | "listOperatorRecommendationRecords"
  | "listSignalTriggerActivity"
  | "listSignalTriggers"
  | "updateSignalTriggerRoutingSettings"
> {
  const { prisma } = deps;

  return {
    async getOperatorRecommendations(context) {
      const recommendations = generateOperatorRecommendations(
        await buildOperatorContextForTenant(prisma, context)
      );

      // P11-4: persist proposals when generated so history is durable.
      await persistGeneratedOperatorRecommendations(
        prisma,
        context.tenant.tenantId,
        recommendations
      );

      // P11-15: overlay durable status from DB so Approved survives refetch.
      // Generators always emit Proposed; without this merge, approve → list
      // flickers back to Proposed and the API response lies about statefulness.
      const rows = await prisma.operatorRecommendation.findMany({
        where: { tenantId: context.tenant.tenantId }
      });
      const statusByRecommendationId = new Map<
        string,
        OperatorRecommendationStatus
      >();
      for (const row of rows) {
        const payload =
          row.payload &&
          typeof row.payload === "object" &&
          !Array.isArray(row.payload)
            ? (row.payload as Record<string, unknown>)
            : {};
        const recommendationId = payload.recommendationId;
        if (typeof recommendationId === "string" && recommendationId.length > 0) {
          statusByRecommendationId.set(
            recommendationId,
            row.status as OperatorRecommendationStatus
          );
        }
      }

      return recommendations.map((recommendation) => {
        const durable = statusByRecommendationId.get(
          recommendation.recommendationId
        );
        if (!durable || durable === recommendation.status) {
          return recommendation;
        }
        return { ...recommendation, status: durable };
      });
    },

    async listOperatorRecommendationRecords(context) {
      const rows = await prisma.operatorRecommendation.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return rows.map(serializeOperatorRecommendationRecord);
    },

    async createOperatorRecommendationRecord(context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create operator recommendations"
      );

      const scopeId = input.scopeId ?? null;
      if (scopeId) {
        const scopeExists = await prisma.scope.count({
          where: {
            scopeId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!scopeExists) {
          throw new AppServiceError(
            "Scope not found for this tenant.",
            404,
            "scope_not_found"
          );
        }
      }

      const row = await prisma.operatorRecommendation.create({
        data: {
          payload: input.payload as Prisma.InputJsonValue,
          scopeId,
          status: input.status,
          tenantId: context.tenant.tenantId
        }
      });

      return serializeOperatorRecommendationRecord(row);
    },

    async approveOperatorRecommendation(
      this: AppServices,
      context,
      recommendationId
    ) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "approve operator recommendations"
      );

      const recommendations = await this.getOperatorRecommendations(context);
      const recommendation = recommendations.find(
        (item) => item.recommendationId === recommendationId
      );

      if (!recommendation) {
        throw new AppServiceError(
          "Operator recommendation not found.",
          404,
          "operator_recommendation_not_found"
        );
      }

      if (
        recommendation.status === "NotActionable" ||
        !recommendation.missionPlan.scopeId
      ) {
        throw new AppServiceError(
          "Operator recommendation is not actionable without verified scope.",
          400,
          "operator_recommendation_not_actionable"
        );
      }

      const decision = await this.previewPolicyDecision(
        context,
        recommendation.missionPlan.scopeId,
        {
          executionEnvironment: recommendation.missionPlan.executionEnvironment,
          missionType: recommendation.missionPlan.missionType,
          requestedAction: recommendation.missionPlan.requestedAction,
          safetyLevel: recommendation.missionPlan.safetyLevel,
          target: recommendation.missionPlan.target
        }
      );
      const mission = await this.createMission(context, {
        missionType: recommendation.missionPlan.missionType,
        policyDecisionId: decision.policyDecisionId,
        policyProfile: `operator:${recommendation.operatorType}`,
        safetyLevel: recommendation.missionPlan.safetyLevel,
        scopeId: recommendation.missionPlan.scopeId,
        scopeIds: [recommendation.missionPlan.scopeId]
      });

      // Persist Approved status on the durable proposal row (P11-4).
      await prisma.operatorRecommendation.updateMany({
        data: {
          status: "Approved"
        },
        where: {
          payload: {
            equals: recommendationId,
            path: ["recommendationId"]
          },
          tenantId: context.tenant.tenantId
        }
      });

      // createMission always starts Draft; operators never auto-queue on apply.
      return {
        decision,
        mission,
        queued: false as const,
        recommendation: {
          ...recommendation,
          status: "Approved" as const
        }
      };
    },

    async listSignalTriggers() {
      return SIGNAL_TRIGGER_RULES;
    },

    async evaluateSignalTriggers(context) {
      const tenantId = context.tenant.tenantId;
      const [
        verifiedScopeCount,
        integrations,
        signals,
        auditEvents,
        controlSourceCount,
        activeRunnerCount
      ] = await Promise.all([
        prisma.scope.count({
          where: {
            tenantId,
            verificationStatus: "Verified"
          }
        }),
        prisma.integration.findMany({
          where: {
            status: "Connected",
            tenantId
          }
        }),
        prisma.signalEnvelope.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId
          }
        }),
        prisma.auditEvent.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            action: "policy_decision",
            tenantId
          }
        }),
        prisma.controlSource.count({
          where: {
            tenantId
          }
        }),
        prisma.runner.count({
          where: {
            status: {
              in: ["Active", "Degraded"]
            },
            tenantId
          }
        })
      ]);

      const routingSettings = await loadSignalTriggerRoutingSettings(
        prisma,
        tenantId
      );

      return buildSignalTriggerEvaluationResponse({
        auditEvents: auditEvents.map(serializeAuditEvent),
        connectedIntegrationCategories: new Set(
          integrations.map((integration) => integration.category)
        ),
        controlSourceCount,
        evaluatedAt: new Date().toISOString(),
        hasActiveRunner: activeRunnerCount > 0,
        hasAnyIntegration: integrations.length > 0,
        hasVerifiedScope: verifiedScopeCount > 0,
        ruleParameters: routingSettings.ruleParameters ?? {},
        signals: signals.map(serializeSignalEnvelope),
        tenantId
      });
    },

    async listSignalTriggerActivity(this: AppServices, context, options) {
      const activity = (await this.evaluateSignalTriggers(context)).activity;

      return options?.limit === undefined
        ? activity
        : activity.slice(0, options.limit);
    },

    async approveSignalTrigger(this: AppServices, context, triggerId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "approve signal-trigger recommendations"
      );

      const evaluationResponse = await this.evaluateSignalTriggers(context);
      const evaluation = evaluationResponse.evaluations.find(
        (candidate) => candidate.triggerId === triggerId
      );
      const rule = SIGNAL_TRIGGER_RULES.find(
        (candidate) => candidate.triggerId === triggerId
      );

      if (!evaluation || !rule) {
        throw new AppServiceError(
          "Signal trigger not found.",
          404,
          "signal_trigger_not_found"
        );
      }

      if (evaluation.status !== "NeedsApproval") {
        throw new AppServiceError(
          evaluation.reason,
          400,
          "signal_trigger_not_actionable"
        );
      }

      const verifiedScopes = await prisma.scope.findMany({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          tenantId: context.tenant.tenantId,
          verificationStatus: "Verified"
        }
      });
      const selectedScope =
        verifiedScopes.find((scope) =>
          rule.requiredScopeTypes.includes(scope.scopeType)
        ) ?? verifiedScopes[0];

      if (!selectedScope) {
        throw new AppServiceError(
          "A verified scope is required before approving a signal trigger.",
          400,
          "verified_scope_required"
        );
      }

      const requestedAction = buildSafeRequestedAction("ControlPlane");
      const evaluatedPolicy = evaluatePolicy({
        adminApproval: TENANT_ADMIN_ROLES.has(context.membership.role),
        executionEnvironment: "ControlPlane",
        explicitMissionApproval: true,
        missionType: evaluation.recommendedMissionType,
        requestedAction,
        safetyLevel: rule.safetyLevel,
        scopeContext: selectedScope,
        scopeVerificationStatus: selectedScope.verificationStatus,
        timeWindowApproved: false,
        userRole: context.membership.role
      });
      const policyDecisionRecord = await prisma.policyDecision.create({
        data: {
          approvalState: evaluatedPolicy.approvalState,
          approvedAt:
            evaluatedPolicy.approvalState === "Approved" ? new Date() : null,
          approvedBy:
            evaluatedPolicy.approvalState === "Approved"
              ? context.user.userId
              : null,
          executionEnvironment: "ControlPlane",
          missionType: evaluation.recommendedMissionType,
          outcome: evaluatedPolicy.outcome,
          rationale: evaluatedPolicy.rationale,
          requestedAction: requestedAction as Prisma.InputJsonValue,
          safetyLevel: rule.safetyLevel,
          scopeId: selectedScope.scopeId,
          target: {
            evidenceIds: evaluation.evidenceIds,
            matchedAuditEventIds: evaluation.matchedAuditEventIds,
            matchedSignalIds: evaluation.matchedSignalIds,
            recommendedModuleIds: evaluation.recommendedModuleIds,
            triggerId: evaluation.triggerId,
            triggerType: evaluation.triggerType
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        }
      });
      const policyDecision = serializePolicyDecision(policyDecisionRecord);

      await writeAuditEvent(prisma, {
        action: "policy.decision",
        actorType: "User",
        entityId: policyDecision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          missionType: policyDecision.missionType,
          outcome: policyDecision.outcome,
          scopeId: policyDecision.scopeId,
          triggerId: evaluation.triggerId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      const missionRecord = await prisma.validationMission.create({
        data: {
          evidenceIds: evaluation.evidenceIds,
          missionType: evaluation.recommendedMissionType,
          policyDecisionId: policyDecision.policyDecisionId,
          policyProfile: `signal-trigger:${evaluation.triggerId}`,
          requestedBy: context.user.userId,
          safetyLevel: rule.safetyLevel,
          scopeId: selectedScope.scopeId,
          scopeIds: [selectedScope.scopeId],
          status: "Draft",
          tenantId: context.tenant.tenantId
        }
      });
      const mission = serializeValidationMission(missionRecord);

      await writeAuditEvent(prisma, {
        action: "mission.created",
        actorType: "User",
        entityId: mission.missionId,
        entityType: "ValidationMission",
        metadata: {
          missionType: mission.missionType,
          policyProfile: mission.policyProfile,
          scopeId: mission.scopeId,
          triggerId: evaluation.triggerId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      const routingSettings = await loadSignalTriggerRoutingSettings(
        prisma,
        context.tenant.tenantId
      );
      const routingIntegrationIds =
        await resolveSignalTriggerRoutingIntegrationIds(
          prisma,
          context.tenant.tenantId,
          routingSettings
        );
      const routingDestinationIds = uniqueSignalTriggerValues([
        ...routingIntegrationIds.notificationIntegrationIds,
        ...routingIntegrationIds.workflowDestinationIntegrationIds
      ]);
      const deliveries =
        routingSettings.enabled && routingDestinationIds.length > 0
          ? await deliverSignalTriggerRouting({
              integrationIds: routingDestinationIds,
              prisma,
              tenantId: context.tenant.tenantId,
              workflowEvent: {
                evidenceIds: evaluation.evidenceIds,
                missionId: mission.missionId,
                policyDecisionId: policyDecision.policyDecisionId,
                summary: evaluation.reason,
                title: `${evaluation.triggerType} trigger approved`,
                triggerId: evaluation.triggerId,
                type: "signal_trigger.approved"
              }
            })
          : [];
      const routing = buildSignalTriggerRoutingDecision({
        connectedNotificationIntegrationIds:
          routingIntegrationIds.notificationIntegrationIds,
        connectedWorkflowDestinationIntegrationIds:
          routingIntegrationIds.workflowDestinationIntegrationIds,
        deliveries,
        settings: routingSettings
      });

      return {
        evaluation,
        mission,
        policyDecision,
        routing
      };
    },

    async getSignalTriggerRoutingSettings(context) {
      return loadSignalTriggerRoutingSettings(prisma, context.tenant.tenantId);
    },

    async updateSignalTriggerRoutingSettings(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "update signal-trigger routing settings"
      );

      const existing = await loadSignalTriggerRoutingSettings(
        prisma,
        context.tenant.tenantId
      );
      const defaultOwnerRole =
        input.defaultOwnerRole ?? existing.defaultOwnerRole;

      if (defaultOwnerRole === "Viewer") {
        throw new AppServiceError(
          "Signal-trigger routing escalation cannot target the Viewer role.",
          400,
          "routing_owner_role_not_allowed"
        );
      }

      const workflowDestinationIntegrationIds = uniqueSignalTriggerValues(
        input.workflowDestinationIntegrationIds ??
          existing.workflowDestinationIntegrationIds
      );
      const notificationIntegrationIds = uniqueSignalTriggerValues(
        input.notificationIntegrationIds ?? existing.notificationIntegrationIds
      );

      await assertSignalTriggerRoutingIntegrations(
        prisma,
        context.tenant.tenantId,
        [...workflowDestinationIntegrationIds, ...notificationIntegrationIds]
      );

      const ruleParameters =
        input.ruleParameters !== undefined
          ? input.ruleParameters
          : (existing.ruleParameters ?? {});

      const settings = await prisma.signalTriggerRoutingSettings.upsert({
        create: {
          defaultOwnerRole,
          enabled: input.enabled ?? existing.enabled,
          notificationIntegrationIds,
          ruleParameters: ruleParameters as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          workflowDestinationIntegrationIds
        },
        update: {
          defaultOwnerRole,
          enabled: input.enabled ?? existing.enabled,
          notificationIntegrationIds,
          ruleParameters: ruleParameters as Prisma.InputJsonValue,
          workflowDestinationIntegrationIds
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      await writeAuditEvent(prisma, {
        action: "tenant.updated",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          defaultOwnerRole: settings.defaultOwnerRole,
          enabled: settings.enabled,
          field: "signalTriggerRoutingSettings",
          notificationIntegrationIds: settings.notificationIntegrationIds,
          ruleParameters,
          workflowDestinationIntegrationIds:
            settings.workflowDestinationIntegrationIds
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeSignalTriggerRoutingSettings(settings);
    }
  };
}
