import { z } from "zod";

import {
  RunnerHeartbeatSchema,
  RunnerRecordSchema,
  RunnerTaskRecordSchema,
  RunnerTaskStatusSchema
} from "./runner";

const IdSchema = z.uuid();
const TimestampSchema = z.iso.datetime();

export const RunnerFleetHealthStateSchema = z.enum([
  "Healthy",
  "Attention",
  "Offline",
  "Halted",
  "Revoked",
  "Provisioning"
]);

export const RunnerFleetAlertSchema = z.object({
  code: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["Critical", "Warning", "Info"]),
  title: z.string().min(1)
});

export const RunnerFleetPolicySchema = z.object({
  attentionAfterSeconds: z.number().int().min(30).max(3_600),
  certificateWarningDays: z.number().int().min(1).max(90),
  configured: z.boolean(),
  escalationReference: z.string().nullable(),
  minimumAgentVersion: z.string().nullable(),
  offlineAfterSeconds: z.number().int().min(60).max(86_400),
  queueWarningDepth: z.number().int().min(1).max(10_000),
  supportOwner: z.string().nullable(),
  updatedAt: TimestampSchema.nullable(),
  updatedBy: IdSchema.nullable()
});

export const UpdateRunnerFleetPolicyInputSchema = z
  .object({
    attentionAfterSeconds: z.number().int().min(30).max(3_600),
    certificateWarningDays: z.number().int().min(1).max(90),
    escalationReference: z.string().trim().min(3).max(240),
    minimumAgentVersion: z
      .string()
      .trim()
      .regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u)
      .nullable(),
    offlineAfterSeconds: z.number().int().min(60).max(86_400),
    queueWarningDepth: z.number().int().min(1).max(10_000),
    supportOwner: z.string().trim().min(3).max(160)
  })
  .strict()
  .refine((value) => value.offlineAfterSeconds > value.attentionAfterSeconds, {
    message: "Offline threshold must be later than the attention threshold.",
    path: ["offlineAfterSeconds"]
  });

export const RunnerHeartbeatSampleSchema = RunnerHeartbeatSchema.extend({
  heartbeatSampleId: IdSchema,
  receivedAt: TimestampSchema
});

export const RunnerFleetTaskCountsSchema = z.object({
  Accepted: z.number().int().nonnegative(),
  Cancelled: z.number().int().nonnegative(),
  Completed: z.number().int().nonnegative(),
  DeniedByLocalPolicy: z.number().int().nonnegative(),
  DeniedByServerPolicy: z.number().int().nonnegative(),
  Expired: z.number().int().nonnegative(),
  Failed: z.number().int().nonnegative(),
  Leased: z.number().int().nonnegative(),
  Queued: z.number().int().nonnegative(),
  Rejected: z.number().int().nonnegative(),
  Running: z.number().int().nonnegative()
});

export const RunnerFleetTaskSummarySchema = z.object({
  active: z.number().int().nonnegative(),
  completionRate24h: z.number().min(0).max(1).nullable(),
  counts: RunnerFleetTaskCountsSchema,
  denied24h: z.number().int().nonnegative(),
  evidence24h: z.number().int().nonnegative(),
  failed24h: z.number().int().nonnegative(),
  oldestQueuedSeconds: z.number().int().nonnegative().nullable(),
  p50DurationSeconds24h: z.number().int().nonnegative().nullable(),
  terminal24h: z.number().int().nonnegative()
});

/**
 * Tenant-scoped engine install posture projected next to runner health.
 * Install status today is control-plane / tool-governance policy (not a host
 * package inventory from the agent). Operators still need both: runner Online
 * AND engine Installed+enabled before nuclei/zap-class modules can run.
 */
export const RunnerEngineInstallReadinessSchema = z.object({
  enabled: z.boolean(),
  href: z.string().startsWith("/"),
  installStatus: z.string().min(1),
  ready: z.boolean(),
  runtimeAvailable: z.boolean(),
  toolId: z.string().min(1)
});

export const RunnerFleetRunnerSchema = z.object({
  alerts: z.array(RunnerFleetAlertSchema),
  certificateDaysRemaining: z.number().nullable(),
  /** Same tenant matrix on each runner card so UI can show engine readiness without a second fetch. */
  engineInstallReadiness: z.array(RunnerEngineInstallReadinessSchema).default([]),
  healthState: RunnerFleetHealthStateSchema,
  heartbeatAgeSeconds: z.number().int().nonnegative().nullable(),
  heartbeatSeries: z.array(RunnerHeartbeatSampleSchema),
  latestHeartbeat: RunnerHeartbeatSampleSchema.nullable(),
  recentTasks: z.array(RunnerTaskRecordSchema),
  runner: RunnerRecordSchema,
  taskSummary: RunnerFleetTaskSummarySchema,
  versionCompliant: z.boolean().nullable()
});

export const RunnerFleetSummarySchema = z.object({
  activeTasks: z.number().int().nonnegative(),
  attention: z.number().int().nonnegative(),
  completionRate24h: z.number().min(0).max(1).nullable(),
  evidence24h: z.number().int().nonnegative(),
  halted: z.number().int().nonnegative(),
  healthy: z.number().int().nonnegative(),
  offline: z.number().int().nonnegative(),
  revoked: z.number().int().nonnegative(),
  total: z.number().int().nonnegative()
});

export const RunnerFleetWorkspaceSchema = z.object({
  generatedAt: TimestampSchema,
  policy: RunnerFleetPolicySchema,
  runners: z.array(RunnerFleetRunnerSchema),
  rulesVersion: z.literal("1.0"),
  summary: RunnerFleetSummarySchema
});

export const RUNNER_FLEET_TASK_STATUSES = RunnerTaskStatusSchema.options;

export type RunnerFleetAlert = z.infer<typeof RunnerFleetAlertSchema>;
export type RunnerFleetHealthState = z.infer<
  typeof RunnerFleetHealthStateSchema
>;
export type RunnerFleetPolicy = z.infer<typeof RunnerFleetPolicySchema>;
export type RunnerFleetRunner = z.infer<typeof RunnerFleetRunnerSchema>;
export type RunnerFleetWorkspace = z.infer<typeof RunnerFleetWorkspaceSchema>;
export type RunnerHeartbeatSample = z.infer<typeof RunnerHeartbeatSampleSchema>;
export type UpdateRunnerFleetPolicyInput = z.infer<
  typeof UpdateRunnerFleetPolicyInputSchema
>;
