import { serializeScope } from "../serializers/entities.js";
import { listExternalValidationTemplateProfiles } from "@periscan/policy";
import {
  AppServiceError,
  buildVerificationMethod,
  createScopeVerificationToken,
  executeInlineValidation,
  MEASURED_POSTURE_MODULE_IDS,
  requireRole,
  SCOPE_EDITOR_ROLES,
  TENANT_ADMIN_ROLES,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

// Scope management service group (D1 Phase 2 closure decomposition). Scope
// verification (verifyScope) stays with the validation/mission slice. Pure reads
// plus audited create/delete using only `prisma` from the shared deps.
export function createScopeServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "createScope"
  | "deleteScope"
  | "getScope"
  | "listScopes"
  | "runDuePostureChecks"
  | "runScopePostureChecks"
  | "updateScopeClassification"
> {
  const { devMode, prisma } = deps;
  const externalValidationProfiles = new Set<string>(
    listExternalValidationTemplateProfiles().map((profile) => profile.profile)
  );

  function assertKnownExternalValidationProfile(profile: string | null) {
    if (profile !== null && !externalValidationProfiles.has(profile)) {
      throw new AppServiceError(
        "Unknown external-validation profile.",
        400,
        "invalid_external_validation_profile"
      );
    }
  }

  const postureCheckIntervalMs = (() => {
    const raw = Number.parseInt(
      process.env.PERISCAN_POSTURE_CHECK_INTERVAL_MS ?? "",
      10
    );

    return Number.isFinite(raw) && raw > 0 ? raw : 24 * 60 * 60 * 1000;
  })();

  // Run every built-in measured module against one verified scope, persist the
  // measured signals/evidence (executeInlineValidation), and advance the
  // posture-check cadence. Shared by the manual endpoint and the continuous
  // sweep. useFixture is dev-only — production always runs live so results can
  // never be fabricated.
  async function runPostureModulesForScope(
    context: Parameters<AppServices["runScopePostureChecks"]>[0],
    scope: { scopeId: string; value: string },
    useFixture: boolean,
    fixtures?: Record<string, Record<string, unknown>>
  ) {
    // Continuous-loop lab (infra/lab): map published host ports so LiveSafe
    // posture works without /etc/hosts when PERISCAN_LAB_MODE=1.
    const labUrlForScope = (() => {
      if (process.env.PERISCAN_LAB_MODE !== "1") {
        return null;
      }
      if (!scope.value.endsWith(".lab.range.test")) {
        return null;
      }
      const tier = scope.value.split(".")[0] ?? "";
      const ports: Record<string, number> = {
        edge: 8081,
        app: 8082,
        data: 8083
      };
      const port = ports[tier];
      return port ? `http://127.0.0.1:${port}/health` : null;
    })();

    const checks = await Promise.all(
      MEASURED_POSTURE_MODULE_IDS.map(async (moduleId) => {
        const fixtureTarget = useFixture
          ? { fixtureMode: true, ...(fixtures?.[moduleId] ?? {}) }
          : {};
        const result = await executeInlineValidation({
          adminApproval: TENANT_ADMIN_ROLES.has(context.membership.role),
          context,
          executionEnvironment: "ControlPlane",
          explicitMissionApproval: true,
          missionType: "ExposureValidation",
          moduleId,
          prisma,
          scopeId: scope.scopeId,
          target: {
            hostname: scope.value,
            ...(labUrlForScope
              ? { url: labUrlForScope, protocol: "http" as const }
              : {}),
            ...fixtureTarget
          }
        });

        return {
          // "exposure" means a measured EXPOSURE was found — not merely that a
          // signal was emitted. Informational ControlObservation signals (e.g. a
          // published security.txt) must NOT be counted as exposures.
          exposure: result.signals.some(
            (signal) => signal.signalCategory === "Exposure"
          ),
          moduleId,
          outcome: result.run.outcome ?? "unknown",
          signalCount: result.signals.length,
          validationState: result.run.validationState ?? null
        };
      })
    );

    const now = new Date();
    await prisma.scope.update({
      data: {
        lastPostureCheckAt: now,
        nextPostureCheckAt: new Date(now.getTime() + postureCheckIntervalMs)
      },
      where: { scopeId: scope.scopeId }
    });

    return checks;
  }

  return {
    async listScopes(context) {
      const scopes = await prisma.scope.findMany({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return scopes.map(serializeScope);
    },

    async getScope(context, scopeId) {
      const scope = await prisma.scope.findFirst({
        where: {
          scopeId,
          tenantId: context.tenant.tenantId
        }
      });

      return scope ? serializeScope(scope) : null;
    },

    async deleteScope(context, scopeId) {
      requireRole(context.membership.role, SCOPE_EDITOR_ROLES, "delete scopes");

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }

      await prisma.scope.delete({
        where: {
          scopeId: scope.scopeId
        }
      });

      await writeAuditEvent(prisma, {
        action: "scope.deleted",
        actorType: "User",
        entityId: scope.scopeId,
        entityType: "Scope",
        metadata: {
          deleted: true,
          scopeType: scope.scopeType,
          value: scope.value
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
    },

    async createScope(context, input) {
      requireRole(context.membership.role, SCOPE_EDITOR_ROLES, "create scopes");
      assertKnownExternalValidationProfile(input.externalValidationProfileId);

      const scope = await prisma.scope.create({
        data: {
          assetClass: input.assetClass,
          businessCriticality: input.businessCriticality,
          createdBy: context.user.userId,
          externalValidationProfileId: input.externalValidationProfileId,
          maxSafetyLevel: input.maxSafetyLevel,
          purdueLevel: input.purdueLevel,
          scopeType: input.scopeType,
          segmentName: input.segmentName,
          sensitivity: input.sensitivity,
          tags: input.tags,
          tenantId: context.tenant.tenantId,
          value: input.value,
          verificationMethod: buildVerificationMethod(input.scopeType),
          verificationStatus: "Pending",
          verificationToken: createScopeVerificationToken()
        }
      });

      await writeAuditEvent(prisma, {
        action: "scope.created",
        actorType: "User",
        entityId: scope.scopeId,
        entityType: "Scope",
        metadata: {
          assetClass: scope.assetClass,
          businessCriticality: scope.businessCriticality,
          maxSafetyLevel: scope.maxSafetyLevel,
          purdueLevel: scope.purdueLevel,
          scopeType: scope.scopeType,
          segmentName: scope.segmentName,
          sensitivity: scope.sensitivity,
          tags: scope.tags,
          value: scope.value
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeScope(scope);
    },

    async updateScopeClassification(context, scopeId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "update scope classification"
      );

      const scope = await prisma.scope.findFirst({
        where: { scopeId, tenantId: context.tenant.tenantId }
      });
      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }

      if (input.externalValidationProfileId !== undefined) {
        assertKnownExternalValidationProfile(
          input.externalValidationProfileId
        );
      }

      const updated = await prisma.scope.update({
        data: input,
        where: { scopeId: scope.scopeId }
      });

      await writeAuditEvent(prisma, {
        action: "scope.classification_updated",
        actorType: "User",
        entityId: scope.scopeId,
        entityType: "Scope",
        metadata: {
          after: serializeScope(updated),
          before: serializeScope(scope)
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeScope(updated);
    },

    async runScopePostureChecks(context, scopeId, input = {}) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "run scope posture checks"
      );

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }
      if (scope.verificationStatus !== "Verified") {
        throw new AppServiceError(
          "Posture checks require a verified scope.",
          400,
          "verified_scope_required"
        );
      }
      if (scope.scopeType !== "Domain" && scope.scopeType !== "Subdomain") {
        throw new AppServiceError(
          "Posture checks apply to Domain or Subdomain scopes.",
          400,
          "unsupported_scope_type"
        );
      }

      // Fixture mode is a dev-only convenience for deterministic testing. In
      // production, reject fixture requests explicitly rather than silently
      // treating them as live checks; API clients must know which evidence mode
      // produced a posture result.
      const fixtureRequested =
        input.executionMode === "Fixture" || Boolean(input.fixtures);
      if (fixtureRequested && !devMode) {
        throw new AppServiceError(
          "Fixture posture checks are only available in dev mode.",
          400,
          "fixture_mode_disabled"
        );
      }

      const useFixture = devMode && input.executionMode !== "LiveSafe";
      const checks = await runPostureModulesForScope(
        context,
        scope,
        useFixture,
        input.fixtures
      );

      return { checks, scopeId };
    },

    async runDuePostureChecks(context) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "run due posture checks"
      );

      const now = new Date();
      // Verified external scopes whose posture check is DUE. A null
      // nextPostureCheckAt means the scope is not enrolled in continuous posture
      // monitoring (it enrolls the first time a posture check runs), so we never
      // retroactively stampede every existing scope. Bounded per tick; the
      // precise nextPostureCheckAt index keeps this a due-work-only query.
      const dueScopes = await prisma.scope.findMany({
        orderBy: { nextPostureCheckAt: "asc" },
        take: 25,
        where: {
          nextPostureCheckAt: { lte: now },
          scopeType: { in: ["Domain", "Subdomain"] },
          tenantId: context.tenant.tenantId,
          verificationStatus: "Verified"
        }
      });

      let postureChecksRun = 0;
      for (const scope of dueScopes) {
        // Auto path: live in production, fixture in devMode (so the sweep test
        // never touches the network). No caller-supplied fixtures.
        await runPostureModulesForScope(context, scope, devMode);
        postureChecksRun += 1;
      }

      return { postureChecksRun };
    }
  };
}
