/**
 * P05-18: Sales / demo guardrails for offensive and simulation modules.
 *
 * Product-enforced honesty so SE demos cannot present fixture/sim output as
 * customer proof. Complements packages/modules fixture watermark helpers.
 */

import { PUBLIC_DEMO_TENANT_ID } from "./demo-snapshot";

export const DEMO_FIXTURE_WATERMARK = "DEMO FIXTURE — NOT CUSTOMER PROOF";

/** Known public / seed demo tenant ids (extend if more sample tenants ship). */
export const DEMO_TENANT_IDS = new Set<string>([PUBLIC_DEMO_TENANT_ID]);

export function isDemoTenantId(tenantId: string | null | undefined): boolean {
  if (!tenantId) return false;
  return DEMO_TENANT_IDS.has(tenantId);
}

/**
 * Prefix finding titles (and similar labels) so demo/fixture work cannot be
 * screenshotted as production validation proof.
 */
export function applyDemoFixtureWatermark(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return DEMO_FIXTURE_WATERMARK;
  }
  if (trimmed.includes(DEMO_FIXTURE_WATERMARK)) {
    return trimmed;
  }
  return `${DEMO_FIXTURE_WATERMARK}: ${trimmed}`;
}

/**
 * Feature tags that identify catalog-only / simulation modules. Production
 * tenants should hide these from launchable module pickers (P05-18).
 */
export const CATALOG_ONLY_SIM_FEATURE_TAGS = [
  "catalog-only",
  "planning-only",
  "simulation"
] as const;

export function isCatalogOnlySimulationModule(input: {
  featureTags?: readonly string[] | null;
  executionMode?: string | null;
}): boolean {
  const tags = input.featureTags ?? [];
  if (tags.some((tag) => (CATALOG_ONLY_SIM_FEATURE_TAGS as readonly string[]).includes(tag))) {
    return true;
  }
  // Planning-only execution modes never produce measured customer proof.
  if (input.executionMode === "PlanningOnly" || input.executionMode === "CatalogOnly") {
    return true;
  }
  return false;
}

/**
 * Whether a module should appear in the customer-facing launch catalog.
 * Demo tenants may show sims (watermarked). Production hides catalog-only sims.
 */
export function shouldShowModuleInCustomerCatalog(input: {
  tenantId?: string | null;
  featureTags?: readonly string[] | null;
  executionMode?: string | null;
  /** Explicit tenant flag for SE demo workspaces. */
  demoWorkspace?: boolean | null;
}): boolean {
  const demo =
    input.demoWorkspace === true || isDemoTenantId(input.tenantId ?? null);
  if (demo) {
    return true;
  }
  return !isCatalogOnlySimulationModule(input);
}
