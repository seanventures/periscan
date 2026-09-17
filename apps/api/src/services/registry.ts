import { getConnectorCatalog } from "@periscan/connectors";
import {
  getOpenSourceToolCatalogEntryWithRuntime,
  listModuleManifests,
  listOpenSourceCapabilitiesWithRuntime,
  listOpenSourceToolCatalogWithRuntime
} from "@periscan/modules";
import { listOperatorProfiles } from "@periscan/operators";
import { listExternalValidationTemplateProfiles } from "@periscan/policy";
import {
  getAttackTechniqueById,
  listAttackTechniques as listAttackTechniqueCatalog
} from "@periscan/shared";
import type {
  OpenSourceCapability,
  OpenSourceToolCatalogEntry
} from "@periscan/shared";

// `AppServices` (type-only, erased at runtime) and `normalizeOpenSourceCatalogFilters`
// (a hoisted top-level function) are imported from runtime-services. The resulting
// import cycle is benign: the type import has no runtime effect, the helper is a
// hoisted function used only at call time, and this factory is invoked at runtime
// inside createRuntimeServices — never during module evaluation.
import { normalizeOpenSourceCatalogFilters } from "../runtime-services.js";
import type { AppServices } from "../runtime-services.js";

function serializeOpenSourcePhase(phase: OpenSourceCapability["phase"]) {
  return phase === "CurrentMvp" ? "Current" : phase;
}

function serializeOpenSourceCapability(
  capability: OpenSourceCapability
): OpenSourceCapability {
  return {
    ...capability,
    phase: serializeOpenSourcePhase(capability.phase)
  };
}

function serializeOpenSourceToolCatalogEntry(
  entry: OpenSourceToolCatalogEntry
): OpenSourceToolCatalogEntry {
  return {
    ...entry,
    capabilities: entry.capabilities.map(serializeOpenSourceCapability),
    tool: {
      ...entry.tool,
      phase: serializeOpenSourcePhase(entry.tool.phase)
    }
  };
}

// First extracted slice of the createRuntimeServices god-closure (D1 Phase 2):
// stateless registry/catalog lookups. They need no closed-over deps, so the
// factory takes none; later domain factories receive a shared RuntimeServiceDeps.
export function createRegistryServices(): Pick<
  AppServices,
  | "getAttackTechnique"
  | "getExternalValidationProfiles"
  | "getIntegrationCatalog"
  | "getModuleCatalog"
  | "getOpenSourceCapabilities"
  | "getOpenSourceTool"
  | "getOpenSourceToolCatalog"
  | "getOperatorProfiles"
  | "listAttackTechniques"
> {
  return {
    async getIntegrationCatalog() {
      return getConnectorCatalog();
    },

    async getModuleCatalog() {
      return listModuleManifests();
    },

    async getExternalValidationProfiles() {
      return listExternalValidationTemplateProfiles();
    },

    async getOpenSourceCapabilities(filters) {
      const capabilities = await listOpenSourceCapabilitiesWithRuntime(
        normalizeOpenSourceCatalogFilters(filters)
      );

      return capabilities.map(serializeOpenSourceCapability);
    },

    async getOpenSourceTool(toolId) {
      const entry = await getOpenSourceToolCatalogEntryWithRuntime(toolId);

      return entry ? serializeOpenSourceToolCatalogEntry(entry) : null;
    },

    async getOpenSourceToolCatalog(filters) {
      const entries = await listOpenSourceToolCatalogWithRuntime(
        normalizeOpenSourceCatalogFilters(filters)
      );

      return entries.map(serializeOpenSourceToolCatalogEntry);
    },

    async getAttackTechnique(techniqueId) {
      return getAttackTechniqueById(techniqueId);
    },

    async listAttackTechniques() {
      return listAttackTechniqueCatalog();
    },

    async getOperatorProfiles() {
      return listOperatorProfiles();
    }
  };
}
