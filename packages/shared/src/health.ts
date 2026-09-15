import { z } from "zod";

export const HealthResponseSchema = z.object({
  service: z.literal("api"),
  status: z.literal("ok"),
  timestamp: z.string().datetime()
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const MetricsResponseSchema = z.object({
  // Observability for the continuous-validation sweep: the most recent run's
  // outcome counts so operators can confirm the loop is running and healthy
  // (null until the first sweep, e.g. in tests where the scheduler is off).
  lastValidationSweep: z
    .object({
      failures: z.number().int().nonnegative(),
      // Per-runner failure attribution so operators see WHICH due-runner is
      // failing, not just an opaque total.
      failuresByRunner: z.object({
        context: z.number().int().nonnegative(),
        integrationSync: z.number().int().nonnegative(),
        posture: z.number().int().nonnegative(),
        reverification: z.number().int().nonnegative(),
        schedules: z.number().int().nonnegative(),
        threatFeed: z.number().int().nonnegative()
      }),
      integrationsSynced: z.number().int().nonnegative(),
      postureChecksRun: z.number().int().nonnegative(),
      ranAt: z.string().datetime(),
      reverified: z.number().int().nonnegative(),
      schedulesRun: z.number().int().nonnegative(),
      tenantsSwept: z.number().int().nonnegative(),
      threatFeedsIngested: z.number().int().nonnegative()
    })
    .nullish(),
  memory: z.object({
    heapTotal: z.number(),
    heapUsed: z.number(),
    rss: z.number()
  }),
  node: z.string(),
  pid: z.number(),
  service: z.literal("api"),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number().int().nonnegative()
});

export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;

export const DependencyCheckStatusSchema = z.enum([
  "ok",
  "degraded",
  "down",
  "skipped"
]);

export const DependencyCheckSchema = z.object({
  name: z.string().min(1),
  status: DependencyCheckStatusSchema,
  detail: z.string().nullable(),
  latencyMs: z.number().nonnegative().nullable()
});

export const ReadinessResponseSchema = z.object({
  service: z.literal("api"),
  status: z.enum(["ready", "not_ready"]),
  timestamp: z.string().datetime(),
  checks: z.array(DependencyCheckSchema)
});

export type DependencyCheckStatus = z.infer<typeof DependencyCheckStatusSchema>;
export type DependencyCheck = z.infer<typeof DependencyCheckSchema>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;

export const DeploymentConfigItemSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  category: z.enum(["Security", "Reliability", "Observability", "Compliance"]),
  configured: z.boolean(),
  required: z.boolean(),
  value: z.string().nullable()
});

export const DeploymentStatusResponseSchema = z.object({
  environment: z.string().min(1),
  generatedAt: z.string().datetime(),
  ready: z.boolean(),
  missingRequired: z.array(z.string()),
  items: z.array(DeploymentConfigItemSchema)
});

export type DeploymentConfigItem = z.infer<typeof DeploymentConfigItemSchema>;
export type DeploymentStatusResponse = z.infer<
  typeof DeploymentStatusResponseSchema
>;
