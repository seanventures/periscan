import { z } from "zod";

export const EnterpriseReadinessStateSchema = z.enum([
  "Operational",
  "Configurable",
  "ExternallyGated"
]);

export const EnterpriseReadinessCheckStateSchema = z.enum([
  "Satisfied",
  "ActionRequired",
  "ExternalDependency"
]);

export const EnterpriseReadinessCheckSchema = z.object({
  actionHref: z.string().nullable(),
  detail: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  state: EnterpriseReadinessCheckStateSchema
});

export const EnterpriseBreadthPackSchema = z.object({
  description: z.string().min(1),
  key: z.string().min(1),
  name: z.string().min(1),
  state: EnterpriseReadinessStateSchema,
  checks: z.array(EnterpriseReadinessCheckSchema).min(1)
});

export const EnterpriseBreadthReadinessSchema = z.object({
  generatedAt: z.iso.datetime(),
  packs: z.array(EnterpriseBreadthPackSchema).min(1)
});

export type EnterpriseBreadthReadiness = z.infer<
  typeof EnterpriseBreadthReadinessSchema
>;
export type EnterpriseBreadthPack = z.infer<typeof EnterpriseBreadthPackSchema>;
export type EnterpriseReadinessCheck = z.infer<
  typeof EnterpriseReadinessCheckSchema
>;
