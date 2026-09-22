import {
  isBoundRunnerSiemModuleId,
  planOrExecuteSiemSync,
  type BoundRunnerSiemSyncOutcome
} from "@periscan/connectors/bound-runner-siem";
import {
  ModuleOutputSchema,
  type ModuleExecutionContext,
  type ModuleOutput
} from "@periscan/modules";
import type { EnterpriseSite } from "@periscan/shared";

export { isBoundRunnerSiemModuleId };

export async function executeBoundRunnerSiemModule(
  context: ModuleExecutionContext
): Promise<ModuleOutput> {
  const config =
    context.inputs.config && typeof context.inputs.config === "object"
      ? (context.inputs.config as Record<string, unknown>)
      : {};
  const sites = Array.isArray(context.inputs.sites)
    ? (context.inputs.sites as EnterpriseSite[])
    : [];

  const outcome = await planOrExecuteSiemSync({
    connectorKey: String(context.inputs.connectorKey ?? ""),
    context: {
      authType: String(context.inputs.authType ?? "apiToken"),
      config,
      integrationId: String(context.inputs.integrationId ?? ""),
      mockMode: context.inputs.mockMode === true,
      tenantId: context.tenantId
    },
    executionSide: "runner-agent",
    runnerId: context.runnerId ?? null,
    sites
  });

  return siemOutcomeToModuleOutput(outcome);
}

function siemOutcomeToModuleOutput(
  outcome: BoundRunnerSiemSyncOutcome
): ModuleOutput {
  const result = outcome.result;
  if (!result) {
    return ModuleOutputSchema.parse({
      errors: [outcome.decision.rationale],
      evidence: [],
      outcome: "unhealthy",
      signals: [],
      summary: outcome.decision.rationale,
      validationState: "RequiresInternalRunner"
    });
  }

  if (result.health.status === "Degraded") {
    return ModuleOutputSchema.parse({
      errors: [],
      evidence: [],
      outcome: "degraded",
      signals: [],
      summary: result.health.detail,
      validationState: "NoEvidence"
    });
  }

  if (result.health.status !== "Healthy") {
    return ModuleOutputSchema.parse({
      errors: [result.health.detail],
      evidence: [],
      outcome: "unhealthy",
      signals: [],
      summary: result.health.detail,
      validationState: "Inconclusive"
    });
  }

  const detected = result.signals.some((signal) =>
    /detection|alert/iu.test(signal.sourceType)
  );

  return ModuleOutputSchema.parse({
    errors: [],
    evidence: [],
    outcome: "synced",
    signals: result.signals,
    summary: result.health.detail,
    validationState: detected ? "Logged" : "NoEvidence"
  });
}
