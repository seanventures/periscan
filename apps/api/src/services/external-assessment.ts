import {
  EXTERNAL_ASSESSMENT_PRODUCT_COPY,
  ExternalAssessmentAttachScheduleInputSchema,
  ExternalAssessmentCompileInputSchema,
  ExternalAssessmentStartInputSchema,
  ExternalAssessmentToolOutputInputSchema,
  attachExternalAssessmentToSchedule,
  compileExternalAssessment,
  mapExternalAssessmentToolOutput,
  type ExternalAssessmentAttachScheduleResult,
  type ExternalAssessmentCompileResult,
  type ExternalAssessmentMappedResults,
  type ExternalAssessmentStartResult,
  type ExternalAssessmentToolOutputInput
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  SCOPE_EDITOR_ROLES,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const SAFE_REQUESTED_ACTION = {
  credentialTheft: false,
  destructive: false,
  persistence: false,
  realDataExfiltration: false,
  requiresInternalRunner: false,
  requiresTimeWindow: false,
  uncontrolledExploitChaining: false
} as const;

const POLICY_PROFILE = "internet-facing-assessment";

function denial(
  code: Extract<ExternalAssessmentCompileResult, { ok: false }>["code"]
): Extract<ExternalAssessmentCompileResult, { ok: false }> {
  return {
    code,
    executable: false,
    jobsQueued: 0,
    ok: false,
    startsJobs: false
  };
}

export function createExternalAssessmentServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "attachExternalAssessmentToSchedule"
  | "compileExternalAssessment"
  | "ingestExternalAssessmentResults"
  | "startExternalAssessment"
> {
  const { prisma } = deps;

  return {
    async compileExternalAssessment(context, rawInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "compile internet-facing assessments"
      );
      const input = ExternalAssessmentCompileInputSchema.parse(rawInput);
      return compileExternalAssessment(input);
    },

    async startExternalAssessment(this: AppServices, context, rawInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "start internet-facing assessments"
      );
      if (
        !rawInput ||
        typeof rawInput !== "object" ||
        (rawInput as { consent?: unknown }).consent !== true
      ) {
        throw new AppServiceError(
          "Consent is required before an internet-facing assessment can start.",
          400,
          "consent_required"
        );
      }

      const input = ExternalAssessmentStartInputSchema.parse(rawInput);
      const compiled = compileExternalAssessment({
        profileId: input.profileId,
        scopeId: input.scopeId
      });
      if (!compiled.ok) {
        return compiled;
      }

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId: input.scopeId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!scope) {
        return denial("scope_not_found");
      }
      if (
        scope.scopeType !== "Domain" ||
        scope.verificationStatus !== "Verified"
      ) {
        return denial("verified_domain_required");
      }

      const jobsByEnvironment = new Map<
        "ExternalPoA" | "ControlPlane",
        string[]
      >();
      for (const job of compiled.assessment.startJobs) {
        const current = jobsByEnvironment.get(job.executionEnvironment) ?? [];
        current.push(job.moduleId);
        jobsByEnvironment.set(job.executionEnvironment, current);
      }

      const missionIds: string[] = [];
      let jobsQueued = 0;

      for (const [executionEnvironment, moduleIds] of jobsByEnvironment) {
        const hostnameTarget = {
          hostname: scope.value,
          protocol: "https",
          templateProfile: compiled.assessment.templateProfile
        };
        const decision = await this.previewPolicyDecision(
          context,
          scope.scopeId,
          {
            executionEnvironment,
            explicitMissionApproval: false,
            missionType: "ExposureValidation",
            requestedAction: { ...SAFE_REQUESTED_ACTION },
            safetyLevel: "ActiveNonInvasive",
            target: hostnameTarget
          }
        );

        if (decision.outcome !== "Allowed") {
          return denial("verified_domain_required");
        }

        const mission = await this.createMission(context, {
          missionType: "ExposureValidation",
          policyDecisionId: decision.policyDecisionId,
          policyProfile: POLICY_PROFILE,
          safetyLevel: "ActiveNonInvasive",
          scopeId: scope.scopeId
        });

        const started = await this.startMission(context, mission.missionId, {
          moduleIds,
          target: hostnameTarget
        });
        missionIds.push(mission.missionId);
        jobsQueued += started.jobsQueued;
      }

      return {
        jobs: compiled.assessment.startJobs.map((job) => ({ ...job })),
        jobsQueued,
        liveAtomic: false,
        missionIds,
        ok: true,
        productCopy: EXTERNAL_ASSESSMENT_PRODUCT_COPY,
        runnerTasksQueued: 0
      } satisfies ExternalAssessmentStartResult;
    },

    async ingestExternalAssessmentResults(
      context,
      rawInput: ExternalAssessmentToolOutputInput
    ): Promise<ExternalAssessmentMappedResults> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "ingest internet-facing assessment results"
      );
      const input = ExternalAssessmentToolOutputInputSchema.parse(rawInput);
      return mapExternalAssessmentToolOutput(input);
    },

    async attachExternalAssessmentToSchedule(
      this: AppServices,
      context,
      rawInput
    ): Promise<ExternalAssessmentAttachScheduleResult> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "attach internet-facing assessments to schedules"
      );
      const input = ExternalAssessmentAttachScheduleInputSchema.parse(rawInput);
      const planned = attachExternalAssessmentToSchedule(input);
      if (!planned.ok) {
        return planned;
      }

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId: input.scopeId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!scope) {
        return denial("scope_not_found");
      }
      if (
        scope.scopeType !== "Domain" ||
        scope.verificationStatus !== "Verified"
      ) {
        return denial("verified_domain_required");
      }

      const schedule = await this.createSchedule(context, {
        config: {
          ...planned.schedule.config,
          audience: "Internet-facing assessment"
        },
        frequency: planned.schedule.frequency,
        missionType: "ContinuousValidation",
        scopeIds: [scope.scopeId]
      });

      return {
        ok: true,
        persisted: { scheduleId: schedule.scheduleId },
        schedule: planned.schedule
      };
    }
  };
}
