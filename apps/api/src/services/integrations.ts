import type { Prisma } from "@prisma/client";

import {
  getConnectorByKey,
  getConnectorCatalogEntryByKey
} from "@periscan/connectors";

import {
  AppServiceError,
  calculateNextRunAt,
  getConnectorKey,
  INTEGRATION_EDITOR_ROLES,
  isMockMode,
  requireRole,
  serializeIntegration,
  syncPersistedIntegration,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";
import {
  decryptIntegrationConfig,
  encryptIntegrationConfig,
  integrationSecretFieldKeys
} from "../integration-credentials.js";

function connectorFieldIsMissing(value: unknown) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

// Integration (connector) management service group (D1 Phase 2 closure
// decomposition). The heavy sync logic lives in the top-level
// syncPersistedIntegration helper; these methods are thin orchestration over it
// plus connector manifest resolution.
export function createIntegrationServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "createIntegration"
  | "deleteIntegration"
  | "getIntegration"
  | "getIntegrationHealth"
  | "listIntegrations"
  | "runDueIntegrationSyncs"
  | "setIntegrationSyncSchedule"
  | "syncIntegration"
> {
  const { devMode, prisma } = deps;

  return {
    async setIntegrationSyncSchedule(context, integrationId, input) {
      requireRole(
        context.membership.role,
        INTEGRATION_EDITOR_ROLES,
        "schedule integration syncs"
      );

      const integration = await prisma.integration.findFirst({
        where: {
          integrationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!integration) {
        throw new AppServiceError(
          "Integration not found.",
          404,
          "integration_not_found"
        );
      }

      const frequency = input.frequency ?? null;
      const updated = await prisma.integration.update({
        data: {
          nextSyncAt: frequency
            ? calculateNextRunAt(frequency, new Date())
            : null,
          syncFrequency: frequency
        },
        where: {
          integrationId: integration.integrationId
        }
      });

      return serializeIntegration(updated);
    },

    // Sync every Connected integration whose recurring schedule is due. Intended
    // to be invoked by an external scheduler/cron (continuous validation), the
    // same pattern as runDueSchedules + the threat-feed ingestion trigger.
    async runDueIntegrationSyncs(context) {
      requireRole(
        context.membership.role,
        INTEGRATION_EDITOR_ROLES,
        "run due integration syncs"
      );

      const ranAt = new Date();
      const due = await prisma.integration.findMany({
        orderBy: {
          nextSyncAt: "asc"
        },
        take: 50,
        where: {
          nextSyncAt: {
            lte: ranAt
          },
          status: "Connected",
          syncFrequency: {
            not: null
          },
          tenantId: context.tenant.tenantId
        }
      });

      const integrationIds: string[] = [];
      for (const integration of due) {
        const connectorKey = getConnectorKey(integration.config);
        const connector = connectorKey ? getConnectorByKey(connectorKey) : null;
        if (!connector) {
          continue;
        }
        try {
          // syncPersistedIntegration records its own audit/health on failure.
          await syncPersistedIntegration({
            actorType: "System",
            connector,
            integration,
            prisma
          });
        } catch {
          // Continue advancing the schedule even if one connector errors.
        }
        await prisma.integration.update({
          data: {
            nextSyncAt: integration.syncFrequency
              ? calculateNextRunAt(integration.syncFrequency, ranAt)
              : null
          },
          where: {
            integrationId: integration.integrationId
          }
        });
        integrationIds.push(integration.integrationId);
      }

      return {
        integrationIds,
        ranAt: ranAt.toISOString(),
        syncedCount: integrationIds.length
      };
    },
    async listIntegrations(context) {
      const integrations = await prisma.integration.findMany({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return integrations.map(serializeIntegration);
    },

    async getIntegration(context, integrationId) {
      const integration = await prisma.integration.findFirst({
        where: {
          integrationId,
          tenantId: context.tenant.tenantId
        }
      });

      return integration ? serializeIntegration(integration) : null;
    },

    async createIntegration(context, input) {
      requireRole(
        context.membership.role,
        INTEGRATION_EDITOR_ROLES,
        "create integrations"
      );

      const manifest = getConnectorByKey(input.connectorKey);
      const catalogEntry = getConnectorCatalogEntryByKey(input.connectorKey);

      if (!manifest) {
        throw new AppServiceError(
          "Connector manifest not found.",
          404,
          "connector_not_found"
        );
      }

      if (
        !catalogEntry ||
        catalogEntry.executionReadiness !== "ReadyForCredentials" ||
        !catalogEntry.connectable
      ) {
        throw new AppServiceError(
          catalogEntry?.executionReadinessReason ??
            "Connector is listed in the marketplace but is not connectable yet.",
          400,
          "connector_not_connectable"
        );
      }

      const selectedAuthType =
        input.authType ?? manifest.manifest.authMethods[0]?.kind;

      if (!selectedAuthType) {
        throw new AppServiceError(
          "Connector manifest does not expose an auth method.",
          400,
          "auth_type_missing"
        );
      }

      if (
        !manifest.manifest.authMethods.some(
          (authMethod) => authMethod.kind === selectedAuthType
        )
      ) {
        throw new AppServiceError(
          "Unsupported auth type for connector.",
          400,
          "invalid_auth_type"
        );
      }
      const selectedAuthMethod = manifest.manifest.authMethods.find(
        (authMethod) => authMethod.kind === selectedAuthType
      )!;
      const missingRequiredFields = selectedAuthMethod.fields
        .filter((field) => field.required)
        .filter((field) => connectorFieldIsMissing(input.config?.[field.key]))
        .map((field) => field.label);
      if (missingRequiredFields.length > 0) {
        throw new AppServiceError(
          `Missing required connector configuration: ${missingRequiredFields.join(", ")}.`,
          400,
          "connector_config_incomplete"
        );
      }
      if (
        (input.mockMode === true || selectedAuthType === "mock") &&
        !devMode
      ) {
        throw new AppServiceError(
          "Mock integrations are only available in dev mode.",
          400,
          "fixture_mode_disabled"
        );
      }

      const integrationConfig = encryptIntegrationConfig(
        {
          ...(input.config ?? {}),
          connectorKey: manifest.manifest.connectorKey,
          mockMode: input.mockMode ?? selectedAuthType === "mock"
        },
        integrationSecretFieldKeys(manifest, selectedAuthType)
      );
      const integration = await prisma.integration.create({
        data: {
          authType: selectedAuthType,
          category: manifest.manifest.category,
          config: integrationConfig as Prisma.InputJsonValue,
          healthStatus: "Unknown",
          permissionsSummary: {
            connectorKey: manifest.manifest.connectorKey,
            dedicatedClient: catalogEntry?.dedicatedClient ?? null,
            executionReadiness: catalogEntry?.executionReadiness ?? null,
            executionReadinessReason:
              catalogEntry?.executionReadinessReason ?? null,
            implementationTier: catalogEntry?.implementationTier ?? null,
            live: catalogEntry?.live ?? null,
            requiredPermissions: manifest.manifest.requiredPermissions
          } as Prisma.InputJsonValue,
          product: manifest.manifest.product,
          // A dev-only mock is locally verifiable at creation time. Real
          // credentials remain Created until an explicit health check proves
          // authorization and promotes the integration to Connected.
          status:
            input.mockMode === true || selectedAuthType === "mock"
              ? "Connected"
              : "Created",
          tenantId: context.tenant.tenantId,
          vendor: manifest.manifest.vendor
        }
      });

      await writeAuditEvent(prisma, {
        action: "integration.connected",
        actorType: "User",
        entityId: integration.integrationId,
        entityType: "Integration",
        metadata: {
          connectorKey: manifest.manifest.connectorKey,
          product: integration.product
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeIntegration(integration);
    },

    async getIntegrationHealth(context, integrationId) {
      const integration = await prisma.integration.findFirst({
        where: {
          integrationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!integration) {
        throw new AppServiceError(
          "Integration not found.",
          404,
          "integration_not_found"
        );
      }

      const connectorKey = getConnectorKey(integration.config);
      const connector = connectorKey ? getConnectorByKey(connectorKey) : null;

      if (!connector) {
        throw new AppServiceError(
          "Connector manifest not found for this integration.",
          404,
          "connector_not_found"
        );
      }

      const health = await connector.healthCheck({
        authType: integration.authType,
        config: decryptIntegrationConfig(
          integration.config,
          integrationSecretFieldKeys(connector, integration.authType)
        ),
        integrationId: integration.integrationId,
        mockMode: isMockMode(integration.config),
        tenantId: integration.tenantId
      });

      const updatedIntegration = await prisma.integration.update({
        where: {
          integrationId: integration.integrationId
        },
        data: {
          healthStatus: health.status,
          status:
            health.status === "Unhealthy" || !health.authorizationVerified
              ? "Error"
              : "Connected"
        }
      });

      return {
        health,
        integration: serializeIntegration(updatedIntegration),
        manifest: connector.manifest
      };
    },

    async syncIntegration(context, integrationId) {
      requireRole(
        context.membership.role,
        INTEGRATION_EDITOR_ROLES,
        "sync integrations"
      );

      const integration = await prisma.integration.findFirst({
        where: {
          integrationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!integration) {
        throw new AppServiceError(
          "Integration not found.",
          404,
          "integration_not_found"
        );
      }

      const connectorKey = getConnectorKey(integration.config);
      const connector = connectorKey ? getConnectorByKey(connectorKey) : null;

      if (!connector) {
        throw new AppServiceError(
          "Connector manifest not found for this integration.",
          404,
          "connector_not_found"
        );
      }

      return syncPersistedIntegration({
        actorType: "User",
        actorUserId: context.user.userId,
        connector,
        integration,
        prisma
      });
    },

    async deleteIntegration(context, integrationId) {
      requireRole(
        context.membership.role,
        INTEGRATION_EDITOR_ROLES,
        "delete integrations"
      );

      const integration = await prisma.integration.findFirst({
        where: {
          integrationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!integration) {
        throw new AppServiceError(
          "Integration not found.",
          404,
          "integration_not_found"
        );
      }

      await prisma.integration.delete({
        where: {
          integrationId: integration.integrationId
        }
      });

      await writeAuditEvent(prisma, {
        action: "integration.disconnected",
        actorType: "User",
        entityId: integration.integrationId,
        entityType: "Integration",
        metadata: {
          product: integration.product
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
    }
  };
}
